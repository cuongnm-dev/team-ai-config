# PM Ref: Retrospective Template & Workspace Updates

> **Load on demand only** — read this file ONLY when retrospective trigger criteria are met
> (reviewer returned `Approved`/`Approved with follow-ups` AND `risk_score ≥ 3` OR `rework_count > 0` OR `cycle_time_days > 1`).
> Do NOT read at pipeline start.

---

## Retrospective Template

After the reviewer approves, compose the retrospective content (PM is read-only — delegate writing to `dev`):

```markdown
---
feature-id: { feature-id }
stage: retrospective
agent: pm
created: { YYYY-MM-DD }
total-waves: { N }
cycle-time-days: { N }
tokens-total: { N }
---

# Retrospective: {Feature Name}

## 1. Delivery Summary

- Total waves: N
- Total agents involved: list
- Cycle time: start date → end date
- **Total token usage: {tokens_total} tokens** (from `kpi.tokens_total` in `_state.md`)

## 1.1 Token Breakdown by Stage

| Stage | Agent | Tokens Used |
|---|---|---|
| Requirements | ba | {kpi.tokens_by_stage.ba} |
| Domain modelling | domain-analyst | {kpi.tokens_by_stage.domain-analyst} |
| Architecture | sa | {kpi.tokens_by_stage.sa} |
| UX design | designer | {kpi.tokens_by_stage.designer} |
| Implementation plan | tech-lead | {kpi.tokens_by_stage.tech-lead} |
| Implementation | dev | {kpi.tokens_by_stage.dev} |
| Frontend impl. | fe-dev | {kpi.tokens_by_stage.fe-dev} |
| QA | qa | {kpi.tokens_by_stage.qa} |
| Review | reviewer | {kpi.tokens_by_stage.reviewer} |
| DevOps | devops | {kpi.tokens_by_stage.devops} |
| Security | security | {kpi.tokens_by_stage.security} |
| Release | release-manager | {kpi.tokens_by_stage.release-manager} |
| **Total** | | **{tokens_total}** |

*(Omit rows where tokens = 0 — agent was not invoked)*

## 2. Blockers Encountered

| Stage | Blocker | Root Cause | Resolution | Time Lost |
| ----- | ------- | ---------- | ---------- | --------- |

## 3. Estimation Accuracy

| Wave | Estimated (KPI cycle_time_minutes) | Actual | Delta |
| ---- | ---------------------------------- | ------ | ----- |

## 4. Reusable Patterns Discovered

- Components or tokens added to design system during this feature (from fe-dev summary)
- API patterns or service patterns worth standardizing (from dev summary)
- QA scenarios worth adding to the regression suite (from qa report)

## 5. Process Gaps Found

- Steps in the workflow that were missing, redundant, or caused rework
- Handoff quality issues (missing artifacts, weak verdicts)

## 6. Recommendations for Future Features

- Specific, actionable items — not generic advice
- Each item: what to change + which agent/stage it affects

## 7. Project Knowledge Updates

| Category | Item | Agent(s) that need it | Add to project-knowledge? |
|----------|----- |----------------------|--------------------------|
| Domain Convention | | | Yes / No |
| Architectural Decision | | | Yes / No |
| Coding Anti-Pattern | | | Yes / No |
| Known Failure Mode | | | Yes / No |
| DevOps Pattern | | | Yes / No |

**After retrospective:** PM adds "Yes" rows to `.cursor/rules/40-project-knowledge.mdc` in the relevant section.
format: `[{feature-id}] {item description}`
```

---

## Workspace Catalog Auto-Update (mandatory after retrospective)

After retrospective is saved, PM composes updates for workspace-level catalogs and delegates writing to `dev`:

```
1. service-catalog.md — update the project row:
   | {project} | {type} | {stack} | Active | {feature count} features shipped |

2. capability-registry.md — append new capabilities this feature delivered:
   | {capability-name} | {project} | {US-IDs} | {date shipped} |
   (only add capabilities that are genuinely new — not incremental improvements)
```

Delegate both updates to `dev` in a single documentation task. Do not update workspace architecture docs (`system-context.md`, `containers.md`, `integration-map.md`) — those are only updated when architecture changes, not after every feature.

---

## Delegation Template (write retrospective via dev)

```
Task(subagent_type="dev", prompt="
## Agent Brief
role: dev
pipeline-path: {S|M|L}
output-mode: {lean|full}
stage: retrospective
artifact-file: 09-retrospective.md

## Project Conventions
(none)

## Feature Context
feature-id: {feature-id}
docs-path: {docs-path}

## Inputs
Write the following content verbatim to {docs-path}/09-retrospective.md.
Do not modify the content. Do not run any build or tests. Save the file and confirm.

[PASTE FULLY COMPOSED RETROSPECTIVE CONTENT HERE]
")
```

Update `_state.md` stage 11 to `Done` after dev confirms the file is saved.
