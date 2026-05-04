---
name: ref-pm-retrospective
description: PM retrospective trigger + template. Auto-load when close-feature requests retrospective generation OR rework-count > 0 surfaces.
---

# PM Retrospective Reference

> **STATUS**: Template + heuristics for retrospective generation at close-feature.

## When to Generate

- close-feature step 4: if `09-retrospective.md` missing → auto-generate via PM
- rework-count > 0: enrich retrospective with rework analysis
- Severity = Critical/High hotfix: generate postmortem (richer than retro)

## Standard Retrospective Output

**Save to:** `{docs-path}/09-retrospective.md`

```markdown
---
feature-id: {id}
feature-name: {name}
created: {YYYY-MM-DD}
closed: {YYYY-MM-DD}
cycle-time-days: {N}
rework-count-total: {sum}
verdict-final: {reviewer verdict}
---

# Retrospective: {feature-name}

## Summary

| Metric | Value |
|---|---|
| Cycle time | {N days} |
| Stages run | {list} |
| Rework count | {by stage} |
| Final verdict | {verdict} |
| Pipeline tokens | {total} |

## What Went Well

- {bullet}
- {bullet}

## What Didn't Go Well

- {bullet, e.g. "BA missed AC-005 — caught at QA, rework cost 1 wave"}
- {bullet}

## Root Causes (for rework events)

| Rework | Root cause | Stage where root cause originated | Prevention |
|---|---|---|---|
| Dev rework W1-T2 | Missing edge case in AC | ba | BA should run /quality check on AC list |

## Lessons Learned

| Domain | Lesson | Apply to |
|---|---|---|
| Domain Glossary | New term: {term} | rules/40-project-knowledge.mdc |
| Recurring Issue | {pattern observed} | next feature |
| Performance | Latency target {X} achieved with {approach} | similar features |

## Process Improvements

- {actionable improvement}

## Knowledge Base Updates

- Append to `~/.codeium/windsurf/memories/global_rules.md` § {section}
- Add ADR-NNN if architectural decision made

## Postmortem (if hotfix Critical/High)

### Incident Timeline
| Time | Event |
|---|---|

### Root Cause Analysis
{5 whys}

### Action Items
| Action | Owner | Due |
|---|---|---|

### Severity Reduction
{what would have caught this earlier}
```

## Triage Heuristics

| rework-count | Retrospective focus |
|---|---|
| 0 | Light retro — what went smoothly |
| 1 | Standard retro — single rework deep-dive |
| 2-3 | Detailed retro — pattern analysis |
| > 3 | Postmortem-style — process failure analysis |

## KB Update Triggers

After retrospective, MUST append to `global_rules.md` if:
- New domain term coined → Domain Glossary
- ADR-NNN created → Architecture Decisions
- Bug class repeated ≥ 2× → Recurring Issues
- NFR target measured → Performance Notes
- External API quirk → Integration Quirks

If no new lesson → leave explicit "no-lesson" comment, don't leave bare placeholder.
