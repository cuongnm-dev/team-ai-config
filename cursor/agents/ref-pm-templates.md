# PM Ref: Artifact Directory & `_state.md` Templates

> **Load on demand only** — read this file when:
> - Initializing a new pipeline (PM Intake — Stage 1)
> - Verifying artifact directory structure mid-pipeline
> - Recovering from missing `_state.md` scenario
>
> Do NOT read for normal state updates (use logic in `pm.md` `_state.md — Update After Every Stage`).

---

## Standard Artifact Directory

All delivery artifacts stored under `{docs-path}` — read from `_state.md` frontmatter:

- Feature pipelines: `docs/features/{feature-id}/`
- Hotfix pipelines: `docs/hotfixes/{hotfix-id}/`

### Feature pipeline structure

```
docs/features/{feature-id}/
  _state.md                          ← dispatcher owns this — pipeline state tracker
  ba/                                ← ba output (Phase 1 — BA)
    00-feature-spec.md
    01-business-process.md
    02-user-stories.md
    03-acceptance-criteria.md
    04-business-rules.md
    05-nfr.md
    06-open-questions.md
    07-test-scenarios.md
  domain-analyst/                    ← ba output (Phase 2 — conditional domain modeling)
    00-domain-overview.md
    01-bounded-contexts.md
    02-aggregates.md
    03-domain-events.md
    04-commands.md
    05-context-map.md
    06-data-ownership.md
    07-open-questions.md
  02-designer-report.md              ← designer output (flat file, conditional)
  sa/                                ← sa output
    00-architecture-overview.md
    01-system-boundaries.md
    02-integration-model.md
    03-data-architecture.md
    04-security-architecture.md
    05-deployment-model.md
    06-nfr-architecture.md
    07-open-questions.md
  04-tech-lead-plan.md               ← tech-lead output
  05-dev-w{N}-{task-slug}.md         ← dev output per wave per task
  05-fe-dev-w{N}-{task-slug}.md      ← fe-dev output per wave per task (conditional)
  05-change-digest-w{N}.md           ← PM-authored digest (Path M/L after each wave)
  06-devops-report.md                ← conditional
  06b-release-manager-report.md      ← conditional
  06c-security-report.md             ← conditional
  06d-sre-report.md                  ← conditional
  06e-data-governance-report.md      ← conditional
  07-qa-report.md                    ← qa output (or 07-qa-report-w{N}.md per-wave)
  08-review-report.md                ← reviewer output
  09-retrospective.md                ← dev writes (delegated by PM after reviewer approves)
  10-deploy-report.md                ← conditional
```

### Feature ID Rules

- Generate from feature name: lowercase, hyphen-separated, max 40 chars
- Example: "User Login with OAuth" → `user-login-oauth`
- Prefix optional: `FEAT-20260101-001`, `AUTH-20260401-002`
- If user does not provide a feature name, ask before proceeding
- Always confirm `feature-id` with user at intake before creating any files

---

## `_state.md` — Initialization Template

When a new feature is received, create `{docs_path}/_state.md` (path resolved from `.cursor/AGENTS.md` — NOT always `docs/features/{feature-id}`):

```markdown
---
feature-id: { feature-id }
feature-name: { Feature Name }
created: { YYYY-MM-DD }
last-updated: { YYYY-MM-DD }
current-stage: intake
output-mode: lean
pipeline-type: sdlc                  # or: doc-intel | doc-generation | hotfix
pipeline-path: { S | M | L }
repo-type: { mini | mono }
project: { name | cross-cutting }
project-path: { resolved path — "." for mini/cross-cutting }
docs-path: { exact resolved path — e.g. "docs/features/FEAT-20260101-001" or "services/auth/docs/features/FEAT-20260101-001" }
stages-queue: []                     # filled by PM or skill at intake
completed-stages: {}                 # populated by Dispatcher
---

# Pipeline State: {Feature Name}

## Business Goal

{1–2 sentence summary from PO request}

## Stage Progress

| # | Stage | Agent | Verdict | Artifact | Date |
|---|---|---|---|---|---|
| 1 | Intake | pm | In Progress | — | {date} |
| 2 | Requirements | ba | — | ba/00-lean-spec.md (lean) / ba/ (full) | — |
| 3 | Domain Modeling | ba | — | domain-analyst/00-lean-domain.md (lean) / domain-analyst/ (full) | — |
| 4 | Design | designer | — | 02-designer-report.md | — |
| 5 | Architecture | sa | — | sa/00-lean-architecture.md (lean) / sa/ (full) | — |
| 6 | Execution Planning | tech-lead | — | 04-tech-lead-plan.md | — |
| 7 | Development | dev/fe-dev | — | 05-dev-w*.md | — |
| 8 | Deployment Readiness | devops | — | 06-devops-report.md | — |
| 9 | QA | qa | — | 07-qa-report.md | — |
| 10 | Review | reviewer | — | 08-review-report.md | — |
| 11 | Retrospective | dev (delegated) | — | 09-retrospective.md | — |

## Current Stage

**Intake** — Awaiting ba delegation.

## Next Action

Invoke `ba` with full PO request.

## Active Blockers

none

## Wave Tracker

| Wave | Tasks | Dev Status | QA Status |
|---|---|---|---|

## Escalation Log

| Date | Item | Decision |
|---|---|---|

## KPI

```yaml
kpi:
  pipeline-opened: ""         # ISO-8601 date when feature was created
  pipeline-closed: ""         # ISO-8601 date when reviewer approved
  cycle-time-days: 0          # calculated at close: pipeline_closed - pipeline_opened
  rework-count: 0             # incremented each time a stage returns "Changes requested"
  retry-count: 0              # incremented each time PM re-invokes a blocked agent
  blocked-count: 0            # incremented each time any agent returns "Blocked"
  escalation-count: 0         # incremented each time dispatcher escalates base→pro tier (see dispatcher.md § Tiered Routing — auto-decided by path + signals)
  routing-override: ""        # rare user override: "all-base" (force cheap) | "all-pro" (force capable) | "" (default: auto)
  tokens-total: 0             # cumulative pipeline token usage — updated after each stage
  token-budget: 200000        # hard cap for entire pipeline — set at intake by PM based on path (S=80K, M=200K, L=500K)
  budget-thresholds:
    soft-warn-pct: 60         # informational note in completion report
    fast-switch-pct: 80       # auto-swap models to *-fast variants for remaining stages
    block-pct: 95             # hard-block; require user approval to continue
  tokens-by-stage:            # breakdown per agent invocation
    ba: 0
    sa: 0
    designer: 0
    tech-lead: 0
    dev: 0                    # sum of all dev wave invocations
    fe-dev: 0                 # sum of all fe-dev wave invocations
    qa: 0
    reviewer: 0
    devops: 0
    security: 0
    release-manager: 0
    sre-observability: 0
    data-governance: 0
```
```

---

## Hotfix-Specific Template

For hotfix pipelines, pre-fill `_state.md` with stages skipped:

```yaml
# Additional frontmatter for hotfix:
pipeline-type: hotfix
pipeline-path: fast-path (ba + sa skipped)
current-stage: tech-lead
stages-queue: [dev-wave-1, qa-wave-1, reviewer]
completed-stages:
  ba:
    verdict: "Skipped — root cause known, no BA/domain analysis needed"
    completed-at: {today YYYY-MM-DD}
  sa:
    verdict: "Skipped — no new architectural boundaries"
    completed-at: {today YYYY-MM-DD}
severity: { Critical | High | Medium }
feature-req: |
  bug: {description}
  Root cause: {specific file/function/behavior}
  reproduction: {steps}
  scope: {files/modules affected}
  constraints: fix scoped to root cause only, rollback must be possible
```

---

## Doc-Pipeline-Specific Template

For doc generation pipelines (`/from-doc`, `/generate-docs`):

```yaml
pipeline-type: doc-intel              # or: doc-generation
current-stage: doc-intel              # or: research
stages-queue: [research, test-runner, doc-gen-phase, doc-export]
input-files: [path1, path2]           # absolute paths to source files
repo-path: { path to codebase being documented }
docs-path: { where to write intel/ and output/ — typically {repo-path}/docs/ }
vision-model: opus-4.7         # for doc-intel phase
multi-file-mode: true                 # if multiple source files provided
project-display-name: "{Display name for output templates}"
dev-unit: "{Development team name for Office template headers}"
```
