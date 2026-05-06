# New Flow — detailed steps

Loaded on demand by `new-feature/SKILL.md` when user creates a brand-new feature.

---

## Step 2 — Read AGENTS.md

Read `AGENTS.md` at project root before asking anything.

Not found → stop:
```
Không tìm thấy AGENTS.md ở project root. Chạy /new-project trước để khởi tạo workspace.
```

Extract from `AGENTS.md`:
- `repo-type` (mini | mono)
- `Docs-Path Formula` table
- `dev-unit` if specified (optional, used in `feature-req.dev-unit`)

> Note: `feature-prefix` field in AGENTS.md is OBSOLETE — feature IDs now follow CD-10 canonical format `F-NNN` / `{service}-F-NNN`, no per-project prefix. Skill ignores `feature-prefix` if present.

---

## Step 2.5 — Read canonical intel (CD-10 + LIFECYCLE.md §5.1)

Per LIFECYCLE.md P5 (stale-block), check intel freshness BEFORE trusting any read:

```
1. Read docs/intel/_meta.json
   For each artifact in {actor-registry, sitemap, feature-catalog, permission-matrix}:
     IF _meta.artifacts[file].stale == true:
       STOP with message:
         "⚠ Intel artifact `{file}` is stale (last fresh: {produced_at}).
          Run /intel-refresh before /new-feature to avoid propagating bad data.
          override: re-run with --force-stale (NOT recommended)."

2. Once freshness confirmed, load:
   Read docs/intel/actor-registry.json   → roles[] (for role_visibility selection)
   Read docs/intel/sitemap.json          → modules + existing routes
   Read docs/intel/feature-catalog.json  → existing features (ID collision + deps)
   Read docs/intel/permission-matrix.json → mode (RBAC/ABAC) + existing patterns
```

If `docs/intel/` empty or not initialized:
- Warn user (Vietnamese, user-facing): `⚠ Intel layer chưa khởi tạo (vi phạm CD-10 #7 block-if-missing). Tính năng sẽ chỉ ghi vào feature-map.yaml, không có canonical record. Generate-docs / resume-feature downstream sẽ phải re-discover (token waste). Khuyến nghị STRONG: chạy /from-doc hoặc /from-code trước.`
- User picks: `[c]ontinue` (legacy mode, feature-map only) | `[a]bort`
- IF user picks `[c]ontinue`:
  - Set `feature-map.yaml.features.{id}.intel-warning: "missing-canonical-intel"` for compliance audit trail.
  - Log warning to `_state.md.frontmatter.intel-warning: missing-canonical-intel`.
  - Reviewer audit at close-feature surfaces these features (CD-10 Quy tắc 6.7).

If intel exists, use it for:
- **Role visibility prompts**: show `roles[].slug` list, user selects which roles see this feature (level: full | partial | readonly | none)
- **Module suggestion**: from feature name, propose closest match in `sitemap.modules[]`
- **ID collision check**: ensure new `feature-id` does not conflict with `feature-catalog.features[].id`
- **Dependency suggestions**: features in same module → propose as `dependencies[]`

Cache loaded intel for Step 4 (avoid re-read).

## Step 2.7 — Semantic duplicate check (Cursor @Codebase)

Even when `feature-catalog.json` shows no name collision, an existing implementation may already cover the requested behavior under a different name. Run semantic search against the codebase BEFORE confirming the feature is new:

```
@Codebase "{feature-name-from-input}"
@Codebase "{1-line description from user}"
```

Triage results:
- **Strong match** (route handler + UI page implementing the requested behavior): show user — likely duplicate. Offer: `[r]eference existing feature {F-XXX} instead` | `[c]ontinue as new feature` | `[a]bort`.
- **Partial match** (related code touching same domain): note as `dependencies[]` candidate; continue.
- **No match**: proceed.

Avoids the "implement it again because nobody knew it existed" failure mode that pure ID-collision check cannot detect.

---

## Step 3 — Determine scope (monorepo only)

If `repo-type: mini` → scope is root-level, skip this step.

If `repo-type: mono` → ask user:
```
Tính năng này thuộc app hoặc service nào?
  (Xem bảng Active Apps / Services trong AGENTS.md)
  Hoặc: cross-cutting (ảnh hưởng nhiều app/service)
```

Resolve paths:

| Scope | project-path | features-root |
|---|---|---|
| mini-repo | `.` | `docs/features` |
| mono — cross-cutting | `.` | `docs/features` |
| mono — app | `src/apps/{name}` | `src/apps/{name}/docs/features` |
| mono — service | `src/services/{name}` | `src/services/{name}/docs/features` |

> **Note** (audit-2026-05-06 T1-1): legacy `docs/features/{id}/` paths shown above are PRE-CD-22. Actual MCP scaffold uses CD-22 nested path `docs/modules/M-NNN-{slug}/features/F-NNN-{slug}/` per ADR-003 D8. Determine `module_id` from sitemap.modules[] (read in Step 2.5) — if no module fits, prompt user to create new module via `/new-module` first.

---

## Step 4 — Gather info + scaffold via MCP (audit-2026-05-06 T1-1 — replaced legacy direct Write)

Ask user one block (VN labels, English schema fields aligned with `feature-catalog.schema.json`):

```
Feature name:       (short Vietnamese name)
Business goal:      (problem to solve — maps to business_intent, ≥100 chars)
Scope in:           (what is included)
Scope out:          (what is excluded)
Flow summary:       (3-7 main steps, trigger → outcome — maps to flow_summary, ≥150 chars)
Constraints:        (tech, deadline, team size — or "none")
Priority:           (critical | high | medium | low)
Module:             (pick from sitemap.modules[] OR M-NNN-{slug} for new — Step 2.5 loaded list)
Role visibility:    (pick from actor-registry.roles[] — format: "hqdk:full, lanh-dao:readonly")
Dependencies:       (existing F-NNN feature-ids — or "none")
```

> **Schema enrichment scope**: `description`, `acceptance_criteria`, `business_rules` are BA's job at stage `ba`. Step 4 only seeds `business_intent` + `flow_summary` (BA enriches later).

### Step 4 — Single ai-kit CLI scaffold call (atomic, replaces legacy 7-Write algorithm)

```
Result = Bash("ai-kit sdlc scaffold feature \
  --workspace {repo-path} \
  --module M-NNN \
  --id {next-F-NNN allocated by skill via resolve} \
  --name '{user-provided VN name}' \
  --slug '{kebab-case derived from name_en or transliterated}' \
  --business-intent '{from prompt, ≥100 chars}' \
  --flow-summary '{from prompt, ≥150 chars}' \
  --priority {critical|high|medium|low} \
  --consumed-by {csv module IDs}")
parse stdout JSON for { ok, data: { feature_id, feature_path, files_created, ... } }
# Per ADR-005: ai-kit CLI Node-native; scaffold_feature_impl atomic. ID allocation
# pre-step: caller resolves next available F-NNN via `ai-kit sdlc verify --scopes id_uniqueness`
# OR scans feature-catalog.json max(numeric F-NNN) before invoke.
# scaffold_options legacy expansion (create_state_md flags etc.) — defaults are correct,
# remove legacy hooks below:
unused_legacy_options_block = {
    create_state_md: true,                     # _state.md ModuleState/FeatureState per CD-23
    create_feature_brief: true,                # feature-brief.md scoped digest
    update_feature_catalog: true,              # append entry with [CẦN BỔ SUNG] AC placeholder
    update_sitemap_placeholder: true,          # confidence: low, status: planned
    update_permission_matrix_placeholder: true, # status: proposed per declared role_visibility
    update_feature_map_yaml: true,             # docs/intel/feature-map.yaml
    update_meta_json: true                     # provenance + ttl + checksum
  }
)
```

**MCP tool guarantees** (atomic txn — all-or-nothing):
- `feature_id` allocated atomically (no Glob race)
- 7 files updated in single txn: `_state.md`, `feature-brief.md`, `feature-catalog.json`, `sitemap.json`, `permission-matrix.json`, `feature-map.yaml`, `_meta.json`
- Schema validation inline (per CD-23 + CD-10 #1)
- Returns: `{feature_id, paths: [...], errors: []}`
- On any failure → rollback ALL writes; surface error

**MCP unavailable → BLOCK pipeline** (CD-8 v3): `docker compose up -d` from `~/.ai-kit/team-ai-config/mcp/etc-platform/` then retry. NO silent local fallback.

**Forbidden patterns** (audit-2026-05-06 T1-1 — replaced):
- ❌ `Write _state.md` directly → use `scaffold_feature.create_state_md`
- ❌ `Glob {features-root}/F-*/` for ID allocation → MCP allocates atomically
- ❌ `Write feature-catalog.json` direct → `update_feature_catalog: true`
- ❌ `Write sitemap.json` direct → `update_sitemap_placeholder: true`
- ❌ `Write permission-matrix.json` direct → `update_permission_matrix_placeholder: true`
- ❌ `Write feature-map.yaml` direct → `update_feature_map_yaml: true`
- ❌ `python ~/.claude/scripts/intel/meta_helper.py update` subprocess → MCP `update_meta_json: true`

**Body sections inside `_state.md`** (sa generates concrete sections later — initial state only):
- Pipeline State header
- Business Goal (1-2 sentences from `business_intent`)
- Stage Progress table (just intake row)
- Current Stage: ba
- Next Action: invoke ba via dispatcher
- Active Blockers: none
- Wave Tracker: empty
- Escalation Log: empty

**Body sections inside `feature-brief.md`** (per from-doc/SKILL.md §5f.5 schema):
- Frontmatter (canonical-source, canonical-hash, generated-at, scope, metrics)
- Scope tables (modules, features, rules, entities, screens, integrations)
- Features in scope (this feature only at intake — single entry)
- Business Rules placeholder
- Entities placeholder
- NFRs Applicable (from constraints if Path L)
- Ambiguities placeholder
- § Agent Hints (ba/sa/tech-lead/dev/qa/reviewer — Opus-precomputed if available)

> Default body content is auto-generated by MCP from skill-provided params. Skill does NOT manually compose body — that's MCP scaffold engine's job.

---

## Step 4.7 — Exit-gate verification (LIFECYCLE.md §5.1)

Before proceeding to dispatcher, verify all EXIT-GATES of /new-feature contract are satisfied:

```
✓ {features-root}/{feature-id}/_state.md exists with required frontmatter
✓ {features-root}/{feature-id}/feature-brief.md exists, size > 200 bytes
✓ docs/feature-map.yaml has entry for {feature-id}
IF intel layer present:
  ✓ docs/intel/feature-catalog.json has features[] entry with id={feature-id}
  ✓ docs/intel/sitemap.json has placeholder for {feature-id}
  ✓ docs/intel/permission-matrix.json has proposed rows for declared roles
  ✓ docs/intel/_meta.json producer chain updated for 3 touched artifacts

If any check fails → STOP with explicit error:
  "Exit-gate failure: {gate-name} not satisfied. Cannot proceed to dispatcher.
   Run /new-feature again or fix manually before /resume-feature."
```

→ Proceed to dispatcher loop (see `notepads/dispatcher-loop.md`).
