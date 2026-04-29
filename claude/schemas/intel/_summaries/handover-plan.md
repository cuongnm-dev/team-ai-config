# Schema Summary — Handover Plan

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/handover-plan.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): TKCT (§9)
> **Writer voice hint**: Reference (training, warranty, maintenance)

## Purpose

Training, deliverables, warranty, maintenance. Tier 3 doc-only — resume-feature SKIPS entirely. Producer: from-doc (interview). Consumed by tdoc-tkct-writer §9 only. Hard-stop in from-doc Phase 8 if training[] empty OR warranty.period_months empty. Justified by: TKCT §9.1-9.3 Đ14 (đào tạo, tài liệu chuyển giao, bảo hành/bảo trì).

## Required top-level fields

- `schema_version`
- `training`
- `deliverables`
- `warranty`

## Field structure (depth ≤ 2)

- `schema_version` (string) [const='1.0'] **REQUIRED**
- `training` (array<object {...}>) [min_items=1] **REQUIRED** — TKCT §9.1 source. Min 1 training plan.
  - **(each array item)**:
    - `audience_role` (string) **REQUIRED** — Role slug or display name. Cross-ref actor-registry.roles[].slug when applicable.
    - `audience_count` (integer | null) [min=1]
    - `topics` (array<string>) [min_items=1] **REQUIRED**
    - `hours` (integer) [min=1] **REQUIRED**
    - `method` (string)
    - `delivery_phase` (string | null) — When in project lifecycle: 'pre-go-live', 'post-go-live', 'continuous'.
    - `materials_provided` (array<string>) — Examples: 'HDSD docx', 'video tutorials', 'lab exercises'.
- `deliverables` (array<object {...}>) **REQUIRED** — TKCT §9.2 source. Documents/artifacts handed to operator.
  - **(each array item)**:
    - `type` (string) **REQUIRED**
    - `name` (string) — Specific deliverable name.
    - `format` (string) **REQUIRED**
    - `audience` (array<string>) — Roles/teams this deliverable serves.
    - `delivery_milestone` (string | null) — When delivered. Example: 'go-live', 'final acceptance'.
- `warranty` (object {...}) **REQUIRED** — TKCT §9.3 source.
  - `period_months` (integer) [min=1] **REQUIRED** — Warranty period from acceptance.
  - `scope` (string | null) — What is covered (bugs, defects, security patches).
  - `exclusions` (array<string>) — What is NOT covered.
  - `sla` (object | null)
  - `support_tier` (string | null)
- `maintenance` (object | null) — Post-warranty maintenance arrangement (optional).
- `knowledge_transfer` (object | null) — Long-term capability building beyond initial training.
- `warnings` (array<object {...}>)
  - **(each array item)**:
    - `severity` (enum ['high', 'medium', 'low']) **REQUIRED**
    - `category` (string)
    - `message` (string) **REQUIRED**

## Critical constraints (quick reference for emit/validate)

- `training` — min_items=1
- `training[].topics` — min_items=1

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `handover-plan.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/handover-plan.schema.json`