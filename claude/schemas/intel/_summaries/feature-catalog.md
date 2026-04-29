# Schema Summary — Feature Catalog

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/feature-catalog.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): all 5 docs
> **Writer voice hint**: Reference + business intent context

## Purpose

Master list of system features with role-visibility tagging. Cross-references actor-registry, permission-matrix, sitemap. Feeds writers (TKKT/TKCS/TKCT/HDSD) and test-case generation.

## Required top-level fields

- `schema_version`
- `multi_role`
- `roles`
- `features`

## Field structure (depth ≤ 2)

- `schema_version` (string) [const='1.0'] **REQUIRED**
- `multi_role` (boolean) **REQUIRED**
- `roles` (array<string>) **REQUIRED** — Role slugs — denormalized from actor-registry for quick filtering.
- `services` (array<$ref:service>) — Optional grouping for monorepo / microservice layouts.
- `features` (array<$ref:feature>) **REQUIRED** — Flat feature list. When 'services' is present, features are also nested per service for clarity.

## Reusable definitions

#### `$service`
**Fields**:
- `id` (string) **REQUIRED**
- `name` (string) **REQUIRED**
- `tech_stack` (array<string>)
- `feature_ids` (array<string>)

#### `$feature`
**Fields**:
- `id` (string) [pattern='^F-[0-9]{3,}$'] **REQUIRED** — F-NNN format, stable across regenerations.
- `name` (string) [min_chars=5] **REQUIRED** — Vietnamese name.
- `name_en` (string)
- `description` (string) [min_chars=200] **REQUIRED** — Vietnamese full description: WHAT the feature does (function), WHO uses it (actors), WHERE it lives (module/screen). Min 200 chars to prevent thin upstream output.
- `business_intent` (string) [min_chars=100] **REQUIRED** — WHY this feature exists. Business goal, KPI it serves, regulation it satisfies, or pain point it solves. Min 100 chars. Producer MUST extract from doc-brief.md or ask user — never invent.
- `flow_summary` (string) [min_chars=150] **REQUIRED** — HOW the feature works end-to-end: trigger → main steps → outcome. Tóm tắt luồng nghiệp vụ (3-7 bước). Min 150 chars. Source for HDSD section + test scenario derivation.
- `acceptance_criteria` (array<string>) [min_items=3] **REQUIRED** — Testable acceptance criteria (Given-When-Then or imperative). ≥ 3 items, mỗi item ≥ 30 chars. Anchor cho Cursor SDLC implementation + test case generation.
- `business_rules` (array<string>) — Rule-style invariants/constraints (validation rules, calculation formulas, state transitions). Optional but recommended for non-trivial features.
- `user_stories` (array<string>) — Optional 'As a {role}, I want {action}, so that {benefit}' statements.
- `module` (string) — Module/domain grouping.
- `service_id` (string)
- `status` (string) **REQUIRED**
- `priority` (string)
- `role_visibility` (array<object {...}>) [min_items=0] **REQUIRED**
  - **(each array item)**:
    - `role` (string) **REQUIRED** — Role slug.
    - `level` (string) **REQUIRED**
    - `notes` (string)
- `role_variants` (object) — Per-role behavior overrides. Keyed by role slug. References sitemap.feature_overrides for UI specifics.
- `routes` (array<string>) — Route paths from sitemap.routes[].path that implement this feature.
- `entities` (array<string>) — Domain entity ids touched by this feature.
- `dependencies` (array<string>) — Other feature_ids this feature requires.
- `test_case_ids` (array<string>) — Cross-ref to xlsx test-case rows.
- `test_evidence_ref` (string | null) — Path to test-evidence.json entry for this feature, e.g. docs/intel/test-evidence/{feature-id}.json. Populated by resume-feature QA stage; consumed by generate-docs Stage 3a/4f instead of re-running...
- `implementation_evidence` (object {...}) — Captured by close-feature when sealing the feature. Cross-ref bridge between SDLC and docs.
  - `commits` (array<string>) — Git commit shas (or branch name).
  - `test_files` (array<string>) — Relative paths to test files for this feature.
  - `coverage_pct` (number | null)
  - `adrs` (array<string>) — ADR file paths created/updated by this feature.
  - `manual_qa_passed` (boolean | null)
  - `closed_at` (string | null) [format=date-time]
- `evidence` (array<$ref:evidence>)
- `confidence` (string) — high=multi-source verified (code + doc agree); medium=single producer; low=inferred (e.g. controller name only); manual=user-confirmed via interview. Consumers (generate-docs Stage 4) MUST route by...
- `source_producers` (array<string>)
- `tags` (array<string>)

## Critical constraints (quick reference for emit/validate)

- `$defs.feature.id` — pattern='^F-[0-9]{3,}$'
- `$defs.feature.name` — min_chars=5
- `$defs.feature.description` — min_chars=200
- `$defs.feature.business_intent` — min_chars=100
- `$defs.feature.flow_summary` — min_chars=150
- `$defs.feature.acceptance_criteria` — min_items=3
- `$defs.feature.acceptance_criteria[]` — min_chars=30
- `$defs.feature.business_rules[]` — min_chars=20
- `$defs.feature.role_visibility` — min_items=0

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `feature-catalog.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/feature-catalog.schema.json`