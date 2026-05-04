---
description: Adversarial reviewer cho strategic documents (Đề án CĐS, NCKT, BRD), proposed features. Tìm điểm yếu, gap, mâu thuẫn, không-feasibility. Output - critique-findings.yaml + report.md.
---

# /strategic-critique {target}

Adversarial review. Read-only. Loads multiple critique perspectives.

## Step 1 — Resolve target

| Target | Source |
|---|---|
| feature-id | `docs/features/{id}/feature-brief.md` + ba spec |
| Strategic doc | `docs/strategy/{name}.md` |
| Proposal file | path provided |
| `from-doc-output` | All `docs/intel/*` |

## Step 2 — Apply rubrics

Loads `strategic-critique` rubrics (per Cursor skill equivalent):

### Rubric 1: Feasibility
- Technology readiness
- Resource availability (team, budget, time)
- Regulatory feasibility (VN gov: NĐ 73/2019, NĐ 45/2026 budget thresholds)
- Stakeholder alignment

### Rubric 2: Value
- Business outcome measurable?
- ROI estimate present + realistic?
- KPI defined?
- User value vs cost ratio

### Rubric 3: Risk
- Technical risk
- Project risk (schedule, scope, quality)
- Compliance risk
- Strategic risk (dependency on vendor, lock-in)

### Rubric 4: Dedup (CT 34 Nguyên tắc 6)
- Existing platform/system handles this?
- Cross-check `mcp__etc-platform__dedup_check`
- VN gov ecosystem: LGSP, NDXP, CSDLQG, VNeID — does it duplicate?

### Rubric 5: Coherence
- Internal consistency (sections agree?)
- External consistency (matches related docs?)
- Definition consistency (terms used same?)

### Rubric 6: Completeness
- Required sections present?
- Stakeholder coverage (all roles addressed)?
- Edge cases acknowledged?

## Step 3 — Generate findings

Save to `{target-dir}/critique-findings.yaml`:

```yaml
target: {path}
date: {YYYY-MM-DD}
verdict: Strong | Acceptable | Concerns | Reject

findings:
  - id: F-001
    rubric: feasibility
    severity: critical | high | medium | low | observation
    title: "..."
    evidence: |
      {citation from target}
    impact: |
      {what happens if not addressed}
    recommendation: |
      {actionable fix}

  - id: F-002
    ...
```

## Step 4 — Write report

Save to `{target-dir}/critique-report.md`:

```markdown
# Strategic Critique: {target}

## Verdict: {verdict}

## Executive Summary
{1-paragraph}

## Findings by Rubric
| Rubric | Critical | High | Medium | Low |

## Top Concerns (must address)
1. F-NNN: ...
2. ...

## Recommendations (prioritized)
1. ...
2. ...

## DEDUP Verdict
{exists vs propose new}

## Compliance Verdict
{VN gov standards alignment}
```

## What's next

| Verdict | Next |
|---|---|
| Strong | Proceed to formal pipeline |
| Acceptable | Address Should-Fix items, then proceed |
| Concerns | Major revision needed before proceed |
| Reject | Reformulate or abandon |
