# Canonical Intel Inputs (CD-10) — shared reference

> Included by all SDLC agents (dev, fe-dev, ba, sa, qa, reviewer, security). NEVER edit per-agent — single source of truth.

## Tier-aware read protocol (NEW — token efficiency)

**Decide which file(s) to read based on YOUR tier:**

| Agent tier | Default read | Fallback |
|---|---|---|
| Base tier (`dev`, `qa`, `reviewer`, `ba`, `sa` — non-pro) | `_snapshot.md` (compressed, ~3-5K tokens) | If snapshot stale/missing → fall back to canonical JSON for the specific section needed |
| Pro tier (`*-pro`, `tech-lead`, `security`) | Canonical JSON files (full detail) | — |
| Specialty: `qa` | Snapshot + `test-accounts.json` (snapshot omits credentials) | — |

**Snapshot freshness check** (base tier):
1. Read `_snapshot.meta.json.sources_sha256`
2. If meta missing OR `_snapshot.md` missing → STOP with `intel-snapshot-missing` (user runs `python ~/.cursor/skills/intel-snapshot/generate.py`)
3. If `_meta.artifacts[file].produced_at > _snapshot.meta.generated_at` → snapshot stale, fall back to canonical
4. Else → trust snapshot

**When base-tier MUST read canonical despite snapshot:**
- Implementing/touching auth: read `permission-matrix.json` directly (snapshot omits rationale + evidence chain)
- Generating tests: `test-accounts.json` + relevant `feature-catalog.features[id]` full entry (AC text, error_cases needed verbatim)
- Routing ambiguity: `sitemap.json` workflow_variants section

This protocol cuts ~95% of redundant intel reads while preserving correctness on judgment-critical paths.

---

## Read protocol (before any analysis/implementation)

Read from `{repo-path}/docs/intel/` (canonical CD-10). **Tier classification** per `~/.claude/schemas/intel/OUTLINE_COVERAGE.md` § 8.2:

### Tier 1 — Mandatory (all SDLC agents read; missing = STOP `intel-missing`)

| File | Use for |
|---|---|
| `actor-registry.json` | Role slugs — CANONICAL (use exact strings as enum values, e.g. `Role.HQDK`). Never translate or rename. |
| `permission-matrix.json` | `@Roles()` / `@PreAuthorize()` decorator values; RBAC checks; UI guard conditions. Per-role × per-resource × per-action. |
| `sitemap.json` | Route paths (use exact strings); navigation tree; Playwright hints (`routes[].playwright_hints`); workflow variants per role. |
| `feature-catalog.json` | Per-feature: `description`, `business_intent`, `flow_summary`, `acceptance_criteria[]`, `business_rules[]`, `role_visibility[]`, `routes[]`, `entities[]`. AC list anchors implementation + tests. |
| `test-accounts.json` (if exists) | Test credentials per role for E2E/Playwright. FK `accounts[].role_slug` → actor-registry. |
| `test-evidence/{feature-id}.json` (if exists) | Existing Playwright tests + screenshots per feature (from prior QA runs). REUSE before re-creating. |
| `code-facts.json` | Stack-agnostic facts: services, routes (raw), entities, auth_rules, integrations, di_graph. Pro-tier reads for architecture decisions; base-tier may peek. |
| `system-inventory.json` | Tech stack with version + license, services, runtimes, IPv6 readiness. Pro-tier reads for stack decisions. |

### Tier 2 — Optional cross-stage (pro-tier reads when relevant; base-tier may skip)

Read by `*-pro`, `tech-lead`, `security`, `devops`, `data-governance`, `sre-observability`. Base-tier reads ONLY when feature work directly touches the area.

| File | Read when |
|---|---|
| `data-model.json` | Implementing migration / schema change / data access. Use `tables[].columns[]` for exact types + constraints. `data_dictionary[]` for business meaning. |
| `api-spec.json` | Adding/modifying endpoint. Use `endpoints[].request.body.schema_ref` to align DTO shape with declared contract. |
| `architecture.json` | Designing new component / refactoring service boundary. Use `components[].cpdt_layer` for placement; `models.{overall,logical,physical}_diagram` for context. |
| `integrations.json` | Implementing/modifying external integration. Use `lgsp_metadata` / `ngsp_metadata` / `csdlqg_metadata` for gov bus integration codes. |

### Tier 3 — Doc-only (DO NOT READ)

These artifacts feed `generate-docs` writers ONLY. SDLC agents do NOT read them; do NOT block on them; do NOT write them. Any changes happen via BA interview before `/generate-docs`, not in code workflow.

- `business-context.json`, `nfr-catalog.json`, `security-design.json`, `infrastructure.json`, `cost-estimate.json`, `project-plan.json`, `handover-plan.json`

## Read order (per feature work)

1. `actor-registry.json` + `permission-matrix.json` — establish role/permission vocabulary
2. `feature-catalog.features[]` filter by `id == {feature-id}` — get business intent + AC + flow
3. `sitemap.json` — find routes implementing this feature
4. `test-evidence/{feature-id}.json` (if exists) — see what tests exist already

## Hard rules

- **Missing required Tier 1 intel** (actor-registry, permission-matrix, sitemap, feature-catalog, code-facts, system-inventory) → STOP with verdict `intel-missing: {file}`. Do NOT guess role/route/permission values from prose.
- **Missing Tier 2 intel** when work directly touches that area → emit verdict `intel-thin: {file}` warning. Continue with code-reading fallback (may produce drift; flag for `/intel-refresh`).
- **Stale intel** (`_meta.artifacts[file].stale=true`) → STOP with verdict `intel-stale: {file}` for Tier 1; warn for Tier 2. Suggest user run `/from-code` to regenerate.
- **Drift events** — if your work touches the following intel-bearing surfaces, set `_state.md.intel-drift: true` so `close-feature` triggers `/intel-refresh`:

  | Code change | Drifts which artifact | Tier |
  |---|---|---|
  | Role enum / RBAC decorators / auth middleware | `actor-registry`, `permission-matrix` | T1 |
  | Add/remove/rename route | `sitemap`, `api-spec`, `feature-catalog` | T1+T2 |
  | DDL change (migration, ORM model alter) | `data-model`, `code-facts.entities[]` | T1+T2 |
  | New endpoint with request/response shape | `api-spec.endpoints[]`, `sitemap.routes[]` | T1+T2 |
  | New external HTTP client / SDK call | `integrations`, `code-facts.integrations[]` | T1+T2 |
  | Service split/merge (architecture refactor) | `architecture.components[]`, `system-inventory.services[]` | T1+T2 |
  | New tech / version bump in manifest | `system-inventory.tech_stack[]` | T1 |

  `/intel-refresh` regenerates Tier 1+2 ONLY (Tier 3 is doc-only — manual edit by BA before `/generate-docs`).

- **Naming canonicalization** — when writing code, use intel slugs verbatim. Anti-pattern: reading `slug: "hqdk"` and writing `customs_officer` enum value.
- **Cross-ref before invent** — before defining new role/route/permission/feature/entity/integration, check intel for existing definition. If exists → reuse; if not → escalate via PM.

## DO NOT read these legacy paths (replaced by canonical)

| Legacy | Canonical replacement |
|---|---|
| `intel/stack-report.json` | `docs/intel/system-inventory.json` + `code-facts.json` |
| `intel/arch-report.json` | `docs/intel/architecture.json` + `code-brief.md` + `arch-brief.md` |
| `intel/flow-report.json` | `docs/intel/sitemap.json.workflow_variants` |
| `intel/frontend-report.json` | `docs/intel/sitemap.json.routes[]` |
| `intel/screens/screen-index.json` | `docs/intel/sitemap.json.routes[].screenshots[]` |
| `intel/screenshot-map.json` | `docs/intel/test-evidence/{feature-id}.json.screenshots[]` |
| `docs/intel/features.json` | `docs/intel/feature-catalog.json` |
| `intel/db-schema.json` | `docs/intel/data-model.json` |
| `intel/api-catalog.json` | `docs/intel/api-spec.json` |
| `intel/external-systems.json` | `docs/intel/integrations.json` |
| `~/.claude/skills/from-code/schemas/code-facts.schema.json` (skill-local) | `~/.claude/schemas/intel/code-facts.schema.json` (canonical CD-10) |

---

## Lifecycle Contract Reference (CD-10 Quy tắc 21)

All agents listed in this file conform to a contract box in `~/.claude/schemas/intel/LIFECYCLE.md` §5. Specific assignments:

| Agent | Contract section |
|---|---|
| `ba`, `ba-pro` | §5.2 |
| `sa`, `sa-pro` | §5.3 |
| `qa`, `qa-pro` | §5.4 |
| `dev`, `dev-pro`, `fe-dev` | §5.6 |
| `tech-lead`, `reviewer`, `reviewer-pro`, `designer`, `devops`, `release-manager` | §5.8 Class A — stage-report writer (no intel write) |
| `security`, `data-governance`, `sre-observability` | §5.9 Class B — verifier/validator (read intel, flag drift, no fix) |
| `dispatcher`, `pm`, `telemetry` | §5.10 Class C — orchestrator (control flow, no intel write) |
| `doc-researcher`, `doc-arch-writer`, `doc-catalog-writer`, `doc-manual-writer`, `doc-test-runner`, `doc-testcase-writer`, `doc-tkcs-writer`, `doc-exporter`, `tdoc-researcher`, `tdoc-data-writer`, `tdoc-test-runner`, `tdoc-exporter` | §5.11 Class D — doc-generation consumer (read-only on intel) |
| `doc-intel` | producer; behaves like `/from-doc` Step 5f for Cursor-side doc analysis |

Every agent MUST honor its contract's READ-GATES, OWN-WRITE, ENRICH, FORBID, EXIT-GATES, and STALE-CHECK rules. Violations are caught at PR review and blocked.

**Quick checks every agent performs:**
- Before any intel read: check `_meta.artifacts[file].stale` (P5)
- When tempted to "help" outside scope: REFUSE + escalate (P8)
- When tempted to scan /src for an answer in canonical intel: STOP, look up (P7)
- When upstream artifact has wrong/stale data: FLAG only, do NOT self-fix (P4)
