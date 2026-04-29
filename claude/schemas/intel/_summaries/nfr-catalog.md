# Schema Summary — NFR Catalog

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/nfr-catalog.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): TKKT (§9), TKCS (§3.2, §3.5)
> **Writer voice hint**: Reference (NFR table with measurable targets)

## Purpose

Non-functional requirements with measurable targets. Tier 3 doc-only — resume-feature SKIPS (sre-observability MAY peek for SLO alignment, optional). Producer: from-doc (target setting) + from-code (current measurement when monitoring data accessible). Consumed by tdoc-tkkt-writer §9 (≥7 NFR items mandate) + tdoc-tkcs-writer §3.2, §3.5. Hard-stop in from-doc Phase 8 if items < 7 OR any item missing target. Justified by: TKCS §3.2 (yêu cầu phi chức năng), §3.5 (ATTT non-functional aspects), TKKT §9 (NFR section).

## Required top-level fields

- `schema_version`
- `items`

## Field structure (depth ≤ 2)

- `schema_version` (string) [const='1.0'] **REQUIRED**
- `items` (array<object {...}>) [min_items=7] **REQUIRED** — Min 7 NFR items per tdoc-tkkt-writer requirement. Each item MUST have requirement + target — generic 'đảm bảo hiệu năng' rejected by writer Step 4.
  - **(each array item)**:
    - `id` (string) [pattern='^NFR-[0-9]{3,}$'] **REQUIRED** — Stable id, e.g. 'NFR-001'.
    - `category` (string) **REQUIRED**
    - `requirement` (string) [min_chars=30] **REQUIRED** — Vietnamese; what the system MUST do (≥30 chars). Example: 'Hệ thống phải đáp ứng truy cập đồng thời của 1000 người dùng'.
    - `target` (string) [min_chars=10] **REQUIRED** — Measurable target. Example: 'API p95 ≤500ms cho 1000 concurrent users', '99.5% uptime', 'Hỗ trợ Chrome/Firefox/Edge phiên bản 2 năm gần nhất'.
    - `measurement_method` (string | null) — How to measure. Example: 'Apache JMeter load test', 'Nagios uptime monitor', 'WAVE accessibility tool'.
    - `current_value` (string | null) — Current measured value (when monitoring exists). Source for gap analysis.
    - `priority` (string)
    - `rationale` (string | null) — Why this target was chosen.
    - `applicable_components` (array<string>) — architecture.components[].name where this NFR applies. Empty = applies to whole system.
    - `tcvn_compliance_ref` (string | null) — Vietnamese standard ref. Example: 'TCVN 11930:2017'.
    - `source_producers` (array<string>)
- `category_distribution` (object) — Pre-computed counts per category for TKKT §9 narrative balance.
- `warnings` (array<object {...}>)
  - **(each array item)**:
    - `severity` (enum ['high', 'medium', 'low']) **REQUIRED**
    - `category` (string)
    - `message` (string) **REQUIRED**
    - `item_id` (string | null)

## Critical constraints (quick reference for emit/validate)

- `items` — min_items=7
- `items[].id` — pattern='^NFR-[0-9]{3,}$'
- `items[].requirement` — min_chars=30
- `items[].target` — min_chars=10

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `nfr-catalog.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/nfr-catalog.schema.json`