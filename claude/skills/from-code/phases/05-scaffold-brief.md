# Phase 5 — Scaffold + Feature Briefs

**Purpose**: Write per-feature `_state.md` + `feature-brief.md` + `status.md`, plus `feature-map.yaml`. Contract compatible with Cursor SDLC agents.

**Pre**: Phase 4 complete. `arch-brief.md` + `code-brief.md` written.
**Tokens**: ~8K per service (parallel per feature)
**Checkpoint**: MC-6 (see [_micro-checkpoint.md](_micro-checkpoint.md))

---

## Step 5.0 — Entry print

```
Print: "▶️ Starting Phase 5: Scaffold + Feature Briefs"
```

## Step 5.1 — Read canonical data

```
Read docs/intel/code-brief.md            → system-name, modules, features
Read docs/intel/features.json            → all features with status
Read docs/intel/status-evidence.json     → per-feature gaps
Read docs/intel/arch-brief.md            → architecture context
Read state.config.interview_context      → feature_notes, nfr_targets, domain_boundaries
Read state.config.services               (mono)
```

## Step 5.2 — PREFIX derivation

```
PREFIX = derive_prefix(system_name, max 6 chars, deaccent)
# "Quản lý đơn hàng" → "QLDH"

Collision check: scan existing docs/features/*/ dirs → append digit if collision.
```

If MC-6 forward-context includes `prefix_override` → use that instead.

## Step 5.3 — Resolve features-root per service

```
FOR each service in active_services:
  IF repo_type == "mini":
    features_root = "docs/features"
  ELSE (mono):
    features_root = f"{service.path}/docs/features"

  mkdir -p {features_root}

  FOR each feature where service_id == svc.id:
    feature_dir = f"{features_root}/{feature.feature_id}"
    mkdir -p {feature_dir}
```

## Step 5.4 — Dependency graph between features

Build `feature.depends_on[]` from:
- Entity FK cross-references (`feature.entity_ids` ∩ FK-targets of another feature's entities)
- DI calls across features (via `code-facts.di_graph`)
- User-provided `feature_notes[id].manual_deps_on` (from MC-2 forward context)

Cycle detection → merge cycled pairs with `cycled-must-refactor` note.

## Step 5.5 — Derive stages-queue per feature

Status-aware routing (reusing the logic from from-doc but adapted):

| Feature status | Default stages-queue | Rationale |
|---|---|---|
| `done` | `[reviewer]` | Just SDLC audit / documentation reinforcement |
| `in-progress` | `[ba, sa?, tech-lead, dev-wave-1, qa-wave-1, reviewer]` | Close gaps_to_done |
| `stubbed` | `[ba, sa, tech-lead, dev-wave-1, qa-wave-1, reviewer]` | Full build; current code is skeleton |
| `planned` | `(path-based per risk-score)` | Greenfield — compute path S/M/L |

Conditional additions:
- FE routes present → insert `designer` + `fe-dev-wave-1`
- PII involved → append `security-review`
- External integrations → force-insert `sa`

Overrides from MC-6 forward context take precedence.

## Step 5.6 — Dispatch parallel writers per feature

Single message, multiple Agent() calls:

```
PARALLEL per feature:
  Agent(subagent_type: code-intel,
        prompt: "task=write-feature-brief, feature_id={id}")
  Agent(subagent_type: code-intel,
        prompt: "task=write-status-md, feature_id={id}")
  Agent(subagent_type: code-intel,
        prompt: "task=write-state-md, feature_id={id}")
```

Each writes one of three files under `{features-root}/{feature_id}/`:
- `feature-brief.md` — scoped per-feature brief (reuses from-doc template + status metadata)
- `status.md` — implementation status evidence + gaps_to_done table + recommended action
- `_state.md` — Cursor SDLC contract with status-aware `current-stage` + `agent-flags`

See [agents/code-intel.md](../agents/code-intel.md) for the exact templates (task specs).

## Step 5.7 — Write `feature-map.yaml`

Per service in mono, or root in mini:

```yaml
repo-type: {mono | mini}
service: {svc.id}   # omit for mini
generated-at: {ISO}
source-type: code-reverse-engineered
features:
  {feature.id}:
    name: {name}
    project: {svc.id}
    docs_path: {features-root}/{id}
    status: in-progress                    # SDLC pipeline status
    current-implementation-status: {status}  # code status (done/in-progress/stubbed/planned)
    completeness-score: {0.XX}
    current-stage: {stage}
    depends-on: [{deps}]
    created: {today}
    updated: {today}
```

Mono → also write `docs/feature-map-aggregate.yaml` at root:
```yaml
repo-type: mono
services:
  {svc.id}:
    feature-count: {N}
    by-status: {done: N, in-progress: N, stubbed: N, planned: N}
    features-root: {svc.path}/docs/features
cross-service-dependencies:
  - from: {svc-A.feature-id}
    to: {svc-B.feature-id}
    kind: "API call | shared entity | event"
```

## Step 5.8 — MC-6 Micro-checkpoint

See [_micro-checkpoint.md](_micro-checkpoint.md) for base pattern.

```
═══════════════════════════════════════════════════
 ✅ Phase 5 complete — {N} features scaffolded
═══════════════════════════════════════════════════

Written per service:
  - api:  16 features → _state.md + feature-brief.md + status.md
  - web:  14 features → ...

PREFIX used: {PREFIX}
Feature-map: docs/feature-map.yaml + (mono) docs/feature-map-aggregate.yaml

Before Phase 6 (Handoff), any of these?

AskUserQuestion (max 4):
  1. "▶️ Continue — scaffold looks right"
  2. "✏️ Adjust feature IDs / PREFIX"
  3. "📌 Skip _state.md emission for some features (keep scaffold-only)"
  4. "🔧 Override stage-queue for specific features"
```

### Edit handlers

- **PREFIX/IDs**: collect new PREFIX, regenerate IDs (rewrite all `_state.md` + `feature-brief.md` + `status.md` and feature-map)
- **Skip _state.md**: remove specified `_state.md` files; update `feature-map.yaml` with `skip-state-md: true` flag; user will manually create later
- **Stage-queue override**: update specific `_state.md` `stages-queue` field in place

Iteration bound: 2. After cap → forced 2-option.

## Step 5.9 — State update + exit print

```
state.steps["5"].completed_at = now
state.steps["5"].mini_gate = { iterations: N, forward_context_keys: [...] }
state.current_step = "6"

Print: "✅ Phase 5 complete. {N} features scaffolded.
        ▶️ Next: Phase 6 Handoff"
```
