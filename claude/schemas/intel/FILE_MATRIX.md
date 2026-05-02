# Intel & Pipeline File Matrix

**Purpose**: complete inventory of files produced + consumed by skills/agents across the pipeline (from-doc → from-code → resume-feature → close-feature → generate-docs). Reference for naming-drift audit, RAG indexing, vendor-side path mapping.

**Conventions**:
- ✅ **CANONICAL** — official path per CD-10
- ⚠️ **LEGACY** — old path, migration in progress
- 🆕 **NEW** — schema added in this refactor pass
- `{slug}` = workspace/service slug; `{feature-id}` = F-NNN; `{N}` = sequence

---

## 1. Intel Layer (canonical, CD-10)

Workspace-level shared knowledge. SOT for every cross-skill bridge.

| File | Status | Schema | Producer (primary) | Producer (secondary) | Consumer | Purpose |
|---|---|---|---|---|---|---|
| `docs/intel/_meta.json` | ✅ | `_meta.schema.json` | new-project (init stub), every producer (via `meta_helper.py`) | — | every consumer (stale/TTL check) | Provenance, TTL, staleness, lock registry |
| `docs/intel/actor-registry.json` | ✅ | `actor-registry.schema.json` | new-project (empty stub), from-code (P1.5 actor-enum), from-doc (interview/extract) | manual-interview | dev, fe-dev, ba, sa, qa, reviewer, security, generate-docs (Stage 1.2, 3a, 4f), new-feature (Step 2.5 read for role_visibility), hotfix (Step 5b read) | Roles + auth + RBAC mode |
| `docs/intel/permission-matrix.json` | ✅ | `permission-matrix.schema.json` | new-project (empty stub), from-code (P1.5), from-doc | — | dev, fe-dev, security, qa, generate-docs (TKCS sec 3) | Role × Resource × Action |
| `docs/intel/sitemap.json` | ✅ | `sitemap.schema.json` | new-project (empty stub), from-code (P2 feature synthesis), from-doc (UX extraction) | — | dev, fe-dev, qa (playwright_hints), generate-docs (HDSD nav), new-feature (Step 2.5 read for module suggestion) | Routes + nav + Playwright hints + workflow variants |
| `docs/intel/feature-catalog.json` | ✅ 🆕(enriched) | `feature-catalog.schema.json` | new-project (empty stub), from-code (P6 handoff), **new-feature (Step 4.5 init `status: in_design`)**, **hotfix (Step 5b update existing or create micro-feature)** | close-feature (status sync to `implemented` + implementation_evidence), ba (enrich AC + business_rules at stage ba) | dev, ba, qa, reviewer, generate-docs (Stage 2-4), feature-status, new-feature (collision check) | Master feature list + role-visibility + acceptance_criteria + business_intent + flow_summary. **Lifecycle**: new-feature creates `in_design` → ba enriches → from-code rescan validates schema → close-feature seals `implemented` |
| `docs/intel/test-accounts.json` | 🆕 | `test-accounts.schema.json` | from-code (extract from seed scripts), generate-docs Stage 0.5 (interactive prompt + offer persist), manual | resume-feature QA (verify) | qa, generate-docs Stage 3a, fe-dev/dev (E2E test setup) | Test credentials per role (Playwright + manual QA bridge) |
| `docs/intel/test-evidence/{feature-id}.json` | 🆕 | `test-evidence.schema.json` | resume-feature QA stage | close-feature (consolidate Playwright artifacts) | generate-docs Stage 3a (screenshots), Stage 4f (test cases xlsx) | Playwright tests + execution results + screenshot map per feature |
| `docs/intel/code-facts.json` | ✅ | (no formal schema) | from-code (P1 static harvest) | — | dev, qa (validation_constraints), generate-docs Stage 4f (AUGMENT) | Routes, models, validations, integrations from static code analysis |
| `docs/intel/code-brief.md` | ✅ | — | from-code (P5 scaffold-brief) | — | dev, qa, ba, reviewer (human reading) | Human-readable digest of code analysis |
| `docs/intel/arch-brief.md` | ✅ | — | from-code (P4 architecture) | — | sa, devops, reviewer, generate-docs Stage 2b | Human-readable architecture digest (C4 + NFR + data classification) |
| `docs/intel/doc-brief.md` | ✅ | — | from-doc (Stage 2 analysis) | — | from-code (input for P2), ba (feature requirements), generate-docs Stage 2a | Project-level business digest from customer docs |
| `docs/intel/tech-brief.md` | ✅ | — | from-doc | — | from-code, sa, generate-docs Stage 2a | Technical requirements digest from customer docs |
| `docs/intel/status-evidence.json` | ✅ | (no formal schema) | from-code (P3 validation) | — | from-code summary, dev (gap_to_done) | Per-feature status detection evidence |
| `docs/intel/modules/{module-id}.md` | ✅ | — | from-doc (large mode), from-code | — | dev, fe-dev (per-module context) | Per-module brief for large projects |

---

## 2. SDLC Layer (Cursor side, per-feature)

Per-feature working state. Lifecycle managed by new-feature → resume-feature → close-feature.

| File | Status | Producer | Consumer | Purpose |
|---|---|---|---|---|
| `docs/feature-map.yaml` | ✅ | new-feature (init), hotfix (init), close-feature (seal), from-code (P7 scaffold) | resume-feature, feature-status (secondary, after feature-catalog), close-feature | Index of all features + their current SDLC stage. New entries include `catalog_id: F-NNN` cross-link. **NOT** authoritative for status — `feature-catalog.json` is canonical. |
| `docs/features/{feature-id}/_state.md` | ✅ | new-feature (init), all SDLC agents (update), close-feature (seal) | resume-feature (read at start), feature-status, close-feature | Per-feature pipeline state machine (current-stage, completed-stages, blockers, intel-drift flag) |
| `docs/features/{feature-id}/feature-brief.md` | ✅ | from-code (P7), from-doc | dev, fe-dev, ba, qa, sa | Per-feature human-readable spec (digest of doc-brief + code-brief filtered to feature) |
| `docs/features/{feature-id}/status.md` | ✅ | from-code (P3) | resume-feature (gap_to_done), human review | Per-feature status with gap analysis |
| `docs/features/{feature-id}/ba/01-feature-spec.md` | ✅ | ba | dev, designer, qa | BA elaboration of feature |
| `docs/features/{feature-id}/ba/02-user-stories.md` | ✅ | ba | dev, designer, qa | User stories US-NN |
| `docs/features/{feature-id}/ba/03-acceptance-criteria.md` | ✅ | ba | dev, qa, reviewer | AC list (also mirrored into `feature-catalog.features[].acceptance_criteria[]`) |
| `docs/features/{feature-id}/ba/04-business-rules.md` | ✅ | ba | dev, qa | Business rules BR-NN |
| `docs/features/{feature-id}/sa/*.md` | ✅ | sa | dev, fe-dev, security, qa | Solution architecture, NFR, integration, data design |
| `docs/features/{feature-id}/designer/02-designer-report.md` | ✅ | designer | fe-dev, qa | UI design specs, Figma refs |
| `docs/features/{feature-id}/dev/dev-w{N}-{slug}.md` | ✅ | dev | qa, reviewer, close-feature | Per-wave dev implementation summary |
| `docs/features/{feature-id}/qa/qa-report-w{N}.md` | ✅ | qa | reviewer, close-feature, generate-docs (read for context) | Per-wave QA report (Pass/Fail + evidence) |
| `docs/features/{feature-id}/reviewer/review-report.md` | ✅ | reviewer | close-feature | Final review verdict |
| `docs/features/{feature-id}/security/c-security-report.md` | ✅ | security | reviewer, close-feature | Security audit per feature |
| `docs/features/{feature-id}/09-retrospective.md` | ✅ | pm (auto via close-feature step 4) | close-feature (seal) | Retrospective notes |
| `docs/features/{feature-id}/clarification-notes.md` | ✅ | pm (escalation) | resume-feature (clarification answer flow) | PM clarification log |

---

## 3. Architecture & Compliance Docs (workspace-level)

| File | Status | Producer | Consumer |
|---|---|---|---|
| `docs/README.md` | ✅ | from-code (P6c) | generate-docs (Path A signal), human |
| `docs/ARCHITECTURE.md` | ✅ | from-code (P6c) | generate-docs Stage 2 (Path A), arch-review |
| `docs/business-flows.md` | ✅ | from-code (P6c) | generate-docs Stage 2a, ba |
| `docs/data-model.md` | ✅ | from-code (P6a/6c) | generate-docs Stage 2a |
| `docs/security-overview.md` | ✅ | from-code (P6c) | security agent, generate-docs |
| `docs/architecture/context.md`, `containers.md`, `data-model.md`, `integrations.md` | ✅ | from-code (P4) | sa, devops, generate-docs |
| `docs/adr/*.md` | ✅ | adr skill, dev (per ADR-required decision) | reviewer, close-feature (capture in implementation_evidence.adrs[]) |
| `docs/glossary.md` | ✅ | manual / from-doc | dev, ba, qa |

---

## 4. generate-docs Internal (per-run)

Internal working dir — ephemeral per generate-docs run. NOT cross-skill SOT.

| File | Status | Producer | Consumer | Note |
|---|---|---|---|---|
| `docs/generated/{slug}/output/content-data.json` | ✅ | generate-docs Stage 4 writers | etc-platform MCP (export) | Final structured data fed to Office templates |
| `docs/generated/{slug}/output/*.docx`, `*.xlsx` | ✅ | etc-platform MCP | zip-disk, customer | Rendered Office files |
| `docs/generated/{slug}/screenshots/*.png` | ✅ | generate-docs Stage 3a (Playwright fallback) OR symlink from `docs/intel/screenshots/` (REUSE-FIRST) | content-data.json embedding, HDSD output | Per CD-4 canonical naming `{feature-id}-step-NN-{state}.png` |
| `docs/generated/{slug}/intel/screenshot-validation.json` | ⚠️ | tdoc-screenshot-reviewer | generate-docs Stage 3b | Should reference canonical `docs/intel/test-evidence/{feature-id}.json` instead |
| `docs/generated/{slug}/intel/quality-report.json` | ✅ | generate-docs Stage 5b | generate-docs Stage 6 export | Per-run quality gate result |
| `docs/generated/{slug}/auth.json` | ✅ | generate-docs Stage 0.5 (merged from `docs/intel/test-accounts.json` + interactive gaps) | Stage 3a Playwright | Working copy; canonical SOT is `docs/intel/test-accounts.json` |
| `docs/generated/{slug}/playwright/.auth/state.json` | ✅ | auth_runner.py | Stage 3a | Playwright storage state |
| `docs/generated/{slug}/intel/capture-profile.json` | ✅ | Stage 0.6 | Stage 3a | Viewport + browser config |

---

## 5. Pipeline State (skill-internal)

Per-skill state files. NOT shared across skills.

| File | Status | Producer | Consumer |
|---|---|---|---|
| `docs/intel/_pipeline-state.json` | ✅ | from-code (per-phase progress) | from-code resume | Internal state for from-code resume; NOT canonical intel artifact |
| `docs/intel/_pipeline-state.{date}.snapshot.json` | ✅ | from-code Phase 8 | history/audit | Snapshot before completion |
| `{docs-path}/.resume-lock` | ✅ | resume-feature | resume-feature (advisory lock) | Prevent concurrent runs |

---

## 6. ⚠️ LEGACY paths (must migrate to canonical)

Cursor agents/dispatcher reference these old names. They should be replaced by canonical CD-10 names.

| Legacy path | Canonical replacement | Used in | Action |
|---|---|---|---|
| `intel/stack-report.json` or `{docs-path}/intel/stack-report.json` | `docs/intel/system-inventory.json` (stage1) OR `docs/intel/code-facts.json` (stage1+2) | dispatcher.md, doc-researcher.md, fe-dev.md | Rewrite refs |
| `intel/arch-report.json` | Split into: `docs/intel/code-brief.md` (digest) + `docs/intel/code-facts.json` (data) + `docs/architecture/*.md` (per-view) | dispatcher.md, doc-researcher.md | Rewrite refs |
| `intel/flow-report.json` | Absorbed into `docs/intel/sitemap.json` (`workflow_variants`, `routes[].playwright_hints`) per CD-10 § Stage 2.3 | dispatcher.md, fe-dev.md, generate-docs Stage 2 | Rewrite refs |
| `intel/frontend-report.json` | Absorbed into `docs/intel/sitemap.json` per CD-10 § Stage 2.3 | dispatcher.md, doc-researcher.md, fe-dev.md, generate-docs Stage 2c | Rewrite refs |
| `intel/screens/screen-index.json` | `docs/intel/sitemap.json.routes[].screenshots[]` (per-route) + canonical screenshot files at `docs/intel/screenshots/{feature-id}-step-NN-{state}.png` | fe-dev.md, doc-intel | Rewrite refs |
| `intel/screenshot-map.json` | `docs/intel/test-evidence/{feature-id}.json.screenshots[]` (per-feature, schema-bound) | dispatcher.md, generate-docs Stage 3a | Migrate to per-feature evidence |
| `docs/intel/features.json` (from old from-code) | `docs/intel/feature-catalog.json` | from-code 06-handoff (FIXED), legacy projects | Migration script needed |
| `qa-report.md` (only) | KEEP per-feature human-readable + ADD `docs/intel/test-evidence/{feature-id}.json` (canonical structured) | qa.md | Dual-write per Fix 8b |
| `test-cases.json` (vague) | Either `docs/intel/test-evidence/{feature-id}.json.test_cases[]` (structured intel) OR `content-data.json.test_cases.ui[]/api[]` (xlsx-bound) — disambiguate per producer | various | Define clearly per producer |

---

## 7a. Feature lifecycle — `feature-catalog.features[].status` transitions

```
[NONE — feature does not exist yet]
        │
        ├─ /from-code (P6) discovers from existing code → status: implemented (if all gaps_to_done met) | in_development (if gaps)
        │
        ├─ /from-doc → status: proposed (from customer docs, not built yet)
        │
        └─ /new-feature → status: in_design (Step 4.5) — placeholder description/AC
                                    │
                                    └─ /resume-feature → ba stage enriches → status stays in_design until BA verdict approved
                                                       │
                                                       ├─ tech-lead/sa/dev stages → status: in_development (auto-bumped at first dev wave start)
                                                       │
                                                       └─ /close-feature → status: implemented + implementation_evidence{} populated
                                                                         │
                                                                         └─ /hotfix targeting this feature → existing entry updated (tags, evidence appended); status NOT changed
```

Each transition triggers `_meta.json` update with `producer` field tracking who made the change. `intel-validator` runs at:
- End of `ba` stage (must replace `[CẦN BỔ SUNG]` placeholders before advancing)
- End of `close-feature` (full schema strict validation)
- Start of `generate-docs` Stage 0.0 (block-if-missing/stale)

## 7. Cross-skill bridge contracts (key invariants)

| From | To | Bridge | Invariant |
|---|---|---|---|
| from-doc | from-code | `docs/intel/doc-brief.md`, `tech-brief.md` | from-code P2 reads briefs to fill `feature-catalog.business_intent`, `flow_summary` |
| from-code | resume-feature (Cursor) | `docs/intel/{actor-registry,permission-matrix,sitemap,feature-catalog}.json` + `docs/features/{feature-id}/_state.md` + `feature-brief.md` | Cursor agents read intel via FROZEN_HEADER `intel-contract` (Fix 5) |
| resume-feature/qa | close-feature | `docs/intel/test-evidence/{feature-id}.json` (NEW per Fix 7b) | qa.md MUST persist evidence per schema (Fix 8b) |
| close-feature | generate-docs | `docs/intel/feature-catalog.json` (status: implemented + implementation_evidence{}) + `docs/intel/test-evidence/{feature-id}.json` | generate-docs reuses test-evidence (Fix 7c). close-feature syncs catalog (Fix 6b). |
| from-code/from-doc | generate-docs | All canonical intel artifacts | generate-docs Stage 0.0 block-if-missing (Fix 3); Stage 1-2 reuse-first (Fix 6a) |
| new-project | all downstream | `docs/intel/{_meta,actor-registry,permission-matrix,sitemap,feature-catalog}.json` (empty stubs) + `.gitignore` for test-accounts | Workspace bootstrap creates the layer so consumer skills don't crash on missing files. Producers (from-doc/from-code) populate stubs incrementally. |
| new-feature | resume-feature → close-feature → generate-docs | `docs/intel/feature-catalog.json` (new entry `status: in_design`) + `_state.md` (with `catalog-id` cross-link) | Feature visible to canonical consumers from creation, not just after close. ba stage enriches placeholders to satisfy schema. |
| hotfix | close-feature → generate-docs | `docs/intel/feature-catalog.json` (existing entry updated tags+evidence, OR new micro-feature) | Hotfix doesn't break canonical state of target feature; appends evidence trail. |

---

## 8. RAG / indexing recommendations

For RAG/index efficiency, prefer:

1. **Index canonical paths only** — exclude `docs/generated/{slug}/` (per-run ephemeral) from primary index; include only as historical snapshots.
2. **Index intel JSON as structured records** — `feature-catalog.features[]` → 1 record per feature with `id`, `description`, `business_intent`, `flow_summary`, `acceptance_criteria[]` as field-level vectors.
3. **Index briefs (doc-brief, tech-brief, code-brief, arch-brief, feature-brief) as prose chunks** — for narrative queries.
4. **DO NOT index legacy paths** (stack-report, flow-report, frontend-report, screen-index) — duplicates of canonical content.
5. **Cross-link via FK fields**: `permission.role_slug` → actor; `feature.routes[]` → sitemap; `test-evidence.feature_id` → feature; etc. Validator enforces these (CD-10 Quy tắc 5).
