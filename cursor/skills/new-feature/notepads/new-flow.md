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
- Warn user (Vietnamese, user-facing): `⚠ Intel layer chưa khởi tạo. Tính năng sẽ chỉ ghi vào feature-map.yaml, không có canonical record. Khuyến nghị chạy /from-doc hoặc /from-code trước.`
- User picks: `[c]ontinue` (legacy mode, feature-map only) | `[a]bort`

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

---

## Step 4 — Gather info and initialize pipeline

Ask all at once (user-facing labels in VN; field semantics in English aligned with `feature-catalog.schema.json` enriched fields):
```
Feature name:       (short Vietnamese name)
Business goal:      (problem to solve — maps to business_intent, ≥100 chars)
Scope in:           (what is included)
Scope out:          (what is excluded)
Flow summary:       (3-7 main steps, trigger → outcome — maps to flow_summary, ≥150 chars)
constraints:        (tech, deadline, team size — or "none")
priority:           (critical | high | medium | low)
Module/domain:      (suggested from sitemap.modules[] if intel loaded; or "new")
Role visibility:    (pick from actor-registry.roles[] loaded in Step 2.5)
                    format: <role-slug>:<level>, e.g. "hqdk:full, lanh-dao:readonly"
dependencies:       (existing feature-catalog feature-ids — or "none")
```

> Note: `description`, `acceptance_criteria`, `business_rules` are BA agent's job at stage `ba`. Here we only seed `business_intent` + `flow_summary` (BA enriches later). Schema validation runs at `from-code` next rescan or when `close-feature` syncs.

**Generate feature-id** (CD-10 canonical, aligned with from-doc + from-code):

```
mini-repo:   F-NNN              e.g. F-001, F-042
monorepo:    {service}-F-NNN    e.g. api-F-001, web-F-014

rules:
  - NNN: 3-digit zero-padded, sequential per service (or per workspace in mini)
  - Forbidden in ID: date, source-prefix (BOTP/SRS/BRD), module name
  - Immutable after first commit
```

**Allocation algorithm**:
1. Scan existing IDs:
   - Read `{features-root}/feature-map.yaml` if exists → collect feature IDs
   - Glob `{features-root}/F-*/` and `{features-root}/{service}-F-*/` → collect dir names
   - Read `docs/intel/feature-catalog.json.features[].id` if intel exists
   - Parse NNN from each, take max → `max_seq` (default 0)
2. Allocate `NNN = max_seq + 1`
3. Final ID = `F-{NNN:03d}` (mini) or `{service}-F-{NNN:03d}` (mono)

Confirm with user before proceeding.

**Select Path based on risk:**
- **Path S** — risk 1–2, self-contained, no auth/PII/migration
- **Path M** — risk 3, standard feature (default when unclear)
- **Path L** — risk 4–5, auth/PII/payment/high-risk

**Compute agent-flags** (used by ba/designer/sa/security agents to skip discovery):

```
ba:
  source-type: user-input             # constant — distinguishes from SRS/BRD-derived
  blocking-gaps: 0                    # interactive interview → no gaps at intake
  total-modules: 1                    # single feature scope
  total-features: 1
designer: { screen-count: N }         # only if user mentions UI screens (else omit block)
sa: { integration-flags: [...] }      # only if user mentions external integrations (else omit)
security: { pii-found: bool, auth-model: rbac|abac|unknown }   # only if Path L OR PII flagged (else omit)
```

**Create `{features-root}/{feature-id}/_state.md`:**

Schema must match contract at `.cursor/skills/from-doc/SKILL.md` Step 5f.

```yaml
feature-id: {feature-id}
feature-name: {name}
pipeline-type: sdlc
status: in-progress
depends-on: [{from Step 4 dependencies — empty [] if none}]
blocked-by: []
created: {YYYY-MM-DD}
last-updated: {YYYY-MM-DD}
current-stage: ba
output-mode: lean   # Only 'full' if user explicitly requests (5-8x token cost)
repo-type: {mini | mono}
repo-path: "."
project: {app/service name | cross-cutting}
project-path: {resolved — "." for mini/cross-cutting, "src/apps/{name}" or "src/services/{name}" for mono}
docs-path: {features-root}/{feature-id}
intel-path: docs/intel
stages-queue: [{path stages after ba — see below}]
completed-stages: {}
kpi:
  tokens-total: 0
  cycle-time-start: {YYYY-MM-DD}
  tokens-by-stage: {}
rework-count: {}
source-type: user-input
agent-flags:
  ba:
    source-type: user-input
    blocking-gaps: 0
    total-modules: 1
    total-features: 1
  # designer / sa / security blocks: include ONLY if signals detected from user input
clarification-notes: ""
feature-req: |
  file:{docs-path}/feature-brief.md
  canonical-fallback:{intel-path}/doc-brief.md
  scope-modules: [{module from Step 4}]
  scope-features: [{feature-id}]
  dev-unit: {from AGENTS.md.dev-unit if present, else omit}
```

`current-stage: ba` is always the start — ba combines BA + domain modeling.
`stages-queue` = stages **after ba completes**:
- Path S: `[tech-lead, dev-wave-1, reviewer]`
- Path M: `[sa, tech-lead, dev-wave-1, qa-wave-1, reviewer]`
- Path L: `[sa, security-design, tech-lead, dev-wave-1, qa-wave-1, security-review, reviewer]`

Conditional additions (apply AFTER base path):
- UI screens mentioned → insert `designer` before `tech-lead`; insert `fe-dev-wave-1` after `dev-wave-1`
- PII / auth flagged AND Path != L → append `security-review` before `reviewer`

**Body sections (REQUIRED — resume-feature Step 3.1 reads these):**

```markdown
# Pipeline State: {name}

## Business Goal
{1-2 sentences synthesized from "Business goal" answer in Step 4}

## Stage Progress
| # | Stage | Agent | Verdict | Artifact | Date |
|---|---|---|---|---|---|
| 1 | Intake | — | Done | — | {today} |
| 2 | Analysis | ba | — | ba/00-lean-spec.md | — |
| 3 | Architecture | sa | — | sa/00-lean-architecture.md | — |
| 4 | Execution Planning | tech-lead | — | 04-tech-lead-plan.md | — |
| 5 | Development | dev/fe-dev | — | 05-dev-w*.md | — |
| 6 | QA | qa | — | 07-qa-report.md | — |
| 7 | Review | reviewer | — | 08-review-report.md | — |

## Current Stage
**ba** — Ready to start. Input: feature-brief.md (scope: {module})

## Next Action
Invoke `ba` with feature-req pointing to feature-brief.md (scope: {module}).

## Active Blockers
none

## Wave Tracker
| Wave | Tasks | Dev Status | QA Status |
|---|---|---|---|

## Escalation Log
| Date | Item | Decision |
|---|---|---|
```

**Also create `{features-root}/{feature-id}/feature-brief.md`** (scoped digest required by resume-feature Step 3.0 `feature-req.file:` resolution):

```markdown
---
feature-id: {feature-id}
feature-name: {name}
canonical-source: docs/intel/doc-brief.md   # null if intel layer absent
generated-at: {ISO-8601}
generator: new-feature
scope:
  modules: [{module}]
  features: [{feature-id}]
  depends-on: [{from Step 4}]
priority: {priority}
---

# Feature Brief: {name}

## Business Goal
{Business goal answer from Step 4}

## Scope

| Dimension | Value |
|---|---|
| Module | {module} |
| Priority | {priority} |
| Scope in | {scope-in} |
| Scope out | {scope-out} |
| Constraints | {constraints} |

## Flow Summary
{Flow summary answer from Step 4}

## Role Visibility
{From Step 2.5 + Step 4 answer — list role:level pairs}

## Dependencies
{From Step 4 — list feature-ids or "none"}

## Notes for BA
- This feature was initiated via `/new-feature` (interactive, no source document).
- BA agent at stage `ba` MUST elaborate: description (≥200 chars), acceptance_criteria (≥3 items × ≥30 chars), business_rules.
- Schema validation runs at end of `ba` stage; placeholders `[CẦN BỔ SUNG: ...]` block advancement.
```

> Note: `feature-brief.md` size > 200 bytes is required — resume-feature Step 3.0 enforces this. Keep meaningful content even for short interview answers.

**Feature Registry (`docs/feature-map.yaml`):**

Create/update at workspace root. Monorepo: required. Mini-repo: recommended.

```yaml
features:
  {feature-id}:
    name: "{feature name}"
    project: "{project name}"
    docs-path: "{features-root}/{feature-id}"
    status: "in-progress"
    current-stage: "ba"
    created: "{YYYY-MM-DD}"
    updated: "{YYYY-MM-DD}"
```

> No `catalog_id` cross-link needed — `feature-id` IS the catalog ID (single canonical namespace per CD-10 unified naming).

If file does not exist → create with header. If exists → append/update entry.

---

## Step 4.5 — Initialize canonical feature-catalog entry (CD-10) — MANDATORY when intel layer exists

If `docs/intel/feature-catalog.json` exists (Step 2.5 confirmed): append entry so canonical consumers (generate-docs, reviewer, security, doc-* writers) see this feature throughout the pipeline — not just after close-feature.

```jsonc
{
  "id": "{feature-id}",                       // Same ID as _state.md — CD-10 single canonical namespace
  "name": "{feature name VN}",
  "name_en": null,                            // Optional, BA can fill
  "description": "[CẦN BỔ SUNG: BA agent sẽ enrich ở stage ba — min 200 chars]",
  "business_intent": "{từ Step 4 prompt}",    // ≥100 chars; if shorter, expand or mark CẦN BỔ SUNG
  "flow_summary": "{từ Step 4 prompt}",       // ≥150 chars; same rule
  "acceptance_criteria": [
    "[CẦN BỔ SUNG: BA agent fill ≥3 items × ≥30 chars at stage ba]"
  ],
  "business_rules": [],                       // BA agent populate
  "module": "{từ Step 4 — module/domain}",
  "service_id": "{project nếu mono}",
  "status": "in_design",                      // in_design until BA approves AC; later in_development → implemented (close-feature)
  "priority": "{critical|high|medium|low}",
  "role_visibility": [
    { "role": "hqdk", "level": "full" },
    { "role": "lanh-dao", "level": "readonly" }
  ],
  "routes": [],                               // Empty — sa/dev fill at design stage
  "entities": [],
  "dependencies": [/* from Step 4 */],
  "test_case_ids": [],
  "test_evidence_ref": null,
  "implementation_evidence": null,
  "evidence": [{ "kind": "manual", "file": "{features-root}/{feature-id}/_state.md", "pattern": "new-feature skill init" }],
  "source_producers": ["new-feature"],
  "tags": ["sdlc-initiated"]
}
```

After write:
```bash
python ~/.claude/scripts/intel/meta_helper.py update docs/intel/ feature-catalog.json \
  --producer new-feature --append-merged-from
```

**Validation note:** placeholder `[CẦN BỔ SUNG: ...]` strings will fail strict schema validation. This is INTENTIONAL — BA agent at stage `ba` MUST replace them before pipeline advances. `intel-validator --strict` invoked at end of `ba` stage will catch unfilled placeholders.

If intel layer absent (legacy mode confirmed in Step 2.5): skip this step. close-feature will create entry retroactively.

---

## Step 4.6 — Register placeholder in sitemap + permission-matrix (LIFECYCLE.md §5.1)

Per LIFECYCLE.md P6 (information sufficiency for downstream), pre-register placeholders so generate-docs/security/sa stages "see" the feature even before sa concretizes routes/permissions.

**A. sitemap.json — append placeholder feature entry**

```jsonc
{
  "feature_id": "{feature-id}",
  "module": "{module from Step 4}",
  "status": "planned",
  "planned_routes": [],
  "source_producers": ["new-feature"],
  "confidence": "low"
}
```

After write:
```bash
python ~/.claude/scripts/intel/meta_helper.py update docs/intel/ sitemap.json \
  --producer new-feature --append-merged-from
```

**B. permission-matrix.json — append proposed rows for declared role_visibility**

```jsonc
// For each role in role_visibility from Step 4:
{
  "id": "P-{feature-id}-{role-slug}-read",
  "role_slug": "{role-slug}",
  "resource": "feature:{feature-id}",
  "action": "read",
  "status": "proposed",
  "confidence": "low",
  "source_producers": ["new-feature"],
  "evidence": [{
    "kind": "manual",
    "file": "{features-root}/{feature-id}/_state.md",
    "pattern": "role_visibility declaration at intake"
  }]
}
```

After write:
```bash
python ~/.claude/scripts/intel/meta_helper.py update docs/intel/ permission-matrix.json \
  --producer new-feature --append-merged-from
```

**Skip Step 4.6 if intel layer absent** (Step 2.5 legacy mode confirmed).

> **Why placeholder, not concrete**: per LIFECYCLE.md P1 (single-writer), sa stage owns concrete routes (sitemap) and concrete actions (permission-matrix). new-feature only registers PROPOSED entries with `confidence: low` + `status: proposed/planned` — sa will replace them with `confidence: high` + concrete data at sa stage.
>
> **Why pre-register at all**: if user runs `/generate-docs` between `/new-feature` and `sa` stage, the feature would be invisible without these placeholders.

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
