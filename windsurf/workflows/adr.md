---
description: Create or evaluate Architecture Decision Record (ADR). Use khi chọn giữa technologies, document design decision với trade-offs + consequences, review system design proposal. Auto-loads engineering domain expertise.
---

# /adr {decision-topic?}

Loads `engineering:architecture` domain skill (Cascade auto-load via description matching).

## Step 1 — Determine mode

| Mode | Trigger | Output |
|---|---|---|
| **Create** | New decision needed | New `docs/adr/ADR-NNN-{slug}.md` |
| **Evaluate** | Review existing decision | Critique with risk + alternatives |
| **Compare** | A vs B vs C technology choice | Decision matrix + recommendation |

## Step 2 — Gather context

Ask:
- Decision being made (1-2 sentences)
- Constraints (technical, organizational, time, budget)
- Stakeholders affected
- Related ADRs (if exists)

Optional: query `mcp__etc-platform__kb_query` for related decisions in KB.

## Step 3 — Generate ADR

Format per `engineering:architecture` skill template:
```
# ADR-NNN: {Title}

## Status
{Proposed | Accepted | Deprecated | Superseded by ADR-XXX}

## Context
{Forces driving the decision}

## Decision
{The choice made}

## Consequences
- Positive: ...
- Negative: ...
- Neutral: ...

## Alternatives considered
- A: rejected because ...
- B: rejected because ...

## Compliance
- Standards: {ISO, NIST, etc.}
- VN gov: {NĐ/QĐ refs}
```

## Step 4 — Save + register

Save to `docs/adr/ADR-{next-NNN}-{slug}.md`. Append entry to `docs/adr/INDEX.md`.

## What's next

| Outcome | Next |
|---|---|
| Created | Reference in `_state.md.completed-stages.sa.adr_assigned` if from feature pipeline |
| Compare matrix | Implement chosen option, link ADR in code commit |
