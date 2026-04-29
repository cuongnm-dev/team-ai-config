# Schema Summary — Integrations Catalog

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/integrations.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): TKKT (§7), TKCT (§7.2-7.3), TKCS (§3.6)
> **Writer voice hint**: Reference (LGSP/NGSP integration catalog)

## Purpose

External + internal system integrations: LGSP/NGSP/CSDLQG/VNeID + commercial APIs + cross-service calls. Tier 2 cross-stage. Consumed by sa-pro/devops/security (Cursor when designing/implementing integration) + tdoc-tkcs-writer §3.6 (giải pháp tích hợp) + tdoc-tkct-writer §7.2-7.3 (giao thức + LGSP/NGSP) + tdoc-tkkt-writer §7 (sơ đồ tích hợp). Aggregates code-facts.integrations[] (HTTP clients/SDK calls) + from-doc business-level integrations (LGSP/NGSP). Justified by: TKCS §3.6 (Đ13 BẮT BUỘC phân tích kết nối + liên thông), TKCT §7.2-7.3, TKKT §7.

## Required top-level fields

- `schema_version`
- `integrations`

## Field structure (depth ≤ 2)

- `schema_version` (string) [const='1.0'] **REQUIRED**
- `integrations` (array<object {...}>) **REQUIRED** — Flat list of all integration points. Each has direction + protocol + purpose. Hard-stop warning if 0 entries when system-inventory shows external service classes.
  - **(each array item)**:
    - `id` (string) [pattern='^I-[0-9]{3,}$'] **REQUIRED** — Stable id, e.g. 'I-001'.
    - `name` (string) **REQUIRED** — Integration display name. Vietnamese OK.
    - `name_en` (string | null)
    - `type` (string) **REQUIRED** — Integration type. Government bus (LGSP/NGSP/NDXP) and CSDLQG (national databases) are first-class per CT 34 §6 + QĐ 292 Mục V.
    - `direction` (string) **REQUIRED** — From this system's perspective.
    - `purpose` (string) [min_chars=50] **REQUIRED** — Why this integration exists. Min 50 chars Vietnamese. TKCS §3.6 source.
    - `protocol` (string)
    - `endpoint_url` (string | null) — Endpoint URL or template. Mask secrets.
    - `auth_method` (object {...})
    - `data_exchanged` (array<object {...}>) — Entities/messages flowing through this integration. Used in TKCT §7.3 'data_exchanged' + TKCS §3.6 narrative.
    - `sla` (object | null)
    - `status` (string)
    - `first_used_at` (string | null) [format=date]
    - `deprecation_date` (string | null) [format=date]
    - `lgsp_metadata` (object | null) — LGSP-specific metadata. Populated when type ∈ {lgsp, ngsp, ndxp}.
    - `ngsp_metadata` (object | null) — NGSP/NDXP-specific metadata.
    - `csdlqg_metadata` (object | null) — National DB-specific metadata.
    - `consuming_components` (array<string>) — architecture.components[].name that consume this integration.
    - `criticality` (string) — Business criticality. critical = system fails without it; important = degraded UX; nice-to-have = optional.
    - `evidence` (array<$ref:evidence>)
    - `confidence` (string)
    - `source_producers` (array<string>)
- `aggregate_stats` (object {...}) — Pre-computed aggregates. TKKT §7 + TKCS §3.6 narrative source.
  - `by_type` (array<object {...}>)
  - `by_direction` (object {...})
  - `lgsp_count` (integer) [min=0]
  - `ngsp_count` (integer) [min=0]
  - `csdlqg_count` (integer) [min=0]
  - `external_count` (integer) [min=0]
- `warnings` (array<object {...}>)
  - **(each array item)**:
    - `severity` (enum ['high', 'medium', 'low']) **REQUIRED**
    - `category` (string)
    - `message` (string) **REQUIRED**
    - `integration_id` (string | null)

## Critical constraints (quick reference for emit/validate)

- `integrations[].id` — pattern='^I-[0-9]{3,}$'
- `integrations[].purpose` — min_chars=50

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `integrations.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/integrations.schema.json`