---
parent: _state.md
applied-at: 2026-05-01
status: applied — needs F-007 spike to validate
---

# Continuity Fix — Pipeline runs full pipeline without exit

## Problem

User observed: pipeline đôi khi dừng giữa chừng sau wave hoặc giữa stages → phải `/resume-feature` lại. Mỗi re-invocation = fresh skill session = cache_write tax (~$0.30-0.50).

F-001 telemetry confirmed multiple `iter:1` events for dev-wave-2 stage = re-invocations.

## Root cause hypotheses (in priority order)

### 1. Skill loop exit conditions too lenient

Step 7 dispatcher loop có:
- `status=other → STOP` (catch-all on any unknown status)
- `status=blocked` (any blocker → STOP, including transient PARSE-001 errors)
- PM `resume=false` → STOP

If dispatcher returns malformed JSON or transient verdict, skill exits prematurely.

### 2. Cursor IDE external limits

Cursor 3 may impose:
- Max tool calls per skill invocation
- Skill execution timeout
- "Continue?" confirmation prompt after N steps

These are OUTSIDE skill control.

### 3. Ambiguous "Stop here" phrase in dispatcher.md

Line 84 had `"Stop here"` after mid-wave return → could be read by Cursor agent as "stop the entire skill" rather than "stop this dispatcher iteration only".

### 4. Dispatcher might emit non-canonical status

If dispatcher returns ad-hoc status like "paused" or omits status field → skill default → STOP (in old code).

## Fixes applied

### Fix 1: Skill loop LENIENT default

`~/.cursor/skills/resume-feature/SKILL.md` Step 7:

| Before | After |
|---|---|
| `status=other → STOP` | `status=other → log + treat as continuing, loop` |
| Missing status → STOP | Missing status → default to `continuing` |
| `status=done` → exit immediately | `status=done` → re-read `_state.md`, verify stages-queue empty before exit (else continue) |
| Transient blockers (PARSE-001, NO-INVOKE-001) → STOP | Retry once before STOP |

### Fix 2: iter limit 50 → 200

Headroom for long pipelines. Path L with 3 dev waves of 6 tasks = ~15-20 iter typical, well under 200.

### Fix 3: Disambiguate "Stop here" in dispatcher.md

```diff
- Return mid-wave continuing JSON. Stop here.
+ Return mid-wave continuing JSON (`status: continuing`). Skill loop will re-invoke
+ dispatcher; dispatcher will re-glob and spawn next batch. **"Stop here"** = stop
+ the current dispatcher iteration only — DO NOT instruct skill to exit.
```

### Fix 4: Canonical status enforcement in dispatcher.md "Return to Caller"

Added explicit warning:
```
🔴 CRITICAL — `status` MUST always be one of: continuing, done, blocked, pm-required.
Never use ad-hoc statuses ("paused", "waiting", etc.). Skill treats unknown as
continuing but it's a buggy dispatcher signal.
```

## What we CAN'T fix from skill side

- **Cursor IDE auto-pause / "Continue?" prompts**: external. User must click Continue.
- **Cursor session timeout**: external. Workaround: keep pipelines short (Path S target <10 min).
- **Skill execution token limit per invocation**: external if exists.

## Workflow guide updated

`workflow-guide.md` đã bổ sung:
- Quy tắc #6: Click "Continue" prompts
- Quy tắc #7: Don't click Stop button
- Section "Pipeline stops mid-pipeline — known issue" với mitigation steps

## Validation plan

Spike F-007 (giống F-006): chạy 4-stage pipeline, đo:
- Số resume-feature invocations (target: 1)
- Số stage-complete events trong telemetry vs số resume-feature events
- Total cost

Pass criteria:
- 1 invocation completes whole pipeline (status=done)
- Cost ≤ $3 (vs F-006 $3.99 — saving from no cache_write tax on re-invocation)

If F-007 still requires multiple invocations → confirm Cursor IDE external limit, document, accept floor.

## Reversibility

```bash
git -C ~/.cursor checkout HEAD skills/resume-feature/SKILL.md
git -C ~/.cursor checkout HEAD agents/dispatcher.md
```
