# Schema Summary — Permission Matrix

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/permission-matrix.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): TKCT (§5.2), HDSD (per-role chapters)
> **Writer voice hint**: Reference (RBAC matrix)

## Purpose

Role × Resource × Action assignments with ABAC-ready conditions. Cross-references actor-registry.roles[].slug and feature-catalog/sitemap resource ids. Pattern follows Casbin/AWS IAM/Spring Security conventions.

## Required top-level fields

- `schema_version`
- `model`
- `resources`
- `permissions`

## Field structure (depth ≤ 2)

- `schema_version` (string) [const='1.0'] **REQUIRED**
- `model` (string) **REQUIRED** — Must align with actor-registry.rbac_mode (excluding 'implicit' — implicit means no matrix).
- `resources` (array<$ref:resource>) **REQUIRED**
- `permissions` (array<$ref:permission>) **REQUIRED**
- `denials` (array<$ref:permission>) — Explicit deny rules. Override allow per least-privilege principle.
- `uncovered_resources` (array<object {...}>) — Resources mentioned in feature-catalog/sitemap but missing from permissions[]. Audit gap.
  - **(each array item)**:
    - `id` (string) **REQUIRED**
    - `reason` (string) **REQUIRED**
    - `note` (string)

## Reusable definitions

#### `$resource`
**Fields**:
- `id` (string) [pattern='^(feature|route|entity|api|menu)\\.[a-z0-9._-]+$'] **REQUIRED** — Namespaced resource id. Examples: 'feature.approval-request', 'route./api/users', 'entity.User', 'menu.reports'.
- `type` (string) **REQUIRED**
- `ref` (string) — Cross-ref to feature-catalog feature_id (e.g. 'F-012') or sitemap node id.
- `actions` (array<string>) [min_items=1] **REQUIRED** — Verb list. Common: create/read/update/delete/list/export/approve/reject/submit.
- `description` (string)

#### `$permission`
**Fields**:
- `role` (string) **REQUIRED** — Must match actor-registry.roles[].slug OR be the wildcard '*'.
- `resource` (string) **REQUIRED** — Must match resources[].id OR end with '.*' for prefix match.
- `actions` (oneOf [...]) **REQUIRED**
- `effect` (string)
- `conditions` (array<object {...}>) — ABAC predicates. Evaluated at request time when conditions are present.
  - **(each array item)**:
    - `field` (string) **REQUIRED** — JSONPath into request context, e.g. 'request.amount'.
    - `op` (string) **REQUIRED**
    - `value` (any) **REQUIRED**
- `evidence` (array<$ref:evidence>)
- `confidence` (string)

## Critical constraints (quick reference for emit/validate)

- `$defs.resource.id` — pattern='^(feature|route|entity|api|menu)\\.[a-z0-9._-]+$'
- `$defs.resource.actions` — min_items=1

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `permission-matrix.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/permission-matrix.schema.json`