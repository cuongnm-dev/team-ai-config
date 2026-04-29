# Intel Layer Contract

Shared knowledge layer for the SDLC closed loop across `from-doc`, `from-code`, `generate-docs` skills (and future SDLC tooling). Vendor-neutral JSON Schema draft-07 — readable by any IDE, any LLM, any human.

## Scope

This folder defines the **wire contract** between three skills and the SDLC team. It does NOT contain runtime data. Live artifacts live at `{workspace}/docs/intel/` per project.

---

## Diátaxis Taxonomy (primary organizing principle — D1)

Per `WORKFLOW_DESIGN.md` § 0 D1: 5 target documents are organized **primarily by Diátaxis type**, secondarily by Tier.

| Document | Diátaxis type | Audience | Writer voice |
|---|---|---|---|
| **TKKT** | Reference + Explanation | Lãnh đạo Bộ/Tỉnh + KTS trưởng | Architecture facts với design rationale; no implementation detail |
| **TKCS** | Reference + Explanation | Bộ TC / Sở TC / ban QLDA (non-tech) | Investment-language facts với WHY (rationale, alternatives) |
| **TKCT** | Reference (pure) | Engineer + QA + tư vấn giám sát | Technical specs (DDL, API, modules); no narrative |
| **HDSD** | Tutorial + How-to | End users theo role | Step-by-step learning + task-oriented help |
| **xlsx** | Reference (pure) | QA team | Test case catalog |

**Anti-pattern**: blurring Diátaxis types within a single document (e.g. tutorial trộn explanation rationale). Each writer prompt MUST cite its Diátaxis type explicitly.

→ See `WORKFLOW_DESIGN.md` § 0 D1 for full rationale.
→ See `_summaries/{schema}.md` for Diátaxis tag per consumer artifact.

---

## Tier Classification (secondary — consumer-driven tag)

Per `WORKFLOW_DESIGN.md` § 0 D7 (demoted from primary). Tier indicates **which consumer reads what**:

- **Tier 1**: mandatory cross-stage (from-code + from-doc emit; resume-feature + generate-docs read)
- **Tier 2**: optional cross-stage (pro-tier SDLC reads when relevant; writers read)
- **Tier 3**: doc-only (resume-feature SKIPS; only generate-docs reads)

Tier is now a **secondary tag** for orchestration purposes, not the primary mental model. Writers organize by Diátaxis type; orchestrators organize by Tier.

## Files

Schemas are **tier-classified** per `OUTLINE_COVERAGE.md` § 8.2 to balance cross-stage richness vs no-bloat. See `OUTLINE_COVERAGE.md` for the consumer-driven justification of every schema and field.

### Tier 1 — Mandatory cross-stage

Read by all SDLC agents (base + pro tier) AND all `tdoc-*` writers. Block all 3 skills if missing.

| Schema | Artifact path | Purpose |
|---|---|---|
| `_meta.schema.json` | `docs/intel/_meta.json` | Provenance, TTL, staleness, locks. Single arbiter for reuse decisions. |
| `actor-registry.schema.json` | `docs/intel/actor-registry.json` | Roles + auth + RBAC mode. NIST 800-162 vocabulary. |
| `permission-matrix.schema.json` | `docs/intel/permission-matrix.json` | Role × Resource × Action with ABAC-ready conditions. Casbin/AWS IAM pattern. |
| `sitemap.schema.json` | `docs/intel/sitemap.json` | Navigation + flat routes + Playwright hints + workflow variants. **Absorbs** legacy `frontend-report.json`. |
| `feature-catalog.schema.json` | `docs/intel/feature-catalog.json` | Features with role-visibility tagging, status, priority. |
| `test-accounts.schema.json` | `docs/intel/test-accounts.json` | Test credentials per role. Optional but enforced for Playwright/HDSD targets. `.gitignore` when storage=inline. |
| `test-evidence.schema.json` | `docs/intel/test-evidence/{feature-id}.json` | Per-feature playwright tests + execution + screenshot map. Co-produced by `resume-feature` QA stage. |
| `code-facts.schema.json` | `docs/intel/code-facts.json` | Stack-agnostic normalized code facts (services, routes, entities, auth_rules, integrations). Source for downstream phases. |
| `system-inventory.schema.json` | `docs/intel/system-inventory.json` | Tech stack with version + license, services, runtimes, package_managers, IPv6 readiness. Replaces legacy `stack-report.json`. |

### Tier 2 — Optional cross-stage

Read by pro-tier SDLC agents (`*-pro`, `tech-lead`, `security`, `devops`, `data-governance`, `sre-observability`) AND all `tdoc-*` writers. Warn-don't-block SDLC; block writers.

| Schema | Artifact path | Purpose |
|---|---|---|
| `data-model.schema.json` | `docs/intel/data-model.json` | Logical entities + physical tables + ERD + data dictionary + backup strategy. |
| `api-spec.schema.json` | `docs/intel/api-spec.json` | OpenAPI-style endpoint catalog with request/response schemas, auth, examples. |
| `architecture.schema.json` | `docs/intel/architecture.json` | 4 CPĐT 4.0 layers + components + design principles + 3 mandatory architecture models (Đ13). |
| `integrations.schema.json` | `docs/intel/integrations.json` | LGSP/NGSP/CSDLQG/VNeID + commercial APIs + cross-service calls. |

### Tier 3 — Doc-only

Read by `tdoc-*` writers only. `resume-feature` SKIPS entirely (BA uses `feature-brief.md` prose narrative).

| Schema | Artifact path | Purpose |
|---|---|---|
| `business-context.schema.json` | `docs/intel/business-context.json` | Project metadata, legal_basis, pain_points, objectives, scope, expected_benefits, recommendations. |
| `nfr-catalog.schema.json` | `docs/intel/nfr-catalog.json` | NFR ≥7 items with measurable targets per CPĐT 4.0 §VII. |
| `security-design.schema.json` | `docs/intel/security-design.json` | ATTT level (NĐ 85/2016), risk analysis, encryption, logging, incident response, IPv6. |
| `infrastructure.schema.json` | `docs/intel/infrastructure.json` | Deployment model, hardware, network topology, environments, HA. |
| `cost-estimate.schema.json` | `docs/intel/cost-estimate.json` | TKCS aggregate (6 line items) + TKCT detailed (Function Point per TT 04/2020). |
| `project-plan.schema.json` | `docs/intel/project-plan.json` | Phases, timeline, organization (RACI), risks. |
| `handover-plan.schema.json` | `docs/intel/handover-plan.json` | Training, deliverables, warranty, maintenance, knowledge transfer. |

## Producer / Consumer Matrix

```
Producers                          Artifacts                   Consumers
─────────                          ─────────                   ─────────
doc-intel              ──┐                                ┌──> doc-writer
tdoc-researcher        ──┼──> actor-registry.json    ────┼──> tdoc-data-writer
tdoc-actor-enum (P1.5) ──┤                                ├──> doc-diagram
manual-interview       ──┘                                └──> intel-export

doc-intel              ──┐
tdoc-researcher        ──┼──> permission-matrix.json  ───┬──> doc-writer (TKCS sect 3)
tdoc-actor-enum        ──┤                                ├──> xlsx test-case generator
manual-interview       ──┘                                └──> HDSD writer (per-role chapters)

doc-intel              ──┐
tdoc-researcher        ──┼──> sitemap.json            ───┬──> tdoc-test-runner (Playwright)
                         │                                ├──> tdoc-screenshot-reviewer
                         │                                ├──> doc-diagram (UX flows)
                         └                                └──> HDSD writer (navigation chapters)

doc-intel              ──┐
tdoc-researcher        ──┼──> feature-catalog.json    ───┬──> all writers
                         └                                └──> xlsx test-case generator

code-harvester         ────> code-facts.json          ───> doc-diagram (architecture diagrams)
```

## Reuse Policy

`_meta.json.reuse_policy` declares per-direction behavior. Possible modes:

- `reuse_if_fresh` — TTL OK + checksum match → skip producer
- `reuse_with_verify` — load existing, run quick verification, regenerate only diffs
- `merge` — multiple producers cooperate, conflict resolution via `intel-merger`
- `regenerate` — always rebuild
- `never_reuse` — incompatible direction, always rebuild

**Default policy** (when `_meta.reuse_policy` is missing):

| Direction | Default mode |
|---|---|
| from-doc → generate-docs | `reuse_if_fresh` |
| from-code → generate-docs | `reuse_if_fresh` |
| generate-docs → from-doc | `reuse_with_verify` (doc may be outdated) |
| generate-docs → from-code | `reuse_with_verify` (code is truth) |
| from-doc ↔ from-code | `merge` |

## Conflict Resolution Precedence

When multiple producers contribute to the same field, `intel-merger` applies:

| Field | Winner |
|---|---|
| `actor.display`, `actor.display_en` | doc-intel (human-curated names) |
| `actor.auth.login_url`, `route.path` | tdoc-researcher (code is truth) |
| `permission.evidence[kind=code]` | tdoc-researcher |
| `permission.evidence[kind=doc]` | doc-intel |
| `sitemap.menu_tree[].label` | doc-intel |
| `sitemap.routes[].path`, `playwright_hints` | tdoc-researcher |
| `feature.role_visibility[].level` | union with severity max (none < readonly < partial < full) |

User manual edits — flagged in `_meta.artifacts[file].locked_fields[]` — **always win** over any producer.

## TTL Defaults

| Artifact | TTL (days) | Tier | Rationale |
|---|---|---|---|
| `code-facts.json` | 7 | T1 | Code is most volatile |
| `system-inventory.json` | 30 | T1 | Tech stack changes occasionally |
| `feature-catalog.json` | 30 | T1 | Feature additions frequent |
| `sitemap.json` | 30 | T1 | UI changes faster |
| `permission-matrix.json` | 60 | T1 | More volatile (new endpoints) |
| `actor-registry.json` | 90 | T1 | Roles change slowly |
| `test-accounts.json` | 90 | T1 | Credentials rotate slowly |
| `test-evidence/{id}.json` | 60 | T1 | Per-feature; refreshed when feature touched |
| `api-spec.json` | 14 | T2 | New endpoints common |
| `data-model.json` | 30 | T2 | Schema changes via migrations |
| `architecture.json` | 60 | T2 | Architecture refactors rare |
| `integrations.json` | 30 | T2 | New integrations occasional |
| `business-context.json` | 180 | T3 | Stable across project lifecycle |
| `nfr-catalog.json` | 90 | T3 | Targets revised quarterly |
| `security-design.json` | 90 | T3 | Threat model + ATTT level stable |
| `infrastructure.json` | 90 | T3 | Hardware list stable until refresh |
| `cost-estimate.json` | 30 | T3 | Refreshed at TKCS → TKCT transition |
| `project-plan.json` | 30 | T3 | Timeline shifts during execution |
| `handover-plan.json` | 90 | T3 | Stable post-design |

After TTL expiry: `_meta.artifacts[file].stale = true` → next producer regenerates.

**Tier 3 staleness rule**: SDLC agents do NOT trigger Tier 3 regeneration; only `from-doc` produces these. `/intel-refresh` skill regenerates Tier 1+2 only (Tier 3 = manual edit by BA before generate-docs).

## Cross-Reference Integrity Rules

The `intel-validator` agent enforces these invariants:

**Tier 1 — Mandatory cross-refs (block on violation):**

1. Every `permission.role` must exist in `actor-registry.roles[].slug` or be `*`.
2. Every `permission.resource` must match a `permission-matrix.resources[].id` or end with `.*`.
3. Every `sitemap.routes[].auth.allowed_roles[]` member must exist in actor-registry.
4. Every `sitemap.menu_tree[].permission_check` must reference an existing resource:action pair.
5. Every `feature-catalog.features[].role_visibility[].role` must exist in actor-registry.
6. Every `feature-catalog.features[].routes[]` must match a `sitemap.routes[].path`.
7. Every `test-accounts.accounts[].role_slug` must exist in actor-registry.
8. Every `system-inventory.services[].id` referenced from `code-facts.services[].id` must align.
9. Every `feature-catalog.features[].entities[]` should match `data-model.entities[].name` (warn if data-model present and miss).

**Tier 2 — Cross-stage cross-refs (warn on violation):**

10. Every `api-spec.endpoints[].path` should correspond to `sitemap.routes[].path` (auto-create stub if missing).
11. Every `architecture.components[].owned_entities[]` should exist in `data-model.entities[].name`.
12. Every `architecture.components[].integrations_consumed[]` should exist in `integrations.integrations[].id`.
13. Every `architecture.cpdt_layers[]` MUST cover all 4 layers (giao-dien/nghiep-vu/du-lieu/ha-tang) when project is gov IT system.
14. `architecture.components[]` count ≥ 3 (TKKT minimum).
15. `architecture.models.{overall,logical,physical}_diagram` ALL present (TKCS §3.3 Đ13 mandate).
16. Every `integrations.integrations[].consuming_components[]` should exist in `architecture.components[].name`.

**Tier 3 — Doc-only cross-refs (block at writer level only):**

17. `nfr-catalog.items[]` count ≥ 7 (TKKT §9 minimum).
18. `security-design.attt_level` ∈ {1, 2, 3, 4, 5} (NĐ 85/2016).
19. `security-design.risk_analysis[]` count ≥ 3 (threat-model minimum).
20. `cost-estimate.summary[]` covers all 6 mandatory line items (TKCS §6.2 standard).
21. `business-context.legal_basis[]` count ≥ 3.
22. `business-context.objectives.specific[]` count ≥ 3.
23. `business-context.pain_points[]` count ≥ 3.
24. `infrastructure.hardware[]` non-empty when `deployment_model.type = on-premise`.
25. `handover-plan.training[]` non-empty AND `handover-plan.warranty.period_months ≥ 12`.

**Generic warnings (non-blocking):**

26. `permission-matrix.uncovered_resources[]` triggers a warning (not error).
27. Every Tier 1+2 entry SHOULD have `confidence` field set; missing = informational warning.

## Vendor Bridge (`intel-export`)

Future Phase 3 component. Exports intel layer to other IDE formats:

- `--target cursor` → `.cursor/rules/intel-*.mdc`
- `--target windsurf` → `.windsurfrules`
- `--target generic` → `INTEL.md`
- `--target openapi` → augments OpenAPI 3.x spec with `x-roles`, `x-permissions`

## Versioning

All schemas pin `schema_version: "1.0"`. Breaking changes bump major version + migration notes added here. Additive changes (new optional fields) keep `1.0`.

## See Also

- `~/.claude/CLAUDE.md` — Rule **CD-10: Intel Layer Contract**
- `~/.claude/agents/intel-validator.md` — validator agent
- `~/.claude/agents/intel-merger.md` — merger agent (Phase 2)
