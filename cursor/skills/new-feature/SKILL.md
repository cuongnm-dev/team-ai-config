---
name: new-feature
description: Khởi tạo pipeline cho 1 tính năng MỚI (không có _state.md trước đó), hoặc cập nhật tính năng đã hoàn thành (status:done) khi có change request. Pipeline đang dở (status:in-progress|blocked) sẽ được redirect sang /resume-feature. Tự đọc AGENTS.md, intel layer (CD-10), tạo _state.md + feature-brief.md + feature-map.yaml + canonical intel entries theo contract chuẩn.
---

# Pipeline Entry Point

Single skill for NEW pipeline OR UPDATE of completed feature.
Resume of in-progress pipelines is delegated to `/resume-feature` (P2.1 dedup, 2026-05).

User-facing output: Vietnamese. Artifact files and dispatcher prompts: English.

---

## Step 1 — Detect mode (NEW | RESUME-redirect | UPDATE)

If user provides `feature-id` (e.g. `/new-feature F-042` or `/new-feature api-F-014`):

Locate `_state.md` — resolution order (stop on first match):
1. `docs/feature-map.yaml` → lookup `features.{feature-id}.docs_path` → `{docs_path}/_state.md`
2. `docs/features/{feature-id}/_state.md` (mini-repo fallback)
3. `docs/hotfixes/{feature-id}/_state.md`
4. Glob `**/docs/features/{feature-id}/_state.md` (last resort — auto-backfill `feature-map.yaml` if found)

| Result | Action |
|---|---|
| Found + `status` = `in-progress` or `blocked` | → **REDIRECT to `/resume-feature {feature-id}`** (do NOT inline resume logic) |
| Found + `status: done` | → **UPDATE FLOW** — Read `notepads/update-flow.md` |
| Not found | → **NEW FLOW** — Read `notepads/new-flow.md` |

No `feature-id` provided → **NEW FLOW** — Read `notepads/new-flow.md`.

---

## Step 2 — Redirect handling (in-progress / blocked)

When `_state.md` exists with `status` in {`in-progress`, `blocked`}:

```
Pipeline {feature-id} đang ở stage {current-stage} ({status}).
Dùng `/resume-feature {feature-id}` để tiếp tục — skill đó có dispatcher loop với cost-fix discipline.
```

STOP. Do not load any new-flow logic, do not modify `_state.md`.

---

## Step 3 — NEW FLOW

Read `notepads/new-flow.md` and follow Steps 2 → 4.7 in that file. Covers:
- Step 2: Read AGENTS.md
- Step 2.5: Read canonical intel (CD-10 + LIFECYCLE.md §5.1) with stale-block
- Step 2.7: Semantic duplicate check (Cursor @Codebase)
- Step 3: Determine scope (monorepo only)
- Step 4: Gather info, allocate feature-id, create `_state.md` + `feature-brief.md` + `feature-map.yaml`
- Step 4.5: Initialize canonical `feature-catalog.json` entry
- Step 4.6: Register placeholder in `sitemap.json` + `permission-matrix.json`
- Step 4.7: Exit-gate verification

After exit-gate passes → load `notepads/dispatcher-loop.md` and run loop.

---

## Step 4 — UPDATE FLOW

Triggered when `_state.md` found with `status: done`.

Read `notepads/update-flow.md` and follow Step 5U. Covers:
- Read existing artifacts (`ba/`, `sa/`, `04-tech-lead-plan.md`)
- Collect change request
- Triage starting stage (ba | sa | tech-lead | hotfix-redirect)
- Reset `_state.md` and `feature-map.yaml`
- Hand off to dispatcher loop (`notepads/dispatcher-loop.md`)

guardrails: same feature-id (no new ID), agents overwrite artifacts in place, do not skip stages in re-run path.

---

## What's next

| Outcome | Next skill |
|---|---|
| Pipeline started (NEW) | Dispatcher loop runs automatically; on long pause use `/resume-feature {id}` |
| Pipeline reset (UPDATE) | Dispatcher loop runs automatically |
| Pipeline blocked | `/feature-status` — inspect + surface blocker |
| Pipeline complete | `/close-feature` |
| Need estimate first | `/plan estimate` |
| In-progress detected | `/resume-feature {feature-id}` (auto-redirected at Step 2) |
