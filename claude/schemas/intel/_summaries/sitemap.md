# Schema Summary — Sitemap

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/sitemap.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): TKCT (§3.2, §7.1), HDSD (navigation)
> **Writer voice hint**: Reference (route catalog)

## Purpose

Single source of truth for navigation, routes, workflow variants per role, and Playwright automation hints. Absorbs frontend-report.json from older designs.

## Required top-level fields

- `schema_version`
- `roles`
- `routes`

## Field structure (depth ≤ 2)

- `schema_version` (string) [const='1.0'] **REQUIRED**
- `base_url` (string) — Production base URL, e.g. https://etc.example.vn.
- `dev_base_url` (string) — Local dev URL for Playwright runs.
- `roles` (array<$ref:roleNavigation>) **REQUIRED**
- `routes` (array<$ref:route>) **REQUIRED** — Flat route list. Used by tdoc-test-runner for Playwright automation.
- `feature_overrides` (array<$ref:featureOverride>)
- `warnings` (array<string>)

## Reusable definitions

#### `$roleNavigation`
**Fields**:
- `role` (string) **REQUIRED** — Must match actor-registry.roles[].slug.
- `entry_url` (string) **REQUIRED**
- `menu_tree` (array<$ref:menuNode>)
- `dashboard_widgets` (array<object {...}>)
  - **(each array item)**:
    - `id` (string) **REQUIRED**
    - `label` (string)
    - `feature_id` (string)
    - `size` (string)
    - `position` (integer)

#### `$menuNode`
**Fields**:
- `id` (string) **REQUIRED**
- `label` (string) **REQUIRED** — Vietnamese display label.
- `label_en` (string)
- `icon` (string)
- `url` (string)
- `feature_id` (string)
- `permission_check` (string) — Format: '{resource_id}:{action}'. Cross-ref permission-matrix.
- `children` (array<$ref:menuNode>)
- `order` (integer)

#### `$route`
**Fields**:
- `path` (string) **REQUIRED** — URL pattern. Examples: '/dashboard', '/approval/:id', '/api/users/:userId/roles'.
- `method` (string)
- `component` (string) — Frontend component name (when known).
- `feature_id` (string)
- `auth` (object {...})
  - `required` (boolean)
  - `allowed_roles` (array<string>) — Convenience denormalization. Authoritative source = permission-matrix.
  - `permission_check` (string)
- `playwright_hints` (object {...}) — Automation hints for tdoc-test-runner. Replaces frontend-report.json.
  - `wait_for_selector` (string)
  - `wait_for_url` (string)
  - `wait_for_network_idle` (boolean)
  - `form_selectors` (object)
  - `submit_selector` (string)
  - `success_indicator` (string)
  - `screenshot_full_page` (boolean)
- `i18n_keys` (array<string>)
- `evidence` (array<$ref:evidence>)
- `confidence` (string) — Route extraction confidence. high=multi-source (code router + doc menu agree); medium=single producer; low=inferred (e.g. component name only). Consumers route by tier.
- `source_producers` (array<string>)

#### `$featureOverride`
**Fields**:
- `feature_id` (string) **REQUIRED**
- `workflow_variants` (object) — Per-role UI workflow. Keyed by role slug.

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `sitemap.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/sitemap.schema.json`