---
name: resume-feature
description: Tiếp tục pipeline đang dở từ checkpoint cuối cùng. Hỗ trợ cả pipeline phát triển tính năng (SDLC) và pipeline sinh tài liệu. Đọc _state.md để biết đang ở đâu, chạy dispatcher loop tự động giao việc cho đúng agent, có cơ chế PM escalation khi gặp blocker, hoàn thành tới checkpoint tiếp theo. Trigger - feature-id đang in-progress hoặc blocked; muốn advance qua stage tiếp theo. Anti-trigger - feature chưa tạo thì /new-feature; feature đã reviewer-Pass thì /close-feature; chỉ muốn readonly view thì /feature-status. Example - "/resume-feature F-001" (auto-loop tới done hoặc blocked).
---

# Resume Pipeline

User-facing: Vietnamese. Dispatcher prompts: English.

---

## ⚠️ SKILL ROLE — THIN ENTRY POINT (2026-05-04 architecture)

This skill is a **thin entry point**. Its job: parse args, validate `_state.md`, acquire lock, then hand off to **PM agent** via single `Task(pm, mode=orchestrate)` call. PM drives the pipeline end-to-end internally.

### Forbidden:
- ❌ Reading `ba.md`/`sa.md`/`dev.md`/agent definitions and "doing the work yourself"
- ❌ Writing artifact files (`ba/`, `sa/`, dev outputs, qa report, review report, `_state.md` content body)
- ❌ Looping `Task(dispatcher)` per-stage — that pattern is deprecated 2026-05-04 (see ARCH note in pm.md)
- ❌ Re-implementing routing/validation/state-update logic — PM owns this

### Required:
- ✅ Steps 1-5 = setup (parse args, validate state, intel, lock)
- ✅ Step 6 = single `Task(pm)` call with Orchestrate prompt. PM does the rest.
- ✅ Surface PM's final verdict to user.

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

**3.1 Extract:** all frontmatter + `clarification-notes`, `pre-scaffold*`, `Active Blockers`, `worktree-path` / `worktree-branch` / `worktree-base` if present.

**3.1a Worktree alignment (Cursor 3+ native — only if `worktree-path` set in _state.md):**

```
state_wt = _state.md.worktree-path
env_wt   = $ROOT_WORKTREE_PATH    # Cursor sets when agent runs in worktree

IF state_wt set AND env_wt NOT set:
  WARN user: "Feature {id} originally ran in worktree {state_wt}.
              You are currently in main checkout (or detached agent).
              Options:
                A) Mở agent ở worktree đó trong Cursor (recommended) — re-run /resume-feature
                B) Continue in main checkout (changes apply to main, not the feature branch)
                C) Cancel"
  IF user picks B → set `_state.md.worktree-mode-override: true` + warn flag in summary

IF state_wt set AND env_wt set AND state_wt != env_wt:
  ERROR: "Worktree mismatch. State: {state_wt}, Env: {env_wt}.
          Either re-run from correct worktree, or update _state.md.worktree-path manually."
  STOP

IF state_wt set AND env_wt set AND match:
  OK — proceed.

IF state_wt NOT set AND env_wt set:
  Update _state.md frontmatter:
    worktree-path:   "{env_wt}"
    worktree-branch: "{git rev-parse --abbrev-ref HEAD}"
    worktree-base:   "{detected base}"
  (Feature was started in main, user moved into worktree mid-pipeline. Backfill state.)

IF neither set: continue in main as before (legacy / solo flow).
```

Reference: https://cursor.com/docs/configuration/worktrees

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

## Step 6 — Hand off to PM (single Task call, PM drives pipeline end-to-end)

Build the Orchestrate prompt, call `Task(pm)` ONCE. PM internally loops dispatch→validate→state-update until done/blocked/user-needed. Skill just relays PM's final verdict to user.

### 6.1 — Build PM Orchestrate prompt (4-block — cache-aware)

```
## Agent Brief
You are PM in Orchestrate mode. Mission: drive feature pipeline to completion. See ~/.cursor/agents/pm.md § Orchestrate Mode for full workflow.

## Mode
orchestrate

## Project Conventions
{≤5 lines from rules/40-project-knowledge.mdc relevant to this pipeline; use "(none)" if no relevant entries}

## Feature Context
feature-id:        {feature-id}
docs-path:         {docs-path}
repo-path:         {worktree-path if _state.md.worktree-path is set, else repo-path}
intel-path:        {intel-path}    # sdlc: {repo-path}/docs/intel/  | doc-generation: {docs-path}/intel/
worktree-mode:     {true if worktree-path set, else false}
worktree-branch:   {worktree-branch if set, else "(none)"}
output-mode:       {output-mode}
pipeline-path:     {pipeline-path or "unknown"}

## Inputs
session-context:   {distilled context from Step 5 if non-empty; else "(none)"}
```

Cache rule: blocks 1-3 are STATIC across the whole pipeline. Block 4 (Inputs) is small and only set at start. PM caches the static prefix internally for its specialist sub-calls.

### 6.2 — Single Task(pm) call

```
result = Task(subagent_type="pm", prompt=prompt_above)
# PM runs Orchestrate Mode internally:
#   - Reads _state.md, dispatches Task(specialist) per stage
#   - Validates artifacts, updates _state.md
#   - Applies judgment inline (path selection, exceptions, extended roles)
#   - Loops until done | hard-blocked | user-needed | iter≥200
#   - Returns final verdict JSON
```

### 6.3 — Surface result to user (one of 4 legitimate stops)

| `result.status` | Surface |
|---|---|
| `done` | "✅ Pipeline hoàn tất — {final_verdict}". Suggest `/close-feature {id}`. |
| `blocked` (hard error) | "❌ Pipeline blocked: {blockers[].description}". Suggest fix. |
| `user-needed` | "⚠ PM cần thông tin từ bạn: {clarification_notes}". Suggest answer + re-run `/resume-feature {id}`. |
| `iter≥200` (safety cap) | "⚠ Pipeline hit safety cap. State preserved at {final_stage}. Re-run `/resume-feature {id}` if healthy." |

Release advisory lock on every exit path.

### 6.4 — Cost rationale

Single `Task(pm)` per `/resume-feature` invocation. PM context grows to ~50-80K accumulating verdicts (well under Cursor 200K auto-compress threshold). Cache_write tax paid once per invocation, not per stage. Compared to legacy skill→dispatcher→agent loop pattern: ~40% cheaper estimated (eliminate Task(dispatcher) overhead per stage).

### 6.5 — Checkpoint markers

PM emits checkpoint markers internally per `notepads/checkpoints.md` on stage advances. Skill does not need to track per-iteration checkpoints — PM handles.

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
