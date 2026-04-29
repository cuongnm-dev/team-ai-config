# Schema Summary — Actor Registry

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/actor-registry.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): TKKT, TKCS, TKCT, HDSD, xlsx
> **Writer voice hint**: Reference (facts about roles)

## Purpose

Canonical roles + auth + RBAC for the system. Single source of truth across from-doc, from-code, generate-docs. NIST RBAC vocabulary.

## Required top-level fields

- `schema_version`
- `multi_role`
- `rbac_mode`
- `roles`

## Field structure (depth ≤ 2)

- `schema_version` (string) [const='1.0'] **REQUIRED**
- `multi_role` (boolean) **REQUIRED** — Whether the system supports multiple distinct roles.
- `rbac_mode` (string) **REQUIRED** — NIST 800-162 access-control model. rbac=role-based, abac=attribute-based, acl=per-resource list, hybrid=mix, implicit=undocumented.
- `rbac_implementation` (array<string>) — How RBAC is enforced in code/doc. Multiple values allowed when both producers contribute.
- `roles` (array<$ref:role>) [min_items=0] **REQUIRED**
- `role_hierarchy_diagram` (string) — Optional Mermaid graph snippet showing inheritance, useful for docs.

## Reusable definitions

#### `$role`
**Fields**:
- `slug` (string) [pattern='^[a-z][a-z0-9-]*$'] **REQUIRED** — kebab-case identifier, stable across regenerations.
- `display` (string) **REQUIRED** — Vietnamese display name.
- `display_en` (string) — English display name for technical docs.
- `description` (string)
- `type` (string) **REQUIRED**
- `inherits_from` (array<string>) — Slugs of parent roles. Permissions are union of self + inherited.
- `auth` (object {...})
  - `login_url` (string | null)
  - `post_login_redirect` (string | null)
  - `credentials_ref` (string | null) — Reference key (NEVER inline secret). Format: 'secrets://{slug}' or 'env://{VAR_NAME}'.
  - `session_strategy` (string)
  - `mfa_required` (boolean)
- `evidence` (array<$ref:evidence>) — Polymorphic — discriminated by 'kind'. Multiple kinds allowed per role.
- `confidence` (string) **REQUIRED** — high=multi-source verified; medium=single producer; low=inferred; manual=user-entered.
- `source_producers` (array<string>)
- `tags` (array<string>)

#### `$evidence`

## Critical constraints (quick reference for emit/validate)

- `roles` — min_items=0
- `$defs.role.slug` — pattern='^[a-z][a-z0-9-]*$'

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `actor-registry.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/actor-registry.schema.json`