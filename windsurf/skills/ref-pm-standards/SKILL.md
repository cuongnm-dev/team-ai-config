---
name: ref-pm-standards
description: PM artifact standards. Output mode (lean vs full), artifact compression, token tracking schema v2, artifact format standard, context bundle standard, artifact directory structure. Auto-load for any artifact producer.
---

# PM Standards Reference

> **STATUS**: Reference for artifact producers (ba/sa/dev/qa/reviewer/etc.). Defines format and tracking standards.

## Output Mode

| Mode | Use | Artifacts |
|---|---|---|
| **lean** (default) | Speed + cost optimization | `00-lean-spec.md`, `00-lean-architecture.md` (single file per stage) |
| **full** | Compliance / audit | Multi-file: `ba/00-feature-spec.md`, `ba/03-acceptance-criteria.md`, `ba/04-data-needs.md`, `sa/00-architecture-overview.md`, `sa/01-data-model.md`, ... |

Workflows set output-mode in `_state.md` based on user choice + risk.

## Artifact Format Standard

**Non-negotiable for all role artifacts:**

- English structural elements (IDs, field keys, verdict labels, table headers)
- Vietnamese OK in narrative prose (rationale, trade-offs, descriptions)
- Tables/YAML for structured data
- Brevity must NOT sacrifice meaning — keep all metrics, thresholds, qualifiers
- Frontmatter at top with `feature-id`, `stage`, `agent`, `verdict`, `last-updated`

## Token Tracking Standard (v2 — Cursor Rule 23)

All agents MUST emit `token_usage` v2 in verdict:

```json
{
  "input_fresh": 12000,
  "input_cache_read": 45000,
  "input_cache_write": 5000,
  "output_text": 4200,
  "output_reasoning": null,
  "apply_model": null,
  "this_agent_total": 66200,
  "pipeline_total": 145000
}
```

Use `null` for fields the platform doesn't expose — NEVER fake zero. Telemetry computes real cost via weighted formula.

## Context Bundle Standard

When PM passes context to role skills via 4-block prompt:

| Block | Content | Cache benefit |
|---|---|---|
| Agent Brief | role + pipeline-path + output-mode + stage + artifact-file | Cache hit across iterations of same agent |
| Project Conventions | ≤5 lines from global_rules.md | Cache hit across features in same project |
| Feature Context | feature-id + paths + intel-path | Cache hit across stages of one feature |
| Inputs | dynamic content (verdict from prior stages, etc.) | Never cached (expected) |

## Artifact Directory Structure

```
{docs-path}/
├── _state.md                       (PM-owned)
├── feature-brief.md                (from-doc / new-feature)
├── ba/
│   ├── 00-lean-spec.md             (lean mode)
│   ├── 00-feature-spec.md          (full mode)
│   ├── 02-domain-analysis.md
│   ├── 03-acceptance-criteria.md
│   ├── 04-data-needs.md
│   └── 05-nfrs.md
├── sa/
│   ├── 00-lean-architecture.md
│   ├── 00-architecture-overview.md
│   ├── 01-data-model.md
│   ├── 02-frontend-architecture.md
│   ├── 03-api-contract.md
│   ├── 04-threat-model.md
│   ├── 05-deployment-view.md
│   └── 06-operational-architecture.md
├── 02-designer-report.md
├── 04-tech-lead-plan.md
├── 05-dev-w{N}-t{M}.md
├── 05-fe-dev-w{N}-t{M}.md
├── 06-devops-report.md
├── 06b-security-review.md
├── 07-qa-report.md
├── 07-qa-report-w{N}.md
├── 08-review-report.md
├── 09-retrospective.md
├── sre/01-nfr-verification.md
├── data-governance/01-compliance-report.md
├── release/01-release-plan.md
└── .archive/                       (post-close compression target)
```

## Compression at Close

`close-feature` compresses `_state.md` post-seal:
1. Stage Progress: keep header + last 3 rows + Closed row, archive rest
2. Wave History: keep summary line, archive details
3. Inline change-digest: keep title + 1-line, archive full

Result: ~60% size reduction; archive preserves audit trail.

Skip if: `_state.md < 200 lines` OR pipeline-type=hotfix OR output-mode=full.
