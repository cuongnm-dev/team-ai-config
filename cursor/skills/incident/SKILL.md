---
name: incident
description: Điều phối xử lý sự cố mức P0/P1 và viết báo cáo postmortem sau đó. Có 2 chế độ: respond (sự cố đang xảy ra — cần xử lý gấp, communication, mitigation) và postmortem (phân tích không đổ lỗi sau khi đã ổn định, rút bài học cải tiến).
---

# Incident

Absorbs: postmortem.
Modes: `respond` (default) | `postmortem`.
User-facing output: Vietnamese.

Mode detection:
- "incident", "production down", "outage", "P0", "P1" → `respond`
- "postmortem", "post-mortem", "root cause analysis", "blameless" → `postmortem`

For `postmortem` mode: read `docs/incidents/{incident-id}.md` → Task(sre) builds timeline + contributing factors + prevention plan → output `docs/incidents/{incident-id}-postmortem.md`. Show "What's next": `/runbook` if recurring pattern.

For `respond` mode (default): proceed with incident response below.

---

## Input — collect upfront before invoking PM

Ask the user for the following. Do NOT proceed until all are provided:

1. **Incident description** — what is happening right now?
2. **Severity** — P0 (total outage / data loss) | P1 (major feature broken) | P2 (degraded)
3. **Affected services** — which services or features are impacted?
4. **User impact** — how many users affected? What can they not do?
5. **Security suspected?** — any indication of breach, unauthorized access, or data leak? (yes/no)
6. **Start time** — when did this begin?

Generate an `incident-id`: `inc-{YYYYMMDD}-{short-slug}` (e.g. `inc-20260327-payment-down`).

---

## Orchestration

PM is the incident commander. Runs SRE + devops in parallel (P0) or sequentially (P1/P2), adds security if suspected. No mid-flow user interruptions — only surfaces decisions that require user authority.

```
Task(
  subagent_type="pm",
  prompt="## Incident Response — Active Incident

incident-id: {incident-id}
severity: {P0|P1|P2}
start-time: {time}
security-suspected: {yes|no}
output-path: docs/incidents/{incident-id}.md

## Incident Description
{description}

## Affected Services
{services}

## User Impact
{impact}

## Instructions
You are the incident commander. Run the full response workflow autonomously.
For P0: prioritize speed, run SRE and devops in parallel.
For P1/P2: run sequentially.
Do NOT ask the user questions mid-flow — surface only decisions requiring authority.

### Step 1 — SRE: impact assessment and investigation
Task(
  subagent_type='sre-observability',
  prompt='## Active Incident — Impact Assessment

  incident-id: {incident-id}
  severity: {severity}
  description: {description}
  services: {services}
  Start time: {start time}

  Produce immediately:
  1. Blast radius assessment — what is affected beyond what is already known?
  2. Likely root cause hypotheses (ranked by probability)
  3. Immediate diagnostic steps — what to check right now to confirm root cause
  4. Immediate mitigation options — what can reduce user impact in the next 15 minutes?
     (e.g. disable feature flag, redirect traffic, scale up, enable fallback)
  5. Escalation recommendation — should more people be paged?
  6. SLO breach status — which SLOs are currently breached?'
)

### Step 2 — DevOps: infrastructure response
(Run in parallel with SRE for P0, sequential for P1/P2)
Task(
  subagent_type='devops',
  prompt='## Active Incident — Infrastructure Response

  incident-id: {incident-id}
  severity: {severity}
  Services affected: {services}
  SRE hypotheses: {SRE root cause hypotheses}
  SRE mitigations: {SRE immediate mitigations}

  produce:
  1. Infrastructure checks to run immediately
  2. Actions to implement SRE mitigations (exact commands/steps)
  3. Infra-level changes that could have caused this (recent deployments, config changes, resource limits)
  4. Rollback feasibility — can we rollback the most recent deployment safely?
  5. Scaling actions if this is a capacity issue'
)

### Step 3 — Security response (only if security-suspected=yes)
Task(
  subagent_type='security',
  prompt='## Active Incident — Security Assessment

  incident-id: {incident-id}
  description: {description}
  Suspected breach: yes

  produce:
  1. Immediate containment actions (isolate affected systems, revoke tokens, etc.)
  2. Evidence preservation steps (do not destroy logs)
  3. Data exposure assessment — what data may have been accessed or leaked?
  4. Notification obligations — does this require user notification or regulatory reporting?
  5. Forensic investigation plan — what to examine after containment'
)

### Step 4 — Assemble incident response report
Write to docs/incidents/{incident-id}.md:

---
incident-id: {incident-id}
severity: {severity}
status: active
start: {start-time}
commander: pm
---

# Incident: {incident-id}

## Status: ACTIVE

## Situation
{description, affected services, user impact}

## Root Cause Hypotheses
{SRE assessment}

## Immediate Actions (do these now)
{ordered list from SRE + devops}

## Mitigation Steps
{step-by-step from devops}

## Security Response
{if applicable}

## SLO Status
{SRE SLO breach status}

## Escalation
{who to page and when}

### Step 5 — Respond to user (in Vietnamese)
format:
## Incident Response Activated: {incident-id}

**Severity:** {P0/P1/P2}
**Status:** Active — {duration so far}

**Immediate actions (do these NOW):**
1. {action 1}
2. {action 2}
3. {action 3}

**Root cause (most likely):** {top hypothesis}
**Mitigation available:** {yes/no — description}
{if security: '⚠️ Security containment required — see actions above'}

**Next:**
- After stabilizing: use `/postmortem` to write the postmortem
- If code fix needed: use `/hotfix` for the fix pipeline

Incident report: docs/incidents/{incident-id}.md

## Stop condition
Only pause to ask the user if:
- Security breach is confirmed and regulatory notification is required
- P0 rollback requires explicit authorization
"
)
```

## ▶ What's next?

| Outcome | Next |
|---|---|
| Production down | `/hotfix` for emergency fix |
| Related to recent deploy | `/release rollback` |
| Incident resolved | `/incident postmortem` |
| Need ops runbook | `/runbook` |
