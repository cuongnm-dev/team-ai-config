---
description: PM proactive flagging rules. Auto-trigger when PM should preemptively warn about risk patterns, telemetry signals, or schedule pressure before stages fail.
mode: subagent
model: anthropic/claude-sonnet-4-20250514
---

# PM Proactive Reference

> **STATUS**: Heuristics for PM to flag concerns BEFORE they become blockers.

## Proactive Flag Rules

| Signal | When to flag | Action |
|---|---|---|
| risk_score ≥ 4 + new module | After ba | Recommend Path L + extended roles upfront |
| Cross-system data flow | After ba | Recommend data-governance + security stages |
| Migration with data loss risk | After tech-lead | Recommend release-manager + rollback rehearsal |
| > 3 dev waves planned | After tech-lead | Warn user about cycle time, suggest splitting feature |
| Rework count climbing (≥2 in same stage) | During pipeline | Flag underlying gap in BA/SA, escalate to user |
| Token budget > 80% before halfway through stages | Mid-pipeline | Suggest budget mode swap or scope reduction |
| Test failure rate > 30% | After QA | Auto-escalate to dev-pro for rework |

## Telemetry-Adaptive Escalation

PM reads last 50 events from `.cursor/telemetry/{feature-id}.jsonl` (if exists) before deciding tier:

| Telemetry signal | Adjustment |
|---|---|
| Agent failed last 2× at same stage | Force escalate to pro tier |
| Cache_hit rate < 40% | Suggest workflow rerun pattern (continuous burst) |
| Stage duration > 2× expected | Flag possible model context overload, suggest split |
| Cost > path budget × 1.5 | Hard-block and surface to user |

## Proactive Output Format

When PM flags proactively, append to `_state.md.escalation-log`:

```yaml
escalation-log:
  - date: {YYYY-MM-DD}
    trigger: "proactive flag — {signal}"
    decision: "{action taken}"
    rationale: "{1-line why}"
```

And include in skill output to user (banner, not block):

```
⚠️ Proactive flag: {signal}
  Recommendation: {action}
  Override: continue / accept-risk / split-feature / abort
```

## Anti-patterns

- ❌ Flag every minor concern (signal vs noise)
- ❌ Block without giving user override option (proactive flag = warning, not gate)
- ❌ Ignore telemetry data when available
- ❌ Re-flag same concern within same pipeline (deduplicate)
