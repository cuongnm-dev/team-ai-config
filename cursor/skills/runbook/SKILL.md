---
name: runbook
description: Tạo runbook vận hành cho 1 tính năng hoặc service đã chạy production. SRE liệt kê các kịch bản giám sát và xử lý lỗi thường gặp, DevOps liệt kê thao tác triển khai và hạ tầng, PM tổng hợp lại thành tài liệu hoàn chỉnh. Chạy sau khi tính năng đã được đẩy lên production.
---

# Runbook

**Output language: Vietnamese.**

---

## Input — collect upfront before invoking PM

Ask the user for the following. Do NOT proceed until all are provided:

1. **Feature / service name** — what is this runbook for?
2. **Feature ID** — if this was built via a pipeline, provide feature-id (optional)
3. **Deployment environment** — production / staging / both
4. **Critical paths** — which user flows or operations are most important to keep running?
5. **Known failure modes** — any known ways this feature can fail? (brief, best-effort)

Generate a `runbook-id`: `runbook-{short-slug}` (e.g. `runbook-user-auth`).

---

## Orchestration

PM orchestrates: SRE → devops → assembles runbook.

```
Task(
  subagent_type="pm",
  prompt="## Runbook Creation

runbook-id: {runbook-id}
feature: {feature/service name}
feature-id: {feature-id or 'none'}
environment: {environment}
output-path: docs/runbooks/{runbook-id}.md

## Critical Paths
{critical paths}

## Known Failure Modes
{known failure modes}

## Instructions
Run the runbook creation workflow fully autonomously. Do NOT ask the user any questions.

If feature-id is provided, locate `_state.md` (try `docs/features/{feature-id}/` then `docs/hotfixes/{feature-id}/`), extract `docs-path`, then read `{docs-path}/sa/` for architecture context and `{docs-path}/06d-sre-report.md` if it exists.

### Step 1 — SRE: monitoring and failure scenarios
Task(
  subagent_type='sre-observability',
  prompt='## Runbook — Monitoring and Failure Scenarios

  runbook-id: {runbook-id}
  feature: {feature name}
  Critical paths: {critical paths}
  Known failure modes: {failure modes}

  produce:
  1. Key metrics to monitor (with healthy thresholds where known)
  2. Alerts that should be configured (alert name, condition, severity)
  3. Failure scenario playbook — for each known failure mode:
     - Symptoms (what the user or monitoring sees)
     - Diagnosis steps (how to confirm root cause)
     - Resolution steps (how to fix it)
     - Escalation path (who to page if not resolved in N minutes)
  4. On-call checklist — first 5 things to check when an alert fires
  5. Health check endpoints / commands to verify the feature is healthy
  6. SLO targets recommendation (availability, latency, error rate)'
)

### Step 2 — DevOps: infrastructure and deployment operations
Task(
  subagent_type='devops',
  prompt='## Runbook — Infrastructure and Deployment Operations

  runbook-id: {runbook-id}
  feature: {feature name}
  environment: {environment}

  produce:
  1. Service dependencies map (what this feature depends on)
  2. Configuration management — env vars, secrets, config files to know
  3. Scaling operations — how to scale up/down if needed
  4. Common operational tasks (e.g. cache clear, queue drain, restart service)
  5. Deployment procedure for this specific feature (redeployment steps)
  6. Log locations and how to query useful logs
  7. Database operations (if applicable — backup, restore, migration status check)'
)

### Step 3 — Write runbook
Delegate to dev:
Task(
  subagent_type='dev',
  prompt='Write to docs/runbooks/{runbook-id}.md:

---
runbook-id: {runbook-id}
feature: {feature name}
environment: {environment}
created: {date}
last-updated: {date}
---

# Runbook: {feature name}

## Overview
{what this feature does, why this runbook exists}

## Health Check
{SRE health check commands/endpoints}

## SLO Targets
{SRE SLO recommendations}

## Monitoring and Alerts
{SRE metrics and alert configurations}

## Failure Scenarios
{SRE failure scenario playbook}

## On-call Checklist
{SRE first-response checklist}

## Infrastructure Operations
{DevOps ops tasks, scaling, config}

## Deployment Operations
{DevOps deployment and log procedures}

## Escalation Path
{who to contact and when}
  '
)

### Step 4 — Respond to user (in Vietnamese)
format:
## Runbook Created: {feature name}

**Runbook ID:** {runbook-id}
**Covers:** {N} failure scenarios | {N} monitoring metrics | {N} operational tasks

**Critical monitoring:**
{top 3 metrics from SRE}

**If something breaks:**
Follow the On-call Checklist in the runbook first.

Runbook saved: docs/runbooks/{runbook-id}.md

## Stop condition
Run to completion with available context.
If architecture context is sparse, SRE and devops produce best-effort output
and mark sections as 'Requires validation after first incident'.
"
)
```

## ▶ What's next?

| Kết quả | Skill tiếp theo |
|---|---|
| Runbook created | Attach link vào `_state.md` và AGENTS.md |
| Cần test runbook | Verify procedures trong staging environment |
| Phát hiện gaps | `/postmortem` — review incident history để fill gaps |
| Done | Share với team và update workspace docs |
