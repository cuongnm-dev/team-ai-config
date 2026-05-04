# Intel Layer Integration — `from-idea`

This skill participates in the shared Intel Layer (CLAUDE.md rule **CD-10**). All actor / permission / sitemap / feature data flows through canonical artifacts at `{workspace}/docs/intel/` validated by `~/.claude/schemas/intel/`.

`from-idea` is the **idea-side producer** alongside doc-side (`from-doc`) and code-side (`from-code`). It produces only intake-stage artifacts; downstream Cursor SDLC stages (`ba`, `sa`, `dev`, `qa`, `reviewer`) enrich.

## Producer identity

- **Producer tag** in `_meta.json#artifacts[].producer`: `manual-interview` (existing enum value, no schema bump required)
- **Producer skill marker** (informational): `_meta.json#artifacts[].produced_by_skill: "from-idea"` — distinguishes from `intel-fill` (which also uses `manual-interview` tag)
- **Source-type** in `_state.md`: `idea-brainstormed` (CD-20 enum, added 2026-05-04)
- **Confidence baseline:**
  - `actor-registry.roles[].confidence`: `manual` (interview-validated)
  - `feature-catalog.features[].confidence`: `manual`
  - `permission-matrix.permissions[].confidence`: `low` (proposed, sa enriches)
  - `sitemap.routes[].confidence`: `low` (placeholder, sa enriches)

## Artifacts written

### 1. `actor-registry.json` — schema-conformant
- `evidence[].kind = "interview"` for every role
- `evidence[].reference_to`: pointer to `_idea/impact-map.md` (Spiral 2 source) or `_idea/visual-primer.md` (if Phase 0.5 used)
- `source_producers: ["manual-interview"]`
- `auth.session_strategy`: only set if user mentions multi-role or auth flow during interview; else null + `[CẦN BỔ SUNG]`

### 2. `permission-matrix.json` — proposed rows only
- `permissions[].status: "proposed"`
- `permissions[].confidence: "low"`
- Rows derived from interview Q&A about RBAC ("Who can do what?")
- `evidence[].kind = "interview"`
- Notes attached: *"Proposed at idea stage; sa to validate against feature flow during design"*

### 3. `sitemap.json` — placeholder routes
- `routes[].path: "TBD"` for every feature (sa designs concrete paths during architecture)
- `routes[].feature_id` cross-ref present
- `routes[].auth.required` inferred from role visibility; `routes[].auth.allowed_roles[]` from interview
- `routes[].playwright_hints`: empty (sa/qa fills)
- `routes[].confidence: "low"`

### 4. `feature-catalog.json` — fully populated intake
- `features[].id`: F-NNN (mini) or `{service}-F-NNN` (mono) per CD-19
- `features[].description ≥ 200 chars` — synthesized from interview
- `features[].business_intent ≥ 100 chars`
- `features[].flow_summary ≥ 150 chars`
- `features[].acceptance_criteria[] ≥ 3 items × ≥ 30 chars`
- `features[].roles[]` from interview
- `features[].role_visibility[]`
- `features[].priority: "must-have" | "should-have" | "nice-to-have"` (from Spiral 4 MVP cut)
- `features[].risks[]` (from Phase 4.5 pre-mortem)
- `features[].assumptions[]` (from Spiral 1 + Phase 4.5)
- `features[].story_points: "S" | "M" | "L"` (from Spiral 4)
- `features[].status: "proposed"` or `"planned"`
- `features[].confidence: "manual"`
- `features[].source_producers: ["manual-interview"]`
- `features[].test_evidence_ref: "docs/intel/test-evidence/{id}.json"` (set after test-evidence written)
- `features[].qa_status: "pending"`
- **NEVER set** by from-idea: `implementation_evidence`, `test_evidence_ref.passed_count`, `routes[]` (sa fills concrete), `entities[]` (only string list, sa elaborates schema)

### 5. `test-evidence/{feature-id}.json` — synthesized seeds
- For each MUST-HAVE feature in feature-catalog
- Schema:
  ```json
  {
    "schema_version": "1.0",
    "feature_id": "<id>",
    "feature_name": "<name>",
    "test_cases": [
      {
        "id": "TC-{id}-{NN}",
        "name": "<derived from feature.name + AC>",
        "role_slug": "<slug>",
        "priority": "Rất cao | Cao | Trung bình | Thấp",
        "preconditions": "<auth + data state>",
        "steps": [{"no": 1, "action": "<verb-first VN>", "expected": "<observable>"}],
        "expected_result": "<final outcome>",
        "labels": ["smoke", "role-{slug}"],
        "design_technique": "ep | bva | dt | st | eg | domain",
        "source": "from-idea/synthesized",
        "execution": {"status": "not-executed"}
      }
    ]
  }
  ```
- Min count per feature (CD-10 #15):
  `min_tc = max(5, len(AC)*2 + len(roles)*2 + len(dialogs)*2 + len(error_cases) + 3)`
- Source MUST be `"from-idea/synthesized"` (extends CD-10 #14 producer chain)
- `execution.status` MUST be `"not-executed"` (qa stage will execute later)

### 6. `_meta.json` — provenance updates

After every artifact write, call:
```bash
python ~/.claude/scripts/intel/meta_helper.py update docs/intel/ <artifact> \
  --producer manual-interview \
  --produced-by-skill from-idea \
  --ttl <90 for actor, 60 for permission, 30 for sitemap, 30 for feature-catalog, 14 for test-evidence> \
  --sources docs/features/_idea/<workshop docs used>
```

If artifact already exists with different `producer` in `_meta.merged_from[]`:
1. **Skill MUST ASK USER** at Phase 5 Step 4 (Replace / Append) — never silent
2. If Replace: backup existing → `<artifact>.bak.{ISO}` → overwrite
3. If Append: write to `<artifact>.new.json` → invoke `intel-merger`
4. Record decision in `_pipeline-state.json#steps.5.merge_decisions{<artifact>: "replace|append"}`

## Validation gate

Before Phase 5 declares complete:

```bash
# Invoke intel-validator subagent in --quick mode
# If errors → halt, return validator report to user
# If warnings only → log + continue
```

PLUS Phase 5 semantic audit (`phases/crystallize.md` Step 3) — 5 rules:
1. Every `actor-registry.roles[].slug` MUST appear in ≥1 `permission-matrix.permissions[].role`
2. Every `feature-catalog.features[]` MUST have ≥1 `role_visibility[]` entry referencing existing role slug
3. Every `_idea/idea-brief.md§target_users` value MUST map to an actor-registry role slug (PRFAQ → actor consistency)
4. Every `feature-catalog.features[].priority="must-have"` MUST appear in `_idea/impact-map.md§deliverables` (no MVP feature without Impact Map ancestry)
5. Every `_idea/event-storming.md§aggregates` MUST be referenced by ≥1 `feature-catalog.features[].entities[]` (no orphan aggregate)

## Path convention

`from-idea` uses `{workspace}/docs/intel/` (Claude Code convention) — same as `from-doc` and `from-code`. No path migration needed.

`{features-root}/_idea/` is the workshop-artifact directory (PRFAQ, Impact Map, Event Storming, Story Map, pre-mortem, dedup-report, idea-graveyard, coherence-log, assumptions). Resolved per repo type:
- Mini-repo: `docs/features/_idea/`
- Monorepo: `src/services/{primary-service}/docs/features/_idea/` if scope is single-service, else `docs/features/_idea/` at workspace root for cross-cutting

Per-feature `{features-root}/{feature-id}/` follows from-doc/new-feature convention exactly (CD-19 + CD-20).

## Cross-skill reuse

When `from-doc` or `from-code` already populated an artifact:
- `from-idea` Phase 5 detects via `_meta.json` → ASKS USER per artifact
- Append decision → write `<file>.new.json` → invoke `intel-merger`
- Conflict precedence (per `~/.claude/schemas/intel/README.md`):
  - Display names: doc-intel wins (linguistic authority)
  - URLs: code-harvester wins (factual authority)
  - Business intent / vision / risks: from-idea wins (interview authority — only it has this layer)
  - Roles slug: first-writer wins; subsequent producers append display variants

When `from-idea` runs first (greenfield) and later `from-code` runs after build:
- `from-code` reads `from-idea` output as warm-start hypothesis space
- Fields owned by code (routes, implementation_evidence) get filled
- Fields owned by idea (vision, business_intent, assumptions) are preserved by precedence

## Anti-patterns (forbidden)

- Writing routes with concrete paths during from-idea (sa stage owns)
- Writing `implementation_evidence` (close-feature owns)
- Writing `test_evidence_ref.passed_count` or any `execution.status: "passed"` (qa owns)
- Writing `data-model.json` or `integrations.json` (sa owns)
- Writing `test-accounts.json` (from-code or manual operator owns)
- Skipping `meta_helper.py update` after artifact write
- Skipping test-evidence synthesis (Gate 4) — every must-have feature MUST have `test-evidence/{id}.json` with ≥ `min_tc(feature)` synthesized seeds before Phase 5 completes
- Setting `execution.status: "passed"` on synthesized TCs (only Cursor QA agent can mark passed)
- Tagging seeds with anything other than `source: "from-idea/synthesized"`
- Inlining credentials into `actor-registry.auth.credentials_ref` (must be reference)
- Silent overwrite at Phase 5 — must ask user (Replace / Append) per artifact

## Backward compatibility

`from-idea` is a NEW skill (v1 release). No backward-compat concerns at first deploy. Future versions:
- Workshop artifact paths under `_idea/` are STABLE — downstream skills (resume-feature, generate-docs) MAY read but MUST NOT write
- Decision schema (`why`, `considered_alternatives`, `confidence_pct`, `assumptions`) is APPEND-ONLY for new fields per CACHE_OPTIMIZATION.md
