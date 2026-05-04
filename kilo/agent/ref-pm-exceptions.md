---
description: PM exception protocols (EP1/EP2/EP3) and rework loop templates. Auto-load when handling Need clarification, Blocked, Fail, Changes Requested verdicts.
mode: subagent
model: anthropic/claude-sonnet-4-20250514
---

# PM Exceptions Reference

> **STATUS**: Reference for PM when exception verdicts arrive.

## Exception Protocols

### EP1 — Convergence (single agent stuck)

**Trigger:** Agent returns `Need clarification` with question that PM can answer from `_state.md` context.

**Action:**
1. Read `_state.md` + prior verdicts in `completed-stages`
2. If answer is in scope → write inline `clarification-resolution` in `_state.md` + re-dispatch same agent with resolution context
3. If answer requires user → set `clarification-notes` + return `status: user-needed`

Max 1 PM EP1 per stage before escalating to user.

### EP2 — Replan (rework needed)

**Trigger:** QA Fail (risk ≥ 3) OR Reviewer Changes Requested.

**Action:**
1. Read failure detail (must-fix list)
2. Determine rework scope:
   - **Dev-only:** must-fix items are implementation issues → re-dispatch dev with must-fix scope. `current-stage = dev-wave-{last N}`.
   - **Backward escalation:** must-fix indicates planning/architecture gap → escalate to tech-lead OR sa OR ba. `current-stage = {appropriate prior stage}`.
   - **Rework scope inference table:**

| Must-fix category | Backward target |
|---|---|
| Code bug, missing test, naming | dev (no escalation) |
| Wrong API contract / data model | sa |
| Wrong implementation approach | tech-lead |
| Missing AC / business rule | ba |
| Architecture drift | sa-pro (force escalate) |

3. Update `_state.md`: increment `rework-count`, reset `current-stage`, re-add stages to queue
4. Continue loop

### EP3 — User Escalate

**Trigger:** EP1 + EP2 exhausted, OR genuinely needs user judgment (scope decision, priority).

**Action:**
1. Set `_state.md.status: user-needed`
2. Write `clarification-notes` with concrete question + relevant context
3. Return verdict to skill with `status: user-needed`
4. Skill surfaces to user, pauses pipeline

## Rework Loop Limits (per `dispatcher` § Loop Safeguards)

- Max 2 dev rework per dev-wave (Path S, PM handles without escalation)
- Max 3 PM-driven reworks per pipeline
- Max 2 backward escalations per pipeline
- If exceeded → block LOOP-001 / LOOP-002

## Inline Resolution Templates

### Need clarification — domain question

```yaml
clarification-resolution: |
  Q (from {agent}): {question}
  A (from PM, derived from _state context): {answer}
  Source: {state field referenced}
  Re-dispatching {agent} with this resolution.
```

### Backward escalation

```yaml
escalation-log:
  - date: {YYYY-MM-DD}
    trigger: "Reviewer Changes Requested — must-fix indicates SA gap"
    backward-from: reviewer
    backward-to: sa
    rework-scope: "Re-design API contract per must-fix item #2"
    must-fix-context: |
      {paste must-fix item}
```

## Anti-patterns (NEVER DO)

- ❌ Skip EP1 → jump straight to user (waste of round-trip)
- ❌ EP2 dev rework when must-fix is architectural (will fail again)
- ❌ EP3 without prior EP1/EP2 attempt (premature escalation)
- ❌ Rework with rework-count already at limit (block instead)
