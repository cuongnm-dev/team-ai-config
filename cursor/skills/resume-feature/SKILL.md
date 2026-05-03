---
name: resume-feature
description: Tiếp tục pipeline đang dở từ checkpoint cuối cùng. Hỗ trợ cả pipeline phát triển tính năng (SDLC) và pipeline sinh tài liệu. Đọc _state.md để biết đang ở đâu, chạy dispatcher loop tự động giao việc cho đúng agent, có cơ chế PM escalation khi gặp blocker, hoàn thành tới checkpoint tiếp theo. Trigger - feature-id đang in-progress hoặc blocked; muốn advance qua stage tiếp theo. Anti-trigger - feature chưa tạo thì /new-feature; feature đã reviewer-Pass thì /close-feature; chỉ muốn readonly view thì /feature-status. Example - "/resume-feature F-001" (auto-loop tới done hoặc blocked).
---

# Resume Pipeline

User-facing: Vietnamese. Dispatcher prompts: English.

---

## ⚠️⚠️⚠️ ORCHESTRATOR DISCIPLINE — READ FIRST

You are running this skill as the **outer orchestrator**. Your ONLY job after Step 5 is to drive the dispatcher loop until the pipeline reaches a legitimate stop condition. You are NOT the worker.

### Forbidden behaviors (each is a critical failure):

- ❌ Reading `ba.md`/`sa.md`/`dev.md`/agent definitions and "doing the work yourself"
- ❌ Writing artifact files: `ba/00-lean-spec.md`, `sa/`, `04-tech-lead-plan.md`, `05-dev-*.md`, `07-qa-report.md`, `08-review-report.md`, `_state.md` directly
- ❌ Updating `feature-catalog.json` / `permission-matrix.json` / `sitemap.json` content (intel writers do that)
- ❌ Reading `feature-brief.md` or feature-req body content (dispatcher passes it through to ba)
- ❌ Returning to user with "Bước tiếp theo: chạy lại /resume-feature" after only 1 stage — that defeats the entire skill
- ❌ Stopping after dispatcher returns `status=continuing` — you MUST call dispatcher again

### Required behavior:

- ✅ Steps 1-5 = setup (read state, validate, lock)
- ✅ Step 6 = `Task(dispatcher)` loop. Continue calling dispatcher until status ∈ {`done`, hard `blocked`, `iter>=200`}
- ✅ Step 6 PM branch = on `pm-required`, call `Task(pm)`. If `resume:true` → loop. If `resume:false` → STOP (legitimate user-needed exit)
- ✅ ONLY 4 legitimate stop conditions: pipeline `done`, hard blocker, PM `resume:false`, iter cap

**If notepads/dispatcher-loop.md fails to load — DO NOT FALLBACK TO DOING WORK YOURSELF.** Use the inlined Step 6 below instead.

---

## Step 1 — Receive input

No arg → prompt user: `Nhập docs-path hoặc feature-id`.

## Step 2 — Locate `_state.md`

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

## Step 3 — Parse + validate `_state.md`

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

## Step 4 — Display status

Mid-wave enrichment (sdlc + `current-stage` is `dev-wave-{N}` or `fe-dev-wave-{N}`):
- Read TL plan, glob `05-*-w{N}-*.md` → show `{done}/{total} tasks, còn lại: {ids}`

Format:
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

## Step 5 — Distill conversation (sdlc, optional)

Silent review for unpersisted decisions (scope changes, spike results, agreed directions). Skip if nothing relevant.

## Step 6 — Build dispatcher prompt + run loop (INLINE — do not skip, do not delegate to user)

This is the entire loop. Execute in-place. Do not stop after 1 stage. Do not surface to user except on legitimate stop conditions (see Orchestrator Discipline above).

### 6.1 — Build FROZEN_HEADER (compute ONCE before loop, identical bytes every iteration)

```
## Pipeline Context
pipeline-type: {sdlc|doc-generation}
feature-id: {feature-id}          # sdlc only — OMIT entirely for doc-generation
docs-path: {docs-path}
repo-path: {repo-path}             # sdlc only
output-mode: {output-mode}         # sdlc only
stages-total: {N}                  # captured once at loop init = len(initial stages-queue) + len(completed-stages)
intel-path: {intel-path}           # sdlc: {repo-path}/docs/intel/  | doc-generation: {docs-path}/intel/
intel-contract: |
  Canonical intel artifacts at {intel-path}: actor-registry.json, permission-matrix.json, sitemap.json, feature-catalog.json, test-accounts.json (optional).
  Sub-agent rules:
  1. Read intel BEFORE planning/coding — role slugs, route paths, permission decorators are CANONICAL (use exact strings).
  2. Required artifact missing OR _meta.artifacts[file].stale=true → STOP with verdict "intel-missing: {file}". Do NOT guess.
  3. Code change touching auth/role enum/routes/RBAC decorators → set _state.md field `intel-drift: true`.
  4. Never ground role/permission decisions on prose alone — JSON is source of truth.
  5. QA stage MUST co-produce 3 artifacts atomically (CD-10 Quy tắc 16):
     - test-evidence/{feature-id}.json
     - playwright/{feature-id}.spec.ts
     - screenshots/{feature-id}-step-NN-{state}.png
  6. Intel read tiers: base-tier agents Read({intel-path}/_snapshot.md) FIRST. Pro-tier reads canonical JSON.
```

Cache rule: STATIC bytes only. Never inject stage-specific or iter-specific values into FROZEN_HEADER. Append-only — new fields go at the END.

### 6.2 — DYNAMIC_SUFFIX (rebuild each iteration, minimal)

```
## Current State
current-stage: {current-stage}
iter: {iter}
last-verdict: {last-verdict}       # "none" on iter=1; result.verdict on iter>1
```

First iteration only: append `session-context: |` block under `## Current State` if distilled content exists (Step 5). Do NOT include in iter > 1.

### 6.3 — Dispatcher loop (the orchestrator core — DO NOT EXIT EARLY)

```
iter = 0; pm_count = 0; last_hash = null; last_verdict = "none"; transient_retry_count = 0
FROZEN_HEADER = build_frozen_header().rstrip("\n")
PM_FROZEN = build_pm_frozen().rstrip("\n")   # 4-block escalation template per pm.md § Escalation Prompt Template

WHILE iter < 200:
  iter++
  DYNAMIC_SUFFIX = "## Current State\ncurrent-stage: {current-stage}\niter: {iter}\nlast-verdict: {last_verdict}"
  IF iter == 1 AND session_context exists: DYNAMIC_SUFFIX += "\nsession-context: |\n  {session_context}"
  prompt = FROZEN_HEADER + "\n\n" + DYNAMIC_SUFFIX

  result = Task(subagent_type="dispatcher", prompt=prompt)   # retry 1× on crash, else STOP

  # Intel gate (sdlc, stages that touch code)
  # Pre-stage: if current-stage starts implementing AND intel-path missing required artifacts → STOP "intel-missing: {file}".
  # Post-stage: if result.verdict carries `intel-drift: true` → persist to _state.md.intel-drift.

  # Lenient status — default unknown to continuing
  status = result.get("status") or "continuing"

  CASE status:
    "continuing":
      last_verdict = result.verdict or "in-progress"
      print "[{stage}] ✓ {verdict}"   # dots after iter>10
      checkpoint_if_wave_boundary()    # see notepads/checkpoints.md
      loop                             # ← CRITICAL: do NOT exit even if verdict says "wave done", "stage advanced"

    "done":
      reread _state.md
      IF stages-queue is non-empty:
        print "⚠ Dispatcher returned done but stages-queue not empty — treating as continuing"
        last_verdict = "auto-continue"
        loop
      ELSE:
        report final summary
        release lock
        exit                           # ← legitimate stop

    "blocked":
      IF result.blockers contains any of: PARSE-001, NO-INVOKE-001:
        IF transient_retry_count < 1:
          transient_retry_count++
          continue                     # retry same iter
      surface blockers, release lock, stop   # ← legitimate stop (hard blocker)

    "pm-required":
      pm_count++
      IF pm_count > 5: STOP             # safeguard: too many escalations
      curr_hash = hash(_state.md)
      IF curr_hash == last_hash AND pm_count > 1: STOP  # no-op loop
      pm_ctx = truncate(result.pm-context, 8K)
      pm_result = Task(subagent_type="pm", prompt=PM_FROZEN + "\n\n" + pm_ctx)   # retry 1× on crash

      IF pm_result invalid JSON or missing `resume`: STOP

      IF pm_result.resume == true:
        last_hash = curr_hash
        last_verdict = "pm-resolved"
        loop                            # ← baton back to dispatcher

      ELSE (pm_result.resume == false):
        surface pm_result.message + clarification-notes to user
        STOP                            # ← legitimate stop (user input needed)

    default ("other"):
      # NEVER silently STOP. Log + treat as continuing.
      print "⚠ Unknown status '{status}' — treating as continuing"
      last_verdict = result.verdict or "unknown-status"
      loop
```

### 6.4 — Stop conditions summary (the ONLY 4 legitimate exits)

| Status | Condition | Surface to user? |
|---|---|---|
| `done` + queue empty | Pipeline complete | ✅ "✅ Pipeline hoàn tất" + reviewer verdict |
| `blocked` (hard) | Config error, missing artifact, PARSE-001/NO-INVOKE-001 retry exhausted | ✅ Surface blockers, suggest fix |
| `pm-required` → `resume:false` | PM judges user input needed (clarification-notes set) | ✅ Surface PM message + question |
| `iter >= 200` | Safety cap | ✅ "Hit max iterations, state preserved" |

**Anything else = LOOP. Including:** stage transition, wave boundary, PM resolved, "Continue?" prompt, long output, "looks paused".

### 6.5 — Checkpoint markers

After each iteration: append checkpoint markers per `notepads/checkpoints.md` (on stage advance + wave-boundary snapshot).

### 6.6 — Cost rationale

Each `/resume-feature` invocation = 1 fresh skill execution = pays cache_write tax (~$0.30-0.50). Looping in-place is the WHOLE POINT of this skill. Re-invocation should only happen on legitimate stops above.

### 6.7 — Cache-preservation rules (when adding fields to FROZEN_HEADER)

1. NEVER inject stage-specific, iter-specific, or runtime-resolved values into FROZEN_HEADER
2. APPEND-ONLY when adding fields. New at END of block. Reordering breaks all existing cache
3. Field naming: kebab-case, lowercase
4. Whitespace: `.rstrip("\n") + "\n\n" +` exactly. No `\r\n`, no trailing spaces
5. No ASCII art / emoji at top — visual changes are cache-killers

---

## Edge cases

| Condition | Action |
|---|---|
| `_state.md` not found | Fuzzy suggest if feature-map exists, else "not found" |
| `status: done` | Refuse (corrupts sealed state) |
| `status: blocked` | Display blockers, ask user to resolve |
| `pipeline-type` missing | Infer (sdlc if `feature-id`, else `doc-generation`) or ask |
| Legacy no `stages-queue` | Reconstruct from path − completed |

---

## What's next

| Type | Outcome | Next |
|---|---|---|
| sdlc | Complete | `/close-feature` → `/retrospective` |
| sdlc | Blocker | `/feature-status` |
| doc-generation | Done | `/export-docs` |
| Any | Interrupted | Re-run `/resume-feature {id}` |
