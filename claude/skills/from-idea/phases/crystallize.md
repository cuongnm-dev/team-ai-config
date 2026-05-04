# Phase 5 — Crystallize

Convert workshop artifacts (Spirals 1-4 + Phase 4.5) into schema-conformant intel + per-feature `_state.md` for Cursor SDLC consumption. This is the ONLY phase that touches `docs/intel/*.json` files.

## Recap header

```
─── Phase 5 · Crystallize ────────────────────────────────
✓ Đã chốt:    Vision (PRFAQ) + win condition
              {N} actors, {M} deliverables (DEDUP-validated)
              {K} aggregates (event-storming)
              {P} must-have features (story-map MVP cut)
              {3} failure modes + {3} success pathways (pre-mortem)
              {A} critical assumptions
◐ Đang quyết: Crystallize 4 intel + N test-evidence + N _state.md
○ Để sau:     Handoff (Phase 6) → Cursor SDLC (resume-feature)
```

## Step 5.0 — Sanity check before crystallize

Run final DEDUP closure pass (assertion):

```python
assert all(deliverable.dedup_verdict in ["UNIQUE","ADOPT","EXTEND","INTEG"] for deliverable in impact_map.deliverables)
assert no deliverable has verdict="REJECT" remaining (else removed)
```

Run final scope creep check:
```python
must_have_count = len([f for f in features if f.priority == "must-have"])
win_conditions = len(prfaq.success_metrics)
assert must_have_count <= 3 * win_conditions, "Scope creep blocking — return to Spiral 4"
```

If either fails → STOP, return to relevant spiral.

## Step 5.1 — FK Integrity Validation

Run cross-reference checks BEFORE writing any artifact:

| Check | Rule |
|---|---|
| FK-1 | Every story map role ∈ actor-registry.roles[].slug |
| FK-2 | Every feature.acceptance_criteria mentions ≥ 1 actor by slug (else fix or flag) |
| FK-3 | Every feature.entities[] is an aggregate name from event-storming |
| FK-4 | Every feature.priority ∈ {must-have, should-have, nice-to-have} |
| FK-5 | Every feature.story_points ∈ {S, M, L} |
| FK-6 | Every feature.risks[] reference ID exists in pre-mortem |
| FK-7 | Every test-evidence.feature_id matches feature-catalog.features[].id |
| FK-8 | Every test-evidence.test_cases[].role_slug ∈ actor-registry.roles[].slug |

If any FK violation → STOP, surface specifics to user, recommend:
- Quick fix in workshop file (impact-map.md / story-map.md / etc.)
- Rewind to relevant Spiral

## Step 5.2 — 5-rule Semantic Audit

Beyond FK, verify semantic consistency:

```
RULE 1: Every actor-registry.roles[].slug MUST appear in ≥ 1 permission-matrix.permissions[].role
        → fail if role has no permission entry (orphan role)
        → fix: ask user "What can {role} do?"

RULE 2: Every feature-catalog.features[] MUST have ≥ 1 role_visibility[] entry
        → fail if feature has no role visible to it (no users)
        → fix: ask user "Who uses {feature}?"

RULE 3: Every PRFAQ.target_users (idea-brief.md persona role) MUST map to actor-registry slug
        → fail if persona ≠ any actor (PRFAQ ↔ actor consistency)
        → fix: add persona as role OR re-align persona

RULE 4: Every feature.priority="must-have" MUST appear in impact-map.md§deliverables
        → fail if MVP feature has no Impact Map ancestry (where did it come from?)
        → fix: trace back to deliverable OR demote to should-have

RULE 5: Every event-storming.aggregates MUST be referenced by ≥ 1 feature.entities[]
        → fail if orphan aggregate (modeled but not used)
        → fix: drop aggregate (move to graveyard) OR add feature that uses it
```

Persist verdict to `_pipeline-state.json#steps.5.semantic_audit_verdict: "PASS|FAIL"`.

If FAIL on any rule → STOP, present specific reconciliation menu (see `notepads/coherence-protocol.md`).

## Step 5.3 — Issue canonical IDs (F-NNN)

For each story in story-map (must-have first, then should-have, then nice-to-have):

```python
# Mini-repo
id = f"F-{next_seq:03d}"
# Monorepo
id = f"{service-slug}-F-{next_seq:03d}"
```

**Collision check (mandatory):**
1. Read `docs/intel/feature-catalog.json#features[].id` (existing IDs in catalog)
2. Read `docs/feature-map.yaml#features.{id}` (registry of all features)
3. Glob `{features-root}/F-*/` (filesystem)
4. Union all sets; pick next sequence not in use

If `from-doc` or `from-code` already issued IDs → continue from `max + 1`.

Persist mapping `story-id → feature-id` to `_pipeline-state.json#steps.5.id_mapping{}`.

## Step 5.4 — Per-artifact merge decision (Option 3)

For each of 4 intel artifacts (`actor-registry.json`, `permission-matrix.json`, `sitemap.json`, `feature-catalog.json`), check existing state:

```python
for artifact in ["actor-registry.json", "permission-matrix.json", "sitemap.json", "feature-catalog.json"]:
    existing = read_meta(intel_path, artifact)
    if existing:
        prompt user:
          *"Phát hiện docs/intel/{artifact} đã có:
             - Producer: {existing.producer}
             - produced_by_skill: {existing.produced_by_skill or 'unknown'}
             - Last updated: {existing.produced_at}
             - Last validated: {existing.validation.validated_at if any}
           Bạn muốn:
             (a) APPEND — merge from-idea data với data hiện tại (qua intel-merger)
             (b) REPLACE — backup .bak.{ISO} + ghi đè toàn bộ
             (c) SKIP — bỏ qua artifact này, giữ nguyên existing
           Lựa chọn:"*
        record decision in _pipeline-state.json#steps.5.merge_decisions[artifact]
    else:
        decision = "create"
```

**Constraints:**
- For `feature-catalog.json`: SKIP option requires ≥ 1 feature already in catalog matches new feature by name (semantic dedup) — else error: "feature-catalog has no features — cannot skip"
- For `actor-registry.json`: SKIP creates risk that new feature.role_visibility[] reference dangling slugs — flag warning
- REPLACE always creates `.bak.{ISO}` backup

## Step 5.5 — Write artifacts (4 intel + N test-evidence)

For each artifact, depending on merge decision:

### CREATE (no existing)
```python
write_artifact(intel_path / artifact, payload)
bash: meta_helper.py update intel_path artifact \
  --producer manual-interview \
  --produced-by-skill from-idea \
  --ttl <see INTEL_INTEGRATION.md>
```

### REPLACE
```python
copy(intel_path / artifact, intel_path / f"{artifact}.bak.{ISO}")
write_artifact(intel_path / artifact, payload)
bash: meta_helper.py update intel_path artifact \
  --producer manual-interview \
  --produced-by-skill from-idea \
  --replace-previous {existing.producer} \
  --ttl <...>
```

### APPEND
```python
write_artifact(intel_path / f"{artifact}.new.json", payload)
dispatch: Agent intel-merger 
  with prompt:
    "Merge {artifact}.new.json into {artifact}. 
     New producer: manual-interview/from-idea (idea-side authority for vision/business_intent/risks).
     Existing producer: {existing.producer}.
     Conflict precedence per ~/.claude/schemas/intel/README.md."
```

### SKIP
```python
log "Skipped {artifact} per user choice"
# but verify FK integrity vs existing — flag if new features reference roles missing from existing
```

### Test-evidence files
For each must-have feature in feature-catalog:
```python
write_artifact(intel_path / "test-evidence" / f"{feature_id}.json", tc_seeds)
bash: meta_helper.py update intel_path test-evidence/{feature_id}.json \
  --producer manual-interview \
  --produced-by-skill from-idea \
  --ttl 14
```

## Step 5.6 — Write per-feature `_state.md` + `feature-brief.md`

For each feature in feature-catalog:

### `_state.md` (CD-20 unified — 21 frontmatter fields + 6 body sections)

Schema reference: `~/.claude/skills/from-doc/SKILL.md` § Step 5f. Values for from-idea-specific fields:

```yaml
---
feature-id: {id}
feature-name: {name}
pipeline-type: sdlc
status: in-progress
depends-on: []          # from-idea defaults empty; user can edit later
blocked-by: []
created: {today}
last-updated: {today}
current-stage: ba       # idea intake done, BA is next stage
output-mode: lean       # default for ideas; user can escalate
repo-type: {mini|mono}
repo-path: "."
project: {service if mono, else "."}
project-path: {resolved}
docs-path: {features-root}/{id}
intel-path: docs/intel
stages-queue: [ba, sa, tech-lead, dev, qa, reviewer]
completed-stages:
  idea-intake:
    verdict: "Idea brainstormed via 4 spirals + pre-mortem"
    completed-at: "{today}"
kpi:
  tokens-total: 0
  cycle-time-start: "{today}"
  tokens-by-stage: {}
rework-count: {}
source-type: idea-brainstormed
agent-flags:
  ba:
    source-type: idea-brainstormed
    blocking-gaps: 0
    has-prfaq: true
    has-impact-map: true
    has-event-storming: true
    has-story-map: true
    has-pre-mortem: true
    risks-count: {N from feature.risks}
    assumptions-count: {N from feature.assumptions}
clarification-notes: ""
feature-req: |
  file:{docs-path}/feature-brief.md
  canonical-fallback:docs/intel/feature-catalog.json#features[id={id}]
  scope-modules: [{inferred from event-storming aggregates}]
  scope-features: [{id}]
  dev-unit: {primary service slug}
---

# Pipeline State: {feature-name}

## Business Goal
{feature.business_intent — 1-2 sentence summary}

## Stage Progress
| # | Stage | Agent | Verdict | Artifact | Date |
|---|---|---|---|---|---|
| 1 | Idea Intake | from-idea | Done | feature-brief.md | {today} |
| 2 | Analysis | ba | — | ba/00-lean-spec.md | — |
| 3 | Architecture | sa | — | sa/00-lean-architecture.md | — |
| 4 | Execution Planning | tech-lead | — | 04-tech-lead-plan.md | — |
| 5 | Development | dev/fe-dev | — | 05-dev-w*.md | — |
| 6 | QA | qa | — | 07-qa-report.md | — |
| 7 | Review | reviewer | — | 08-review-report.md | — |

## Current Stage
**ba** — Ready to start. Input: feature-brief.md. Source: idea-brainstormed (4 spirals + pre-mortem).

## Next Action
Invoke `/resume-feature {id}` to start BA stage.

## Active Blockers
{if feature.risks has severity=high unmitigated → list as blockers; else "none"}

## Wave Tracker
| Wave | Tasks | Dev Status | QA Status |
|---|---|---|---|

## Escalation Log
| Date | Item | Decision |
|---|---|---|
```

### `feature-brief.md` (primary feature-req file)

```markdown
---
type: feature-brief
feature-id: {id}
feature-name: {name}
source-type: idea-brainstormed
created: {today}
producer: from-idea
canonical-hash: {sha256 of feature-catalog entry}
linked-spirals: [s1, s2, s3, s4, 4.5]
---

# Feature Brief: {name}

## Vision Context (digested from PRFAQ)

> Self-contained vision excerpt — embedded so stage agents have full context
> without needing to traverse `_idea/idea-brief.md`. ENRICHMENT v0.27 (option 2).

**Headline:** {prfaq.headline}
**Target user:** {prfaq.persona.role} — {prfaq.persona.context}, {prfaq.persona.frequency}
**Win condition:** {prfaq.success_metric.metric-name} = {target} (baseline: {baseline}, confidence: {pct}%)
**Why now / why this approach:** {1-2 sentences digest from PRFAQ Q1.3.1 + Q1.3.3}
**Top 3 critical assumptions (project-level):**
1. {prfaq.assumption.A1}
2. {prfaq.assumption.A2}
3. {prfaq.assumption.A3}

## This Feature's Role in Vision

This feature contributes to win condition by: {1-2 sentences how this feature serves the success metric — derived from impact-map deliverable rationale}.

**Linked impact:** {impact-map.I-X.X — actor + behavior change}
**Linked deliverable:** D-X.X.x ({deliverable name + DEDUP verdict})

## Business Goal (this feature)
{feature.business_intent}

## Acceptance Criteria
{numbered list from feature.acceptance_criteria}

## Roles (Visible-To)
{list from feature.role_visibility}

## Flow Summary
{feature.flow_summary}

## Domain Context (from Event Storming)
**Aggregate:** {feature.entities[0]} — owns events: {list of events touching this feature}
**Cross-aggregate dependencies:** {if any, list other aggregates this feature reads/writes}

## Dialogs (placeholders for sa/UX)
{list from feature.dialogs[] — string list}

## Error Cases
{list from feature.error_cases[]}

## Risks (from Phase 4.5 pre-mortem)
{list of feature.risks[] — propagated to _state.md Active Blockers if severity=high}

| Risk ID | Narrative | Probability | Severity | Mitigation idea |
|---|---|---|---|---|
| R-{id}-1 | ... | low/med/high | low/med/high | ... |

## Critical Assumptions (this feature)
{list of feature.assumptions[]}

## Story Points
{S | M | L} ({estimated person-days range})

## Open Questions for `ba`
{list of [CẦN BỔ SUNG] markers found in feature, if any}
{list of decisions where confidence_pct < 50% — these need validation}

## Source Spirals (deep-context pointers — read on-demand if ba/sa needs more)
- PRFAQ:        `_idea/idea-brief.md` § Section 1 (Headline) + 2 (Persona) + 3 (Why)
- Impact Map:   `_idea/impact-map.md` § Tier 4 Deliverable D-X.X.x
- Event Storming: `_idea/event-storming.md` § Aggregate "{name}" + cross-aggregate events
- Story Map:    `_idea/story-map.md` § Story S-N (priority assignment + linked AC)
- Pre-mortem:   `_idea/pre-mortem.md` § Risk F-i (failure narrative + mitigation) + Pathway S-j (success precondition)
- Assumptions:  `_idea/assumptions.md` § A-i
- Dedup:        `_idea/dedup-report.md` § D-X.X.x verdict + rationale
```

## Step 5.7 — Update `feature-map.yaml`

Append entries:

```yaml
features:
  {id}:
    name: {name}
    docs-path: {features-root}/{id}
    status: proposed
    priority: must-have | should-have | nice-to-have
    current-stage: ba
    source-type: idea-brainstormed
    created: {today}
    last-updated: {today}
    depends-on: []
```

## Step 5.8 — Run `intel-validator --quick` (mandatory agent dispatch)

```python
dispatch: Agent intel-validator
  with prompt:
    "Validate intel layer at {intel_path} after from-idea Phase 5 crystallize.
     Mode: --quick.
     Producer: manual-interview / from-idea.
     Affected artifacts: {list of 4 intel + N test-evidence + ≥ 1 _state.md}.
     Return: PASS | WARN (with list) | FAIL (with diagnostics)."

if verdict == "FAIL":
    surface diagnostics to user
    STOP — do not proceed to snapshot regen
elif verdict == "WARN":
    log warnings + continue
elif verdict == "PASS":
    continue
```

Persist `_pipeline-state.json#steps.5.validator_verdict`.

## Step 5.9 — Snapshot regen (Cursor Rule 24 — mandatory)

```bash
python ~/.cursor/skills/intel-snapshot/generate.py --intel-path docs/intel
python ~/.cursor/skills/intel-snapshot/generate.py --intel-path docs/intel --check
```

Expected: `[OK] Snapshot fresh`. If fails → log, surface to user, but don't block (agents fall back to canonical JSON).

Persist `_pipeline-state.json#steps.5.snapshot_regenerated: true|false`.

## Step 5.10 — Final coherence ledger

Append to `_idea/coherence-log.md`:

```markdown
## C-S5 — Crystallize closure ({ISO})
- Features crystallized: {N total} (must-have: {P}, should-have: {Q}, nice-to-have: {R})
- Test-evidence seeds: {sum(min_tc) seeds across must-haves}
- _state.md created: {N}
- feature-brief.md created: {N}
- Merge decisions: {map}
- FK integrity: PASS
- Semantic audit (5 rules): {PASS|FAIL with rule-id}
- intel-validator verdict: {PASS|WARN|FAIL}
- Snapshot: [OK|FAIL]
```

## MC-5 — User confirmation

Before transitioning to Phase 6:

```
✅ Crystallize complete.

Đã ghi:
  • {features-root}/{id}/ × {N} feature folders
  • docs/intel/{actor-registry, permission-matrix, sitemap, feature-catalog}.json (4 files)
  • docs/intel/test-evidence/{F-NNN}.json × {must-have count}
  • docs/feature-map.yaml updated
  • Merge decisions: {summary table}

Validator: {PASS}
Snapshot: [OK]

Sang Phase 6 (Handoff)?
```

## Failure modes

- intel-validator FAIL → STOP, surface, do not advance to snapshot. User can choose: rewind to fix or accept-with-skip.
- meta_helper.py update fails (missing script, permission) → STOP, log, suggest manual recovery.
- intel-merger conflict cannot be resolved automatically → surface diff to user, ask manual resolution before continuing.
- snapshot regen fails repeatedly → log + warn but continue (snapshot is non-blocking per Cursor Rule 24 fallback semantics).

## Stop conditions

- FK integrity fails → MUST fix before proceed (no soft-fail)
- Semantic audit fails any rule → MUST fix before proceed
- ≥ 30% of features have `[CẦN BỔ SUNG]` in critical fields → STOP, recommend `intel-fill` or rewind to relevant spiral
