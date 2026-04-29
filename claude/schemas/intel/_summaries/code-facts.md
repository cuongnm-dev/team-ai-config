# Schema Summary — Code Facts

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/code-facts.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): TKKT, TKCT (architecture/data-model derivation)
> **Writer voice hint**: Reference (raw code facts, not for end-user docs)

## Purpose

Normalized stack-agnostic facts extracted from a codebase by `from-code` skill (Phase 1 Static Harvest). Source for all downstream phases — they read ONLY this file, never adapter-specific outputs. Tier 1 cross-stage: consumed by sa/sa-pro/dev-pro/reviewer-pro (Cursor SDLC) + tdoc-researcher (generate-docs). Justified by TKCT §3.1 (module spec), TKCT §3.2 (component name), TKKT §4.2 (logical components), TKCS §3.3 (architecture mapping).

## Required top-level fields

- `schema_version`
- `meta`
- `services`
- `routes`
- `entities`
- `auth_rules`
- `integrations`
- `tests`
- `markers`

## Field structure (depth ≤ 2)

- `schema_version` (string) [const='1.0'] **REQUIRED**
- `meta` (object {...}) **REQUIRED**
  - `generated_at` (string) [format=date-time] **REQUIRED**
  - `repo_path` (string) **REQUIRED** — Absolute or workspace-relative path.
  - `repo_type` (enum ['mono', 'mini']) **REQUIRED** — mono = monorepo with multiple services; mini = single-service repo.
  - `adapters_used` (array<object {...}>) **REQUIRED**
- `services` (array<object {...}>) **REQUIRED** — Service inventory at code level. For mono: multiple entries. For mini: exactly one with id='root'.
  - **(each array item)**:
    - `id` (string) [pattern='^[a-z][a-z0-9-]*$'] **REQUIRED**
    - `name` (string) **REQUIRED**
    - `path` (string) **REQUIRED** — Repo-root-relative path.
    - `kind` (enum (one of 7 values)) **REQUIRED**
    - `language` (string) — Primary language slug (typescript, python, csharp, go, ...).
    - `framework` (string | null)
    - `manifest_file` (string) — package.json, *.csproj, pyproject.toml, ...
- `routes` (array<object {...}>) **REQUIRED** — All HTTP/RPC/MQ routes detected. Source for sitemap.routes[].
  - **(each array item)**:
    - `id` (string) [pattern='^R-[0-9]{3,}$'] **REQUIRED**
    - `service_id` (string) **REQUIRED**
    - `method` (enum (one of 11 values)) **REQUIRED**
    - `path` (string) **REQUIRED** — Normalized URL with path params as {name}.
    - `handler_symbol` (string) **REQUIRED** — Class.Method or function name.
    - `handler_file` (string) **REQUIRED**
    - `handler_line` (integer) [min=1]
    - `handler_loc` (integer) [min=0] — Lines of code; signal for completeness scoring.
    - `cyclomatic` (integer | null) [min=0]
    - `auth_scope` (array<string>) — Normalized vocabulary: 'anonymous' | 'authenticated' | 'role:X' | 'policy:X' | 'scope:X'.
    - `entities_touched` (array<string>) — Entity names referenced in handler body or DTOs.
    - `is_stub` (boolean) — throw NotImplemented, TODO-only body, empty result.
    - `has_error_handling` (boolean)
    - `has_feature_flag` (boolean)
    - `feature_flag_state` (boolean | null)
    - `adapter` (string) **REQUIRED**
    - `confidence` (number) [min=0, max=1] **REQUIRED**
- `entities` (array<object {...}>) **REQUIRED** — Domain entities (ORM models, migrations, code-first attributes, manual). Aggregated source for data-model.json.
  - **(each array item)**:
    - `name` (string) **REQUIRED**
    - `service_id` (string) **REQUIRED**
    - `table_name` (string | null)
    - `fields` (array<object {...}>) **REQUIRED**
    - `relationships` (array<object {...}>)
    - `state_machine` (object | null)
    - `source` (enum ['migration', 'orm-model', 'code-first-attribute', 'sql-script', 'manual']) **REQUIRED**
    - `source_file` (string) **REQUIRED**
    - `migration_version` (string | null)
- `auth_rules` (array<object {...}>) **REQUIRED** — Auth enforcement rules detected from decorators / middleware / policy code.
  - **(each array item)**:
    - `scope` (string) **REQUIRED** — Normalized auth_scope vocabulary.
    - `applies_to` (string) **REQUIRED** — Route id, handler symbol, or class name.
    - `source_file` (string) **REQUIRED**
    - `source_line` (integer) [min=1]
    - `evidence` (string) — Raw code snippet (truncate to 200 chars).
- `integrations` (array<object {...}>) **REQUIRED** — Code-level integration points. Aggregated to integrations.schema.json by from-code Phase 2.
  - **(each array item)**:
    - `kind` (enum (one of 10 values)) **REQUIRED**
    - `direction` (enum ['in', 'out', 'bi']) **REQUIRED**
    - `target` (string) **REQUIRED** — Service name, URL template, queue name, table name, etc.
    - `protocol` (string | null)
    - `config_key` (string | null) — Env var or config key providing the address.
    - `classification` (enum ['core', 'legacy', 'planned', 'unknown'])
    - `source_file` (string) **REQUIRED**
    - `source_line` (integer) [min=1]
- `i18n` (object {...}) — Internationalization snapshot. Used by HDSD writer + UI prose verification.
  - `default_locale` (string | null)
  - `locales` (array<string>)
  - `namespaces` (object)
- `tests` (object {...}) **REQUIRED** — Test file inventory. Cross-ref to test-evidence.test_cases[]. Source for TKCT §8.2 baseline.
  - `files` (array<object {...}>)
  - `coverage_map` (object | null) — If coverage artifacts exist (lcov, coverage.xml), map handler_symbol → coverage %.
- `markers` (array<object {...}>) **REQUIRED** — TODO/FIXME/HACK/NotImplemented occurrences. Used in feature status scoring.
  - **(each array item)**:
    - `kind` (enum ['TODO', 'FIXME', 'HACK', 'XXX', 'NotImplemented', 'Deprecated']) **REQUIRED**
    - `file` (string) **REQUIRED**
    - `line` (integer) [min=1] **REQUIRED**
    - `text` (string)
- `di_graph` (array<object {...}>) — Component dependency edges per service. Used for component diagrams (TKKT §4.1, TKCT diagrams).
  - **(each array item)**:
    - `service_id` (string)
    - `from` (string)
    - `to` (string)
    - `kind` (enum ['constructor-inject', 'property-inject', 'factory', 'direct-import'])
- `configs` (object {...}) — Parsed config files surfaced for architecture reconstruction.
  - `env_keys` (array<string>)
  - `docker_compose_services` (array<any>)
  - `k8s_resources` (array<any>)
  - `feature_flags` (array<object {...}>)
- `warnings` (array<object {...}>) — Non-blocking issues surfaced by extractors.
  - **(each array item)**:
    - `severity` (enum ['high', 'medium', 'low']) **REQUIRED**
    - `category` (string)
    - `message` (string) **REQUIRED**
    - `file` (string | null)

## Critical constraints (quick reference for emit/validate)

- `services[].id` — pattern='^[a-z][a-z0-9-]*$'
- `routes[].id` — pattern='^R-[0-9]{3,}$'

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `code-facts.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/code-facts.schema.json`