---
description: Tiếp tục pipeline đang dở từ checkpoint cuối. Đọc _state.md → hand off PM orchestrator. Anti-trigger - feature chưa tạo dùng /new-feature; feature đã reviewer-Pass dùng /close-feature; chỉ readonly view dùng /feature-status.
---

# /resume-feature {feature-id}

User-facing: Vietnamese. PM context block: English.

## Step 1 — Receive input

No arg → prompt: "Nhập docs-path hoặc feature-id".

## Step 2 — Locate `_state.md`

Resolution order (stop on first match):
1. `{arg}/_state.md` (explicit path)
2. `docs/feature-map.yaml` → `features.{arg}.docs_path` → `{docs_path}/_state.md`
3. `docs/features/{arg}/_state.md`
4. `docs/hotfixes/{arg}/_state.md`
5. `docs/generated/{arg}/_state.md`
6. Glob `**/docs/features/{arg}/_state.md` (last resort)

Not found + feature-map present → fuzzy suggest top 3 by Levenshtein ≤ 3.
Not found at all → "Không tìm thấy. Dùng /new-feature hoặc /generate-docs."

**Lock:** Check `{docs-path}/.resume-lock`:
- Exists < 10min → ask wait/force takeover
- Create lock with session-id + timestamp
- Delete on every exit path

## Step 3 — Parse + validate `_state.md`

3.0 Validation:
- YAML parse fails → STOP, suggest backup
- Missing required fields → STOP
- `docs-path` dir missing → STOP

3.1 Extract: all frontmatter + `clarification-notes`, `pre-scaffold*`, `Active Blockers`, `worktree-path`/`worktree-branch`/`worktree-base`

3.1a Worktree alignment (if worktree-path set in state):
```
state_wt = _state.md.worktree-path
env_wt   = $ROOT_WORKTREE_PATH

IF state_wt set AND env_wt NOT set:
  WARN: "Feature {id} originally in worktree {state_wt}. You're in main.
         A) Mở agent ở worktree đó (recommended) — re-run /resume-feature
         B) Continue main (changes apply to main, not branch)
         C) Cancel"

IF state_wt set AND env_wt set AND mismatch:
  ERROR + STOP

IF match: OK — proceed.
IF state_wt NOT set AND env_wt set: backfill state with env_wt.
```

3a. Reconcile with feature-map.yaml: if mismatch on `status` / `current-stage` → ask sync direction.

3b. Dependency check (if `depends-on` non-empty): cycle detection (DFS) hard-block; missing dep → STOP; not-done dep → ask wait/override/cancel.

3c. Pre-scaffold: if `pre-scaffold: true` AND target dir exists → ask move.

## Step 4 — Display status

Mid-wave enrichment if `current-stage` is `dev-wave-{N}` / `fe-dev-wave-{N}`:
- Read TL plan, glob `05-*-w{N}-*.md` → show `{done}/{total} tasks, còn lại: {ids}`

```
## Pipeline: {feature-name}
Feature ID: {id}
stage: {current-stage}  [{done}/{total} tasks if mid-wave]
Đã xong: {completed}
Còn: {queue}
blockers: {or "không có"}
worktree: {worktree-path or "main checkout"}
```

### 4b Clarification answer check

If `clarification-notes` non-empty AND no `User answer:` line:
```
⚠️ PM đã hỏi: {question}
  A) Trả lời  B) Dừng  C) Rollback stage
```

## Step 5 — Distill conversation (sdlc, optional)

Silent review for unpersisted decisions. Skip if nothing relevant.

## Step 6 — Hand off to PM

Build context block:
```
## Mode
orchestrate

## Feature Context
feature-id: {feature-id}
docs-path: {docs-path}
repo-path: {worktree-path if worktree-mode, else repo-path}
intel-path: {intel-path}
worktree-mode: {true | false}
output-mode: {output-mode}
pipeline-path: {pipeline-path or "unknown"}

## Inputs
session-context: {distilled or "(none)"}
```

This auto-loads `pm` skill via Cascade description matching. PM drives end-to-end until done | hard-blocked | user-needed | iter≥200.

Surface PM's final verdict to user.

## Edge cases

| Condition | Action |
|---|---|
| `_state.md` not found | Fuzzy suggest |
| `status: done` | Refuse — pipeline sealed |
| `status: blocked` | Display blockers, ask user resolve |
| `pipeline-type` missing | Infer or ask |
| Legacy no `stages-queue` | Reconstruct |

## What's next

| Type | Outcome | Next |
|---|---|---|
| sdlc | Complete | `/close-feature` |
| sdlc | Blocker | `/feature-status` |
| doc-generation | Done | `/export-docs` (or done) |
| Any | Interrupted | Re-run `/resume-feature {id}` |
