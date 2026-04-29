# Schema Summary — System Inventory

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/system-inventory.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): TKKT (§11), TKCS (§3.4), TKCT (§2.3)
> **Writer voice hint**: Reference (tech stack tables)

## Purpose

Tech stack + runtime + service catalog with versions and licenses. Tier 1 cross-stage. Consumed by sa-pro/dev-pro/devops/sre (Cursor SDLC) for tech decisions + tdoc-tkkt-writer/tdoc-tkcs-writer/tdoc-tkct-writer for tech tables. Justified by TKCS §3.4 (Giải pháp công nghệ), TKCT §2.3 (Công nghệ sử dụng), TKKT §11 (Bảng công nghệ theo tầng).

## Required top-level fields

- `schema_version`
- `services`
- `tech_stack`

## Field structure (depth ≤ 2)

- `schema_version` (string) [const='1.0'] **REQUIRED**
- `services` (array<object {...}>) **REQUIRED** — Service-level inventory. Cross-ref code-facts.services[].id (when from-code participates).
  - **(each array item)**:
    - `id` (string) [pattern='^[a-z][a-z0-9-]*$'] **REQUIRED** — Stable service id (kebab-case).
    - `name` (string) **REQUIRED** — Display name (Vietnamese OK).
    - `kind` (string) **REQUIRED**
    - `description` (string) — 1-2 sentence purpose summary.
    - `language` (string) — Primary language slug. Examples: 'typescript', 'python', 'csharp', 'go', 'java', 'php'.
    - `language_version` (string | null) — Language runtime version, e.g. 'TypeScript 5.4', 'Python 3.12', '.NET 8'.
    - `framework` (string | null) — Primary framework slug, e.g. 'nestjs', 'fastapi', 'aspnet-core', 'next.js'.
    - `framework_version` (string | null)
    - `runtime` (string | null) — Execution runtime, e.g. 'Node.js 20.x', 'JVM 17', 'Python 3.12'.
    - `deployment_target` (string | null)
    - `repo_path` (string | null) — Repo-relative path; null for external services.
    - `manifest_file` (string | null) — package.json, *.csproj, pyproject.toml, etc.
    - `tech_stack_refs` (array<string>) — tech_stack[].id values used by this service. Denormalized for quick lookup.
    - `tags` (array<string>) — Free-form tags: 'public-facing', 'internal-only', 'pii-handling', 'high-traffic', etc.
    - `evidence` (array<$ref:evidence>)
    - `confidence` (string) — high=detected from manifest+code; medium=manifest only; low=inferred; manual=user-curated.
    - `source_producers` (array<string>)
- `tech_stack` (array<object {...}>) **REQUIRED** — Layered technology catalog. Min 5 entries (per from-code Phase 8 hard-stop). Must cover all 4 CPĐT 4.0 layers when project is government IT system.
  - **(each array item)**:
    - `id` (string) [pattern='^[a-z][a-z0-9-]*$'] **REQUIRED** — Stable id, e.g. 'pg-15', 'redis-7', 'react-18'.
    - `layer` (string) **REQUIRED** — CPĐT 4.0 layer per QĐ 292/2025: giao-dien (UI) | nghiep-vu (business) | du-lieu (data+app) | ha-tang (infrastructure).
    - `category` (string) **REQUIRED**
    - `name` (string) **REQUIRED** — Product name. Examples: 'PostgreSQL', 'Redis', 'React', 'Next.js', 'Kubernetes'.
    - `version` (string | null) — Exact or range. Example: '15.4', '>=18.0', 'latest'.
    - `license` (string | null) — License slug per SPDX. Examples: 'MIT', 'Apache-2.0', 'GPL-3.0', 'commercial', 'proprietary'.
    - `license_type` (string) — Aggregated license category for cost+compliance analysis.
    - `purpose` (string) — Why this technology was chosen. Used in TKKT §11.2 'Lý do chọn' column.
    - `alternatives_considered` (array<string>) — Tech alternatives evaluated and rejected. Source for TKKT §11.1 standards rationale.
    - `vendor` (string | null) — Vendor or maintainer. Examples: 'Microsoft', 'PostgreSQL Global Development Group', 'Vercel'.
    - `support_status` (string) — Lifecycle status. EOL/deprecated triggers warning in tdoc-tkkt-writer.
    - `support_eol_date` (string | null) [format=date] — End-of-life date if known. Triggers QĐ 292 §11.3 future-tech roadmap discussion.
    - `tcvn_compliance` (array<string>) — Vietnamese standards this tech complies with. Examples: 'TCVN 11930:2017', 'TCVN 12603:2018'.
    - `evidence` (array<$ref:evidence>)
    - `confidence` (string)
    - `source_producers` (array<string>)
- `runtime_environments` (array<object {...}>) — Deployment runtime environments observed (dev/staging/prod). Optional — populated when CI/CD config detected.
  - **(each array item)**:
    - `name` (string) **REQUIRED** — Environment slug: 'dev', 'staging', 'uat', 'prod'.
    - `purpose` (string) **REQUIRED**
    - `url` (string | null)
    - `deployed_services` (array<string>) — services[].id deployed in this environment.
    - `config_overrides_file` (string | null) — Path to env-specific config, e.g. '.env.production'.
- `package_managers` (array<object {...}>) — Package managers used per service. Source for SBOM + dependency audit.
  - **(each array item)**:
    - `service_id` (string) **REQUIRED**
    - `manager` (enum (one of 13 values)) **REQUIRED**
    - `lockfile` (string | null) — Path to lockfile, e.g. 'package-lock.json', 'poetry.lock'.
    - `dependency_count` (integer | null) [min=0] — Total direct + transitive dependencies.
    - `outdated_count` (integer | null) [min=0] — Dependencies with available updates.
    - `vulnerability_count` (object | null)
- `compliance` (object {...}) — Compliance posture relevant to government IT projects. Used in TKKT §10 + TKCS §3.5.
  - `ipv6_readiness` (string) — Per QĐ 292 + Đề án IPv6 Quốc gia. TKCS §3.5 mandate.
  - `ipv6_evidence_files` (array<string>) — Config files showing IPv6 listen/dual-stack: nginx.conf, kubernetes service, etc.
  - `open_standards_used` (array<string>) — Open standards adopted. Examples: 'OpenAPI 3.x', 'OAuth 2.0', 'OIDC', 'SAML 2.0', 'JSON Schema'.
  - `qd_2568_alignment_notes` (string | null) — Free-form notes on alignment with QĐ 2568/QĐ-BTTTT. TKKT §11.1 source.
- `warnings` (array<object {...}>)
  - **(each array item)**:
    - `severity` (enum ['high', 'medium', 'low']) **REQUIRED**
    - `category` (string)
    - `message` (string) **REQUIRED**
    - `tech_id` (string | null) — tech_stack[].id when applicable.
    - `service_id` (string | null)

## Critical constraints (quick reference for emit/validate)

- `services[].id` — pattern='^[a-z][a-z0-9-]*$'
- `tech_stack[].id` — pattern='^[a-z][a-z0-9-]*$'

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `system-inventory.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/system-inventory.schema.json`