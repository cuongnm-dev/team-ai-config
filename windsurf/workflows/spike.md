---
description: Time-boxed exploration / proof-of-concept. Validate hypothesis hoặc explore tech choice trước khi commit. Output - spike report với findings + recommendation. Không tạo _state.md cho feature pipeline.
---

# /spike {hypothesis-or-question}

Time-boxed exploration. Throwaway code OK.

## Step 1 — Define spike

Confirm with user:
- Hypothesis or question
- Time-box (default 4 hours, max 1 day)
- Success criteria (what answers the question)
- Scope boundary (what NOT to do)

## Step 2 — Plan spike

Save to `docs/spikes/{date}-{slug}.md`:

```markdown
# Spike: {title}

## Question
{clear statement}

## Hypothesis
{if hypothesis-driven}

## Time-box
{N hours, deadline {date}}

## Success criteria
- [ ] ...
- [ ] ...

## Out-of-scope
- ...

## Plan
1. ...
2. ...
```

## Step 3 — Execute

- Throwaway branch OK
- Skip tests OK (it's a spike)
- Document findings as you go (avoid forgetting)

## Step 4 — Output report

Append to spike doc:

```markdown
## Findings

### Question 1: {original question}
**Answer:** {clear answer}
**Evidence:** {what proves it}

### Surprises / Unknowns
- ...

## Recommendation
{Yes/No/Maybe + 1-paragraph why}

## Risks identified
| Risk | Severity | Mitigation |

## Next steps if accepted
1. {informal plan}

## Sunk cost
- Time spent: {actual hours}
- Code to keep: {0 if pure spike}
- Code to throw away: {scope}
```

## Step 5 — Decide next

User picks:
- `/new-feature` (recommendation accepted, formal implement)
- `/adr` (decision worthy of ADR)
- Discard (hypothesis disproved)

## What's next

| Outcome | Next |
|---|---|
| Hypothesis confirmed | `/new-feature` for formal implement |
| Hypothesis disproved | Document for future, archive |
| Inconclusive | Extend spike or try alternative |
