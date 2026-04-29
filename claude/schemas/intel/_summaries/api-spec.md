# Schema Summary — API Specification

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/api-spec.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): TKCT (§7.1), TKKT (§6 aggregate counts only)
> **Writer voice hint**: Reference (endpoint catalog)

## Purpose

OpenAPI-style endpoint catalog with request/response schemas, auth, examples. Tier 2 cross-stage. sitemap.routes[] has path+method but lacks payload spec — api-spec.endpoints[] fills the gap. Consumed by sa-pro/dev (Cursor when adding endpoint), qa (contract testing) + tdoc-tkct-writer §7.1 (Danh mục API). Justified by TKCT §7.1 — TKKT §6 reads only aggregate counts (audience-profile bans listing paths).

## Required top-level fields

- `schema_version`
- `endpoints`

## Field structure (depth ≤ 2)

- `schema_version` (string) [const='1.0'] **REQUIRED**
- `openapi_version` (string | null) — If exported from existing OpenAPI spec, version reference (e.g. '3.0.3', '3.1.0'). When null, this artifact IS the source of truth.
- `base_paths` (array<object {...}>) — Base URL prefixes per service. Cross-ref system-inventory.services[].id.
  - **(each array item)**:
    - `service_id` (string) **REQUIRED**
    - `base_path` (string) **REQUIRED** — Prefix path, e.g. '/api/v1', '/v2/users'.
    - `external` (boolean) — True if exposed externally (vs internal-only).
- `endpoints` (array<object {...}>) **REQUIRED** — Flat endpoint list. Each endpoint references sitemap.routes[].path + method via FK.
  - **(each array item)**:
    - `operation_id` (string) **REQUIRED** — Unique operation id (camelCase). Example: 'createApprovalRequest'. Used as TC trace anchor.
    - `method` (enum (one of 7 values)) **REQUIRED**
    - `path` (string) **REQUIRED** — Full path including base. Cross-ref sitemap.routes[].path.
    - `service_id` (string | null) — Owning service. Cross-ref system-inventory.services[].id.
    - `feature_id` (string | null) — Cross-ref feature-catalog.features[].id.
    - `summary` (string) — 1-line purpose. Vietnamese for TKCT §7.1 table.
    - `description` (string) — Multi-line detail. Used in TKCT module spec (§3.1).
    - `tags` (array<string>) — Grouping tags. TKKT §6.2 aggregates count by tag.
    - `auth` (object {...})
    - `request` (object {...})
    - `responses` (array<object {...}>)
    - `examples` (array<object {...}>)
    - `rate_limit` (object | null)
    - `deprecation` (object | null)
    - `evidence` (array<$ref:evidence>)
    - `confidence` (string)
    - `source_producers` (array<string>)
- `schemas` (array<object {...}>) — Reusable DTO schemas (OpenAPI components). Referenced by endpoints[].request.body.schema_ref and responses[].schema_ref.
  - **(each array item)**:
    - `id` (string) **REQUIRED** — Schema id (PascalCase). Example: 'UserCreateRequest', 'PaginatedUserList'.
    - `description` (string)
    - `schema` (object) **REQUIRED** — JSON Schema draft-07 fragment defining the shape.
    - `entity_ref` (string | null) — data-model.entities[].name when this schema is the wire format of an entity.
- `aggregate_stats` (object {...}) — Pre-computed aggregates for TKKT §6 (audience-profile bans listing paths). Producer MUST emit; writer MUST NOT recompute via path enumeration.
  - `by_service` (array<object {...}>)
  - `by_tag` (array<object {...}>)
  - `auth_distribution` (object {...})
- `warnings` (array<object {...}>)
  - **(each array item)**:
    - `severity` (enum ['high', 'medium', 'low']) **REQUIRED**
    - `category` (string)
    - `message` (string) **REQUIRED**
    - `operation_id` (string | null)

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `api-spec.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/api-spec.schema.json`