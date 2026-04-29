# LIFECYCLE.md — Intel Production-Line Contract

**Status**: Canonical contract (CD-10 Quy tắc 21).
**Audience**: Skill authors, agent prompt designers, intel-validator implementers.
**Scope**: All skills/agents that READ or WRITE any artifact under `{workspace}/docs/intel/`.
**Language**: English (per CD-9 cache discipline). Vietnamese allowed in examples only.

This document defines the production-line contract for the canonical intel layer.
Every skill and agent that touches `docs/intel/` MUST conform to one of the contract
boxes in §5, or its operations are considered drift and will be blocked by
`intel-validator` (when enforcement is active).

---

## §1. Production-Line Metaphor

| Reality | Metaphor |
|---|---|
| Skill (Claude/Cursor command) | Stage on the production line |
| Agent (sub-agent invocation) | Worker within a stage |
| Intel artifacts in `docs/intel/` | Work-in-progress dossier |
| `_state.md` | Routing slip traveling with the dossier |
| `_meta.json` | QC ledger — who wrote what, when, freshness |
| Tokens | Raw materials — costly when wasted on rework |
| Drift between artifacts | Defective parts |
| `intel-validator` | End-of-stage QC inspection |
| Feature lifecycle (intake → done) | One dossier traveling through all stages |

**Why this metaphor matters**

A modern LLM is omnipotent in raw capability. An *agent* is the same model with an
intentionally narrow role + curated context. The narrowness is the design, not a
limitation:

- Each worker has a specialty. They do not "help out" at the next station.
- Quality at each stage compounds: a 5% drift per stage over 7 stages = 30% defect rate at delivery.
- Information must arrive at each station ready-to-use. Workers do not go fishing in raw materials.
- Defects spotted upstream are cheap; downstream rework is expensive.

This contract operationalizes the metaphor as nine principles + per-stage boxes.

---

## §2. Nine Core Principles

### P1 — Single-writer per field per stage

At any moment, every field in every intel artifact has exactly ONE owner stage.
Two stages MUST NOT both write the same field concurrently.

- Owner is recorded in `_meta.json.artifacts[file].locked_fields[]`.
- Subsequent producers READ-only on locked fields.
- Conflict is a contract violation, not a feature.

> Violation example: `ba` stage writes `feature-catalog.routes[]` (sa's field).
> Result: sa overwrites ba's data → ba's intent lost → feature ships with wrong endpoints.

### P2 — Read-validate-write

Every stage that touches intel performs three steps in order:

1. **Read** the upstream artifacts listed in its READ-GATES.
2. **Validate** freshness via `_meta.artifacts[file].stale` and `produced_at`.
3. **Write** only fields within OWN-WRITE / ENRICH scope, then update `_meta.json`.

Skipping step 2 = silent propagation of stale data. Skipping step 3 = downstream
stages cannot tell what changed.

### P3 — No re-discovery (reuse-first mandate)

If an upstream stage already produced a fact, the current stage MUST reuse it. It
MUST NOT re-scan the codebase, re-parse source documents, or re-derive.

- Routes already in `sitemap.json` → use them; do not `Glob('**/*.tsx')`.
- Roles already in `actor-registry.json` → use them; do not grep for `@Roles(...)`.
- Features already in `feature-catalog.json` → look them up; do not enumerate code.

> Per CD-10 Quy tắc 9: silent skip is forbidden. The reuse must be visible
> to the user as a one-line summary ("♻ reused N entries from feature-catalog").

### P4 — No silent drift (flag, do not fix)

When a stage detects an upstream artifact has wrong/stale/missing data, it MUST
NOT silently correct it. Instead:

1. Flag the inconsistency in the stage's verdict (`drift-detected: ...`).
2. Surface to user via `_state.md` Escalation Log.
3. Recommend the appropriate refresh skill (`/intel-refresh`, `/from-code`, `/from-doc`).
4. Continue work only if the drift does not block its own scope.

> Self-fix violates P1 (single-writer) and erases the audit trail of who broke
> the contract. Worse: it teaches downstream stages to expect quiet repair, which
> hides systemic drift.

### P5 — Stale-block, not stale-tolerate

At entry, a stage that finds any of its READ-GATES has `stale: true` MUST stop
with a directive to refresh:

```
STOP: intel artifact `{file}` is stale (last fresh: {timestamp}).
Run /intel-refresh before retrying this stage.
```

Soft warnings ("intel may be stale, continuing anyway") are forbidden. Stale
data poisons every downstream stage; the cost of stopping and refreshing is
always lower than the cost of re-running 3-5 downstream stages on bad input.

### P6 — Information sufficiency

Each stage receives EXACTLY the information it needs — no more, no less.

- "Less" → the stage goes fishing (P7 violation) or stalls.
- "More" → the stage wastes tokens on irrelevant context, raises the chance of
  bleed-over into other fields, and inflates the cache-prefix variance.

Each contract box in §5 lists READ-GATES at field-level granularity:

```
READ-GATES:
  ✓ feature-brief.md           (always — primary scope)
  ✓ feature-catalog.json#features[id={feature_id}]   (entry only)
  ✓ actor-registry.json#roles[]  (slugs only)
  ✗ doc-brief.md               (lazy — only if feature-brief insufficient)
  ✗ code-brief.md              (lazy — only when stage is code-aware)
```

### P7 — Anti-fishing (no scan when lookup exists)

If an answer is in a structured intel artifact, the stage MUST look it up there.
It MUST NOT scan source files, run wide globs, or grep large directories.

Forbidden patterns when intel layer is fresh:

| Anti-pattern | Use instead |
|---|---|
| `Glob('**/*.controller.ts')` | `sitemap.json#routes[]` |
| `Grep('@Roles\\(', '/src')` | `actor-registry.json#roles[].source` |
| `Read each ts file in /src/auth` | `permission-matrix.json` |
| `Glob('docs/features/*/_state.md')` | `feature-map.yaml` |

Exceptions only when the stage is a producer (`/from-code`, `/intel-refresh`)
whose job IS extraction.

### P8 — Role refusal (out-of-scope → escalate)

Each contract box has a 1-line ROLE statement. A stage gets a request that doesn't
match its ROLE → it MUST refuse + return an escalation, not "help out" silently.

Examples:

- ba sees acceptance criteria but also notices missing data-model field → ROLE
  is "elaborate AC + business_rules", NOT "fix data-model". Flag for sa, do
  not write to data-model.
- qa sees a feature missing acceptance_criteria → ROLE is "execute test cases",
  NOT "write AC". Refuse to fabricate, escalate back to ba.
- close-feature sees test-evidence with `execution.status: "pending"` → ROLE is
  "seal completed feature", NOT "execute tests". Refuse to seal.

> The "tiện tay làm hộ" anti-pattern is the single largest source of intel drift
> in real projects. Workers help-fixing creates phantom owners that no one tracks.

### P9 — Context economy

Default to the smallest sufficient input:

- `feature-brief.md` (scoped, ~80% smaller) is preferred over `doc-brief.md`
  (canonical) at every stage that operates on one feature.
- `feature-catalog.json#features[id=X]` (one entry) preferred over the whole catalog.
- `actor-registry.json#roles[].slug` list preferred over full role definitions.

Each contract box declares `TOKEN-BUDGET` ceiling. Exceeding it requires explicit
user opt-in (vd: `--full-context` flag).

---

## §3. Artifact Ownership Matrix

Legend: **C** create | **E** enrich (placeholder→concrete) | **U** update existing |
**S** seal/lock | **R** read-only | — not touched

| Artifact | from-doc | from-code | new-feature | ba | sa | tech-lead | dev/fe-dev | qa | reviewer | close-feature | intel-refresh | generate-docs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `actor-registry.json` | C (seeds) | C (extracted) | R | E (perm seeds) | E (refine) | R | R | R | R | R | U (sync) | R |
| `permission-matrix.json` | C (planned) | C (extracted) | E (proposed rows) | R | E (concrete actions) | R | trigger drift | R | R | R | U (sync) | R |
| `sitemap.json` | C (planned) | C (extracted) | E (placeholder) | R | E (concrete routes) | R | trigger drift | R | R | R | U (sync) | R |
| `feature-catalog.json` | C (planned) | C (implemented) | E (intake) | E (description, AC, business_rules) | E (routes, entities) | R | R | E (test refs) | R | U (status, evidence) + S | R | R |
| `data-model.json` | — | C (extracted) | R | R | E (new entities) | R | trigger drift | R | R | R | U (sync) | R |
| `integrations.json` | — | C (extracted) | R | R | E (new integrations) | R | trigger drift | R | R | R | U (sync) | R |
| `test-evidence/{id}.json` | C (TC seeds) | C (TC extracted) | — | — | — | R | R | C (executed) | R | U (final ref) + S | R | R |
| `test-accounts.json` | — | C (extracted) | — | — | R | R | R | R | R | — | R | R |
| `_meta.json` | C/U | C/U | U | U | U | — | — | U | — | U | U | R |
| `_state.md` (per feature) | C | — | C | U | U | U | U | U | U | S | — | R |
| `feature-brief.md` (per feature) | C | C | C | R | R | R | R | R | R | R | — | R |
| `feature-map.yaml` | U | U | U | U | U | — | — | U | — | U | — | R |

**Rules derived from matrix:**

1. Only `from-doc`, `from-code`, `new-feature` may CREATE intel artifacts.
2. Only `close-feature` may SEAL feature-scoped entries (status: implemented).
3. Only `intel-refresh` may UPDATE-SYNC sitemap/permission-matrix/data-model
   (re-derive from current code state).
4. Stage agents (ba/sa/qa) ENRICH placeholder fields → concrete; they never
   CREATE artifacts and never SEAL.
5. `generate-docs` is purely consumer (R only) — if it ever needs to write,
   that is a contract violation.
6. `tech-lead` and `reviewer` write only their stage report markdown, never intel.

---

## §4. Field-Level Ownership Within Key Artifacts

### `feature-catalog.json` field ownership

| Field | Owner stage | Lifecycle |
|---|---|---|
| `id` | new-feature OR from-doc OR from-code | Set once at create, immutable |
| `name`, `name_en` | new-feature/from-doc | Created at intake; ba may refine `name_en` |
| `description` (≥200 chars) | ba | Created at intake as `[CẦN BỔ SUNG]`, filled by ba |
| `business_intent` (≥100 chars) | new-feature/from-doc | Set at intake from interview/SRS |
| `flow_summary` (≥150 chars) | new-feature/from-doc | Set at intake |
| `acceptance_criteria[]` (≥3 × ≥30) | ba | Placeholder at intake, filled by ba |
| `business_rules[]` | ba | Empty at intake, filled by ba |
| `module` | new-feature/from-doc | Set at intake |
| `service_id` | new-feature/from-doc | Set at intake (mono only) |
| `status` | new-feature → ba → sa → qa → close-feature | `planned` → `in_design` → `in_development` → `implemented` |
| `priority` | new-feature/from-doc | Set at intake; ba may revise after AC |
| `role_visibility[]` | new-feature/from-doc (intake) → sa (validate vs permission-matrix) | Append-only |
| `routes[]` | sa | Empty at intake, filled by sa from architecture design |
| `entities[]` | sa | Empty at intake, filled by sa |
| `dependencies[]` | new-feature/from-doc (declared) → ba (refine) | Forward edges only |
| `test_case_ids[]` | qa | Filled when QA produces test-evidence |
| `test_evidence_ref` | qa (set) → close-feature (seal ref) | Path to test-evidence/{id}.json |
| `implementation_evidence` | close-feature | Created at seal |
| `evidence[]` | new-feature (init) → from-code (append on rescan) | Audit trail |
| `source_producers[]` | every producer | Append-only |
| `tags[]` | new-feature (`sdlc-initiated`) → close-feature (`shipped`) | Append-only |

### `sitemap.json` field ownership

| Field | Owner stage | Lifecycle |
|---|---|---|
| `modules[]` | from-doc/from-code (initial) | Append-only across stages |
| `modules[].name` | original creator | Immutable |
| `modules[].features[]` | new-feature (placeholder) | Cross-link to feature-catalog |
| `routes[]` | from-code (extracted) → sa (designed) → fe-dev/intel-refresh (sync) | concrete after sa |
| `routes[].path` | sa (design) → fe-dev (final) | Final value after fe-dev |
| `routes[].feature_id` | new-feature → sa | Cross-link |
| `routes[].permission_ref` | sa (link) → intel-refresh (sync) | Points to permission-matrix.permissions[].id |
| `workflows[]` | from-doc/sa | Cross-feature workflows |

### `permission-matrix.json` field ownership

| Field | Owner stage | Lifecycle |
|---|---|---|
| `mode` (RBAC/ABAC) | from-code (initial) → sa (refine) | Set once, refined |
| `permissions[]` | from-code (extracted) → new-feature (proposed rows) → sa (concrete actions) | Append + concretize |
| `permissions[].role_slug` | first writer | Immutable |
| `permissions[].resource` | first writer | Immutable |
| `permissions[].action` | sa (concrete) | Was `proposed` from new-feature → `active` after sa |
| `permissions[].confidence` | every writer | `low` for proposed, `high` after sa, `manual` for user-locked |
| `permissions[].source_producers[]` | every writer | Append-only |

### `test-evidence/{feature_id}.json` field ownership

| Field | Owner stage | Lifecycle |
|---|---|---|
| `feature_id` | first writer | Immutable, FK to feature-catalog |
| `test_cases[]` (seeds, status=proposed) | from-doc/from-code | Created when feature seeded |
| `test_cases[]` (executed, status=passed/failed) | qa | Updated during QA stage |
| `test_cases[].execution.status` | qa | Required before close-feature |
| `playwright_path` | qa | Path to executable spec |
| `screenshots[]` | qa | Path list (CD-4 naming) |
| `coverage_pct` | qa (parse from report) | Optional |

### `_meta.json` discipline

Every write to any intel artifact MUST be followed by:

```bash
python ~/.claude/scripts/intel/meta_helper.py update {intel_dir} {artifact_file} \
  --producer {stage_name} --append-merged-from
```

This updates: `producers[]`, `produced_at`, `checksum`, optionally `stale: false`,
and propagates `merged_from` chain. Skipping this break P2 (read-validate-write).

---

## §5. Stage Contract Boxes

### Template

```
┌─ {skill or agent name} ─────────────────────────────┐
│ ROLE        : 1-sentence narrow specialty            │
│                                                      │
│ READ-GATES  : artifact + field + freshness rule      │
│   ✓ {required, freshness-checked}                    │
│   ✗ {lazy, only when needed}                         │
│                                                      │
│ OWN-WRITE   : artifacts/files only this stage writes │
│ ENRICH      : placeholder → concrete fields          │
│                                                      │
│ FORBID      : explicit anti-patterns                 │
│                                                      │
│ EXIT-GATES  : downstream-readiness invariants        │
│ FAILURE     : explicit STOP conditions               │
│                                                      │
│ TOKEN-BUDGET: max input/output tokens per call       │
└──────────────────────────────────────────────────────┘
```

### 5.1 `/new-feature` (Cursor)

```
┌─ /new-feature ──────────────────────────────────────────────────────────┐
│ ROLE        : Initialize one new feature dossier from interview input.  │
│                                                                          │
│ READ-GATES  :                                                            │
│   ✓ AGENTS.md (repo-type, dev-unit)                                     │
│   ✓ docs/intel/_meta.json (freshness check before any other intel read) │
│   ✓ docs/intel/actor-registry.json#roles[] (slugs for role_visibility)  │
│   ✓ docs/intel/sitemap.json#modules[] (module suggestion)               │
│   ✓ docs/intel/feature-catalog.json#features[].id (collision check)     │
│   ✓ docs/intel/permission-matrix.json#mode (proposed rows must match)   │
│   ✓ docs/feature-map.yaml (ID sequence allocation)                      │
│   ✗ docs/intel/code-brief.md (lazy — only if user asks for tech context)│
│   ✗ docs/intel/doc-brief.md (lazy)                                      │
│                                                                          │
│ OWN-WRITE   :                                                            │
│   - {features-root}/{feature-id}/_state.md       (full template per     │
│                                                   from-doc §5f)         │
│   - {features-root}/{feature-id}/feature-brief.md                       │
│   - docs/feature-map.yaml entry                                         │
│                                                                          │
│ ENRICH      :                                                            │
│   - feature-catalog.json: append entry with intake fields, AC/desc/rules│
│     as [CẦN BỔ SUNG] placeholders                                       │
│   - sitemap.json#features[]: append placeholder {feature_id, planned:[]}│
│   - permission-matrix.json#permissions[]: append rows for each role in  │
│     role_visibility, action="read", confidence="low", status="proposed" │
│                                                                          │
│ FORBID      :                                                            │
│   - Writing concrete routes, entities, business_rules, AC               │
│   - Writing implementation_evidence, test_evidence_ref                  │
│   - Glob/Grep on /src (P7 anti-fishing — except when intel absent and   │
│     user has confirmed legacy mode)                                     │
│   - Setting feature.status to anything beyond "planned" or "in_design"  │
│                                                                          │
│ EXIT-GATES  :                                                            │
│   - feature appears in feature-map.yaml                                 │
│   - feature appears in feature-catalog.json (or warned: legacy mode)    │
│   - sitemap + permission-matrix have placeholder entries                │
│   - _meta.json producer chain updated for 3 artifacts                   │
│   - resume-feature {id} would pass Step 3.0 validation                  │
│                                                                          │
│ FAILURE     :                                                            │
│   - _meta has any READ-GATES artifact stale=true → STOP, redirect       │
│     /intel-refresh                                                       │
│   - Codebase semantic search returns strong duplicate → STOP, propose   │
│     /resume-feature {existing-id} instead                               │
│                                                                          │
│ TOKEN-BUDGET: ~15K input, ~5K output per invocation.                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.2 `ba` stage (Cursor agent)

```
┌─ ba.md / ba-pro.md ─────────────────────────────────────────────────────┐
│ ROLE        : Elaborate description, acceptance criteria, business      │
│               rules for one feature. NOT architecture, NOT tests.       │
│                                                                          │
│ READ-GATES  :                                                            │
│   ✓ {features-root}/{feature-id}/feature-brief.md (primary)             │
│   ✓ {features-root}/{feature-id}/_state.md (current stage info)         │
│   ✓ feature-catalog.json#features[id={feature-id}] (one entry)          │
│   ✓ actor-registry.json#roles[] (slugs only)                            │
│   ✓ _meta.json (freshness)                                              │
│   ✗ doc-brief.md (lazy — only when feature-brief lacks specific detail) │
│   ✗ sitemap.json (NOT needed — sa job)                                  │
│                                                                          │
│ OWN-WRITE   :                                                            │
│   - {features-root}/{feature-id}/ba/00-lean-spec.md                     │
│                                                                          │
│ ENRICH      :                                                            │
│   - feature-catalog.json#features[id]:                                  │
│     • description (≥200 chars, replace [CẦN BỔ SUNG])                   │
│     • acceptance_criteria[] (≥3 items × ≥30 chars)                      │
│     • business_rules[]                                                  │
│   - actor-registry.json#permission_seeds[]: append role+action seeds    │
│     discovered during analysis (sa will concretize)                     │
│                                                                          │
│ FORBID      :                                                            │
│   - Writing routes, entities, data-model, integrations (sa job)         │
│   - Writing concrete permission-matrix actions (sa job)                 │
│   - Writing test_case_ids, test_evidence (qa job)                       │
│   - Setting feature.status = implemented (close-feature job)            │
│   - Glob/Grep on /src (P7 — feature-brief is the input)                 │
│                                                                          │
│ EXIT-GATES  :                                                            │
│   - feature-catalog.json[id].description has no [CẦN BỔ SUNG]           │
│   - feature-catalog.json[id].acceptance_criteria has no [CẦN BỔ SUNG]   │
│   - feature.status promoted: planned → in_design                        │
│   - _meta.json updated                                                  │
│                                                                          │
│ FAILURE     :                                                            │
│   - feature-brief.md missing → STOP, suggest /from-doc or /from-code    │
│   - intel artifact stale → STOP, redirect /intel-refresh                │
│   - User input still ambiguous after BA elaboration → set               │
│     clarification-notes, return pm-required                             │
│                                                                          │
│ TOKEN-BUDGET: lean=~25K input, ~8K output. full=~80K input, ~25K output │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.3 `sa` stage (Cursor agent)

```
┌─ sa.md / sa-pro.md ─────────────────────────────────────────────────────┐
│ ROLE        : Design architecture: routes, entities, integrations,      │
│               permission concrete actions for one feature.              │
│                                                                          │
│ READ-GATES  :                                                            │
│   ✓ {features-root}/{feature-id}/ba/00-lean-spec.md                     │
│   ✓ feature-catalog.json#features[id={feature-id}] (post-ba enrichment) │
│   ✓ data-model.json#entities[] (existing entities)                      │
│   ✓ integrations.json#integrations[] (existing integrations)            │
│   ✓ sitemap.json#routes[] (existing routes — collision check)           │
│   ✓ permission-matrix.json#permissions[] (rules + proposed rows)        │
│   ✓ actor-registry.json (full)                                          │
│   ✓ _meta.json (freshness)                                              │
│   ✗ code-brief.md (lazy)                                                │
│                                                                          │
│ OWN-WRITE   :                                                            │
│   - {features-root}/{feature-id}/sa/00-lean-architecture.md             │
│                                                                          │
│ ENRICH      :                                                            │
│   - sitemap.json#routes[]: append concrete routes for this feature      │
│     (path, method, feature_id, permission_ref)                          │
│   - permission-matrix.json#permissions[]: replace proposed rows with    │
│     concrete (action enum, confidence: high)                            │
│   - data-model.json#entities[]: append new entities (if any)            │
│   - integrations.json#integrations[]: append new integrations (if any)  │
│   - feature-catalog.json#features[id]: routes[], entities[]             │
│                                                                          │
│ FORBID      :                                                            │
│   - Writing description/AC/business_rules (ba job)                      │
│   - Writing test cases or test-evidence (qa job)                        │
│   - Modifying actor-registry.json#roles[] (org-level, not feature-level)│
│   - Glob/Grep on /src (P7 — intel artifacts are inputs)                 │
│   - Self-fix when ba's permission_seeds conflict with concrete rules:   │
│     FLAG, do not silently merge (P4)                                    │
│                                                                          │
│ EXIT-GATES  :                                                            │
│   - feature-catalog.json[id].routes has ≥1 entry (or explicit "headless")│
│   - sitemap.routes[] has all feature routes                             │
│   - permission-matrix has no `status: proposed` rows for this feature   │
│   - feature.status promoted: in_design → in_development                 │
│   - _meta.json updated for all 4-5 touched artifacts                    │
│                                                                          │
│ FAILURE     :                                                            │
│   - ba output missing → STOP, sequencing error                          │
│   - permission_seeds conflict with existing rules → STOP, flag for user │
│   - intel artifact stale → STOP, redirect /intel-refresh                │
│                                                                          │
│ TOKEN-BUDGET: lean=~30K input, ~10K output. full=~120K, ~30K            │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.4 `qa` stage (Cursor agent)

```
┌─ qa.md / qa-pro.md ─────────────────────────────────────────────────────┐
│ ROLE        : Execute test cases for one feature; produce 3 atomic      │
│               artifacts (TC prose + Playwright spec + screenshots).     │
│                                                                          │
│ READ-GATES  :                                                            │
│   ✓ {features-root}/{feature-id}/04-tech-lead-plan.md                   │
│   ✓ feature-catalog.json#features[id={feature-id}] (AC + routes)        │
│   ✓ sitemap.json#routes (paths to drive)                                │
│   ✓ permission-matrix.json (role-based test scenarios)                  │
│   ✓ test-accounts.json (Playwright auth)                                │
│   ✓ test-evidence/{feature-id}.json (existing seeds, if any)            │
│                                                                          │
│ OWN-WRITE   :                                                            │
│   - {features-root}/{feature-id}/07-qa-report.md                        │
│   - docs/intel/test-evidence/{feature-id}.json (TC prose + execution)   │
│   - {playwright-root}/{feature-id}.spec.ts (executable script)          │
│   - docs/intel/screenshots/{feature-id}-step-NN-{state}.png             │
│                                                                          │
│ ENRICH      :                                                            │
│   - feature-catalog.json#features[id].test_case_ids[]                   │
│   - feature-catalog.json#features[id].test_evidence_ref =               │
│     "docs/intel/test-evidence/{feature-id}.json"                        │
│                                                                          │
│ FORBID      :                                                            │
│   - Writing description/AC/business_rules (ba job)                      │
│   - Writing routes/entities (sa job)                                    │
│   - Setting feature.status = implemented (close-feature job)            │
│   - Fabricating AC when feature-catalog.AC is empty: REFUSE, escalate   │
│     to ba (P8 role refusal)                                             │
│   - Modifying permission-matrix or sitemap                              │
│                                                                          │
│ EXIT-GATES  : (CD-10 Quy tắc 16 — atomic triple)                        │
│   - test-evidence/{id}.json has test_cases[] with execution.status set  │
│   - Playwright spec file exists and is re-runnable                      │
│   - All referenced screenshots exist on disk (CD-4 naming)              │
│   - feature.status promoted: in_development → ready_for_review          │
│   - _meta.json updated                                                  │
│                                                                          │
│ FAILURE     :                                                            │
│   - feature.acceptance_criteria empty → STOP, escalate to ba            │
│   - test-accounts.json missing for required role → STOP                 │
│   - <min_tc(feature) test cases produced (CD-10 Q.15) → STOP            │
│                                                                          │
│ TOKEN-BUDGET: lean=~40K input, ~15K output. full=~150K, ~40K            │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.5 `/close-feature` (Cursor)

```
┌─ /close-feature ────────────────────────────────────────────────────────┐
│ ROLE        : Seal a feature dossier; sync canonical intel to           │
│               implemented status with full evidence.                    │
│                                                                          │
│ READ-GATES  :                                                            │
│   ✓ {features-root}/{feature-id}/_state.md (status checked)             │
│   ✓ {features-root}/{feature-id}/08-review-report.md (reviewer verdict) │
│   ✓ feature-catalog.json#features[id={feature-id}]                      │
│   ✓ test-evidence/{feature-id}.json (qa output)                         │
│   ✓ {playwright-root}/{feature-id}.spec.ts (existence)                  │
│   ✓ git log main..HEAD (commits in feature branch)                      │
│                                                                          │
│ OWN-WRITE   :                                                            │
│   (no new artifacts created)                                            │
│                                                                          │
│ UPDATE      :                                                            │
│   - _state.md: status=done, current-stage=closed (SEAL)                 │
│   - feature-map.yaml: status=done                                       │
│   - feature-catalog.json#features[id]:                                  │
│     • status: implemented                                               │
│     • implementation_evidence: {commits, test_files, coverage_pct,      │
│                                  adrs, manual_qa_passed, closed_at}    │
│     • test_evidence_ref (final, validated against schema)               │
│     • SEAL into _meta.locked_fields                                     │
│   - _meta.json (4 artifacts touched)                                    │
│                                                                          │
│ FORBID      :                                                            │
│   - Modifying sitemap.routes, permission-matrix (intel-refresh job)     │
│   - Modifying data-model, integrations (intel-refresh job)              │
│   - Re-running test cases (qa job)                                      │
│   - Bypassing QA atomic triple gate (CD-10 Q.16)                        │
│                                                                          │
│ EXIT-GATES  :                                                            │
│   - feature-catalog has full implementation_evidence                    │
│   - test_evidence_ref points to validated file                          │
│   - intel-snapshot regen suggested to user                              │
│                                                                          │
│ FAILURE     :                                                            │
│   - QA atomic triple incomplete → STOP                                  │
│   - reviewer verdict ≠ Approved → STOP                                  │
│   - Required intel artifact missing → STOP                              │
│   - test-evidence schema validation fails → STOP                        │
│                                                                          │
│ TOKEN-BUDGET: ~30K input, ~5K output                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.6 `dev` / `fe-dev` (Cursor agents)

```
┌─ dev.md / fe-dev.md ────────────────────────────────────────────────────┐
│ ROLE        : Implement code per tech-lead-plan; trigger intel-drift    │
│               flag when code touches auth/role/route/RBAC.              │
│                                                                          │
│ READ-GATES  :                                                            │
│   ✓ {features-root}/{feature-id}/04-tech-lead-plan.md (current wave)    │
│   ✓ feature-catalog.json#features[id] (AC, routes from sa)              │
│   ✓ sitemap.json#routes (existing route patterns)                       │
│   ✓ permission-matrix.json (RBAC mode + existing decorators)            │
│   ✓ data-model.json#entities[] (schema reference)                       │
│                                                                          │
│ OWN-WRITE   :                                                            │
│   - source code under /src (per task scope)                             │
│   - {features-root}/{feature-id}/05-dev-w{N}-{task-id}.md (task report) │
│                                                                          │
│ UPDATE      :                                                            │
│   - _state.md.intel-drift: true (when touching auth/role/route/RBAC)    │
│                                                                          │
│ ENRICH      :                                                            │
│   (none — dev does not directly write intel; intel-refresh re-derives   │
│    from code at end of pipeline)                                        │
│                                                                          │
│ FORBID      :                                                            │
│   - Direct edits to sitemap.json, permission-matrix.json, data-model    │
│     (intel-refresh's role to sync from code)                            │
│   - Modifying feature-catalog directly (close-feature's role)           │
│                                                                          │
│ EXIT-GATES  :                                                            │
│   - Task code merged                                                    │
│   - Tests pass at task-level                                            │
│   - intel-drift flag set if code change qualifies                       │
│                                                                          │
│ FAILURE     :                                                            │
│   - tech-lead-plan task spec ambiguous → return pm-required             │
│   - Implementation requires schema change not in data-model → STOP,     │
│     escalate to sa (P8 role refusal)                                    │
│                                                                          │
│ TOKEN-BUDGET: per-task (lean ~20K input ~10K output)                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.7 `/intel-refresh` (Claude)

```
┌─ /intel-refresh ────────────────────────────────────────────────────────┐
│ ROLE        : Re-derive sitemap, permission-matrix, data-model,         │
│               integrations from current code state. Sync intel after    │
│               dev-induced drift.                                         │
│                                                                          │
│ READ-GATES  :                                                            │
│   ✓ docs/intel/_meta.json (find stale=true artifacts)                   │
│   ✓ codebase (re-extraction is the JOB)                                 │
│   ✓ feature-catalog.json (preserve manual fields)                       │
│   ✓ actor-registry.json (preserve role definitions)                     │
│                                                                          │
│ OWN-WRITE   :                                                            │
│   (no new artifacts)                                                    │
│                                                                          │
│ UPDATE      :                                                            │
│   - sitemap.json: re-derive routes, preserve workflows                  │
│   - permission-matrix.json: re-derive permissions[].action where        │
│     decorators changed; preserve manual locks                           │
│   - data-model.json: re-derive entities, preserve manual notes          │
│   - integrations.json: re-derive endpoints                              │
│   - _meta.json: stale=false, fresh checksums                            │
│                                                                          │
│ FORBID      :                                                            │
│   - Touching feature-catalog (close-feature/ba/sa own that)             │
│   - Touching test-evidence (qa owns)                                    │
│   - Touching actor-registry.roles[] (org-level, manual)                 │
│   - Overwriting fields in _meta.locked_fields[] (P1)                    │
│                                                                          │
│ EXIT-GATES  :                                                            │
│   - All previously-stale artifacts: stale=false                         │
│   - User-visible diff summary (what changed)                            │
│                                                                          │
│ FAILURE     :                                                            │
│   - Source code missing or unparseable → STOP                           │
│   - Locked field conflict → STOP, surface to user                       │
│                                                                          │
│ TOKEN-BUDGET: O(codebase size) — incremental when possible              │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.8 Class A — Stage-report writers (no intel touch)

**Agents**: `tech-lead`, `reviewer`, `reviewer-pro`, `designer`, `devops`, `release-manager`

```
┌─ Class A — Stage-report writer ─────────────────────────────────────────┐
│ ROLE        : Produce one stage report markdown; deliver verdict.       │
│                                                                          │
│ READ-GATES  :                                                            │
│   ✓ {features-root}/{feature-id}/_state.md (current stage)              │
│   ✓ {features-root}/{feature-id}/feature-brief.md                       │
│   ✓ Previous stage report(s) per dependency                             │
│   ✓ feature-catalog.json#features[id] (read-only context)               │
│                                                                          │
│ OWN-WRITE   :                                                            │
│   - tech-lead     → 04-tech-lead-plan.md                                │
│   - reviewer*     → 08-review-report.md                                 │
│   - designer      → designer/00-screens.md                              │
│   - devops        → devops/00-deploy-plan.md                            │
│   - release-mgr   → release/00-release-plan.md                          │
│                                                                          │
│ ENRICH      :                                                            │
│   (none — Class A does not write intel)                                 │
│                                                                          │
│ FORBID      :                                                            │
│   - ANY write to docs/intel/* (P1 violation)                            │
│   - ANY write to feature-catalog.json (close-feature/ba/sa job)         │
│   - "Helping" upstream by filling missing AC, routes, permissions       │
│     (P8 role refusal — escalate, do not fix)                            │
│   - Glob/Grep on /src when answer is in feature-catalog/sitemap (P7)    │
│                                                                          │
│ EXIT-GATES  :                                                            │
│   - Stage report file exists with verdict block                         │
│   - _state.md.completed-stages updated by dispatcher                    │
│                                                                          │
│ FAILURE     :                                                            │
│   - Required upstream artifact missing → STOP, sequencing error         │
│   - feature-brief.md missing → STOP, run /from-doc or /from-code        │
│                                                                          │
│ TOKEN-BUDGET: lean=~20K input, ~8K output                                │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.9 Class B — Verifier / validator agents (read intel, flag drift)

**Agents**: `security`, `data-governance`, `sre-observability`

```
┌─ Class B — Verifier / validator ────────────────────────────────────────┐
│ ROLE        : Cross-check code/design vs canonical intel; flag drift    │
│               with verdict. Specialized scope per agent (see below).    │
│                                                                          │
│ READ-GATES  : (tier-aware per ref-canonical-intel.md)                   │
│   ✓ Tier 1 (always): actor-registry, permission-matrix, sitemap,        │
│     feature-catalog                                                     │
│   ✓ Tier 2 (when in scope): data-model, integrations                    │
│   ✓ Tier 3 (peek only): security-design, nfr-catalog                    │
│   ✓ Source code (extraction is the JOB — verifiers re-read code by      │
│     design; this is the only class where /src scan is NOT P7 violation) │
│                                                                          │
│ OWN-WRITE   :                                                            │
│   - security        → security/01-findings.md + verdict                 │
│   - data-governance → data-governance/01-findings.md + verdict          │
│   - sre-observability → sre/01-nfr-verification.md + verdict            │
│                                                                          │
│ UPDATE      :                                                            │
│   - _state.md.intel-drift: true (when drift between code and intel      │
│     detected — does NOT fix the drift)                                  │
│                                                                          │
│ ENRICH      :                                                            │
│   (none — Class B never writes intel artifacts directly,                │
│    even when finding bugs in them. Flag, do not fix.)                   │
│                                                                          │
│ FORBID      :                                                            │
│   - Modifying permission-matrix to "correct" RBAC drift                 │
│     (refer to /intel-refresh — P4 no silent drift)                      │
│   - Modifying feature-catalog to add missing PII tag                    │
│     (refer to data-governance follow-up sprint)                         │
│   - Modifying data-model.json directly                                  │
│   - Setting feature.status = blocked without PM concurrence             │
│                                                                          │
│ EXIT-GATES  :                                                            │
│   - Findings file exists with severity-tagged drift list                │
│   - intel-drift flag set if any high-severity finding                   │
│   - Verdict in {Pass, Concerns, Fail} with explicit reasoning           │
│                                                                          │
│ FAILURE     :                                                            │
│   - Tier 1 intel artifact missing → STOP `intel-missing: {file}`        │
│   - Cannot read code (permissions, missing files) → STOP                │
│                                                                          │
│ TOKEN-BUDGET: ~50K input (re-scan code), ~10K output                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.10 Class C — Orchestrators (control flow only)

**Agents**: `dispatcher`, `pm`, `telemetry`

```
┌─ Class C — Orchestrator ────────────────────────────────────────────────┐
│ ROLE        : Route stage work, handle escalations, emit telemetry.     │
│               NOT a content producer — never writes substantive docs.   │
│                                                                          │
│ READ-GATES  :                                                            │
│   ✓ _state.md (full)                                                    │
│   ✓ feature-map.yaml (cross-feature lookup)                             │
│   ✓ stage report files (to determine next stage)                        │
│                                                                          │
│ OWN-WRITE   :                                                            │
│   - dispatcher  → updates _state.md fields: current-stage,              │
│                    completed-stages, stages-queue, rework-count         │
│   - pm          → updates _state.md.clarification-notes when blocking;  │
│                    writes pm verdict JSON inline (consumed by skill)    │
│   - telemetry   → .cursor/telemetry/{feature-id}.jsonl (append events)  │
│                                                                          │
│ ENRICH      :                                                            │
│   (none — control flow never writes intel content)                      │
│                                                                          │
│ FORBID      :                                                            │
│   - Writing stage reports (each Class A agent's job)                    │
│   - Writing intel artifacts                                             │
│   - Filling content placeholders in feature-catalog (ba/sa/qa job)      │
│   - Inventing verdicts when an agent failed to return one (escalate     │
│     instead — P8)                                                       │
│                                                                          │
│ EXIT-GATES  :                                                            │
│   - _state.md transitions are atomic (one stage advance per dispatch)   │
│   - telemetry events appended within bash-atomic boundaries             │
│                                                                          │
│ FAILURE     :                                                            │
│   - Loop guards (max iterations, no-op detection) tripped → STOP        │
│   - PM rework limit (3 per pipeline) exceeded → STOP, status=blocked    │
│                                                                          │
│ TOKEN-BUDGET: dispatcher ~5K (FROZEN_HEADER + DYNAMIC_SUFFIX);          │
│               pm ~15K when invoked; telemetry ~0 (Bash printf)          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.11 Class D — Doc-generation consumers (read-only intel)

**Agents**: `doc-intel`, `doc-researcher`, `doc-arch-writer`, `doc-catalog-writer`,
`doc-manual-writer`, `doc-test-runner`, `doc-testcase-writer`, `doc-tkcs-writer`,
`doc-exporter`, `tdoc-researcher`, `tdoc-test-runner`, `tdoc-data-writer`,
`tdoc-exporter`

```
┌─ Class D — Doc-generation consumer ─────────────────────────────────────┐
│ ROLE        : Render canonical intel into Office output documents       │
│               (TKCT/TKCS/TKKT/HDSD/test-cases) for one project.         │
│                                                                          │
│ READ-GATES  : (subset relevant to output document type)                 │
│   ✓ Required tier 1: actor-registry, permission-matrix, sitemap,        │
│     feature-catalog (per CD-10 Q.7 block-if-missing)                    │
│   ✓ Required tier 2 per writer:                                         │
│     • doc-tkcs-writer    → security-design, nfr-catalog, system-inv     │
│     • doc-arch-writer    → data-model, integrations, infrastructure     │
│     • doc-manual-writer  → test-evidence (screenshots), sitemap         │
│     • doc-testcase-writer → test-evidence (TC + execution status)       │
│     • doc-catalog-writer → feature-catalog (full)                       │
│   ✗ Tier 3 (interview) — fill via /intel-fill, not within writer        │
│                                                                          │
│ OWN-WRITE   :                                                            │
│   - All writers feed → docs/generated/{slug}/content-data.json          │
│     (intermediate format consumed by exporter)                          │
│   - Or → individual section MD files for Pandoc-route documents         │
│   - doc-exporter / tdoc-exporter → docs/generated/{slug}/output/*       │
│     (Office files via etc-platform MCP)                                 │
│                                                                          │
│ ENRICH      :                                                            │
│   (none — Class D is strictly read-only on intel.                       │
│    If intel is incomplete, escalate to /intel-fill or /intel-refresh.)  │
│                                                                          │
│ FORBID      :                                                            │
│   - ANY write to docs/intel/* (P1 — intel is sealed at close-feature;   │
│     generate-docs is consumer-only per CD-10)                           │
│   - Self-fixing missing intel (P4 — flag, escalate, do not fabricate)   │
│   - Inventing test cases when test-evidence empty without explicit      │
│     fallback contract (CD-10 Q.18)                                      │
│   - Re-extracting from code (intel is the input, not /src)              │
│                                                                          │
│ EXIT-GATES  :                                                            │
│   - content-data.json validates against ContentData schema              │
│   - Or: Pandoc MD passes structural lint                                │
│   - User-visible reuse summary printed when intel was reused (CD-10 Q.9)│
│                                                                          │
│ FAILURE     :                                                            │
│   - Required intel artifact missing → STOP `intel-missing: {file}`,     │
│     redirect /from-code or /from-doc                                    │
│   - Schema validation fails → STOP, surface error                       │
│   - MCP etc-platform unavailable (exporter only) → STOP, instruct user  │
│     `docker compose up -d` (CD-8)                                       │
│                                                                          │
│ TOKEN-BUDGET: per-writer ~30K input ~15K output;                        │
│               full /generate-docs run ~300-500K total                   │
└──────────────────────────────────────────────────────────────────────────┘
```

> **Note on Claude-side parallels**: Claude has analogous agents (`tdoc-researcher`,
> `tdoc-tkcs-writer`, etc. under `~/.claude/agents/`). They follow the same Class D
> contract since their role is identical. Claude-side `/from-doc`, `/from-code`,
> `/generate-docs`, `/intel-refresh` skills are covered in §5.1 (analogous to
> /new-feature for greenfield), and §5.7 respectively. Stage agents (ba/sa/qa) are
> Cursor-only; Claude does not run SDLC stages.

---

## §6. Enforcement (placeholder for next phase)

To be specified in v2 of this contract:

- `_meta.json.locked_fields[]` schema extension
- intel-validator pre-write hook (skill must declare write intent)
- Drift detection across stages
- Stage skip detection

For now, contracts are advisory + manual review. Stage agents that violate
contracts will be caught in code review of skill/agent edits.

## §7. Token Efficiency Rules (placeholder for next phase)

Practical rules for implementing P9. To be added with concrete byte budgets.

## §8. Anti-patterns Catalog (placeholder for next phase)

Common violations observed in real workflows; reference for code review.

## §9. Migration Path (placeholder for next phase)

How to bring legacy skills (no contract) to compliance. Backwards compatibility
strategy. Versioning of contract itself.

---

## Quick reference

- **One-line check** when designing a new skill/agent: "Does it have a contract box in §5?"
- **One-line check** when reviewing a skill PR: "Does it READ artifacts not in its READ-GATES, or WRITE fields not in its OWN-WRITE/ENRICH?"
- **One-line check** for an active pipeline: "Are all stages between current and downstream closing their EXIT-GATES?"

When in doubt: **a stage that is uncertain should STOP and escalate, never guess and proceed.** The cost of stopping is one user prompt; the cost of bad data flowing through 3 downstream stages is hours of rework.
