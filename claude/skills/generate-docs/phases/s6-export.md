# Stage 6 — Delivery (HTTP job + MCP)

**Stage**: 6 DELIVERY
**Predecessor**: Stage 5 (validate clean)
**Successor**: pipeline complete

**ROLE**: Upload content_data via HTTP, create render job via MCP, download outputs via HTTP. No bytes pass through the LLM context window.

**SEPARATION OF CONCERNS**:
- Agent: Stage 2 → 3 → 4 → 5 (research, analyze, write JSON)
- HTTP: byte-level upload + download (out-of-band of LLM)
- MCP: job creation, validation, status polling (small JSON only)
- MCP/HTTP down → BLOCK. Agent NEVER falls back to local Python rendering.

---

## CORE RULES

1. **Job-based pipeline is mandatory** for content_data > 50 KB (~10 features). The legacy inline `export(content_data=...)` MCP tool is deprecated and will fail on payloads that bust the LLM output token budget (~32K).
2. Agent uses **Bash + curl** for upload + download. **MCP tools** for job lifecycle.
3. Token budget per export: ~80 output tokens (3 small MCP calls + 2 curl invocations).
4. NEVER run `render_docx.py` / `fill_xlsx_engine.py` from agent.
5. NEVER inline content_data dict into a tool call parameter — that breaks the LLM context window.
6. MCP/HTTP offline → block with a clear message; user fixes container, retries.

---

## Decision tree

```
HTTP /healthz responds 200?
├─ YES → upload → submit job → poll → download → Done
└─ NO  → BLOCK; user runs:
         docker compose up -d
         No Python fallback path.
```

---

## Job-based export (recommended — etc-platform v2.0.0+)

The agent flows through 5 phases, each phase being a single short tool call.
Bytes only ever live on disk and on the wire — never in the agent's context.

### Step 1 — Pre-flight checks

```bash
# Reach the unified server (HTTP + MCP).
curl -fsS "${ETC_PLATFORM_URL:-http://localhost:8001}/healthz"
# expect: {"status":"ok"}

# (Optional) inspect runner capacity before submitting.
# Tool call: mcp__etc-platform__upload_capacity()
# Returns {ready, storage{}, runner{queue_size, inflight, workers, queue_max}}
```

If `/healthz` is non-200 → **BLOCK**, instruct user to bring up Docker compose.

### Step 2 — Final cross-block validation (optional but recommended)

Validation also runs server-side at job creation, but doing it locally first
shortens the feedback loop and avoids creating jobs that cannot succeed.

```python
# Tool call (small payload only — for skeleton/header validation).
# Skip this step if content_data is large; rely on the server-side gate at Step 4.
v = mcp__etc-platform__validate(content_data=current_content_data_skeleton)
if v["errors"]:
    BLOCK — re-dispatch quality stage 5b
```

### Step 3 — Upload bundle as a workspace (recommended)

A **workspace** is a content-addressed multi-file bundle: `content-data.json`
plus `screenshots/*.png` plus optional `diagrams/*.png`. One POST uploads
everything; identical content re-uploaded later returns the same `workspace_id`
(TTL refreshed) so re-rendering does not require re-upload.

```bash
DATA_PATH="$DOCS_PATH/output/content-data.json"
SCREENSHOTS_DIR="$DOCS_PATH/screenshots"
ETC_URL="${ETC_PLATFORM_URL:-http://localhost:8001}"

# Build curl form: 1 part for content-data.json + 1 part per screenshot.
ARGS=( -F "files[content-data.json]=@${DATA_PATH};type=application/json" )
if [ -d "$SCREENSHOTS_DIR" ]; then
  for f in "$SCREENSHOTS_DIR"/*.png; do
    [ -e "$f" ] || continue
    name=$(basename "$f")
    ARGS+=( -F "files[screenshots/${name}]=@${f};type=image/png" )
  done
fi
ARGS+=( -F "label=${SLUG}" )

WS_RESPONSE=$(curl -fsS -X POST "$ETC_URL/workspaces" "${ARGS[@]}")
echo "$WS_RESPONSE" | tee "$DOCS_PATH/output/_workspace.json"
WORKSPACE_ID=$(echo "$WS_RESPONSE" | python -c "import sys,json; print(json.load(sys.stdin)['workspace_id'])")
echo "WORKSPACE_ID=$WORKSPACE_ID"
```

If `ETC_PLATFORM_API_KEY` is set on the server, append `-H "X-API-Key: $ETC_PLATFORM_API_KEY"`.

Server returns 201 with `{workspace_id, sha256, parts[], total_size, expires_at}`.

**Workspace constraints** (defaults; override via env on server):
- ≤ 100 MB total per bundle
- ≤ 10 MB per single file
- ≤ 200 files per bundle
- TTL 24h (renders within 24h reuse same bundle, 0 re-upload)

**Legacy single-file upload** (only when no screenshots needed):
```bash
curl -fsS -X POST "$ETC_URL/uploads" -F "file=@${DATA_PATH}" -F "label=${SLUG}"
# → returns {upload_id, ...}; pass upload_id instead of workspace_id at Step 4.
```

### Step 4 — Create the render job via MCP

```python
# Tool call — passes ID only, never the payload.
job = mcp__etc-platform__export_async(
    workspace_id=WORKSPACE_ID,
    targets=["tkkt", "tkcs", "tkct", "xlsx", "hdsd"],   # subset OK
    auto_render_mermaid=True,
    label=f"{SLUG}-stage6"
)
# Legacy: pass upload_id=UPLOAD_ID instead of workspace_id (no screenshots).

# Response (job public view):
# {
#   "success": true,
#   "job_id": "j_...",
#   "status": "queued",
#   "targets": [...],
#   "expires_at": "2026-04-26T22:00:00Z",
#   ...
# }

JOB_ID = job["job_id"]
```

If the response contains `error_code` (e.g. `UPLOAD_NOT_FOUND`, `INVALID_TARGET`,
`QUEUE_FULL`), surface it to the user and stop.

### Step 5 — Poll until terminal

```python
import time
deadline = time.time() + 600  # 10 min hard ceiling
while True:
    status = mcp__etc-platform__job_status(job_id=JOB_ID)
    if status["status"] in ("succeeded", "failed", "cancelled", "expired"):
        break
    if time.time() > deadline:
        BLOCK — "Job exceeded local 10-min poll timeout. Inspect server logs."
    time.sleep(2)   # back-off; the MCP call itself is cheap
```

`succeeded` → `outputs[]` is populated with `{target, filename, download_url, size_bytes, sha256}`.
`failed`    → `error.code` and `error.message` explain. Do NOT auto-retry.

### Step 6 — Download outputs via HTTP

```bash
JOB_ID="j_..."
ETC_URL="${ETC_PLATFORM_URL:-http://localhost:8001}"
OUT_DIR="$DOCS_PATH/output/exported"
mkdir -p "$OUT_DIR"

# Iterate over outputs[].download_url returned from job_status.
# Example for one file:
curl -fsS -o "$OUT_DIR/thiet-ke-kien-truc.docx" \
  "$ETC_URL/jobs/$JOB_ID/files/thiet-ke-kien-truc.docx"
# Repeat per file from outputs[].
```

Verify with `sha256sum` against the value returned in `outputs[].sha256` for
each file. Any mismatch → re-download once; if persistent, file the issue.

### Step 7 — (Optional) cleanup server-side state

Both uploads and jobs evict on TTL automatically (30 min / 1 h by default).
For a clean shutdown, delete explicitly:

```bash
curl -fsS -X DELETE "$ETC_URL/uploads/$UPLOAD_ID"
curl -fsS -X DELETE "$ETC_URL/jobs/$JOB_ID"
```

---

## Legacy inline export (DEPRECATED — for content_data ≤ 50 KB only)

The pre-2.0.0 flow inlined the entire `content_data` dict into one MCP tool
call. This worked for tiny demos but breaks on real projects:

* 173 KB JSON ≈ 50 K tokens in tool-call output → exceeds Sonnet/Opus output cap.
* Each retry re-renders the whole prompt → cache busts → token storm.

If you absolutely must use it (e.g. local dev with 1-2 features):

```python
result = mcp__etc-platform__export(
    content_data=tiny_dict,
    screenshots=base64_dict_or_None,
    targets=[...],
    auto_render_mermaid=True
)
# outputs[filename] = base64 string (decode + write yourself)
```

The unified server keeps this tool around for backwards compatibility but
emits a server-side warning whenever content_data > 50 KB. New code paths
must use the job-based flow above.

---

## Completion card

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ EXPORT COMPLETE — job-based pipeline
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  upload_id : u_{...}      (size {N} KB, sha {short})
  job_id    : j_{...}      (elapsed {seconds}s)

  📦 $DOCS_PATH/output/exported/
     ├── kich-ban-kiem-thu.xlsx     ({N} TCs)
     ├── huong-dan-su-dung.docx     (~{N} pages, {M} screenshots)
     ├── thiet-ke-kien-truc.docx
     ├── thiet-ke-co-so.docx        ({N} placeholders)
     └── thiet-ke-chi-tiet.docx

  ⚠ Screenshots missing: {list}
  🪙 Token cost: ~80 output tokens (3 MCP calls + 2 curl)
  🎯 Bytes through LLM context: 0

  Human completion:
    [ ] Review [CẦN BỔ SUNG] markers
    [ ] Ký 2 trang signing
    [ ] Open .docx → F9 refresh TOC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Failure handling

### `validate` returned errors

* Re-dispatch Stage 5b quality gate. Do NOT submit a job that the local
  validator already rejects — server-side validation will fail identically,
  and the failed job clutters telemetry.

### `/uploads` returns 413 UPLOAD_TOO_LARGE

* content_data exceeds the 10 MB default. Likely cause: embedded base64
  blobs in `diagrams.*`. Move to file references and let the server render.

### `export_async` returns `QUEUE_FULL` (503)

* Runner queue is saturated (default 100 jobs). Retry with linear backoff:
  `sleep 5; sleep 10; sleep 20`. After 3 retries, surface to user.

### `job_status` shows `status=failed`

* Read `error.code` + `error.message`. Common codes:
  - `VALIDATION_FAILED` — schema/quality gate. Inspect job's
    `validation_report` (in metrics — request via diagnostics endpoint).
  - `RENDER_FAILED`     — engine error per target. Check `metrics.targets_report`.
  - `TIMEOUT`           — job exceeded 5-min ceiling. Reduce target set or
    fix slow render (likely a Mermaid that hangs).
* DO NOT auto-retry. Engine failures are deterministic; surfacing forces a fix.

### Container not reachable

* Agent blocks with clear instruction: `docker compose up -d`.
* DOES NOT render files itself.
* Once container is up, the job can be re-submitted without re-running
  Stages 1–5; the upstream content_data hasn't changed.

### Template missing in container

* Indicates a stale image. User runs:
  ```
  docker compose pull && docker compose up -d --force-recreate
  ```
