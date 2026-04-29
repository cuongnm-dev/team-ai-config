# Schema Summary — Project Plan

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/project-plan.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): TKCS (§5)
> **Writer voice hint**: Reference (phases, timeline, RACI)

## Purpose

Phasing, timeline, organization. Tier 3 doc-only — resume-feature SKIPS entirely. Producer: from-doc (interview-driven). Consumed by tdoc-tkcs-writer §5 only. Hard-stop in from-doc Phase 8 if phases[] empty OR organization.owner empty. Justified by: TKCS §5.1-5.3 Đ13 (phân kỳ, tiến độ, tổ chức).

## Required top-level fields

- `schema_version`
- `phases`
- `organization`

## Field structure (depth ≤ 2)

- `schema_version` (string) [const='1.0'] **REQUIRED**
- `phases` (array<object {...}>) [min_items=1] **REQUIRED** — TKCS §5.1 phân kỳ đầu tư. Min 1 phase.
  - **(each array item)**:
    - `id` (string) **REQUIRED** — Phase id, e.g. 'P1'.
    - `name` (string) **REQUIRED** — Vietnamese phase name.
    - `description` (string | null)
    - `duration_months` (number) [min=0.5] **REQUIRED**
    - `start_offset_months` (number | null) — Months from project start.
    - `deliverables` (array<string>) — Concrete deliverables for this phase.
    - `budget_pct` (number | null) [min=0, max=100] — Share of total budget.
    - `milestones` (array<string>)
- `timeline` (array<object {...}>) — TKCS §5.2 tiến độ. Optional Gantt-style task list.
  - **(each array item)**:
    - `task` (string) **REQUIRED**
    - `phase_id` (string | null) — phases[].id this task belongs to.
    - `start_month` (integer) [min=1] **REQUIRED**
    - `end_month` (integer) [min=1] **REQUIRED**
    - `dependencies` (array<string>) — task names this depends on.
    - `responsible` (string | null) — Role/team responsible.
- `organization` (object {...}) **REQUIRED** — TKCS §5.3 tổ chức thực hiện.
  - `owner` (object {...}) **REQUIRED**
  - `implementing_unit` (object | null)
  - `contractor` (object | null)
  - `supervisor` (object | null)
  - `qa_team` (object | null)
  - `stakeholders` (array<object {...}>) — RACI-style stakeholder list.
- `risks` (array<object {...}>) — Project-level execution risks (NOT security threats — those go to security-design.json).
  - **(each array item)**:
    - `risk` (string) **REQUIRED**
    - `category` (enum (one of 8 values))
    - `likelihood` (enum ['very-high', 'high', 'medium', 'low', 'very-low'])
    - `impact` (enum ['catastrophic', 'major', 'moderate', 'minor', 'negligible'])
    - `mitigation` (string) **REQUIRED**
- `warnings` (array<object {...}>)
  - **(each array item)**:
    - `severity` (enum ['high', 'medium', 'low']) **REQUIRED**
    - `category` (string)
    - `message` (string) **REQUIRED**

## Critical constraints (quick reference for emit/validate)

- `phases` — min_items=1

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `project-plan.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/project-plan.schema.json`