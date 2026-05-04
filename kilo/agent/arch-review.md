---
description: Review existing architecture của 1 service hoặc cross-service interaction. Identify drift, anti-patterns, scaling risks. Output - 1 markdown report với findings + recommendations.
mode: primary
model: anthropic/claude-sonnet-4-20250514
---

# /arch-review {service-or-scope}

## Step 1 — Scope

Identify target:
- Single service (`apps/{name}`, `services/{name}`)
- Cross-service flow (named or feature-id)
- Whole system

## Step 2 — Read inputs

- Source code (read 5-10 representative files)
- `docs/intel/arch-brief.md` + `data-model.json` + `integrations.json` + `api-spec.json`
- Existing ADRs related (`docs/adr/`)

Use `@Codebase` for semantic patterns.

## Step 3 — Analyze (loads `engineering:system-design` skill)

Dimensions:
1. **Module boundaries** — coupling, cohesion
2. **Data flow** — where data lives, how it moves
3. **Failure modes** — what breaks, how, recovery
4. **Scalability** — bottlenecks, hot paths
5. **Security boundaries** — trust zones, auth points
6. **Operational** — observability, ops complexity
7. **Tech debt indicators** — dead code, fragile patterns
8. **Architecture drift** — vs intended ADRs

## Step 4 — Output report

Save to `docs/arch-review/{date}-{scope}.md`:

```markdown
# Architecture Review: {scope}

## Summary
{1-paragraph verdict}

## Findings (per dimension table)
| Area | Finding | Severity | Recommendation |

## Anti-patterns detected
| Pattern | Location | Recommendation |

## Drift vs ADRs
| ADR | Drift | Action |

## Tech Debt Items
| Item | Effort | Impact |

## Recommendations (prioritized)
1. ...
2. ...
```

## What's next

| Severity findings | Next |
|---|---|
| Critical | `/incident` if production risk |
| High | `/spike` to validate fix |
| Medium | `/plan` to schedule refactor |
| Low / observation | Document, defer |
