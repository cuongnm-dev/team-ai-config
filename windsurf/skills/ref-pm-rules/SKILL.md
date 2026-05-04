---
name: ref-pm-rules
description: PM stage gate rules, extended roles, doc generation agents, verdict taxonomy, cross-agent traceability, domain authority, refinement loop limits, dev wave rules. PM skill auto-loads for stage-gating decisions.
---

# PM Rules Reference

> **STATUS**: Reference skill loaded by `pm` for stage-gating decisions.

## Stage Gate Rules

| Stage | Gate criteria | If failed |
|---|---|---|
| ba | verdict ∈ {Ready for *, Need clarification, Blocked} + risk_score set | Block, return to user |
| sa | verdict ∈ {Ready for Technical Lead planning, Need clarification, Blocked} | Block or rework |
| tech-lead | verdict ∈ {Ready for development, Ready for FE development, Need clarification, Blocked} + wave plan present | Block |
| dev | verdict ∈ {Ready for QA, Ready for review, Need clarification, Blocked} + tests with code | Block, dev rework |
| qa | verdict ∈ {Pass, Fail, Need clarification, Blocked} + atomic triple complete + 100% AC coverage | Fail → rework dev |
| reviewer | verdict ∈ {Approved, Approved with follow-ups, Changes requested, Blocked} | Changes → rework |

## Extended Roles (substantive-change threshold)

Add to `stages-queue` only on substantive change:

| Role | Threshold | NOT for |
|---|---|---|
| designer | new screen / flow / redesign | add field, change label |
| security | auth model change / new PII / trust boundary | permission check added |
| devops | new service / env var / schema migration / CI change | code-only |
| release-manager | multi-service coord / non-trivial rollback with data risk | single-service |
| sre-observability | new vendor/protocol integration / SLO path | minor refactor |
| data-governance | new PII obligation / compliance / cross-system data | internal-only |

Budget: Path S = 0, Path M = max 1, Path L = justified per role.

## Verdict Taxonomy (universal labels)

| Stage | Pass labels | Fail labels |
|---|---|---|
| ba | Ready for Technical Lead planning, Ready for solution architecture | Need clarification, Blocked |
| sa | Ready for Technical Lead planning | Need clarification, Blocked |
| designer | Ready for tech-lead | Need clarification, Blocked |
| tech-lead | Ready for development, Ready for FE development | Need clarification, Blocked |
| dev / fe-dev | Ready for QA, Ready for review | Need clarification, Blocked |
| qa | Pass | Fail, Need clarification, Blocked |
| reviewer | Approved, Approved with follow-ups | Changes requested, Blocked |
| devops | Deployment ready, Deployment ready with risks | Need clarification, Blocked |
| security | Threat model complete, Security cleared, Security cleared with follow-ups | Changes requested, Blocked |
| release-manager | Release ready, Release ready with risks | Need clarification, Blocked |
| sre-observability | SRE ready, SRE ready with gaps | Need clarification, Blocked |
| data-governance | Compliance cleared, Compliance cleared with follow-ups | Changes requested, Blocked |

## Refinement Loop Limits

- Max 2 dev rework per dev-wave (Path S handled by PM, no escalation)
- Max 3 PM-driven reworks per pipeline (any stage)
- Max 2 backward escalations per pipeline (PM sets current-stage to completed)
- Max 5 PM invocations per pipeline (legacy; new flow has PM run inline so this caps escalation count)

## Dev Wave Rules

- Max 4 tasks per wave (cost cap: 4 × dev = ~2M tokens burst)
- Wave sizing per Path: S=1, M=2-3, L=3-5
- Each task has explicit files-to-read list (per tech-lead plan)
- Re-glob check after each batch — only spawn for tasks WITHOUT existing output file

## Domain Authority

| Domain | Authoritative role |
|---|---|
| Requirements / AC | ba |
| Architecture / contracts | sa |
| Implementation plan / waves | tech-lead |
| Code | dev / fe-dev |
| Test design + execution | qa |
| Quality gate | reviewer |
| Threat model + security review | security |
| Deployment readiness | devops |
| SLO / monitoring | sre-observability |
| PII / compliance | data-governance |
| Release sequencing | release-manager |

When two roles disagree → escalate to PM judgment.

## Cross-Agent Traceability

Every artifact MUST cite its inputs:
- `ba/00-lean-spec.md` cites feature-req
- `sa/00-lean-architecture.md` cites ba spec
- `04-tech-lead-plan.md` cites ba + sa
- `05-dev-w*.md` cites tech-lead plan + AC IDs
- `07-qa-report.md` cites tech-lead plan + AC + test-evidence file
- `08-review-report.md` cites all of the above
