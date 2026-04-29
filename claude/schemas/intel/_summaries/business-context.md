# Schema Summary — Business Context

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/business-context.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): TKCS (§1, §2.4, §7, §8), TKCT (§1.2-1.3), TKKT (§1)
> **Writer voice hint**: Reference + Explanation (project facts + WHY for non-tech audience)

## Purpose

Project metadata, legal basis, pain points, objectives, scope, expected benefits, recommendations. Tier 3 doc-only — resume-feature SKIPS this schema entirely (BA agent uses feature-brief.md prose narrative). Producer: from-doc (interview-driven). Consumed by tdoc-tkcs-writer §1, §2.4, §7, §8 + tdoc-tkct-writer §1.2-1.3 + tdoc-tkkt-writer §1. Hard-stop in from-doc Phase 8 if project.name empty, legal_basis empty, or objectives.specific < 3.

## Required top-level fields

- `schema_version`
- `project`
- `legal_basis`
- `objectives`
- `scope`

## Field structure (depth ≤ 2)

- `schema_version` (string) [const='1.0'] **REQUIRED**
- `project` (object {...}) **REQUIRED** — Project identity. TKCS §1.1 source.
  - `name` (string) [min_chars=5] **REQUIRED** — Official project name (Vietnamese).
  - `name_en` (string | null)
  - `code` (string | null) — Project code if assigned by parent program.
  - `owner` (object {...}) **REQUIRED**
  - `implementing_unit` (object | null) — Unit executing the project (may differ from owner).
  - `investment_amount_vnd` (integer | null) [min=0] — Total investment in VND. Drives investment_group classification per NĐ 45/2026 Đ9.
  - `investment_group` (string | null) — NĐ 45/2026 Đ9: A (>1.600 tỷ) | B (90-1.600 tỷ) | C (<90 tỷ). TKCS §1.1 must declare.
  - `approving_authority` (string | null) — Per Đ9 group: A=Bộ TTTT; B=Bộ chủ quản/HĐND; C=Sở/Ban/Ngành.
  - `location` (string | null) — Geographic scope: tỉnh/thành/khu vực.
  - `duration_months` (integer | null) [min=1]
  - `expected_start_date` (string | null) [format=date]
  - `expected_end_date` (string | null) [format=date]
- `legal_basis` (array<object {...}>) [min_items=3] **REQUIRED** — Legal references grounding this project. Min 3 (per from-doc Phase 8 hard-stop). TKCS §1.2 source. Use KB-driven canonical refs (kb_query 'legal').
  - **(each array item)**:
    - `ref_code` (string) **REQUIRED** — Citation. Example: 'Nghị định số 45/2026/NĐ-CP', 'Quyết định số 749/QĐ-TTg'.
    - `title` (string) **REQUIRED** — Full Vietnamese title.
    - `issue_date` (string | null) [format=date]
    - `issuing_authority` (string | null)
    - `applicability` (string) — Why this ref applies to THIS project.
- `current_state` (object {...}) — TKCS §2 Hiện trạng. Optional — populated when project replaces/migrates existing system.
  - `infrastructure_summary` (string | null) — TKCS §2.1 narrative source.
  - `applications_summary` (string | null) — TKCS §2.2 narrative source.
  - `human_resources` (object | null) — TKCS §2.3 source.
  - `swot` (object | null) — TKCS §2.4 SWOT.
- `pain_points` (array<object {...}>) [min_items=3] — Current state pain points motivating this project. Min 3 (per from-doc hard-stop). TKCS §1.3 + §2.4 source.
  - **(each array item)**:
    - `title` (string) **REQUIRED** — Short label.
    - `description` (string) [min_chars=50] **REQUIRED** — Vietnamese ≥50 chars.
    - `severity` (enum ['critical', 'high', 'medium', 'low'])
    - `evidence_refs` (array<string>) — Source documents/incidents.
- `objectives` (object {...}) **REQUIRED** — TKCS §1.4 source. Hard-stop if specific < 3.
  - `overall` (string) [min_chars=100] **REQUIRED** — Strategic goal in 1 paragraph.
  - `specific` (array<object {...}>) [min_items=3] **REQUIRED**
- `scope` (object {...}) **REQUIRED** — TKCS §1.5 + TKCT §1.2 source.
  - `in_scope` (array<string>) [min_items=1] **REQUIRED**
  - `out_of_scope` (array<string>)
  - `boundaries` (string | null) — Free-form prose on system boundaries.
  - `phasing` (string | null) — If multi-phase, summary here; full plan in project-plan.json.
- `expected_benefits` (object {...}) — TKCS §7 source.
  - `economic` (array<object {...}>)
  - `social` (array<object {...}>)
- `recommendations` (array<object {...}>) — TKCS §8 Kiến nghị source. Free-form recommendations to approver.
  - **(each array item)**:
    - `recommendation` (string) [min_chars=30] **REQUIRED**
    - `addressed_to` (string | null) — Audience: 'Chủ đầu tư', 'Cấp thẩm định', etc.
- `references` (array<object {...}>) — TKCT §1.3 Tài liệu tham chiếu source. Cross-references to other artifacts (TKCS, NCKT, standards).
  - **(each array item)**:
    - `title` (string) **REQUIRED**
    - `type` (enum ['internal-doc', 'legal-ref', 'standard', 'study', 'other'])
    - `version` (string | null)
    - `path_or_url` (string | null)
- `glossary` (array<object {...}>) — TKCT §1.4 Thuật ngữ + viết tắt source.
  - **(each array item)**:
    - `term` (string) **REQUIRED**
    - `abbreviation` (string | null)
    - `definition` (string) **REQUIRED**
- `warnings` (array<object {...}>)
  - **(each array item)**:
    - `severity` (enum ['high', 'medium', 'low']) **REQUIRED**
    - `category` (string)
    - `message` (string) **REQUIRED**

## Critical constraints (quick reference for emit/validate)

- `project.name` — min_chars=5
- `legal_basis` — min_items=3
- `pain_points` — min_items=3
- `pain_points[].description` — min_chars=50
- `objectives.overall` — min_chars=100
- `objectives.specific` — min_items=3
- `objectives.specific[].description` — min_chars=50
- `scope.in_scope` — min_items=1
- `recommendations[].recommendation` — min_chars=30

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `business-context.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/business-context.schema.json`