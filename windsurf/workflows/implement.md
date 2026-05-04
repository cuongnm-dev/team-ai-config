---
description: Quick implementation workflow cho task có plan rõ. Skip BA/SA/full SDLC. Direct dev → reviewer inline. Dùng cho - prototype, spike outcome, well-defined refactor. Anti-trigger - feature mới /new-feature; bug /hotfix.
---

# /implement {task-description}

Direct implementation, light orchestration.

## Step 1 — Brief plan

Confirm with user:
- Files affected
- Tests to add
- Acceptance criteria (informal)
- Time estimate

## Step 2 — Hand off to PM (lightweight mode)

```
## Mode
orchestrate

## Feature Context
feature-id: implement-{YYYYMMDD}-{slug}
docs-path: docs/implement/{feature-id}    # ephemeral
repo-path: {worktree-path or "."}
intel-path: docs/intel/    # if exists, else "(none)"
worktree-mode: {true | false}
output-mode: lean
pipeline-path: S    # always Path S for /implement

## Inputs
session-context: |
  task: {description}
  pre-scaffold: ba+sa+tech-lead marked Skipped — direct to dev.
```

PM creates ephemeral `_state.md` with `completed-stages.{ba,sa,tech-lead}.verdict: Skipped — /implement workflow`.

PM dispatches `dev` → `reviewer` inline.

## Step 3 — Output

| Mode | Outcome |
|---|---|
| Pass | Done summary, suggest commit message |
| Changes requested | Surface, user decides scope |
| Blocked | Surface, user decides |

## Cleanup

Ephemeral state — don't promote to feature-map.yaml unless user asks. After done, optionally archive `docs/implement/` entries weekly.

## What's next

| Outcome | Next |
|---|---|
| Pass | Commit + PR |
| Found scope creep | Promote to `/new-feature` |
| Need full review | `/audit` |
