# Phase 6 — Handoff

**Purpose**: Summarize deliverables, optionally invoke `/generate-docs` bridge, update memory.

**Pre**: Phase 7 complete, all artifacts on disk
**Tokens**: 0 (display + optional delegation)
**Gate**: none

---

## Step 6.0 — Entry print

```
Print: "▶️ Starting Phase 6: Handoff"
```

## Step 6.1 — Verify artifacts

```
# Tier 1 (mandatory cross-stage) per OUTLINE_COVERAGE.md § 8.2
required_artifacts_tier1 = [
  docs/intel/code-facts.json,             # T1 — code-level facts (services/routes/entities/auth)
  docs/intel/system-inventory.json,       # T1 — tech stack, services, IPv6 readiness
  docs/intel/feature-catalog.json,        # T1 — canonical (CD-10) — NOT features.json
  docs/intel/actor-registry.json,         # T1 — roles + auth + RBAC mode
  docs/intel/permission-matrix.json,      # T1 — RBAC matrix
  docs/intel/sitemap.json,                # T1 — routes + navigation + Playwright hints
  docs/intel/status-evidence.json,        # T1 supporting — status detection rationale
]

# Tier 2 (cross-stage optional, but block here since from-code MUST emit) per OUTLINE_COVERAGE.md § 5
required_artifacts_tier2 = [
  docs/intel/data-model.json,             # T2 — entities + tables + ERD + data dictionary
  docs/intel/api-spec.json,               # T2 — OpenAPI-style endpoint catalog
  docs/intel/architecture.json,           # T2 — 4 cpdt_layers + components + 3 architecture models
  docs/intel/integrations.json,           # T2 — external systems + LGSP/NGSP
]

# Bridge files for generate-docs Route A
bridge_files = [
  docs/intel/code-brief.md,
  docs/intel/arch-brief.md,
  docs/README.md,
  docs/ARCHITECTURE.md,
  docs/business-flows.md,
  docs/data-model.md,
  docs/security-overview.md,
  docs/architecture/context.md,
  docs/architecture/containers.md,
  docs/architecture/data-model.md,
  docs/architecture/integrations.md,
]

# Cursor SDLC bridge files
sdlc_bridge_files = [
  {features-root}/*/feature-brief.md,    # per pipeline (mono) or root (mini)
  {features-root}/*/_state.md,
  {features-root}/*/status.md,
  feature-map.yaml,
]

required_artifacts = required_artifacts_tier1 + required_artifacts_tier2 + bridge_files + sdlc_bridge_files

verify all exist + sha256 matches state.artifacts
IF any Tier 1 missing → HARD-STOP (block handoff, never continue)
IF any Tier 2 missing → print which, offer: "Re-run Phase {N}" or "Mark as gap (Cursor SDLC pro-tier will warn)"
IF any bridge file missing → offer same options (Route A score degrades 5/5 → 4/5)
```

## Step 6.1.5 — Intel quality gate (HARD-STOP — extended for all Tier 1+2)

Validate every emitted intel artifact against `~/.claude/schemas/intel/*.schema.json`. Apply quality gates per `OUTLINE_COVERAGE.md` § 5 acceptance criteria.

### Validation pass (all Tier 1+2)

```
for artifact in required_artifacts_tier1 + required_artifacts_tier2:
    python ~/.claude/scripts/intel/validate.py {artifact} --schema {schema-name}
    # Validates schema_version, required fields, type/pattern constraints, FK integrity
```

### Tier 1 quality gates (HARD-STOP if violated)

| Artifact | Hard-stop condition |
|---|---|
| `code-facts.json` | `services[]` empty AND `routes[]` empty (no code detected) |
| `system-inventory.json` | `tech_stack[]` count < 5 entries |
| `feature-catalog.json` | feature count = 0; OR per feature: description < 200 chars, business_intent < 100, flow_summary < 150, acceptance_criteria < 3 items × 30 chars each |
| `actor-registry.json` | `rbac_mode = implicit` AND no auth code detected |
| `permission-matrix.json` | empty `permissions[]` when `rbac_mode != implicit` |
| `sitemap.json` | `routes[]` count < 5 |

### Tier 2 quality gates (HARD-STOP if violated)

| Artifact | Hard-stop condition |
|---|---|
| `data-model.json` | `tables[]` count = 0 when project has DB (detected via system-inventory.tech_stack with category=database) |
| `api-spec.json` | `endpoints[]` count = 0 |
| `architecture.json` | `components[]` count < 3; OR `cpdt_layers[]` missing 'giao-dien' or 'nghiep-vu'; OR `models.{overall,logical,physical}_diagram` any null |
| `integrations.json` | (non-blocking — warn only when count = 0; not all systems integrate externally) |

### Cross-reference integrity (HARD-STOP)

Per `~/.claude/schemas/intel/README.md` § Cross-Reference Integrity Rules:

```
intel-validator agent runs all 27 cross-ref rules. Any blocking violation in T1 (rules 1-9) or T2 (rules 10-16 with severity=block) → halt.
```

### Failure handling

```
IF any hard-stop violation:
  Print: "❌ Intel quality gate FAILED"
  Per failure show: artifact, rule violated, current vs required
  
  Options:
    [r] Re-run Phase {N} for the artifact owner (e.g. data-model gaps → Phase 1 Static Harvest entity adapter)
    [i] Interactive fill — prompt user per gap (only for fields where user input is appropriate)
    [a] Abort handoff — pipeline incomplete, do NOT print "ready" summary
  
  Default: [r]. NEVER auto-skip. Downstream consumers (Cursor SDLC + generate-docs) depend on these fields.
```

**Anti-pattern (FORBIDDEN):** Producing thin Tier 1+2 artifacts and proceeding. Cursor SDLC then has to invent values → drift. generate-docs writers then emit `[CẦN BỔ SUNG]` placeholders or pad with banned formulaic prose. Block here, fix upstream — invest in producer correctness, save downstream rework.

### Update _meta.json after pass

```
for artifact in required_artifacts_tier1 + required_artifacts_tier2:
  python ~/.claude/scripts/intel/meta_helper.py update docs/intel/ {artifact-basename} \
    --producer from-code --ttl-days {ttl-per-README} \
    --source-evidence "{phase that produced it}"
```

TTL defaults per `~/.claude/schemas/intel/README.md` § TTL Defaults:
- code-facts: 7d | system-inventory: 30d
- feature-catalog/sitemap: 30d | permission-matrix: 60d | actor-registry: 90d
- api-spec: 14d | data-model: 30d | architecture: 60d | integrations: 30d

## Step 6.1.6 — Generate intel snapshot (MANDATORY — non-blocking)

After all Tier 1+2 artifacts pass quality gate + `_meta.json` updated, regenerate `_snapshot.md` so base-tier consumers (Cursor SDLC `dev`/`qa`/`reviewer`/`ba`/`sa`) read compressed view (~95% smaller) instead of full canonical JSON. Without this step, base-tier agents in subsequent SDLC stages re-read canonical Tier 1 → ≥40K duplicate tokens per agent dispatch.

```bash
python ~/.cursor/skills/intel-snapshot/generate.py --intel-path docs/intel
python ~/.cursor/skills/intel-snapshot/generate.py --intel-path docs/intel --check
```

Expected:
- First call: `[WROTE] docs/intel/_snapshot.md (X.X KB ~ NNN tokens)` + `[WROTE] _snapshot.meta.json`
- `--check` follow-up: `[OK] Snapshot fresh`

**Failure handling** (per intel-snapshot SKILL.md "snapshot is optimization, not correctness"):
- IF generator exits non-zero → WARN user: "Snapshot regen failed — base-tier agents will fall back to canonical JSON (slower, no correctness impact)". Continue Step 6.2.
- IF Tier 1 inputs missing → snapshot generates partial (handled inside script). Continue.

**State**: `state.steps["6"].snapshot_regenerated: true|false_with_reason`. Do NOT block handoff on snapshot failure.

## Step 6.2 — Display summary card

Mini:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ from-code hoàn tất — {system-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Workspace:  {path}
  Repo type:  mini
  Stack:      {FE} / {BE}  (adapters: {list})

  📊 Features:
    Total:        {N}
    done:         {D}
    in-progress:  {IP}
    stubbed:      {S}
    planned:      {P}

  📁 Intel:
    docs/intel/code-brief.md      ({N} features, {M} rules, {K} entities)
    docs/intel/arch-brief.md      (C4 + NFR + data classification)
    docs/intel/status-evidence.json  ({G} gaps_to_done total)

  🗺 Architecture diagrams:
    context, containers, {N} components, ER, {5} sequences, integrations
    Mermaid errors: {E}

  📘 Bridge-ready (generate-docs Route A):
    docs/README.md, ARCHITECTURE.md, business-flows.md,
    data-model.md, security-overview.md, adr/{N} ADRs
    → generate-docs coverage: {4/5 | 5/5}

  📋 Features (next stage in Cursor SDLC):
    {feature.id} — {name} — stage: {current-stage} ({status})
    ...

  🕒 Runtime: {N} min
  💰 Tokens:  ~{K}K

  ▶ Next steps:
    1. Review docs/intel/code-brief.md + docs/features/*/status.md
    2. Cursor SDLC: /resume-feature {first-feature-id}
    3. Render VN admin docs: /generate-docs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Mono — same but per-service subsections + cross-service dependency summary.

## Step 6.3 — Optional: auto-invoke generate-docs

```
AskUserQuestion (max 4):
  1. "✅ Dừng ở đây — review thủ công"
  2. "📄 Tiếp tục /generate-docs (render TKKT/TKCS/TKCT/HDSD từ bridge files)"
  3. "📄 Chỉ /generate-docs tkkt (architecture doc, nhanh nhất)"
  4. "💬 Mở Cursor SDLC (/resume-feature) trên feature đầu tiên"

IF option 2 or 3:
  Print: "ℹ️ generate-docs sẽ đọc docs/README.md + docs/ARCHITECTURE.md (Route A).
          Không cần re-interview — interview_context đã lưu trong state."

  IF mono:
    AskUserQuestion: "Chạy generate-docs cho service nào?"
    Options: list of services + "tất cả (tuần tự)"

  Invoke via Skill tool OR print command for user:
  "   /generate-docs {target} --docs-path {svc.path}/docs   (mono)
    /generate-docs {target}                                 (mini)"

IF option 4:
  Print: "   Trong Cursor: /resume-feature {first-feature-id}"
  Note: Claude Code can't directly invoke Cursor; user switches editors.
```

## Step 6.4 — Update memory (MANDATORY)

Append to `MEMORIES.md` per workspace (if supported) OR to user's global memory:

```markdown
## from-code

### {system-slug} (last-run: {today})
- workspace: {path}
- repo-type: {mono | mini}
- services: {N}
- adapters: {list}
- features: {total}
  - done: {D}
  - in-progress: {IP}
  - stubbed: {S}
  - planned: {P}
- bridge-route-a-score: {4/5 | 5/5}
- generate-docs-ready: true
- interview-context-keys: {list} (for generate-docs reuse)
- notable-decisions:
  - {ADR references if any}
- notable-tech-debt:
  - {flagged items}
- runtime-min: {N}
```

## Step 6.5 — Final state update

```
state.steps["6"].completed_at = now
state.current_step = "complete"
Flush state

Archive state snapshot:
  cp _pipeline-state.json _pipeline-state.{today}.snapshot.json
```

## Step 6.6 — Exit print (MANDATORY)

```
Print: "🏁 from-code pipeline complete for {system-name}."
```

---

## Resume after handoff

If user later wants to regenerate (e.g. after significant code changes):

```
/from-code --resume    # continues from current_step if != complete
/from-code --rescan    # archives old state, fresh run (same workspace)
/from-code --diff      # [future] compare current code-facts vs snapshot, show delta
```

## Bridge to generate-docs — contract verification

`from-code` → `generate-docs` bridge invariants (`generate-docs` Phase 0.3 verifies):

| generate-docs check | from-code guarantees |
|---|---|
| `docs/README.md` exists | P6c writes it |
| `docs/ARCHITECTURE.md` exists | P6c writes it |
| `docs/adr/` ≥ 3 ADRs | Only if P6b.3 option 1 chosen (4/5 otherwise) |
| `docs/features/*/feature-brief.md` | P7.6 writes all |
| `docs/business-flows.md` | P6c writes it |
| `docs/data-model.md` | P6a.2 / 6c writes it |
| `docs/security-overview.md` | P6c writes it |

Route A scoring → **5/5 with ADRs, 4/5 without** — both trigger Route A in generate-docs (threshold: score ≥ 2/5).

`_pipeline-state.json` `config.interview_context` is discoverable by generate-docs; contents cover NFR + domain boundaries + external classification — no re-interview.
