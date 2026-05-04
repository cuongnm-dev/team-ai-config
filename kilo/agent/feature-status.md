---
description: Readonly inspect pipeline state. Hiển thị current-stage, completed-stages, blockers, kpi tokens. Không modify state. Anti-trigger - muốn advance dùng /resume-feature; muốn close dùng /close-feature.
mode: primary
model: anthropic/claude-sonnet-4-20250514
---

# /feature-status {feature-id?}

Read-only view. No state mutation.

## Step 1 — Locate `_state.md`

Same resolution as `/resume-feature` Step 2. No lock acquired.

If no arg → list all active pipelines from `feature-map.yaml`.

## Step 2 — Display

```
## Pipeline: {feature-name}
Feature ID:     {id}
Type:           {feature | hotfix | doc-generation}
Status:         {in-progress | blocked | done}
Current stage:  {stage}  [{done}/{total} mid-wave if applicable]
Pipeline path:  {S | M | L}
Risk score:     {1-5}
Output mode:    {lean | full}

### Completed stages
{table: stage | verdict | date}

### Stages queue
{remaining list}

### Active blockers
{or "không có"}

### KPI
| Metric | Value |
|---|---|
| Tokens total | {total} |
| Cycle time | {start → now/closed} |
| Rework count | {by stage} |

### Wave tracker (if dev/fe-dev wave active)
{table: wave | tasks | dev status | qa status}

### Worktree
{worktree-path if set, else "main checkout"}

### Next action
{suggestion based on current state}
```

## Step 3 — Suggest next

| Status | Suggestion |
|---|---|
| in-progress | `/resume-feature {id}` to continue |
| blocked | Resolve blocker (see Active Blockers) |
| done | `/close-feature {id}` |
| Mid-wave | `/resume-feature {id}` (will auto-detect wave progress) |
| Unknown | `/audit {id}` to investigate |

## Forbidden

- Modifying `_state.md`
- Acquiring lock
- Calling PM or any role skill

Pure read.
