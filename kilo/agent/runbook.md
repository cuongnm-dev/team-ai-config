---
description: Document operational runbook cho service — common failure scenarios, recovery steps, monitoring/alerting. Loads engineering-documentation skill. Output - docs/runbooks/{service}.md.
mode: primary
model: anthropic/claude-sonnet-4-20250514
---

# /runbook {service-or-scope}

## Step 1 — Determine scope

| Scope | Output path |
|---|---|
| Service name | `docs/runbooks/{service}.md` |
| Component | `docs/runbooks/{service}-{component}.md` |
| Cross-cutting | `docs/runbooks/general/{topic}.md` |

## Step 2 — Gather context

- Read service code (entry points, error paths)
- Read existing monitoring/alerting configs
- Read past incidents (`docs/incidents/*-{service}-*.md`)
- Read SRE/observability artifacts if exist

## Step 3 — Loads `engineering:documentation` skill

## Step 4 — Generate runbook

```markdown
# Runbook: {service}

## Service Overview
- Purpose
- Critical user journeys
- SLO targets (if defined)
- Dependencies (upstream + downstream)

## Common Failures

### Failure: {name}
**Symptoms:** {what users see, what alerts fire}
**Likely cause:** {hypothesis}
**Verification steps:**
1. Check {logs/dashboard}
2. Confirm {metric} below threshold

**Recovery:**
1. ...
2. ...

**Prevention:**
{what to do to avoid recurrence}

### Failure: {next}
...

## Monitoring Quick Reference
- Dashboard: {URL}
- Logs: {query examples}
- Metrics: {key SLIs}
- Alerts: {what triggers, who responds}

## Deployment Procedure
{routine deploy steps}

## Rollback Procedure
{step-by-step}

## On-call Contact
- Primary: ...
- Secondary: ...

## References
- ADRs: ADR-NNN ...
- Architecture: docs/intel/arch-brief.md
- Past incidents: ...
```

## Step 5 — Validate

Check completeness:
- ≥ 3 failure scenarios documented
- Each has verification + recovery + prevention
- Monitoring section has working URLs
- Contact section filled

## What's next

| Outcome | Next |
|---|---|
| Runbook saved | Reference in service README, link from on-call rotation |
| Gaps found | Schedule SRE work to fill |
| New incident | Re-run runbook to add learnings |
