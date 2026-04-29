# Schema Summary — Cost Estimate

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/cost-estimate.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): TKCS (§6), TKCT (§10)
> **Writer voice hint**: Reference (cost tables, TT 04/2020 method)

## Purpose

Two-level cost estimate: TKCS aggregate (6 standard line items) + TKCT detailed (Function Point per TT 04/2020). Tier 3 doc-only — resume-feature SKIPS entirely. Producer: from-doc + manual interview. Consumed by tdoc-tkcs-writer §6 (aggregate) + tdoc-tkct-writer §10 (detailed FP). Hard-stop in from-doc Phase 8 if summary[] missing 6 standard line items. Justified by: TKCS §6 Đ13 (dự toán sơ bộ), TKCT §10 Đ14 + TT 04/2020 (chi tiết FP).

## Required top-level fields

- `schema_version`
- `basis`
- `summary`

## Field structure (depth ≤ 2)

- `schema_version` (string) [const='1.0'] **REQUIRED**
- `basis` (object {...}) **REQUIRED** — TKCS §6.1 + TKCT §10.1 source.
  - `method` (string) **REQUIRED**
  - `reference_projects` (array<string>) — Comparable projects used for benchmarking.
  - `calculation_date` (string | null) [format=date]
  - `currency_assumption` (string | null)
  - `inflation_assumption_pct` (number | null) [min=0]
  - `vat_included` (boolean)
  - `notes` (string | null)
- `summary` (array<object {...}>) [min_items=6, max_items=8] **REQUIRED** — TKCS §6.2 aggregate table — 6 standard line items (PM, HW, deploy, training, consulting, contingency). Hard-stop in from-doc if any of 6 mandatory items missing.
  - **(each array item)**:
    - `item_code` (string) **REQUIRED** — Roman numeral. I=phần mềm, II=phần cứng, III=triển khai, IV=đào tạo, V=tư vấn+QLDA, VI=dự phòng. VII/VIII for additional.
    - `item_name` (string) **REQUIRED** — Vietnamese category name.
    - `amount_vnd` (integer) [min=0] **REQUIRED**
    - `ratio_pct` (number | null) [min=0, max=100] — Ratio of total. Auto-computed but stored for verification.
    - `expected_range_pct` (string | null) — Expected ratio range per TT 04/2020. Example: '~50-60%' for software.
    - `notes` (string | null)
- `total_summary_vnd` (integer | null) [min=0] — Sum of summary[].amount_vnd. Verified at validate time.
- `detailed` (object | null) — TKCT §10 detailed cost. Optional in TKCS context, mandatory in TKCT.
- `total_detailed_vnd` (integer | null) [min=0] — Sum of detailed.* totals. Should match summary total ±5%.
- `funding` (object | null) — TKCS §6.3 source.
- `warnings` (array<object {...}>)
  - **(each array item)**:
    - `severity` (enum ['high', 'medium', 'low']) **REQUIRED**
    - `category` (string)
    - `message` (string) **REQUIRED**

## Critical constraints (quick reference for emit/validate)

- `summary` — min_items=6, max_items=8

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `cost-estimate.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/cost-estimate.schema.json`