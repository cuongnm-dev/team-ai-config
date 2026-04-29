---
name: from-code
description: Đọc mã nguồn của dự án (bất kỳ ngôn ngữ nào) để tự động trích xuất danh sách tính năng, dựng lại sơ đồ kiến trúc và sinh hồ sơ trạng thái cho từng tính năng. Kết quả ghép nối được với /generate-docs để sinh tài liệu kỹ thuật. Dùng khi đã có code nhưng chưa có tài liệu.
---

# From Code to Features + Docs — Claude Code Pipeline

User-facing messages: Vietnamese. All instructions: English.

## Purpose

Reverse-engineer a codebase into:
1. **Feature inventory** with implementation status (`planned` / `stubbed` / `in-progress` / `done`)
2. **Architecture documentation** (C4: Context, Containers, Components, ER, Sequences, Integrations)
3. **`_state.md` per feature** — Cursor SDLC contract (same format as `from-doc`)
4. **Bridge artifacts** — `docs/README.md`, `docs/ARCHITECTURE.md`, etc. consumable by `generate-docs` Route A

Target stacks: **stack-agnostic** via 3-tier extraction. v1 ships 4 framework adapters (`dotnet-aspnetcore`, `angular`, `nestjs`, `fastapi`); other stacks fall back to tier 1 (universal) + tier 3 (LLM fallback). Adapters are pluggable.

## When to use

- Legacy codebase with no/stale docs → reverse-engineer features + docs
- Newly inherited project → onboarding artifacts
- Pre-migration audit → know what exists, status, architecture
- Bridge to `generate-docs` for TKKT/TKCS/TKCT/HDSD when source code is only input

## Intel cache warm-start (Phase 4 — AGI #2)

**Before Phase 1 Static Harvest**, query `etc-platform` MCP for similar prior projects:

```
sig = build_signature_from_p0(repo)
  → {stacks: [...], role_count: ?, domain_hint: ?, feature_count_bucket: ?}

mcp__etc-platform__intel_cache_lookup(project_signature=sig, kinds=["actor-pattern", "feature-archetype"])
  → exact_matches[] + similar_projects[]
```

**Use cases**:
- `actor-pattern` exact match → seed Stage 1.2 (Actor Enum) with prior canonical role list, validate against actual code
- `feature-archetype` similar → narrow Stage 2.2 (Feature Synthesis) hypothesis space
- Pre-populate confidence scores: prior pattern + current code agreement → `confidence: high`

**Contribute back** (after pipeline completes, with consent):
```
mcp__etc-platform__intel_cache_contribute(
  project_id=slug,
  project_signature=sig,
  artifact_kind="actor-pattern",
  payload={role_archetypes: ["admin","manager","staff"]},  # canonical only — NEVER customer names
  contributor_consent=True  # require explicit user opt-in
)
```

Server auto-rejects payloads containing PII / customer hints (Bộ/Tỉnh/Sở/CCCD/email/phone). Default-deny.

## When NOT to use

- Codebase has complete `docs/` → use `/generate-docs` directly
- Need to start a greenfield project from requirements → use `/from-doc` or `/new-workspace`
- Single-feature extraction → use `Explore` agent directly

---

## Intel Layer Integration (CLAUDE.md CD-10)

This skill writes to the shared Intel Layer at `{workspace}/docs/intel/`. See `INTEL_INTEGRATION.md` (sibling file) for full contract. Key changes vs legacy:

- **NEW phase P1.5 — Actor Enumeration** between P1 and P2 (agent: `tdoc-actor-enum`)
- **DEPRECATED** P5/P6c bridge files — Intel Layer IS the bridge
- **REQUIRED** producer calls: `python ~/.claude/scripts/intel/meta_helper.py update ...` after every artifact write
- **REQUIRED** validator call: invoke `intel-validator --quick` before phase exit
- **Schemas** (must conform): `~/.claude/schemas/intel/{actor-registry,permission-matrix,sitemap,feature-catalog,_meta}.schema.json`

## State Machine — Per-Phase Micro-Checkpoint Flow

The pipeline is 7 phases, each ending with a **micro-checkpoint** (MC) that:
1. Confirms phase output
2. Collects forward-looking context for the next phase
3. Typically resolves with 1 tap ("Continue") for well-detected repos

This replaces the old batched interview rounds (R1/R2/R3) + 3 heavy gates. Token-efficient: LLM context for phase N+1 starts with user-confirmed N output.

```
P0 Preflight              P1 Static Harvest (parallel, no LLM)        P2 Feature Synthesis
┌────────────┐            ┌──────────────────────────────────────┐    ┌────────────────────┐
│ detect     │            │ 1a stack / 1b routes / 1c entities   │    │ 2a cluster          │
│ workspace  │  →  MC-0 → │ 1d auth / 1e integrations / 1f i18n  │→MC-1 → 2b status classify │→MC-2
│ resume     │            │ 1g tests / 1h di-graph / 1i configs  │    │ 2c name (i18n-first)│
└────────────┘            └──────────────────────────────────────┘    └────────────────────┘
                                                                                    ↓
P3 Validation            P4 Architecture Diagrams       P5 Architecture Merge     P6 Scaffold+Brief  P7 Handoff
┌────────────┐           ┌────────────────────────┐     ┌──────────────────┐     ┌─────────────┐   ┌──────────┐
│ silent-fail│           │ 4a context / container │     │ 5a arch-brief    │     │ 6a _state.md│   │ summary  │
│ detection  │→MC-3 →    │ 4b component / ER      │→MC-4→│ 5b code-brief    │→MC-5→│ 6b feat-    │→MC-6→ bridge  │
│ + autofix  │           │ 4c sequences / integ   │     │ 5c bridge files  │     │    brief.md │   │ to gen-  │
└────────────┘           └────────────────────────┘     └──────────────────┘     └─────────────┘   │ docs     │
                                                                                                    └──────────┘

MC-N = Micro-Checkpoint: confirms phase N + collects forward context for phase N+1.
       See phases/_micro-checkpoint.md for the reusable pattern.
```

### Phase-to-forward-context mapping

| Checkpoint | After phase | Forward context collected (feeds next phase's LLM prompt) |
|---|---|---|
| MC-0 | P0 Preflight | Folders to exclude, specific services to focus (for mono) |
| MC-1 | P1 Static Harvest | Domain vocabulary (VN terms) · module boundary hint (DDD/team/feature) · deprecated code to ignore · infrastructure context (DB prod, Redis usage, legacy systems) |
| MC-2 | P2 Feature Synthesis | Rename features · status overrides · planned-feature additions · out-of-scope flags |

### P2 Feature Synthesis dispatch — Extended Thinking REQUIRED

`tdoc-researcher` Stage 2.2 needs **extended thinking** to group routes/controllers into business features (the hardest reasoning step in the pipeline). Dispatcher MUST pass this flag explicitly:

```
Agent(subagent_type="tdoc-researcher",
      prompt="""EXECUTE Stage 2.2 (Feature Synthesis).
docs-path: {DOCS_PATH}
repo-path: {REPO_PATH}
scope: stage2
use-extended-thinking: true                  ← REQUIRED — without this, feature grouping degrades
chunking-threshold: 30
""")
```

Other stages (1.1 inventory, 1.3 skeleton, 2.3 sitemap) do NOT need extended thinking — they're mechanical extraction. Pass `use-extended-thinking: false` to save tokens.
| MC-3 | P3 Validation | Auto-fix selections · strict-mode escalation |
| MC-4 | P4 Architecture Diagrams | Domain boundaries (core/supporting/generic) · integration classification (core/legacy/planned) · diagram corrections |
| MC-5 | P5 Architecture Merge | NFR targets · PII classification · ADR candidates to write · tech-debt flags |
| MC-6 | P6 Scaffold + Brief | Feature ID PREFIX override · stage-queue adjustments · features to skip _state.md generation |

## State File: `{workspace}/docs/intel/_pipeline-state.json`

```json
{
  "version": 1,
  "created": "{ISO-8601}",
  "workspace_path": "{abs-path}",
  "repo_type": "mono | mini",
  "current_step": "0",
  "steps": {
    "0":  { "status": "pending", "completed_at": null },
    "1":  { "status": "pending", "completed_at": null, "sub": {"1a":null,"1b":null,"1c":null,"1d":null,"1e":null,"1f":null,"1g":null} },
    "2":  { "status": "pending", "completed_at": null },
    "gate-0": { "status": "pending", "confirmed": false, "iterations": 0 },
    "3":  { "status": "pending", "completed_at": null },
    "4":  { "status": "pending", "completed_at": null },
    "5":  { "status": "pending", "completed_at": null },
    "gate-a": { "status": "pending", "confirmed": false, "iterations": 0 },
    "6":  { "status": "pending", "completed_at": null },
    "gate-b": { "status": "pending", "confirmed": false, "iterations": 0 },
    "7":  { "status": "pending", "completed_at": null },
    "8":  { "status": "pending", "completed_at": null }
  },
  "config": {
    "repo_path": "",
    "detected_stack": {},
    "selected_adapters": [],
    "services": [],
    "per_service_docs": true,
    "interview_context": {
      "stack_context": {},
      "feature_notes": {},
      "arch_context": {},
      "nfr_targets": {},
      "domain_boundaries": {}
    }
  },
  "artifacts": {}
}
```

---

## Resume Protocol

Same pattern as `from-doc`. On every invocation, BEFORE any work:

```
state = read _pipeline-state.json (if exists)
IF not exists → fresh start from P0

step = state.current_step
FOR step AND each subsequent step:
  expected = EXPECTED_ARTIFACTS[step]
  actual = check files on disk + hashes vs artifacts map

  IF step is a gate:
    IF gate.confirmed == true → advance, CONTINUE
    ELSE → run gate (re-read files, display, ask user)

  IF all expected artifacts exist + valid hash → mark done, advance
  IF some exist → run step with existing-artifacts list (partial resume, reuse cache)
  IF none exist → run step fresh
```

### Expected artifacts per step

| Step | Expected artifacts | Gate? |
|------|-------------------|-------|
| 0 | — (user interaction only) | No |
| 1a | `docs/intel/stack-facts.json` | No |
| 1b | `docs/intel/routes.json` | No |
| 1c | `docs/intel/entities.json` | No |
| 1d | `docs/intel/auth-rules.json` | No |
| 1e | `docs/intel/integrations.json` | No |
| 1f | `docs/intel/i18n-map.json` | No |
| 1g | `docs/intel/test-map.json` | No |
| 1-merge | `docs/intel/code-facts.json` (normalized merged) | No |
| 2 | `docs/intel/stack-context.md`, `stack-brief.md` | Gate 0 |
| 3a | `docs/intel/feature-candidates.json` | No |
| 3b | `docs/intel/status-evidence.json` | No |
| 3c | `docs/intel/features.json` (named + clustered) | No |
| 4 | `docs/intel/validation-report.json` | No |
| 5 | user confirmation + `feature-notes` in state | Gate A |
| 6a | `docs/architecture/*.mmd` + `.md` stubs | No |
| 6b | `docs/intel/arch-context.md` | Gate B |
| 6c | `docs/architecture/*.md` finalized, `docs/intel/arch-brief.md`, `docs/intel/code-brief.md` | No |
| 7 | `docs/features/{id}/_state.md` + `feature-brief.md` + `status.md`, `docs/feature-map.yaml` (per service in mono) | No |
| 8 | — (display + optional bridge invoke) | No |

### Artifact write protocol (atomic)

Every file write:
```
1. Write content → {path}.tmp
2. hash = sha256({path}.tmp)
3. Rename {path}.tmp → {path}
4. Register in state.artifacts: { step, status: "done", hash, size }
5. Flush _pipeline-state.json to disk
```

Crash recovery: `.tmp` exists → interrupted write → re-generate on resume.

---

## Core Principles

### CP-1: Deterministic first, LLM last

Tier 1 (universal primitives) + Tier 2 (framework adapters) = deterministic extraction. LLM runs only in:
- Feature synthesis (clustering + naming proposal)
- Status evidence narrative
- Architecture prose sections
- Bridge doc composition (code-brief.md, README.md)
- Tier 3 fallback when no adapter matches

**Never** let LLM invent routes, entities, or auth rules not backed by AST/config evidence.

### CP-2: Normalized schema for downstream stack-agnosticity

All adapters output to the same normalized schema (`code-facts.json`). Downstream phases (3–8) read normalized schema only and never know which stack. See [schemas/code-facts.schema.json](schemas/code-facts.schema.json).

### CP-3: Facts vs claims vs inferences — 3-level separation

| Level | Example | File |
|---|---|---|
| **Facts** | `routes[12].path = "/api/orders/{id}"` | `code-facts.json`, `stack-facts.json` |
| **Claims** (user says) | "Redis dùng cho session" | `stack-context.md`, `arch-context.md`, `feature-notes` |
| **Inferences** (LLM synthesis) | "Feature `quan-ly-don-hang` handles order lifecycle" | `*-brief.md` — every inference MUST carry `source:` field pointing to facts/claims |

Rule: A brief claim without source → validator HIGH issue.

### CP-4: Multi-signal feature boundary

Compose cluster score from 6 signals (weights in [phases/03-feature-synthesis.md](phases/03-feature-synthesis.md)):
URL prefix (0.20) + entity touched (0.25) + auth scope (0.15) + i18n namespace (0.15) + test describe block (0.15) + folder/module (0.10).

Routes pair cluster when composite ≥ 0.6. Threshold is tunable per stack (confirmed in Interview R1).

### CP-5: Status detection without git

Static completeness score per feature (0–1). 4 buckets: `planned` / `stubbed` (<0.2) / `in-progress` (<0.7) / `done` (≥0.7). Weights in [phases/03-feature-synthesis.md](phases/03-feature-synthesis.md).

### CP-6: Bridge-ready output

P6c writes canonical files into both locations:
- `docs/intel/*-brief.md` — internal pipeline artifacts
- `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/business-flows.md`, `docs/data-model.md`, `docs/security-overview.md`, `docs/features/*/feature-brief.md`, `docs/adr/` (optional from interview)

This guarantees `generate-docs` Route A scores **5/5** and skips Phase 1B code-scan.

### CP-7: Per-service docs in monorepo

When `repo_type: mono`:
- Each service gets its own `src/{apps|services}/{name}/docs/` tree with full architecture + features
- Root-level `docs/architecture/context.md` (system-wide) + `docs/feature-map-aggregate.yaml` (cross-service view)
- Running `/generate-docs` picks one service at a time

### CP-8: Aggressive interview in 3 rounds, bounded

Max 3 iterations per gate. After cap → forced 2-option choice (confirm-with-known-gaps / cancel). Round sizes:
- R1: ~5 questions (stack confirmation)
- R2: ~1 question per feature below 0.6 confidence OR status `in-progress/stubbed` (batch ≤ 10 per AskUserQuestion round, use multi-question mode)
- R3: ~10 questions (architecture + NFR + domain boundaries + planned features)

---

## 3-Tier Extraction Strategy

### Tier 1 — Universal primitives (always runs, stack-agnostic)

| Primitive | Tool | Output |
|---|---|---|
| File inventory + LOC | `scc` or `tokei` | `file-inventory.json` |
| Polyglot AST | `tree-sitter` (30+ languages) | in-memory AST per file |
| Symbol index | `ctags` (universal-ctags) | `symbols.ctags` |
| TODO/FIXME markers | grep `(TODO|FIXME|HACK|XXX|NotImplemented)` | `markers.json` |
| Config files | parse YAML/JSON/XML/TOML | `configs.json` |
| Migration folder | glob + name parse | `migrations.json` |
| Test discovery | glob `*.test.*`, `*Tests.cs`, `*_test.py`, etc. | `test-files.json` |

Tier 1 alone yields ~70% extraction signal. No adapter needed.

### Tier 2 — Framework adapters (plugin, runs only when detect())

See [adapters/_contract.md](adapters/_contract.md) for the adapter interface.

v1 ships 4 adapters:
- [adapters/dotnet-aspnetcore.md](adapters/dotnet-aspnetcore.md)
- [adapters/angular.md](adapters/angular.md)
- [adapters/nestjs.md](adapters/nestjs.md)
- [adapters/fastapi.md](adapters/fastapi.md)

**Format**: Hybrid — tree-sitter queries (YAML) for pattern extraction + Python module for complex logic (DI graph, entity FK resolution).

Adapters declare detect confidence HIGH/MED/LOW/NONE. Multi-adapter repos (e.g. .NET BE + Angular FE) run adapters in parallel.

### Tier 3 — LLM fallback (only when Tier 1+2 yield insufficient signal)

Trigger: `routes_found == 0 AND entities_found == 0` AND no adapter detected HIGH.

Action: LLM reads entry points (`main.*`, `Program.cs`, `index.*`, `app.*`) with a structured-output prompt requesting normalized schema fields. Output is marked `adapter: llm-fallback, confidence: low` and MUST be confirmed by user in Interview R1.

---

## Status Detection Algorithm

Full details in [phases/03-feature-synthesis.md](phases/03-feature-synthesis.md). Summary:

```
completeness_score = weighted_sum([
  handler_completeness   * 0.25,  # LOC + cyclomatic + stub detection
  test_coverage          * 0.25,  # test file exists + describe count + skip ratio
  error_path_coverage    * 0.15,  # try/catch vs happy path
  feature_flag_state     * 0.10,  # flag absent = 1.0, flag value if present
  entity_integrity       * 0.15,  # all referenced entities resolve
  todo_density_inverse   * 0.10,  # 1 - min(todos/LOC * 10, 1)
])

status_bucket =
  if score < 0.2  → stubbed
  elif score < 0.7 → in-progress
  else              → done

planned = features added by user in interview R2 with no code evidence
```

Every feature gets `status-evidence.json` entry with:
- `score, bucket, user_override, signals[] (file:line per signal), gaps_to_done[]`

`gaps_to_done` is consumed by Cursor SDLC agents (e.g. `dev` agent picks up `in-progress` features and closes gaps).

---

## Architecture Reconstruction — 6 artifacts (C4+)

| Artifact | Source | Generator |
|---|---|---|
| **Context diagram** | env vars + outbound HTTP + MQ producers + auth providers | Mermaid `C4Context` |
| **Container diagram** | docker-compose, k8s manifests, csproj/package.json | Mermaid `C4Container` |
| **Component diagram (per service)** | DI graph from adapter + module boundaries | Mermaid `C4Component` |
| **ER diagram** | migrations (preferred) OR ORM models | Mermaid `erDiagram` |
| **Sequence diagrams (top 5 journeys)** | call graph: route→service→repo→DB+external | Mermaid `sequenceDiagram` |
| **Integration map** | inbound (routes, webhooks, consumers) + outbound (HTTP, MQ producers, storage) | Mermaid `flowchart` + table |

Top 5 journeys selected by: feature priority (from interview R3) × unique entities touched × cross-service span.

Interview R3 augments with: domain boundaries, NFR targets, data classification, legacy/core/planned external systems, deployment topology.

---

## Bridge to `generate-docs`

Output placed in canonical locations `generate-docs` Route A reads:

```
docs/
├── README.md                          ← from code-brief.md (header) + arch summary
├── ARCHITECTURE.md                    ← concat of architecture/*.md + TOC
├── business-flows.md                  ← aggregate sequence narratives
├── data-model.md                      ← ER diagram + entity catalog
├── security-overview.md               ← auth-rules + PII + NFR security
├── adr/
│   └── ADR-001-{topic}.md            ← optional, from interview R3 decisions
└── features/
    └── {id}/
        ├── feature-brief.md           ← same format as from-doc
        ├── _state.md                  ← same contract as from-doc + status fields
        └── status.md                  ← implementation status evidence (new)
```

Route A scoring in `generate-docs`:
1. `README.md` + `ARCHITECTURE.md` exist ✅
2. `docs/adr/` ≥ 3 ADRs — **conditional** (from interview)
3. `docs/features/` has feature specs ✅
4. `docs/business-flows.md` ✅
5. `docs/security-overview.md` OR `docs/data-model.md` ✅

Score → 4/5 or 5/5 (with ADRs). Route A activates → skip Phase 1B code-scan.

**Interview context reuse**: `_pipeline-state.json` `config.interview_context` is also loaded by `generate-docs` if present (no re-interview).

---

## Monorepo Handling

Detection: `repo_type = mono` if any of:
- `nx.json` / `turbo.json` / `pnpm-workspace.yaml` / `lerna.json`
- `package.json` with `workspaces` field
- `*.sln` with ≥ 2 `*.csproj` projects (different folders)
- `pyproject.toml` with multiple packages OR `poetry.workspace` usage
- Root has `src/apps/` OR `src/services/` with ≥ 2 sibling dirs each containing own manifest

Per-service behavior (when mono):

```
Per-service output:
  src/{apps|services}/{name}/docs/
    ├── README.md
    ├── ARCHITECTURE.md (service-scoped)
    ├── business-flows.md
    ├── data-model.md
    ├── security-overview.md
    └── features/{id}/{_state.md, feature-brief.md, status.md}

System-level (root) output:
  docs/architecture/
    ├── context.md              ← system boundary, all services + externals
    ├── containers.md           ← all services + data stores
    └── deployment.md           ← topology, env, scaling
  docs/feature-map-aggregate.yaml    ← cross-service feature index
```

Each service's `_state.md` sets `project-path: src/{apps|services}/{name}` and `docs-path: src/{apps|services}/{name}/docs/features/{id}`.

---

## Pipeline Phase Files

| Phase | File | Tokens est. |
|---|---|---|
| P0 Preflight | [phases/00-preflight.md](phases/00-preflight.md) | 0 (no LLM) |
| P1 Static Harvest | [phases/01-static-harvest.md](phases/01-static-harvest.md) | 0 (deterministic) |
| P2 Interview R1 | [phases/02-interview-r1.md](phases/02-interview-r1.md) | ~1K |
| P3 Feature Synthesis | [phases/03-feature-synthesis.md](phases/03-feature-synthesis.md) | ~10K |
| P4 Validation | [phases/04-validation.md](phases/04-validation.md) | ~2K |
| P5 Interview R2 | [phases/05-interview-r2.md](phases/05-interview-r2.md) | ~3K |
| P6 Architecture | [phases/06-architecture.md](phases/06-architecture.md) | ~15K |
| P7 Scaffold + Brief | [phases/07-scaffold-brief.md](phases/07-scaffold-brief.md) | ~8K per service |
| P8 Handoff | [phases/08-handoff.md](phases/08-handoff.md) | 0 |

---

## Sub-agents

| Agent | File | Purpose |
|---|---|---|
| `code-harvester` | [agents/code-harvester.md](agents/code-harvester.md) | Runs Tier 1 + Tier 2 extractors (parallel, deterministic) |
| `code-intel` | [agents/code-intel.md](agents/code-intel.md) | Feature clustering + status classification + naming (LLM) |
| `code-intel-validator` | [agents/code-intel-validator.md](agents/code-intel-validator.md) | Silent-failure detection (claims without evidence, orphan entities, coverage gaps) |

---

## Dispatch Pattern

```
P1 (parallel):
  Agent(subagent_type: code-harvester, prompt: "extractor=1a stack-detector ...")
  Agent(subagent_type: code-harvester, prompt: "extractor=1b route-extractor ...")
  ... (7 extractors total, single message)

P3 (sequential, each reads prior output):
  Agent(subagent_type: code-intel, prompt: "task=cluster")
  Agent(subagent_type: code-intel, prompt: "task=classify-status")
  Agent(subagent_type: code-intel, prompt: "task=name-features")

P4:
  Agent(subagent_type: code-intel-validator, prompt: "mode=strict")

P6 (parallel, one per artifact):
  Agent(subagent_type: code-intel, prompt: "artifact=context-diagram")
  ... (6 artifacts)

P7 (parallel, one per feature OR per service):
  Agent(subagent_type: code-intel, prompt: "service={name}, write feature-brief + state.md")
```

All agents follow the 4-block prompt structure (Agent Brief / Project Conventions / Feature Context / Inputs) for cache efficiency across iterations.

---

## Invariants

- **I1**: `_pipeline-state.json` exists from P0 completion
- **I2**: `AskUserQuestion` ≤ 4 options, always
- **I3**: Every loop has integer bound in state. After bound → 2-option forced choice
- **I4**: Every inference in a `*-brief.md` carries `source:` field pointing to `code-facts.json` path OR interview context key
- **I5**: Downstream phases (P3+) read ONLY `code-facts.json` (normalized) — never adapter-specific files
- **I6**: `current_step` monotonic forward (explicit rerun resets downstream state)
- **I7**: Cleanup never deletes non-pipeline files (checked via `artifacts` map)
- **I8**: Sub-agent output ignored for progression — only artifacts on disk + state file govern
- **I9**: Bridge files (`docs/README.md`, etc.) written LAST in P6c → atomic consistency with intel
- **I10**: Per-service mono: each service's intel folder isolated; no cross-pollution
- **I11**: `status-evidence.json` MUST exist before Step 7; `_state.md` reads status from it

## Anti-Skip Protocol (same as from-doc)

Every step and sub-step MUST follow 3-phase:
1. **Entry print** — `"▶️ Starting Step {N}: {name}"`
2. **State detection + branching** — print detected state, all branches reach Phase 3
3. **State update + exit print** — update `_pipeline-state.json`, print `"✅ Step {N} hoàn tất. Next: ..."`

Forbidden: silent skip, conditional without else, broad OR detection conditions, missing state updates.

---

## Failure Matrix

| Step | Failure | Retry | Fallback |
|------|---------|-------|----------|
| 0 | Not a repo / missing entry points | 0 | Stop |
| 1a | No stack detected (Tier 1 + 2 fail) | 0 | Tier 3 LLM fallback |
| 1b-g | Adapter crash on file | 1 | Skip file, log in extractor warnings |
| 2 | User adds no adapter + all auto-detect NONE | 0 | Force LLM fallback or cancel |
| Gate 0 | 3 iterations | 0 | Force confirm-with-gaps or cancel |
| 3 | LLM output schema fail | 2 | Force cancel + user sees raw candidates |
| 4 | HIGH issues | 2 auto-fix rounds | User: proceed-with-warnings or cancel |
| Gate A | 3 iterations | 0 | Force 2-option |
| 6a | Mermaid render fail | 1 | Keep source, flag in report |
| Gate B | 3 iterations | 0 | Force 2-option |
| 7 | Write fail | 1 | Stop (critical) |

## Cleanup on Cancel

```
IF cancel before Gate 0 → offer: keep state / delete intel / delete all
IF cancel at Gate A → offer: keep intel / keep + partial features / rollback
IF cancel at Gate B → offer: keep features / keep all / rollback to Gate A
ALWAYS: print file list before delete, require explicit confirmation
NEVER: delete files not in artifacts map
```

---

## JSON Schemas

| Schema | File |
|---|---|
| `code-facts.json` (normalized) | [schemas/code-facts.schema.json](schemas/code-facts.schema.json) |
| `status-evidence.json` | [schemas/status-evidence.schema.json](schemas/status-evidence.schema.json) |
| `feature-candidates.json` | [schemas/feature-candidates.schema.json](schemas/feature-candidates.schema.json) |

---

## Invocation

```
/from-code                              # full pipeline, detect repo at cwd
/from-code --repo-path /path/to/repo    # explicit repo path
/from-code --resume                     # resume from last pipeline state
/from-code --bridge-only                # assume P1-7 done, generate bridge files only
/from-code --service {name}             # mono: run pipeline for one service only
/from-code --tier-3-only                # force LLM fallback (unknown stack)
/from-code --stop-after P{N}            # halt after phase N (dev debugging)
```

Default: full pipeline, bridge-ready, auto-invoke `/generate-docs` prompt at P8 (user chooses).
