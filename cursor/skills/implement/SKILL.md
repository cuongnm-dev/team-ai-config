---
name: implement
description: Triển khai code theo đúng kế hoạch đã được duyệt (từ /plan-feature hoặc tech-lead). Dev chạy từng task trong plan, cập nhật test và tài liệu liên quan. Dùng cho task ad-hoc nằm ngoài pipeline; nếu đang trong pipeline đang chạy thì dùng /pm hoặc /resume-feature thay thế. Trigger - đã có plan-id từ /plan; cần thực thi 1 wave hoặc cả plan ngoài pipeline SDLC chính thức. Anti-trigger - chưa có plan thì /plan trước; có _state.md đang active thì /resume-feature; bug cần fix thì /code-change. Example - "/implement plan-id=plan-20260328-auth wave=1".
---

# Implement Feature

**Output language: Vietnamese.**

---

## Input — collect upfront

Ask the user for the following. Do NOT proceed until all are provided:

1. **Plan source** — `plan-id` (e.g. `plan-20260328-user-auth`) | path to plan file | inline plan description
2. **Scope override** — limit implementation to specific tasks from the plan? (or "all tasks")
3. **Wave to execute** — if plan has multiple waves, which wave? (or "wave 1" or "all")
4. **Test update required?** — yes | no | only if existing tests break
5. **Doc update required?** — yes (update README/inline docs) | no

Generate an `impl-id`: `impl-{YYYYMMDD}-{short-slug}`.

---

## Pre-check

Before invoking any agent:

1. Check for active pipelines: scan `docs/features/*/  _state.md` and `docs/hotfixes/*/_state.md`
2. If an active pipeline exists for this feature: **stop** and tell the user:
   > "Pipeline đang active cho feature này. Dùng `/pm {message}` để tiếp tục thay vì /implement."
3. If no active pipeline: proceed.

---

## Orchestration

Dev executes plan tasks → optionally writes test updates → saves implementation report.

```
Task(
  subagent_type="pm",
  prompt="## Ad-hoc Feature Implementation

impl-id: {impl-id}
plan-source: {plan-id or inline plan}
scope: {all tasks | specific tasks}
wave: {wave number or 'all'}
test-update: {yes|no|if-broken}
doc-update: {yes|no}
output-path: docs/implementations/{impl-id}.md

## Plan Content

**Cursor idiom — prefer `@Files` injection over inline read:**
```
@Files docs/plans/{plan-id}.md
```
Composer injects the plan file directly into context — user sees the load, plan content stays in cache instead of re-reading every prompt.

Fallback (when plan-id not provided, only inline plan): include the provided plan inline below.

**Legacy fallback** (when @Files unavailable in target environment): read `docs/plans/{plan-id}.md` via Read tool and inline into prompt.

## Instructions
Run fully autonomously. Do NOT ask the user any questions.

### Step 0 — MCP discovery
Call ListMcpResources. Record as {available_mcps}.
If NX MCP available: call get_affected_projects --base=main for scope validation.
If Context7 available: pass to dev for library docs.

### Step 1 — Dev: implement tasks
For each task in scope (sequentially or per wave):
Task(
  subagent_type='dev',
  prompt='## Ad-hoc Implementation

  impl-id: {impl-id}
  task: {task name and description from plan}
  Files to change: {file list from plan}
  Dev guidance: {dev guidance from plan}
  available-mcps: {available_mcps}

  MCP instruction: If NX MCP available, use get_project_graph to verify module ownership before editing. If Context7 available, use it for any library APIs you need.

  Execute this task:
  1. Read every file you will modify before touching it
  2. Implement the task exactly as specified in the plan
  3. Do NOT expand scope beyond the task boundary
  4. Run lint/typecheck after every meaningful change
  5. Capture: files changed, commands run, exit codes

  output:
  - Files changed (list)
  - Key implementation decisions made
  - Verification: command → exit code for each check run
  - Any deviations from plan (must justify)'
)

### Step 2 — Dev: update tests (if test-update=yes or if-broken)
Task(
  subagent_type='dev',
  prompt='## Test Update

  impl-id: {impl-id}
  Implementation summary: {dev output from Step 1}
  Test requirement: {test-update value}
  available-mcps: {available_mcps}

  MCP instruction: If NX MCP available, run nx affected --target=test --base=main to identify which test suites are affected.

  Update tests:
  1. Run existing tests: nx affected --target=test --base=main
  2. Fix any broken tests caused by the implementation
  3. Add new unit tests for new logic added
  4. Capture: test command → exit code → pass/fail count'
)

### Step 3 — Write implementation report
Task(
  subagent_type='dev',
  prompt='Write to docs/implementations/{impl-id}.md:

---
impl-id: {impl-id}
plan-ref: {plan-id or "inline"}
date: {date}
status: complete
---

# Implementation: {impl-id}

## Summary
{1-paragraph summary of what was implemented}

## Files Changed
{list with brief description of each change}

## Verification Evidence
| Command | Exit Code | Notes |
|---|---|---|
{rows from dev output}

## Test Results
{test command → pass/fail count or "No tests updated"}

## Deviations from Plan
{any deviations with justification — or "None"}

## Definition of Done Checklist
{checklist from plan — each item marked ✅ or ❌}
  '
)

### Step 4 — Respond to user (in Vietnamese)
format:
## Implementation Complete: {impl-id}

**Tasks completed:** {N}/{total}
**Files changed:** {N}
**Tests:** {pass count / updated count or "skipped"}
**Lint/typecheck:** {pass | fail — with details if fail}

**Deviations from plan:** {list or 'None'}

report: docs/implementations/{impl-id}.md

{If any ❌ in DoD checklist: 'Cảnh báo: {N} tiêu chí DoD chưa đạt. Xem report để biết chi tiết.'}

## Stop condition
Stop if: (1) a task requires changes outside the defined scope — surface the scope question to the user, or (2) lint/test failures cannot be resolved within 2 retry attempts — report what was tried.
"
)
```

## ▶ What's next?

| Kết quả | Skill tiếp theo |
|---|---|
| Implementation complete | `/review-pr` — code review trước khi merge |
| Cần test coverage | `/gen-tests` — generate test cases |
| Phát hiện scope lớn hơn | `/update-feature` — điều chỉnh plan trước khi tiếp tục |
| Technical blocker | `/spike` — research giải pháp |
