---
name: ref-pm-templates
description: PM artifact templates for _state.md initialization (feature/hotfix/doc-generation). Auto-load when creating new pipeline state.
---

# PM Templates Reference

> **STATUS**: Templates for PM / new-feature / hotfix / from-doc skills when initializing `_state.md`.

## _state.md template (feature)

```yaml
---
feature-id: {PREFIX-NNN}
feature-name: "{descriptive name}"
pipeline-type: sdlc
status: in-progress
depends-on: []
created: {YYYY-MM-DD}
last-updated: {YYYY-MM-DD}
current-stage: ba
pipeline-path: unknown    # PM sets after BA
output-mode: lean
risk-score: null          # ba sets
repo-type: {mini | mono}
repo-path: "."
project: {app/service or "cross-cutting"}
project-path: {resolved}
docs-path: docs/features/{feature-id}
intel-path: docs/intel
intel-drift: false
worktree-path: ""         # set if running in worktree
worktree-branch: ""
worktree-base: ""
stages-queue: []          # PM populates after BA
completed-stages: {}
feature-req: |
  file:docs/features/{id}/feature-brief.md
  canonical-fallback:docs/intel/doc-brief.md
  scope-modules: [...]
  scope-features: [{id}]
  dev-unit: {team}
kpi:
  tokens-total: 0
  cycle-time-start: {YYYY-MM-DD}
  tokens-by-stage: {}
  token_budget: 200000     # path default
  budget_thresholds:
    soft_warn_pct: 60
    fast_switch_pct: 80
    block_pct: 95
rework-count: {}
clarification-notes: ""
source-type: {user-input | from-doc | from-code | code-reverse-engineered}
agent-flags: {}
---

# Pipeline State: {feature-name}

## Business Goal
{1-2 sentences from feature-req}

## Stage Progress
| # | Stage | Agent | Verdict | Artifact | Date |
|---|---|---|---|---|---|

## Current Stage
**ba** — Decompose feature-req into AC + business rules.

## Next Action
Skill `ba` will read feature-req, produce `00-lean-spec.md`, return verdict for PM Path Selection.

## Active Blockers
(none)

## Wave Tracker
| Wave | Tasks | Dev Status | QA Status |
|---|---|---|---|

## Escalation Log
| Date | Item | Decision |
|---|---|---|
```

## _state.md template (hotfix)

Same as feature template + override:

```yaml
feature-id: hotfix-{YYYYMMDD}-{slug}
pipeline-type: sdlc
current-stage: tech-lead
pipeline-path: S
risk-score: 2
docs-path: docs/hotfixes/{hotfix-id}
stages-queue: [dev-wave-1, qa-wave-1, reviewer]
completed-stages:
  ba:
    verdict: "Skipped — root cause known, no BA needed"
  sa:
    verdict: "Skipped — no new boundaries"
feature-req: |
  bug: {description}
  Root cause: {file/function/behavior}
  reproduction: {steps}
  scope: {files/modules}
  severity: {Critical|High|Medium}
  constraints: fix scoped to root cause only, rollback must be possible
hotfix-investigation:
  symptom: ...
  candidate-locations:
    - file: ...
      reason: ...
```

## _state.md template (doc-generation)

```yaml
feature-id: docgen-{YYYYMMDD}-{slug}
pipeline-type: doc-generation
current-stage: research    # or doc-intel
docs-path: docs/generated/{slug}
stages-queue: [research, doc-gen-phase, doc-export]
intel-path: docs/intel
output-mode: lean
input-files: [...]    # for doc-intel pipeline
```

## feature-map.yaml entry

```yaml
features:
  {feature-id}:
    name: "{feature-name}"
    project: "{project}"
    docs-path: "docs/features/{feature-id}"
    status: "in-progress | done"
    current-stage: "{stage}"
    created: "{YYYY-MM-DD}"
    updated: "{YYYY-MM-DD}"
    is-hotfix: false
```

## feature-catalog.json entry (intel)

```json
{
  "id": "{feature-id}",
  "name": "{name}",
  "module": "{module-id}",
  "status": "planned | in_development | implemented | deprecated",
  "description": "...",
  "business_intent": "...",
  "flow_summary": "...",
  "acceptance_criteria": ["AC-001: ..."],
  "roles": ["role-slug"],
  "routes": ["/api/v1/..."],
  "tags": [],
  "evidence": [{"kind": "...", "file": "...", "pattern": "..."}],
  "confidence": "high | medium | low | manual",
  "source_producers": ["..."],
  "implementation_evidence": null,    // populated at close-feature
  "test_evidence_ref": null
}
```
