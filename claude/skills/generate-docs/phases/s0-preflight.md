# Stage 0 — PREFLIGHT

**Predecessor**: pipeline invocation (`/generate-docs <targets>`)
**Successor**: Stage 1 — Discovery
**Goal**: Establish foundation. No analysis yet. Just verify environment, resolve paths, route to Path A vs B.
**Gate 0**: All preflight checks pass → enter Stage 1. Any blocker → STOP, ask user.

---

## Sub-steps

### 0.0 — Intel contract gate (CD-10) — RUN FIRST

Canonical intel layer at `{workspace}/docs/intel/` is the source of truth for roles, routes, permissions, features, and test accounts. This skill is a **consumer** and MUST NOT re-discover when intel exists.

```
INTEL_DIR="docs/intel"
REQUIRED=(actor-registry.json permission-matrix.json sitemap.json feature-catalog.json)
OPTIONAL=(test-accounts.json)

missing=()
stale=()
for art in "${REQUIRED[@]}"; do
  [[ ! -f "$INTEL_DIR/$art" ]] && missing+=("$art") && continue
  python ~/.claude/scripts/intel/meta_helper.py is-fresh "$INTEL_DIR" "$art" || stale+=("$art")
done
```

**Decision matrix:**

| State | Action |
|---|---|
| All REQUIRED fresh | ✓ Proceed to 0.1. Cache intel into memory; downstream stages READ-ONLY. |
| Any REQUIRED missing | **BLOCK**. Print: `intel-missing: <file>`. Suggest `/from-code` (Path B) or `/from-doc` then `/from-code` (Path A→B). Do NOT fall back to in-skill discovery. |
| Any REQUIRED stale | Ask user: `[r]egenerate via /from-code, [u]se anyway (will tag drift in output), [c]ancel`. |
| `test-accounts.json` missing | **WARN only** if HDSD in targets. Step 0.5 will collect interactively + offer to persist back to intel. |
| `test-accounts.json` present, `storage=inline`, `gitignore_verified=false` | **BLOCK**. Force user to add file to `.gitignore`, then re-run. |

**Anti-pattern (FORBIDDEN):** silently re-deriving roles/routes/permissions from codebase when canonical intel is missing. That is what creates the drift between `from-doc` / `from-code` / `resume-feature` / `generate-docs`. Block early, fail loudly.

**Legacy fallback (one release only):** if `docs/intel/` empty BUT `docs/generated/{slug}/intel/` populated → migrate per `INTEL_INTEGRATION.md § Path migration`, then re-run gate. After migration window, remove this fallback.

### 0.1 — Slug + DOCS_PATH resolution

Auto-detect project slug from git remote → package.json → pyproject.toml → go.mod → cwd basename.

```bash
# Slug derivation logic — see SKILL.md § Pre-flight detail
SLUG=$(detect_slug)
export DOCS_PATH="docs/generated/${SLUG}"
mkdir -p "$DOCS_PATH"/{intel,screenshots,output,output/diagrams}
echo "📂 DOCS_PATH = $DOCS_PATH"
```

**Output**: `$DOCS_PATH` env var (used by all subsequent stages)

### 0.1.5 — etc-docgen v2.0.0 architecture: small JSON via MCP, bytes via HTTP

`etc-docgen` v2.0.0 splits the wire protocol by payload size:

* **MCP tools** carry only short JSON (schema, partial blocks, validation reports, ids).
  The agent context never holds a full `content_data` dict.
* **HTTP endpoints** carry bytes (uploads + rendered Office files). The agent invokes
  them via `Bash` + `curl`, so bytes never enter the LLM token stream.

**Tool signatures** (v2.0.0+):

```python
# ── Small-JSON tools (MCP) — same as v1, used during writing ──
mcp__etc-platform__section_schema(doc_type: str)
  → {primary_schema, support_schemas, minimums, banned_phrases, ...}

mcp__etc-platform__merge_content(current_data: dict, partial: dict, auto_validate: bool = True)
  → {merged_data: dict, validation: {valid, errors, warnings, dod_met, ...}}

mcp__etc-platform__validate(content_data: dict)            # only for skeletons / small dicts
  → {valid, errors, warnings, stats}

# ── Async export tools (MCP) — used only at Stage 6 ──
mcp__etc-platform__validate_uploaded(upload_id: str)
  → {valid, errors, warnings, stats, elapsed_s}

mcp__etc-platform__export_async(
    upload_id: str,
    targets: list[str] | None = None,
    auto_render_mermaid: bool = True,
    label: str | None = None,
)
  → {success, job_id, status, targets, expires_at, ...}

mcp__etc-platform__job_status(job_id: str)
  → {status, outputs: [{target, filename, download_url, size_bytes, sha256}], error}

mcp__etc-platform__cancel_job(job_id: str)
  → {success, status}

mcp__etc-platform__upload_capacity()
  → {ready, storage{}, runner{queue_size, inflight, workers, queue_max}}
```

**HTTP endpoints** (out-of-band — call via `Bash`/`curl`):

```
POST   {ETC_URL}/uploads                        multipart, file=@content-data.json
GET    {ETC_URL}/uploads/{upload_id}            metadata
DELETE {ETC_URL}/uploads/{upload_id}
POST   {ETC_URL}/jobs                            JSON {upload_id, targets, ...}
GET    {ETC_URL}/jobs/{job_id}                   poll status
GET    {ETC_URL}/jobs/{job_id}/files/{filename}  download rendered output
DELETE {ETC_URL}/jobs/{job_id}
GET    {ETC_URL}/healthz                         liveness
GET    {ETC_URL}/readyz                          readiness + runner stats
```

`ETC_URL` defaults to `http://localhost:8001`. Optional `X-API-Key` header
when `ETC_DOCGEN_API_KEY` is set on the server.

**Token economics**:

| Phase                     | Inline (deprecated) | Job-based (current) |
|---------------------------|---------------------|---------------------|
| Upload payload to server  | ~50K output tokens  | 0 (curl)            |
| Job creation              | n/a                 | ~30                 |
| Status poll (per check)   | n/a                 | ~30                 |
| Outputs returned          | ~70K output tokens  | 0 (curl)            |
| **Per export**            | **~120K**           | **~80**             |

**Size limits**:
- Single upload: 10 MB default (env `ETC_DOCGEN_MAX_UPLOAD_BYTES`)
- Job output: bounded only by disk; downloads stream
- Inline `validate(content_data=…)`: keep dict ≤ 50 KB; for larger, prefer
  upload + `validate_uploaded(upload_id)`

**Deprecated**: `mcp__etc-platform__export(content_data=…)` — kept for back-compat
on tiny demos but blows the LLM output token budget on real projects. New code
paths MUST use the upload + `export_async` flow.

### 0.2 — MCP health probe

```bash
# Resolve MCP_URL from ~/.cursor/mcp.json or ~/.vscode/mcp.json (NOT hardcoded)
code=$(curl.exe -s -o /dev/null -w "%{http_code}" --max-time 2 "$MCP_URL" 2>/dev/null)
[[ "$code" == "200" ]] && echo "MCP ✓" || echo "MCP ✗ ($code)"
```

If MCP down → BLOCK (Gate 0 fails). User starts container, retries. Pipeline does NOT fall back to Python rendering.

### 0.3 — Path detection (A vs B vs hybrid)

Score 5 doc-coverage signals:
1. README.md + ARCHITECTURE.md exist
2. docs/adr/ ≥ 3 ADR files
3. docs/features/ has feature specs
4. docs/business-flows.md or equivalent
5. docs/security-*.md or docs/data-model.md

| Score | Route | Stage 1 producer |
|---|---|---|
| ≥ 4/5 | **Path A (doc-driven)** — preferred | doc-intel agent reads `docs/source/` |
| 2-3/5 | **Path AB (hybrid)** — both paths | doc-intel + tdoc-researcher in parallel |
| ≤ 1/5 | **Path B (code-driven)** — fallback | tdoc-researcher scans codebase |

### 0.4 — Resume detection

Check existing artifacts on disk to enable partial resume:

```python
existing = {
  "stage1": exists(f"{DOCS_PATH}/intel/actor-registry.json")
            and exists(f"{DOCS_PATH}/intel/system-inventory.json"),
  "stage2": exists(f"{DOCS_PATH}/intel/feature-catalog.json")
            and exists(f"{DOCS_PATH}/intel/sitemap.json")
            and exists(f"{DOCS_PATH}/intel/code-facts.json"),
  "stage3": exists(f"{DOCS_PATH}/intel/screenshot-map.json")
            and exists(f"{DOCS_PATH}/intel/screenshot-validation.json"),
  "stage4": exists(f"{DOCS_PATH}/output/content-data.json"),
  "stage5_passed": gate5_passed_marker_exists(),
  "stage6": all_office_outputs_exist()
}

# Skip stages with valid existing outputs unless user passed --rerun
```

### 0.5 — Auth collect (only when HDSD in targets)

**0.5.a — Read canonical first.** If `docs/intel/test-accounts.json` exists:
- Validate against `~/.claude/schemas/intel/test-accounts.schema.json`
- Cross-ref each `accounts[].role_slug` against `actor-registry.roles[].slug` (intel-validator). Fail on mismatch.
- For each role in `actor-registry` NOT covered by `test-accounts.accounts[]` → mark missing.
- Resolve `password_ref` (env-ref mode) at this step; if env var unset → mark missing.

**0.5.b — Prompt only for missing.** Interactive prompt covers gaps only (multi-role: per missing role; single-role: single user). Captures: base URL, login URL, email + password OR storage state file. OAuth/SSO/MFA blocker detection (warn upfront).

**0.5.c — Persist back (offer).** After collection, ask user: `Lưu vào docs/intel/test-accounts.json để lần sau dùng lại? [Y/n]`. If yes:
- Default `storage=inline`. Verify `.gitignore` contains `docs/intel/test-accounts.json` (add if missing, ask user to confirm). Set `gitignore_verified=true`.
- Update `_meta.json` via `meta_helper.py update --producer generate-docs --artifact test-accounts.json`.

**0.5.d — Working copy.** Write merged result to `$DOCS_PATH/auth.json` (working copy for Stage 3a). Schema documented in `s3a-capture.md` Step A.

### 0.6 — Capture profile (only when HDSD in targets)

Choose viewport: `desktop 1280×800` (default) | `mobile 390×844` | `tablet 1024×768`.

Save to `$DOCS_PATH/intel/capture-profile.json`.

---

## Gate 0 checklist

- [ ] **Intel contract gate (0.0) passed** — all REQUIRED canonical artifacts present + fresh
- [ ] DOCS_PATH resolved + directory created
- [ ] MCP responds 200 (or fallback path agreed with user)
- [ ] Path A/B/AB decided + recorded
- [ ] Resume map computed
- [ ] (HDSD only) auth.json written (merged from canonical test-accounts.json + interactive gaps)
- [ ] (HDSD only) capture-profile.json written

All checked → advance to Stage 1.

---

## Anti-patterns

- ❌ Hardcode MCP URL — read from `~/.cursor/mcp.json` or `~/.vscode/mcp.json`
- ❌ Use `Invoke-WebRequest` for SSE probe (will hang) — use `curl.exe --max-time 2` or `Test-NetConnection`
- ❌ Skip Path detection — always score 5 signals
- ❌ Ask user for slug — auto-detect first, ask only if all heuristics fail
