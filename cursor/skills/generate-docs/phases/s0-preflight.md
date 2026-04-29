# Stage 0 — PREFLIGHT (Cursor Edition)

**Predecessor**: pipeline invocation (`/generate-docs <targets>`)
**Successor**: Stage 1 — Discovery
**Goal**: Establish foundation. NO analysis yet. Verify env, resolve paths, route to Path A vs B.
**Gate 0**: All preflight checks pass → enter Stage 1.

**Cursor pattern**: Inline bash + `@Files MEMORIES.md` auto-load + integrated terminal probe. NO sub-agent dispatch needed (Cursor doesn't have real parallel agents).

---

## 0.0 — Intel contract gate (CD-10) — RUN FIRST

Canonical intel layer at `{workspace}/docs/intel/` is the source of truth for roles, routes, permissions, features, and test accounts. This skill is a **consumer** and MUST NOT re-discover when intel exists (CD-10 §7 block-if-missing, §9 reuse-first mandate).

Run in integrated terminal:

```bash
INTEL_DIR="docs/intel"
REQUIRED=(actor-registry.json permission-matrix.json sitemap.json feature-catalog.json)
OPTIONAL=(test-accounts.json)

missing=()
stale=()
for art in "${REQUIRED[@]}"; do
  [[ ! -f "$INTEL_DIR/$art" ]] && missing+=("$art") && continue
  python ~/.claude/scripts/intel/meta_helper.py is-fresh "$INTEL_DIR" "$art" || stale+=("$art")
done

echo "missing=${missing[*]:-none}"
echo "stale=${stale[*]:-none}"
```

**Decision matrix:**

| State | Action |
|---|---|
| All REQUIRED fresh | ✓ Proceed to 0.1. Load intel via `@Files docs/intel/*.json`; downstream stages READ-ONLY. |
| Any REQUIRED missing | **BLOCK**. Print: `intel-missing: <file>`. Suggest `/from-code` (Path B) or `/from-doc` then `/from-code` (Path A→B). Do NOT fall back to in-skill discovery. |
| Any REQUIRED stale | Ask user: `[r]egenerate via /from-code, [u]se anyway (will tag drift in output), [c]ancel`. |
| `test-accounts.json` missing | **WARN only** if HDSD in targets. Step 0.5 will collect interactively + offer to persist back to intel. |
| `test-accounts.json` present, `storage=inline`, `gitignore_verified=false` | **BLOCK**. Force user to add file to `.gitignore`, then re-run. |

**Anti-pattern (FORBIDDEN):** silently re-deriving roles/routes/permissions from codebase when canonical intel is missing. That is what creates the drift between `from-doc` / `from-code` / `resume-feature` / `generate-docs`. Block early, fail loudly.

**Legacy fallback (one release only):** if `docs/intel/` empty BUT `docs/generated/{slug}/intel/` populated → migrate per `INTEL_INTEGRATION.md § Path migration`, then re-run gate. After migration window, remove this fallback.

## 0.1 — MEMORIES.md auto-load (Cursor 3)

```
@Files MEMORIES.md
```

If `## generate-docs` section exists for current project → pre-fill: `dev-unit`, `client-name`, `service-ports`, `auth-strategy`, `capture-profile`. Skip Stage 0.5+ if values still valid.

## 0.2 — Slug + DOCS_PATH resolution

Run in integrated terminal (YOLO approved):

```bash
# Auto-detect slug — git remote → package.json → pyproject.toml → go.mod → cwd
REPO_NAME=""
git rev-parse --is-inside-work-tree &>/dev/null && \
  REPO_NAME=$(basename "$(git config --get remote.origin.url 2>/dev/null || git rev-parse --show-toplevel)" .git)
[ -z "$REPO_NAME" ] && [ -f package.json ] && REPO_NAME=$(jq -r .name package.json 2>/dev/null | tr '@/' '-')
[ -z "$REPO_NAME" ] && REPO_NAME=$(basename "$(pwd)")

SLUG=$(echo "$REPO_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//g')
export DOCS_PATH="docs/generated/${SLUG}"
mkdir -p "$DOCS_PATH"/{intel,screenshots,output,output/diagrams}
echo "📂 DOCS_PATH = $DOCS_PATH (slug: $SLUG)"
```

## 0.2.5 — MCP API mode (production-grade, multi-user safe)

`etc-docgen` MCP v1.0.0+ dùng **PURE API mode** — NO filesystem path. Content + screenshots inline qua tool params; outputs returned as base64.

User project data KHÔNG bao giờ vào thư mục MCP server. MCP có thể host remote, multi-user safe.

**Tool signatures** (v1.0.0+):

```python
mcp__etc-platform__validate(content_data: dict)
mcp__etc-platform__merge_content(current_data: dict, partial: dict, auto_validate: bool = True)
mcp__etc-platform__export(content_data: dict, screenshots: dict, targets: list, auto_render_mermaid: bool)
```

Skill quản lý `content_data` in-memory (Composer state). Outputs (.docx/.xlsx base64) decode + Write vào user repo `$DOCS_PATH/output/`.

**Size limits**: content_data ≤ 1 MB, screenshots total base64 ≤ 20 MB, outputs ≤ 25 MB.

## 0.3 — MCP probe (TCP only, NOT Invoke-WebRequest)

```bash
# Resolve MCP_URL from ~/.cursor/mcp.json
MCP_URL=""
[ -f "$HOME/.cursor/mcp.json" ] && \
  MCP_URL=$(python -c "import json; print(json.load(open('$HOME/.cursor/mcp.json')).get('mcpServers', {}).get('etc-docgen', {}).get('url', ''))" 2>/dev/null)
[ -z "$MCP_URL" ] && MCP_URL="${ETCDOCGEN_MCP_URL:-http://localhost:8001/sse}"
export MCP_URL
```

```powershell
# PowerShell (Cursor Windows) — TCP probe NOT IWR
if ((Test-NetConnection localhost -Port 8000 -WarningAction SilentlyContinue).TcpTestSucceeded) {
  Write-Host "MCP ✓"
} else {
  throw "MCP ✗ — start docker container trước khi tiếp tục"
}
```

**TUYỆT ĐỐI KHÔNG DÙNG** `Invoke-WebRequest -Uri "$MCP_URL"` — SSE long-lived sẽ hang đến timeout.

## 0.4 — Path detection (A vs B vs AB hybrid)

```
@Files README.md ARCHITECTURE.md
@Folders docs/adr docs/features
```

Score 5 doc-coverage signals:

1. README.md + ARCHITECTURE.md tồn tại
2. docs/adr/ ≥ 3 ADR files
3. docs/features/ có feature specs
4. docs/business-flows.md hoặc tương đương
5. docs/security-*.md hoặc docs/data-model.md

| Score | Route | Stage 1+2 producer |
|---|---|---|
| ≥ 4/5 | **Path A** (doc-driven) | Custom Mode "Doc Harvester" + `@Files docs/source/` |
| 2-3/5 | **Path AB** (hybrid) | Both modes (sequential — Doc Harvester first, then Code Researcher) |
| ≤ 1/5 | **Path B** (code-driven) | Custom Mode "Code Researcher" + `@Codebase` |

Record decision to `intel/_route.json`.

## 0.5 — Resume detection

Check existing artifacts:

```
@Files {DOCS_PATH}/intel/actor-registry.json
@Files {DOCS_PATH}/intel/feature-catalog.json
@Files {DOCS_PATH}/intel/sitemap.json
@Files {DOCS_PATH}/intel/code-facts.json
@Files {DOCS_PATH}/intel/screenshot-validation.json
@Files {DOCS_PATH}/output/content-data.json
```

Pipeline auto-skips stages with valid existing outputs unless user passes `--rerun`.

## 0.6 — Auth collect (only when "hdsd" in targets)

Cursor `Composer` collects via interactive prompt. Save to `{DOCS_PATH}/auth.json`.

For multi-role projects (detected later in Stage 1.2), auth.json should have `credentials[]` array — but at Stage 0 we don't know yet, so collect:
- Single-role default: 1 credential
- If user knows multi-role: tick "multi-role" → collect N credentials

Better UX: defer multi-role auth collection to AFTER Stage 1.2 (when actor-registry exists). Stage 0.6 collects single-role; Stage 3 prompts for multi-role creds if needed.

## 0.7 — Capture profile (only when "hdsd" in targets)

```
desktop 1280×800  (default)
mobile  390×844
tablet  1024×768
both
```

Save to `{DOCS_PATH}/intel/capture-profile.json`.

---

## Gate 0 checklist (auto)

- [ ] MEMORIES.md loaded
- [ ] DOCS_PATH resolved
- [ ] MCP TCP probe ✓
- [ ] Path detected + recorded
- [ ] Resume map computed
- [ ] (HDSD only) auth.json + capture-profile.json written

All ✓ → auto-advance to Stage 1.

---

## Anti-patterns (Cursor-specific)

- ❌ `Invoke-WebRequest "http://localhost:8001/sse"` — hangs
- ❌ Hardcode MCP URL — read from `~/.cursor/mcp.json`
- ❌ Skip `@Files MEMORIES.md` — pre-fill saves user time
- ❌ Ask user for slug — auto-detect via git/package.json first
- ❌ Skip Path detection — score 5 signals or fail loudly
