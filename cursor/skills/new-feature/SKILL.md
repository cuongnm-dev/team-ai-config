---
name: new-feature
description: Khởi tạo pipeline cho 1 tính năng MỚI (không có _state.md trước đó), hoặc cập nhật tính năng đã hoàn thành (status:done) khi có change request. Pipeline đang dở (status:in-progress|blocked) sẽ được redirect sang /resume-feature. Tự đọc AGENTS.md, intel layer (CD-10), tạo _state.md + feature-brief.md + feature-map.yaml + canonical intel entries theo contract chuẩn. Trigger - feature-id chưa tồn tại; user nói "thêm tính năng mới"; change request cho feature đã done. Anti-trigger - feature đang in-progress/blocked thì dùng /resume-feature; chỉ muốn xem status thì /feature-status. Example - "/new-feature" (interactive) hoặc "/new-feature F-042" để mở lại feature done.
---

# Pipeline Entry Point

Single skill for NEW pipeline OR UPDATE of completed feature.
Resume of in-progress pipelines is delegated to `/resume-feature` (P2.1 dedup, 2026-05).

User-facing output: Vietnamese. Artifact files and dispatcher prompts: English.

---

## ⚠️⚠️⚠️ ORCHESTRATOR DISCIPLINE — READ FIRST

You are running this skill as the **outer orchestrator**. After Steps 1-4 finish setup (create `_state.md`, intel entries, feature-map), Step 5 = dispatcher loop. You are NOT the worker.

### Forbidden behaviors:

- ❌ Reading `ba.md`/`sa.md`/`dev.md`/agent definitions and "doing the work yourself"
- ❌ Writing artifact files (`ba/`, `sa/`, `04-tech-lead-plan.md`, dev outputs, qa report, review report)
- ❌ Returning to user with "Bước tiếp theo: chạy /resume-feature" after only 1 stage — that defeats the skill
- ❌ Stopping after dispatcher returns `status=continuing` — you MUST call dispatcher again

### Required behavior:

- ✅ Steps 1-4 = setup (state, intel, feature-map)
- ✅ Step 5 dispatcher loop — call `Task(dispatcher)` repeatedly until status ∈ {`done`, hard `blocked`, `pm-required`→`resume:false`, `iter>=200`}
- ✅ ONLY 4 legitimate stop conditions (see resume-feature/SKILL.md § 6.4 Stop conditions table — same applies here)

**If `notepads/dispatcher-loop.md` fails to load — DO NOT FALLBACK TO DOING WORK YOURSELF.** Use the inlined Step 5 below (mirrors resume-feature SKILL.md § 6).

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

After exit-gate passes → run dispatcher loop (Step 5 below).

---

## Step 4 — UPDATE FLOW

Triggered when `_state.md` found with `status: done`.

Read `notepads/update-flow.md` and follow Step 5U. Covers:
- Read existing artifacts (`ba/`, `sa/`, `04-tech-lead-plan.md`)
- Collect change request
- Triage starting stage (ba | sa | tech-lead | hotfix-redirect)
- Reset `_state.md` and `feature-map.yaml`
- Hand off to dispatcher loop (Step 5 below)

guardrails: same feature-id (no new ID), agents overwrite artifacts in place, do not skip stages in re-run path.

---

## Step 5 — Dispatcher loop (INLINE — same protocol as resume-feature SKILL.md § 6)

After NEW or UPDATE setup completes, run the dispatcher loop in-place. Do NOT defer to a separate `/resume-feature` invocation — that defeats the skill.

### 5.1 — FROZEN_HEADER (compute ONCE)

```
## Pipeline Context
pipeline-type: sdlc
feature-id: {feature-id}
docs-path: {docs-path}
repo-path: {repo-path}
output-mode: {output-mode}
stages-total: {N}
intel-path: {repo-path}/docs/intel/
intel-contract: |
  Canonical intel artifacts at {intel-path}: actor-registry.json, permission-matrix.json, sitemap.json, feature-catalog.json, test-accounts.json (optional).
  See resume-feature/SKILL.md § 6.1 for full sub-agent rules (intel reads, RBAC, QA artifacts, tier reads).
```

### 5.2 — DYNAMIC_SUFFIX (rebuild each iter)

```
## Current State
current-stage: {current-stage}
iter: {iter}
last-verdict: {last-verdict}
```

### 5.3 — Loop (identical semantics to resume-feature § 6.3)

```
iter = 0; pm_count = 0; transient_retry_count = 0; last_verdict = "none"
FROZEN_HEADER = build_frozen_header().rstrip("\n")
PM_FROZEN = build_pm_frozen().rstrip("\n")

WHILE iter < 200:
  iter++
  prompt = FROZEN_HEADER + "\n\n## Current State\ncurrent-stage: {current-stage}\niter: {iter}\nlast-verdict: {last_verdict}"

  result = Task(subagent_type="dispatcher", prompt=prompt)
  status = result.get("status") or "continuing"

  CASE status:
    "continuing":
      last_verdict = result.verdict or "in-progress"
      print "[{stage}] ✓ {verdict}"
      loop                                  # ← do NOT exit on stage transition

    "done":
      reread _state.md
      IF stages-queue non-empty: last_verdict="auto-continue"; loop
      ELSE: report final summary; exit      # ← legitimate stop

    "blocked":
      IF result.blockers contains PARSE-001 or NO-INVOKE-001 AND transient_retry_count < 1:
        transient_retry_count++; continue
      surface blockers, stop                # ← legitimate stop

    "pm-required":
      pm_count++
      IF pm_count > 5: STOP
      pm_result = Task(subagent_type="pm", prompt=PM_FROZEN + "\n\n" + truncate(result.pm-context, 8K))
      IF pm_result invalid OR missing `resume`: STOP
      IF pm_result.resume == true: last_verdict="pm-resolved"; loop   # ← baton back
      ELSE: surface pm_result.message + clarification; STOP   # ← legitimate stop (user-needed)

    default:
      print "⚠ Unknown status — treating as continuing"
      last_verdict = result.verdict or "unknown-status"
      loop
```

### 5.4 — Stop conditions (the ONLY 4 legitimate exits)

| Status | Condition |
|---|---|
| `done` + queue empty | Pipeline complete |
| `blocked` (hard) | Config error / artifact missing / retry exhausted |
| `pm-required` → `resume:false` | PM judges user input needed |
| `iter >= 200` | Safety cap |

Anything else = LOOP.

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
