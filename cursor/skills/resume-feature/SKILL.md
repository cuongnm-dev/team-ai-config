---
name: resume-feature
description: Tiếp tục pipeline đang dở từ checkpoint cuối cùng. Hỗ trợ cả pipeline phát triển tính năng (SDLC) và pipeline sinh tài liệu. Đọc _state.md để biết đang ở đâu → chạy dispatcher loop tự động giao việc cho đúng agent → có cơ chế PM escalation khi gặp blocker → hoàn thành tới checkpoint tiếp theo.
---

# Resume Pipeline

User-facing: Vietnamese. Dispatcher prompts: English.

## Workflow

### 1. Receive input
No arg → prompt user: `Nhập docs-path hoặc feature-id`.

### 2. Locate `_state.md`

Arg detection:
- Ends with `_state.md` → strip filename, use dirname
- Contains `/` or `\` with existing dir → explicit path
- Partial path like `docs/features` (no feature-id) → reject: `cần feature-id cụ thể`
- Else → treat as feature-id

Resolution (stop on first match):
1. `{arg}/_state.md` (explicit path)
2. `docs/feature-map.yaml` → `features.{arg}.docs_path` → `{docs_path}/_state.md`
3. `docs/features/{arg}/_state.md`
4. `docs/hotfixes/{arg}/_state.md`
5. `docs/generated/{arg}/_state.md`
6. Glob `**/docs/features/{arg}/_state.md` (last resort — auto-update feature-map.yaml)

**Not found** with feature-map present: compute Levenshtein distance to all feature-ids, suggest top 3 matches with distance ≤ 3. Else: `Không tìm thấy. Dùng /new-feature hoặc /generate-docs.`

**File read safety:** On lock/access error → retry 2× (500ms delay). Still fail → tell user close other tabs.

**Advisory lock:** Check `{docs-path}/.resume-lock`:
- Exists, < 10min old → ask: wait or force takeover
- Create lock (session-id + timestamp) before proceed
- Delete lock on every exit path

### 3. Parse + validate `_state.md`

**3.0 Validation:**
- YAML parse fails → STOP with error detail, suggest backup
- Missing required fields (`pipeline-type`, `status`, `docs-path`, `current-stage`, `repo-path`; sdlc adds `feature-id`, `output-mode`) → STOP
- `docs-path` dir missing → STOP with options (restore from git / cancel)
- **feature-req file resolution** (sdlc only):
  - Parse `feature-req.file:` (primary) and `canonical-fallback:`
  - Verify primary file exists AND size > 200 bytes
  - IF primary missing/corrupt → try fallback
  - IF both missing → STOP: "feature-brief.md and doc-brief.md both missing. Re-run /from-doc or restore from git."
  - IF only fallback available → warn user: "feature-brief missing, agents will use canonical doc-brief (slower)"
- **feature-brief staleness check** (if primary exists):
  - Read feature-brief frontmatter `canonical-hash`
  - Compute current sha256 of `{canonical-fallback}` (doc-brief)
  - IF mismatch → warn: "feature-brief stale (canonical edited). Regenerate? (yes/use-stale/use-canonical)"
  - IF user picks regenerate → invoke from-doc Step 5f.5 only (re-generate feature-brief from current doc-brief), then proceed

**3.1 Extract:** all frontmatter + `clarification-notes`, `pre-scaffold*`, `Active Blockers`

**3a. Reconcile with feature-map.yaml (if both exist):**
Mismatch on `status` or `current-stage` → ask user:
- A) Sync feature-map ← _state.md (default, recommended)
- B) Sync _state.md ← feature-map (backup first to `.pre-reconcile.bak`)
- C) Proceed with warning (set `sync-warning: true`)
- D) Cancel

**3b. Dependency check (if `depends-on` non-empty):**

feature-map parse fail → warn, offer skip.

**Cycle detection (DFS)** — if cycle found: STOP (hard block, user fixes config).

**Blocked deps:**
- Missing in map → STOP (config error)
- `status != done` → ask: wait / override / cancel

**3c. Pre-scaffold:** if `pre-scaffold: true` AND target dir now exists → ask move (yes/no), update paths.

### 4. Display status

Mid-wave enrichment (sdlc + `current-stage` is `dev-wave-{N}` or `fe-dev-wave-{N}`):
- Read TL plan, glob `05-*-w{N}-*.md` → show `{done}/{total} tasks, còn lại: {ids}`

**Format:**
```
## Pipeline: {feature-name}
Feature ID: {id}
stage: {current-stage}  [{done}/{total} tasks if mid-wave]
Đã xong: {completed}
Còn: {queue}
blockers: {or "không có"}
```

### 4b. Clarification answer check

If `clarification-notes` non-empty AND no `User answer:` line:
```
⚠️ PM đã hỏi: {question}
options:
  A) Trả lời
  B) Dừng (/resume sau)
  C) Rollback stage
```
- **A**: ask answer, validate non-empty (3 retries), append `User answer: {text}`, save
- **B**: STOP, preserve state
- **C**: clear `clarification-notes`, pop last from `completed-stages` back to front of `stages-queue`, save, proceed

### 5. Distill conversation (sdlc, optional)

Silent review for unpersisted decisions (scope changes, spike results, agreed directions). Skip if nothing relevant.

### 6. Build dispatcher prompt (cache-aware)

Compute **FROZEN_HEADER once** before the loop — identical bytes every iteration = cache hit.
Append **DYNAMIC_SUFFIX** per iteration — only the parts that actually change.

**FROZEN_HEADER** (computed once before loop — never re-read, never mutated; STATIC bytes only — never inject stage-specific or iter-specific values here, otherwise cache breaks):
```
## Pipeline Context
pipeline-type: {sdlc|doc-generation}
feature-id: {feature-id}          # sdlc only — OMIT this line entirely for doc-generation (do not include with empty value)
docs-path: {docs-path}
repo-path: {repo-path}             # sdlc only — OMIT entirely for doc-generation
output-mode: {output-mode}         # sdlc only — OMIT entirely for doc-generation
stages-total: {N}                  # captured once at loop init = len(initial stages-queue) + len(completed-stages); never re-read from _state.md
intel-path: {intel-path}           # sdlc: {repo-path}/docs/intel/  | doc-generation: {docs-path}/intel/  — captured once, static within run
intel-contract: |
  Canonical intel artifacts at {intel-path}: actor-registry.json, permission-matrix.json, sitemap.json, feature-catalog.json, test-accounts.json (optional).
  Sub-agent rules:
  1. Read intel BEFORE planning/coding — role slugs, route paths, permission decorators are CANONICAL (use exact strings; do not rename/translate).
  2. Required artifact missing OR _meta.artifacts[file].stale=true → STOP with verdict "intel-missing: {file}". Do NOT guess values.
  3. Code change touching auth/role enum/routes/RBAC decorators → set _state.md field `intel-drift: true` so /intel-refresh runs at pipeline end.
  4. Never ground role/permission decisions on prose alone (feature-brief.md) — JSON is source of truth.
  5. QA stage MUST co-produce 3 artifacts atomically (CD-10 Quy tắc 16):
     - test-evidence/{feature-id}.json    (TC prose with execution.status set)
     - playwright/{feature-id}.spec.ts    (executable script, naming 1:1 with TC IDs)
     - screenshots/{feature-id}-step-NN-{state}.png  (CD-4 naming, captured DURING Playwright run)
     Single capture pass = dual-purpose evidence: regression run-back + doc illustration.
     QA stage verdict MUST include {test_cases_count, passed_count, screenshot_count, playwright_path}.
     Missing any one of 3 → block close-feature (handled in /close-feature gate).
```

**Why this fits cache:** `intel-path` resolves to a constant string at loop init; the `intel-contract` block is fully static text identical across all iterations and stages. FROZEN_HEADER bytes remain identical, preserving prefix-cache hits for Cursor's Task() context.

**DYNAMIC_SUFFIX** (rebuilt each iteration — keep minimal):
```
## Current State
current-stage: {current-stage}
iter: {iter}
last-verdict: {last-verdict}       # "none" on iter=1; result.verdict on iter>1
```

First iteration only: append `session-context: |` block under `## Current State` if distilled content exists (Step 5). Do NOT include in iter > 1.

**Assembly rule:**
```
header = build_frozen_header().rstrip("\n")   # strip trailing newlines — prevents \n\n\n
prompt = header + "\n\n" + DYNAMIC_SUFFIX     # separator always exactly \n\n
```

If `stages-queue` missing (legacy): reconstruct from path stages − completed-stages, save before loop.

### 7. Dispatcher loop

**⚠️ DO NOT STOP unless explicit condition:**
- `status=done` / `blocked` / `pm-required` with `resume=false`
- Loop guards: max_iterations (50), max_pm_invocations (5), no-op detection
- Exception after retry
- **NOT**: user confirmation, milestones, long output, context pressure

**Loop:**
```
iter = 0; pm_count = 0; last_hash = null; last_verdict = "none"
FROZEN_HEADER = build_frozen_header().rstrip("\n")   # computed once — see Step 6 for sdlc/doc-gen conditional fields
PM_FROZEN = build_pm_frozen().rstrip("\n")           # computed once — sdlc: include feature-id; doc-gen: omit

WHILE iter < 50:
  iter++
  DYNAMIC_SUFFIX = "## Current State\ncurrent-stage: {current-stage}\niter: {iter}\nlast-verdict: {last_verdict}"
  IF iter == 1 AND session_context exists: DYNAMIC_SUFFIX += "\nsession-context: |\n  {session_context}"
  prompt = FROZEN_HEADER + "\n\n" + DYNAMIC_SUFFIX

  result = Task(dispatcher, prompt)  # retry 1× on crash, else STOP

  # Intel gate (sdlc, stages that touch code: implement, dev-wave-*, fe-dev-wave-*)
  # Pre-stage: if current-stage starts implementing AND intel-path missing required artifacts → STOP with "intel-missing: {file}". User must run /from-code (or /from-doc + /from-code) before /resume-feature.
  # Post-stage: if result.verdict carries `intel-drift: true` → persist to _state.md.intel-drift; suggest /intel-refresh after pipeline done.

  status=continuing: last_verdict = result.verdict; print "[{stage}] ✓ {verdict}" (dots after iter>10), append_telemetry_inline(stage-complete), checkpoint_if_wave_boundary(), loop
  status=done: append_telemetry_inline(done), report, release lock, exit
  status=blocked: surface blockers, release lock, stop
  status=pm-required:
    pm_count++
    IF pm_count > 5: STOP (possible stuck)
    curr_hash = hash(_state.md)
    IF curr_hash == last_hash AND pm_count > 1: STOP (no-op loop)
    pm_ctx = truncate(result.pm-context, 8K)
    pm_dynamic = "## PM Request\n" + pm_ctx
    pm_result = Task(pm, PM_FROZEN + "\n\n" + pm_dynamic)  # retry 1× on crash, else STOP
    IF invalid JSON or no `resume`: STOP
    IF resume=true: last_hash = curr_hash; last_verdict = "pm-resolved"; loop
    else: surface message, STOP
  status=other: STOP
```

All STOP paths release lock. All paths preserve `_state.md`.

### 7a. SDLC Checkpoint markers (cache-safe)

After each stage advance, append a checkpoint marker to `{docs-path}/_checkpoints.md`:
```
## CKP-{NN}  {stage}  {YYYY-MM-DD HH:MM}
verdict: {verdict}
tokens-stage: {N}
tokens-total: {N}
artifacts: [list of new file paths produced this stage]
intel-drift: {true|false}
```

Wave-boundary checkpoints (after `dev-wave-{N}` or `qa-wave-{N}` completes) ALSO snapshot:
- `_state.md` → `_state.md.ckp-{NN}.bak` (rollback target)
- Resolved feature-map.yaml entry hash

reasoning: `_checkpoints.md` is human-readable timeline; `.bak` files give rollback target without git noise. Equivalent to doc pipeline's checkpoint discipline (Strategic Pipeline Spirals 1-4) but per-stage instead of per-spiral.

Rollback path: `/resume-feature {id} --rollback CKP-{NN}` (skill restores `_state.md` from `.bak`, prunes later checkpoint markers).

### 7b. Inline telemetry (zero sub-agent token cost)

After every dispatcher result, the **skill itself** appends ONE line to `.cursor/telemetry/{feature-id}.jsonl` via the Bash tool — no Task() spawn. Saves ~10-25K tokens per feature. Anomaly detection deferred to `/telemetry-report` aggregation pass.

**Implementation contract** (skill instructs main agent to call Bash with this template):

Use `jq` to safely build the JSON (handles quote-escaping). If `jq` not installed → fall back to printf with manual quote-escape (see below).

**Primary template (jq, preferred):**
```bash
ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
mkdir -p .cursor/telemetry
jq -nc \
  --arg ts "$ts" \
  --arg fid "{feature_id}" \
  --arg ev "{event}" \
  --arg stg "{stage}" \
  --arg ag "{agent}" \
  --arg tier "{tier}" \
  --arg vd "{verdict}" \
  --arg cs "{cache_signal}" \
  --argjson it {iter} \
  --argjson dur {duration_s} \
  --argjson tu '{token_usage_json_block}' \
  '{ts:$ts, feature_id:$fid, event:$ev, stage:$stg, agent:$ag, tier:$tier, iter:$it, verdict:$vd, duration_s:$dur, cache_signal:$cs, token_usage:$tu}' \
  >> .cursor/telemetry/{feature_id}.jsonl
```

`{token_usage_json_block}` is the verdict's `token_usage` object verbatim (skill copies it from agent verdict — see ref-pm-standards.md § Token Tracking Standard v2).

**Fallback template (printf, if jq absent):**
```bash
ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
mkdir -p .cursor/telemetry
verdict_esc=$(printf '%s' "{verdict}" | sed 's/"/\\"/g')
printf '{"ts":"%s","feature_id":"%s","event":"%s","stage":"%s","agent":"%s","tier":"%s","iter":%d,"verdict":"%s","duration_s":%d,"cache_signal":"%s","token_usage":%s}\n' \
  "$ts" "{feature_id}" "{event}" "{stage}" "{agent}" "{tier}" {iter} "$verdict_esc" {duration_s} "{cache_signal}" '{token_usage_json_block}' \
  >> .cursor/telemetry/{feature_id}.jsonl
```

**JSONL event schema (v2 — full breakdown):**

```json
{
  "ts": "ISO-8601 UTC",
  "feature_id": "F-042",
  "event": "stage-complete | pm-escalation | rework | blocker | done | escalate-tier",
  "stage": "dev-wave-1",
  "agent": "dev | dev-pro | qa | qa-pro | reviewer | reviewer-pro | sa | sa-pro | ba | ba-pro | tech-lead | pm | ...",
  "tier": "base | pro",
  "iter": 7,
  "verdict": "Pass",
  "duration_s": 142,
  "cache_signal": "hit | miss | unknown",
  "token_usage": {
    "input_fresh": 12500,
    "input_cache_read": 45000,
    "input_cache_write": null,
    "output_text": 3200,
    "output_reasoning": null,
    "apply_model": null,
    "this_agent_total": 60700,
    "pipeline_total": 89200
  }
}
```

**Skill loop responsibility:**
1. After each Task() returns → extract `result.verdict.token_usage` (full block, not just total)
2. Build telemetry JSONL line via jq template
3. Append to `.cursor/telemetry/{feature_id}.jsonl`
4. Update `_state.md.kpi.tokens_total` from `token_usage.pipeline_total`

**Tier field**: derive from agent name suffix — `*-pro` → `"pro"`, else `"base"`. Allows `/telemetry-report` to compute per-tier cost split.

**JSON-escape rule**: only `verdict` field is free-text from agent — use jq's `--arg` (auto-escapes) OR sed `s/"/\\"/g` in fallback. All other fields are controlled enums (event, stage, cache_signal) or numbers.

**Cache signal heuristic** (computed by skill before Bash call, no model needed):
- Track `frozen_header_hash` in skill memory at loop init
- Track `first_run_duration` after iter=1 completes
- Compute `cache_signal`:
  - `hit` if `iter > 1` AND header hash unchanged AND `duration_s < first_run_duration × 0.6`
  - `miss` if `iter == 1` OR header hash changed
  - `unknown` otherwise

**Why Bash + printf instead of agent**:
- Cursor skills are LLM instructions; the agent invokes tools (Bash, Edit, Write)
- A 1-line printf is ~50 tokens vs ~500 tokens for sub-agent invocation overhead
- Race-safe via shell append (`>>`) — atomic on POSIX, OK on Windows for single-line writes

**Failure mode**: If Bash fails (disk full, permission), skill prints `[telemetry-degraded] {error}` to console, continues pipeline. Telemetry is never on the critical path.

**Aggregation deferred** to `/telemetry-report` slash command (see `commands/telemetry-report.md`). When user wants insight, that command loads JSONL with appropriate analysis model — anomalies surfaced lazily, with full historical context.

**`agents/telemetry.md` retained** for advanced cross-feature root-cause analysis only. Default per-iter flow = inline Bash printf. NEVER invoke Task(telemetry) in dispatcher loop.

**Token budget per iteration (approximate):**
- FROZEN_HEADER: ~150 tokens (was ~80; +70 for intel-path + intel-contract) — stable prefix, may benefit from Cursor's prompt cache if Task() shares prefix within session
- DYNAMIC_SUFFIX: ~30 tokens — billed each iteration regardless
- Net: each iteration costs ~30 tokens input beyond the first call
- Note: Cursor Task() spawns independent contexts — prefix cache hit depends on Cursor's internal implementation; do not rely on it as guaranteed
- ⚠️ Cache-preservation rules:
  1. **NEVER inject stage-specific, iter-specific, or runtime-resolved values into FROZEN_HEADER.** New static fields = OK; dynamic fields belong in DYNAMIC_SUFFIX.
  2. **APPEND-ONLY when adding fields to FROZEN_HEADER.** New fields go at END of block. Reordering existing fields breaks ALL existing cache entries (byte-mismatch on prefix). The current order is intentionally stable — preserve it.
  3. **Field naming: kebab-case, lowercase.** Match existing pattern (`intel-path`, `repo-path`). Inconsistency breaks scanning + cache key stability.
  4. **Whitespace discipline.** Trailing spaces / different newline counts produce different bytes. Builder uses `.rstrip("\n")` then `+ "\n\n" +` exactly — don't add `\r\n` or extra spaces.
  5. **No ASCII art / emoji at the very top.** Visual changes are tempting; they're cache-killers when prefix bytes are sensitive.

### Completion Report

**sdlc done:**
```
✅ Pipeline hoàn tất — {feature-name}
reviewer: {verdict}
▶ /close-feature
```

**doc-generation done:**
```
✅ Generate docs hoàn tất
📁 {docs-path}/output/
⚠️ Checklist: verify dates, screenshots, test coverage, placeholders
```

**Max iterations hit:**
```
⚠️ Hit max iterations. State preserved at {current-stage}.
Re-run /resume-feature {id} nếu healthy. Else check /feature-status.
```

## Why pipelines sometimes stop mid-run

Cursor main-chat has context/turn limits. Long pipelines (Path L + reworks) may exit at safe checkpoint — this is Cursor protection, not bug. `_state.md` is always current; re-run to continue.

Minimize by: `output-mode: lean`, lower `risk_score`, split large features into dependent smaller ones.

## Edge cases

| Condition | Action |
|---|---|
| `_state.md` not found | Fuzzy suggest if feature-map exists, else "not found" |
| `status: done` | Refuse (corrupts sealed state) |
| `status: blocked` | Display blockers, ask user to resolve |
| `pipeline-type` missing | Infer (sdlc if `feature-id`, else `doc-generation`) or ask |
| Legacy no `stages-queue` | Reconstruct from path − completed |

## What's next

| Type | Outcome | Next |
|---|---|---|
| sdlc | Complete | `/close-feature` → `/retrospective` |
| sdlc | Blocker | `/feature-status` |
| doc-generation | Done | `/export-docs` |
| Any | Interrupted | Re-run `/resume-feature {id}` |
