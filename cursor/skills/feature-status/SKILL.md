---
name: feature-status
description: Xem trạng thái pipeline đang chạy và sức khỏe tổng thể dự án. 4 chế độ - standup (xem nhanh tất cả pipeline để báo cáo daily), detail (chi tiết 1 pipeline cụ thể), health (xu hướng KPI theo thời gian), overview (tóm tắt cả workspace). READ-ONLY - không sửa _state.md, không advance stage. Trigger - daily standup, báo cáo manager, check sức khỏe trước retro. Anti-trigger - muốn tiếp tục pipeline thì /resume-feature; muốn close thì /close-feature. Example - "/feature-status standup" hoặc "/feature-status detail F-001".
---

# Pipeline Status

Absorbs: health-check, workspace-sync.
Modes: `standup` | `detail` | `health` | `overview`.
User-facing output: Vietnamese.
Runs direct — no PM subagent. Reads files and reports.

## Step 1 — Determine mode

| Input | Mode |
|---|---|
| No argument | `standup` (Step 2A) |
| feature-id | `detail` (Step 2B) |
| `health` or `--health` | `health` (Step 2C) |
| `overview` or `--overview` | `overview` (Step 2D) |

## Step 2A — All Pipelines (Daily Standup)

**Primary: read `docs/intel/feature-catalog.json`** (CD-10 canonical) for authoritative status. **Then read `docs/feature-map.yaml`** for SDLC stage details (current-stage, docs_path).

If `feature-catalog.json` exists:
- Iterate `features[]`. Authoritative status from `features[].status` (proposed | in_design | in_development | implemented | deprecated)
- For each non-implemented feature: lookup `feature-map.features.{id}` for `current-stage` + `docs_path`, then read `{docs_path}/_state.md` for blockers + next action
- **Drift check**: if `feature-catalog.status == implemented` BUT `feature-map.status != done` (or vice versa) → flag DRIFT (close-feature didn't sync). Print warning per drifted feature.

If `feature-catalog.json` absent:
- Warn user: "⚠ Intel layer chưa khởi tạo — chạy /from-code hoặc /from-doc trước để có canonical status"
- Fallback to `feature-map.yaml` only

If both absent:
- Fallback: glob `docs/features/*/_state.md` + `docs/hotfixes/*/_state.md`
- For monorepo also: `**/docs/features/*/_state.md`

For each pipeline, classify:
- **On track** — recent progress, no blockers
- **Needs attention** — no progress 2+ days OR has known risks
- **Blocked** — `status: blocked` or has active blockers
- **Complete** — `status: done`

output:
```
## Daily Standup — {YYYY-MM-DD}

### Summary
| Status | Count |
|---|---|
| On track | {N} |
| Needs attention | {N} |
| Blocked | {N} |
| Complete | {N} |

### Pipeline Details
**{feature-name}** [{type}] — {status icon}
- Stage: {current-stage} | Updated: {last-updated}
- Depends on: {depends-on list or 'None'}
- Blocker: {blockers or 'None'}
- Next: {next action}

### Top priorities
{Blocked first, then oldest last-updated}

### Decisions needed
{Blockers requiring user input — or 'None'}
```

No pipelines found:
```
Không có pipeline nào đang hoạt động. Dùng /new-feature hoặc /hotfix để bắt đầu.
```

## Step 2B — Single Pipeline Detail

Locate `_state.md` — resolution order:
1. `docs/feature-map.yaml` → lookup `features.{id}.docs_path`
2. `docs/features/{id}/_state.md`
3. `docs/hotfixes/{id}/_state.md`
4. Glob `**/docs/features/{id}/_state.md` (last resort)

Not found → stop with VN message.

Read full `_state.md`. List artifacts under `docs-path`.

output:
```
## Pipeline Status: {feature-name}

**Feature ID:** {feature-id}
**Type:** {pipeline-type}
**Status:** {status}
**Created:** {created}
**Updated:** {last-updated}

### Stage Progress
| Stage | Agent | Verdict | Date |
|---|---|---|---|
| {stage} | {agent} | ✅ {verdict} | {date} |
| {stage} | {agent} | ⏳ In Progress | — |
| {stage} | {agent} | ⬜ Pending | — |

### Current Stage
**{stage-name}** — {next action}

### Active Blockers
{blockers or "None"}

### Artifacts
{list files under docs-path}

### Next Step
{one concrete action}
```

## Step 2C — Health (KPI trends from closed pipelines)

Read `docs/feature-map.yaml` → filter all entries. For `status: done`: read `_state.md` → extract `kpi`, `rework-count`, cycle time (`created` → `closed-at`).

output:
```
## Project Health — {YYYY-MM-DD}

### KPI Trends (last {N} pipelines)
| Metric | Avg | Best | Worst | Trend |
|---|---|---|---|---|
| Cycle time | {days} | {days} | {days} | ↑↓→ |
| Rework count | {N} | {N} | {N} | ↑↓→ |
| Blocked count | {N} | {N} | {N} | ↑↓→ |

### Active Pipeline Health
{same as standup summary}

### Recommendations
{based on trends — e.g. "Rework rising → review ba output quality"}
```

## Step 2D — Overview (workspace summary)

Scan workspace structure → summarize projects, features, docs.

Output `docs/OVERVIEW.md`:
```
## Workspace Overview — {date}

### Projects
| Name | Type | Path | Active Features | Done |
|---|---|---|---|---|

### Feature Catalog
{from feature-map.yaml — all features grouped by project}

### Service Catalog
{from tech-brief or AGENTS.md}
```

---

## What's next

| Outcome | Next skill |
|---|---|
| Blocked | `/resume-feature` after resolving blocker |
| Continuing | No action — dispatcher running |
| Done | `/close-feature` |
| Health declining | `/arch-review` or `/plan` |
