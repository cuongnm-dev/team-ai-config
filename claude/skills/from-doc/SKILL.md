---
name: from-doc
description: Đọc tài liệu mô tả nghiệp vụ (PDF, Word, ảnh, file test case) để phân tích sâu, dựng cấu trúc dự án và sinh hồ sơ từng tính năng theo chuẩn Cursor SDLC. Dùng khi đã có tài liệu yêu cầu nhưng chưa có code.
---

# From Document to Code — Claude Code Pipeline

User-facing messages: Vietnamese. All instructions: English.

## ⚠️ ai-kit CLI Enforcement (ADR-005)
**This skill MUST call `Bash("ai-kit sdlc ...")` commands for ALL workspace/module/feature scaffolding** instead of direct `Write`/`mkdir`/`glob`. Per ADR-005 D3 governance (supersedes prior CD-8 v3 MCP wording).

**Replacements**:

| Legacy step | New ai-kit CLI command |
|---|---|
| Step 4a workspace mkdir + AGENTS.md/CLAUDE.md Write | `ai-kit sdlc scaffold workspace --workspace . --type {mini|mono} --stack ...` |
| Step 5b ID allocation algorithm (scan features-root + map) | `ai-kit sdlc scaffold module` allocates atomically, validates uniqueness via verify scope `id_uniqueness`. Caller passes target M-NNN; CLI rejects on collision. SUPERSEDES legacy "scan features-root for max NNN" algorithm — F-061 bug class fixed. |
| Step 5d decompose modules → pipelines (then Write `_state.md`) | Loop: `ai-kit sdlc scaffold module --id M-NNN --name "..." --slug ... --depends-on csv` per module — atomic catalog + map + folder updates |
| Step 5f.5 Write `feature-brief.md` | `ai-kit sdlc scaffold module` renders `module-brief.md` from JS template literal (bundled in ai-kit) |
| Step 5g feature-map.yaml Write | `ai-kit sdlc scaffold feature` updates feature-map.yaml + module-catalog.feature_ids atomically |
| Step 5h verify intel quality | `ai-kit sdlc verify --scopes all --strict block` |

**Forbidden after migration**:
- ❌ `Write` tool for `_state.md` / `_feature.md` / `module-brief.md` / `feature-brief.md` / catalogs / maps
- ❌ `Bash mkdir` under `docs/{modules,features,hotfixes}/**`
- ❌ `Glob {features-root}/F-*/` for ID allocation (replaced by MCP atomic)

**Allowed**:
- ✅ Skill orchestrates: read intel briefs, decide module/feature decomposition, build context dicts, then **call MCP tools**
- ✅ `Read` tool for source docs in `docs/inputs/` (renamed from `docs/source/`)
- ✅ `Edit` for in-place updates IF field NOT in `locked-fields[]`

**MCP down → BLOCK**: hard-stop with clear error; user runs `docker compose up -d` from `~/.ai-kit/team-ai-config/mcp/etc-platform/`.

**Reference**: `D:\AI-Platform\maintainer-notes\adr\ADR-003-sdlc-2tier-module-feature.md` D8/D11 + `plans/p0-mcp-tool-spec.md` §3.

---

## Intel Layer Integration (CLAUDE.md CD-10)

This skill is the doc-side producer for the shared Intel Layer at `{workspace}/docs/intel/`. See `INTEL_INTEGRATION.md` (sibling file) for full contract. Key changes vs legacy:

- **Schema-conformant** writes: `actor-registry.json`, `permission-matrix.json` (NEW), `sitemap.json`, `feature-catalog.json` per `~/.claude/schemas/intel/`
- **Permission data** moves from prose in `doc-brief.md §3 + §7.6` → structured `permission-matrix.json`
- **REQUIRED** producer calls: `python ~/.claude/scripts/intel/meta_helper.py update ...` after every artifact write
- **Cross-skill merge**: when from-code already populated → produce `<file>.new.json` then invoke `intel-merger`
- **Validation gate**: `intel-validator --quick` before Phase 1.5 complete

## Intel cache warm-start (Phase 4 — AGI #2)

Before Step 3 (doc-intel deep analysis), query `etc-platform` MCP for similar projects:

```
sig = {stacks: [], role_count: ?, domain_hint: <from doc TOC>, feature_count_bucket: ?}
mcp__etc-platform__intel_cache_lookup(project_signature=sig, kinds=["feature-archetype", "actor-pattern"])
```

Use exact_matches[] to seed actor candidates + feature archetype hypothesis space, then validate against actual doc content. Prior + doc agreement → `confidence: high`.

**Contribute** (after Gate B confirmed, with `contributor_consent=True`):
```
mcp__etc-platform__intel_cache_contribute(...)
```

Anonymization: server rejects payloads containing customer names (Bộ/Tỉnh/Sở), PII (email/phone/CCCD). Default-deny — caller must pre-redact.

## State Machine

```
PHASE 1: SETUP                  PHASE 2: ANALYSIS + VALIDATE
┌──────────┐  ┌──────────┐      ┌──────────┐  ┌──────────┐  ┌──────────┐
│  Step 1   │→│  Step 2   │→     │  Step 3   │→│  Step 3b  │→│  Gate A   │⟳(3)
│ Preflight │  │  Inputs   │      │ doc-intel │  │ Validator │  │ Confirm   │
│           │  │  + Init   │      │ (SMALL or │  │ (silent   │  │ analysis  │
│           │  │           │      │  LARGE)   │  │  failures)│  │           │
└──────────┘  └──────────┘      └──────────┘  └──────────┘  └────┬─────┘
                                                                  ↓
PHASE 3: SCAFFOLD                PHASE 4: OUTPUT
┌──────────┐  ┌──────────┐      ┌──────────┐  ┌──────────┐
│  Step 4   │→│  Gate B   │⟳(3) │  Step 5   │→│  Step 6   │
│ Scaffold  │  │ Confirm   │  →   │ Features  │  │ Handoff   │
│           │  │ path+risk │      │ _state.md │  │ report    │
└──────────┘  └────┬─────┘      └──────────┘  └──────────┘
```

## State File: `{workspace}/docs/intel/_pipeline-state.json`

```json
{
  "version": 2,
  "created": "{ISO-8601}",
  "workspace_path": "{abs-path}",
  "current_step": "1",
  "steps": {
    "1": { "status": "done|pending", "completed_at": null },
    "2": { "status": "pending", "completed_at": null },
    "3": { "status": "pending", "completed_at": null },
    "gate-a": { "status": "pending", "confirmed": false, "iterations": 0 },
    "4": { "status": "pending", "completed_at": null },
    "gate-b": { "status": "pending", "confirmed": false, "iterations": 0,
                "risk_score": null, "selected_path": null, "output_mode": "lean" },
    "5": { "status": "pending", "completed_at": null },
    "6": { "status": "pending", "completed_at": null }
  },
  "config": {
    "input_files": [],
    "workspace_preexisting": false,
    "dev_unit": ""
  },
  "artifacts": {}
}
```

## Resume Protocol

On every invocation, BEFORE any work:

```
state = read _pipeline-state.json (if exists)
IF not exists → fresh start from Step 1

step = state.current_step
FOR step AND each subsequent step:
  expected = EXPECTED_ARTIFACTS[step]  # see table below
  actual = check files on disk vs artifacts map
  
  IF step is a gate:
    IF gate.confirmed == true → advance, CONTINUE
    ELSE → run gate (re-read files, display, ask user)
  
  IF all expected artifacts exist + valid → mark done, advance, CONTINUE
  IF some exist → run step with existing-artifacts list (partial resume)
  IF none exist → run step fresh
```

### Expected artifacts per step

| Step | Expected artifacts | Gate? |
|------|-------------------|-------|
| 1 | — (user interaction only) | No |
| 2 | `docs/source/*` (copied files), `_pipeline-state.json` | No |
| 3 | `docs/intel/raw-extract.md`, `doc-brief.md`, `tech-brief.md`, (LARGE: `strategy.json`, `structure-map.json`, `modules/*.md`) | No |
| 3b | `docs/intel/validation-report.json` | No |
| gate-a | — (user confirmation + iteration-metrics tracking) | Yes: check `gate-a.confirmed` |
| 4 | Workspace structure OR features-root dir (repo-type aware) | No |
| gate-b | — (user confirmation + risk_score + selected_path) | Yes: check `gate-b.confirmed` |
| 5 | `{features-root}/{id}/_state.md` + `{features-root}/{id}/feature-brief.md` (per pipeline), `docs/feature-map.yaml` at root | No |
| 6 | — (display only, marks complete) | No |

### Artifact write protocol

Every file write follows atomic-write pattern:
```
1. Write content → {path}.tmp
2. hash = sha256({path}.tmp)
3. Rename {path}.tmp → {path}
4. Register in state.artifacts: { step, status: "done", hash }
5. Flush _pipeline-state.json to disk
```

Crash recovery: `.tmp` exists → interrupted write → re-generate on resume.

---

## Step 0 — Flag handling (Resume Protocol Lockout escape)

**Purpose**: Allow user to redo confirmed gates / re-run completed steps when intel quality is unsatisfactory. Without these flags, user must hand-edit `_pipeline-state.json` (Resume Protocol Lockout — known issue).

**Recognized flags**:

| Flag | Effect |
|---|---|
| `--reset-gate <a\|b>` | Set `state.steps["gate-{x}"].confirmed = false`, `iterations = 0`, `current_step = "gate-{x}"`. Backup state to `_pipeline-state.json.bak.{ISO}`. Re-enter gate loop on next invocation. |
| `--rerun-step <N>` | Reset all steps from N onwards: `steps.{N..end}.status = pending`, `current_step = "{N}"`. Move dependent artifacts (Step ≥ N) to `docs/intel/_history/{ISO}/`. Re-run from step N. |
| `--reset-all` | Full reset: move `docs/intel/` → `docs/intel.bak.{ISO}/`, delete `_pipeline-state.json`. Preserves `docs/source/`. Re-run from Step 1. |

**Detection logic** (Step 0.1, runs BEFORE Resume Protocol):

```
flags = parse CLI args
IF --reset-gate {x} present:
  Read _pipeline-state.json
  cp _pipeline-state.json _pipeline-state.json.bak.{ISO-timestamp}
  state.steps["gate-{x}"].confirmed = false
  state.steps["gate-{x}"].iterations = 0
  state.current_step = "gate-{x}"
  Write _pipeline-state.json
  IF state.steps["gate-{x}"].iterations > 0 (was previously refined):
    Print warning: "⚠️ Resetting Gate {x} after {iter} iterations. Previous quality: features={N}, gaps={N}. This loses refinement work. Confirm? (yes/no)"
    AskUserQuestion → if no, restore backup + EXIT
  Print: "✅ Gate {x} reset. Backup at _pipeline-state.json.bak.{ISO}. Resume re-enters gate-{x}."
  EXIT (user re-invokes /from-doc without flag to enter gate loop)

IF --rerun-step {N} present:
  Read _pipeline-state.json
  cp _pipeline-state.json _pipeline-state.json.bak.{ISO}
  Move docs/intel/ contents owned by step N+ to docs/intel/_history/{ISO}/
  state.steps["{N}".."{end}"].status = pending
  state.current_step = "{N}"
  Write _pipeline-state.json
  Print: "✅ Reset to step {N}. {M} artifacts archived to _history/{ISO}/. Resume runs from step {N}."
  EXIT

IF --reset-all present:
  Move docs/intel/ → docs/intel.bak.{ISO}/
  Delete _pipeline-state.json
  Print: "✅ Full reset. docs/intel/ → .bak.{ISO}. Re-run /from-doc to start fresh."
  EXIT

IF no flag → continue to Step 1 (normal Resume Protocol)
```

**Why skill-side state mutation, not MCP `update_state(op=stage_rollback)`**: Pending MCP backend primitive (T1-12 in audit roadmap). Skill-side mutation works today; switch to MCP when primitive ships.

**Quality regression guard**: confirmed-gate reset after iter > 0 prompts user with previous metrics — prevents accidental refinement loss.

---

## Step 0.5 — Refinement modes (incremental post-completion improvements)

**Purpose**: After initial `/from-doc` completes, real-world workflow needs continued refinement: deeper extraction, supplemental inputs, targeted re-extraction, decomposition rework, full rollback. These modes apply ONLY when `state.current_step == "complete"` OR explicit override.

**Recognized refinement flags** (mutually exclusive — pick one per invocation):

| Flag | Mode | Effect |
|---|---|---|
| `--deepen [--focus {area}]` | DEEPEN | Re-run Step 3 with enriched system prompt for depth + gap detection. Preserves locked_fields. |
| `--add-input <file>` | ADD-INPUT | Incremental ingest single new file. Diff-merge to existing intel with conflict resolution. |
| `--reextract <file>` | REEXTRACT-FILE | Invalidate intel derived from `<file>` (lineage), re-extract from updated content. |
| `--reextract --module M-NNN` | REEXTRACT-MODULE | Targeted re-extraction of features under M-NNN only. |
| `--redecompose` | REDECOMPOSE | Re-run Step 5d (module decomposition) from existing doc-brief. Show diff before mutate. |
| `--rollback [--to {ISO}]` | ROLLBACK | Restore intel + modules + state from backup (default: most recent). |

**Backup retention**: rotate to keep most-recent N=5 timestamped backups (`_pipeline-state.json.bak.{ISO}` + `docs/intel/.bak/{ISO}/`). Older backups pruned automatically. All-time history preserved via git (recommend commit before refinement runs).

**Locked fields enforcement** (CD-10 #3): every refinement mode MUST honor `_meta.json.artifacts[file].locked_fields[]` — manual user edits in feature-catalog/business-context/etc. NEVER overwritten. If conflict, surface to user [k]eep-locked / [u]nlock-and-update.

**Lineage tracking**: `_meta.json.artifacts[file].source_lineage` records `{source_file, extracted_at, extracted_by}` — used by REEXTRACT to compute invalidation scope.

---

### MODE: DEEPEN (`--deepen [--focus {area}]`)

```
IF --deepen present:
  IF state.steps.3.status != "done":
    STOP "Cannot deepen — Step 3 not yet completed. Run /from-doc first."
    EXIT

  # Backup with rotation
  rotate_backups N=5
  cp -r docs/intel/ docs/intel/.bak/{ISO}/
  cp _pipeline-state.json _pipeline-state.json.bak.{ISO}

  # Read current intel + locked fields
  current_doc_brief = Read docs/intel/doc-brief.md
  locked_fields = read _meta.json.artifacts.doc-brief.locked_fields[]

  # Re-run Step 3 (full re-extract) with DEEPEN system prompt
  focus_clause = --focus value (PII | security | integration | NFR | ...) OR ""
  Spawn doc-intel agent with system prompt:
    "DEEPEN MODE — you have produced doc-brief.md previously. Re-read all inputs in {input_files}.
     Goals (in priority order):
       1. Find missing edge cases, exception flows, error states not in current doc-brief
       2. Add depth to existing entries: more business rules, more acceptance criteria, more entity relationships
       3. {IF focus} Pay special attention to {focus} dimension — surface every detail
       4. Identify gaps: contradictions between source files, ambiguities, undefined terms
     PRESERVE: do NOT remove existing entries. Append/enrich only.
     LOCKED: these fields MUST NOT be modified: {locked_fields list}
     Output: new doc-brief.md (full content, including preserved + new)."

  # Validate output
  IF new doc-brief covers strictly less features than current → reject as regression, restore backup
  IF locked field modified → reject, surface diff, ask user [k]eep-old-locked / [u]pdate

  # Apply
  Write docs/intel/doc-brief.md
  Update _meta.json.artifacts.doc-brief.deepen_iterations += 1
  Reset state.steps.5.status = "pending" (downstream needs re-run with deeper data)
  state.steps.5h.status = "pending"
  state.steps.5i.status = "pending"
  state.steps.6.status = "pending"
  state.current_step = "5"

  Print: "✅ DEEPEN complete. doc-brief.md enriched (iter {N}, {M} new entries / {K} enriched).
          Re-run /from-doc to populate downstream artifacts (Step 5 → 6)."
  EXIT
```

---

### MODE: ADD-INPUT (`--add-input <file>`)

```
IF --add-input <file> present:
  # Validate
  IF NOT exists(file): STOP "File not found: {file}"
  IF file IN state.config.input_files: STOP "Already ingested. Use --reextract instead."
  IF state.steps.3.status != "done": STOP "Run /from-doc first before --add-input"

  # Backup
  rotate_backups N=5
  cp -r docs/intel/ docs/intel/.bak/{ISO}/

  # Add file to config
  state.config.input_files.append(file)

  # Extract fragment from new file ONLY
  Spawn doc-intel agent with system prompt:
    "EXTRACT-FRAGMENT MODE — extract feature/module/rule/actor entries from {file} ONLY.
     Output: doc-brief-fragment.md (same schema as full doc-brief).
     Do NOT read other inputs. Goal: isolate what {file} adds."
  Write docs/intel/.tmp/doc-brief-fragment.md

  # Diff fragment vs existing doc-brief.md
  Compute classification per fragment entry:
    - NEW: entry not in existing doc-brief → safe to append
    - COMPATIBLE: entry refines existing without contradiction → propose merge
    - CONFLICT: entry contradicts existing (different AC, different actor, different rule) → require user

  Print summary:
    "Fragment from {file}: {N_new} new / {N_compat} compatible / {N_conflict} conflicts"

  # Per-conflict interactive resolution (Q2 = interactive)
  FOR each conflict:
    Display side-by-side: existing entry vs fragment entry, highlighted diff
    Ask user:
      [k] Keep existing (discard fragment)
      [n] Keep new (override existing — note: respect locked_fields)
      [m] Manual merge (open editor — user composes resolution)
      [s] Skip (defer — surface in report)
    Apply choice
    Append decision to _meta.json.artifacts.doc-brief.conflict_log[]

  # Apply NEW + COMPATIBLE + resolved CONFLICTs
  Merge fragment into doc-brief.md (preserve locked_fields)
  Update _meta.json.artifacts.doc-brief.source_lineage += {file, ISO, doc-intel}
  Reset state.steps.5h.status = "pending" (gate revalidate downstream)

  Print: "✅ ADD-INPUT done. {N} entries merged from {file}.
          {N_skip} conflicts deferred to conflict_log[].
          Re-run /from-doc to revalidate Step 5h gate."
  EXIT
```

---

### MODE: REEXTRACT (`--reextract <file>` OR `--reextract --module M-NNN`)

```
IF --reextract <file> present (no --module):
  IF NOT exists(file): STOP
  IF file NOT IN state.config.input_files: STOP "File not in lineage. Use --add-input."

  # Backup
  rotate_backups N=5
  cp -r docs/intel/ docs/intel/.bak/{ISO}/

  # Compute invalidation scope from lineage
  invalidated = entries in doc-brief.md / feature-catalog.json / etc.
                where _meta.source_lineage matches file
  Print: "Re-extract {file} will invalidate {N} entries (preserving locked_fields)"
  AskUserQuestion: "[c]ontinue / [a]bort"

  # Re-extract from updated file
  Spawn doc-intel agent with system prompt:
    "REEXTRACT MODE — file {file} has been updated. Re-extract entries from THIS FILE ONLY.
     Existing entries derived from {file} will be replaced (except locked_fields).
     Output: doc-brief-fragment.md restricted to {file}."

  # Replace invalidated entries with new fragment, preserving locked_fields
  Update doc-brief.md
  Update _meta.json: lineage entry updated, sha256 of file refreshed
  Reset state.steps.5.status = "pending"

  Print: "✅ REEXTRACT {file} done. {N} entries replaced. Re-run /from-doc Step 5."
  EXIT

ELIF --reextract --module M-NNN:
  IF NOT exists module-catalog entry M-NNN: STOP

  rotate_backups N=5
  cp -r docs/intel/ docs/intel/.bak/{ISO}/

  # Identify input sections relevant to M-NNN
  module_entry = read module-catalog.json[M-NNN]
  source_sections = sections in inputs that mention M-NNN modules/keywords (heuristic)

  # Re-extract focused on M-NNN
  Spawn doc-intel with prompt:
    "TARGETED REEXTRACT — focus on module {M-NNN}: {module.name} ({module.business_goal}).
     Read inputs but extract ONLY features/rules/entities relevant to this module's scope.
     Append depth to existing M-NNN entries (preserve locked_fields)."

  # Replace M-NNN-related entries in doc-brief + feature-catalog
  Update artifacts (locked-aware)
  Reset state.steps.5g.status = "pending" (re-scaffold features for this module)

  Print: "✅ REEXTRACT module {M-NNN} done. {N} features enriched. Re-run /from-doc to re-scaffold."
  EXIT
```

---

### MODE: REDECOMPOSE (`--redecompose`)

```
IF --redecompose present:
  IF state.steps.5.status != "done": STOP "No existing decomposition to compare against."

  rotate_backups N=5
  cp -r docs/intel/ docs/intel/.bak/{ISO}/
  cp -r docs/modules/ docs/modules/.bak/{ISO}/

  # Read current modules
  current_modules = module-catalog.json.modules[]

  # Re-run Step 5d ONLY with current doc-brief
  Spawn from-doc Step 5d procedure (decompose modules into pipelines)
  → produces proposed_modules[]

  # Show diff
  Print:
    "MODULE DECOMPOSITION DIFF:
     Current ({N} modules): {ids list}
     Proposed ({M} modules): {ids list}

     Added:    {new_ids}
     Removed:  {removed_ids}
     Renamed:  {old_id → new_id pairs}
     Merged:   {old_ids → new_id}
     Split:    {old_id → new_ids[]}
    "
  AskUserQuestion: "[a]pply / [c]ancel / [s]elective (per-change confirm)"

  IF apply:
    Wipe docs/modules/ (already backed up)
    Reset module-catalog.json + module-map.yaml to empty
    Re-run Step 5d → 5g (scaffold modules + features)
    Reset state.steps.5h+ = "pending"

  IF selective:
    FOR each diff item: ask [y]/[n], apply incrementally

  Print: "✅ REDECOMPOSE done. {N} modules now in catalog. Re-run /from-doc Step 5h."
  EXIT
```

---

### MODE: ROLLBACK (`--rollback [--to {ISO}]`)

```
IF --rollback present:
  # List backups
  backups = sorted glob `_pipeline-state.json.bak.*` desc
  intel_backups = sorted glob `docs/intel/.bak/*/` desc
  module_backups = sorted glob `docs/modules/.bak/*/` desc

  IF empty backups: STOP "No backups available."

  IF --to {ISO} specified:
    target_iso = {ISO}
    Verify all 3 backup types exist for target_iso → else STOP "Incomplete backup at {ISO}"
  ELSE:
    target_iso = backups[0]    # most recent
    Print available backups (top 5):
      "Available backups (most recent first):
         1. {ISO_1} — current_step at backup: {step}, modules: {N}, features: {M}
         2. {ISO_2} — ...
         ...
       Default: rollback to {ISO_1} ({backup_age})"
    AskUserQuestion: "[1-5] pick / [a]bort"

  # Show what will be restored
  Print:
    "ROLLBACK to {target_iso} will restore:
       - docs/intel/_pipeline-state.json
       - docs/intel/*.json + *.md (entire intel layer)
       - docs/modules/ (entire scaffold tree)
       - module-catalog.json + module-map.yaml + feature-catalog.json + feature-map.yaml
     CURRENT state will be moved to docs/intel/.bak/{NEW_ISO}/ before restore (so rollback is itself reversible).
     User-edited input files in docs/inputs/ are NOT touched."

  # Confirmation phrase
  Print: "Type 'CONFIRM ROLLBACK' to proceed: ▌"
  IF user types exactly:
    # Snapshot current state (so rollback is reversible)
    rotate_backups N=5
    cp -r docs/intel/ docs/intel/.bak/{NEW_ISO}-pre-rollback/
    cp -r docs/modules/ docs/modules/.bak/{NEW_ISO}-pre-rollback/

    # Restore atomically
    rm -rf docs/intel/* (except .bak/)
    cp -r docs/intel/.bak/{target_iso}/* docs/intel/
    rm -rf docs/modules/*
    cp -r docs/modules/.bak/{target_iso}/* docs/modules/
    cp _pipeline-state.json.bak.{target_iso} _pipeline-state.json

    Print: "✅ Rolled back to {target_iso}. Pre-rollback state preserved at .bak/{NEW_ISO}-pre-rollback/."
  ELSE:
    Print: "Cancelled."
  EXIT
```

---

### Backup rotation helper (used by all modes)

```
function rotate_backups(N=5):
  # State backups
  state_baks = sorted glob `_pipeline-state.json.bak.*` desc
  IF len > N: rm state_baks[N:]   # keep N most recent

  # Intel backups
  intel_baks = sorted glob `docs/intel/.bak/*/` desc
  IF len > N: rm -rf intel_baks[N:]

  # Module backups
  mod_baks = sorted glob `docs/modules/.bak/*/` desc
  IF len > N: rm -rf mod_baks[N:]

  Print: "Backup rotation: keeping {N} most recent (oldest pruned: {pruned_count})"
```

Recommend user `git commit` before refinement runs — git provides all-time history beyond rotation window.

---

## Step 1 — Preflight + Inputs

**Pre**: nothing
**Do**:
1. Check dependencies: `doc-intel` agent + `new-workspace` skill exist in `~/.claude/`
2. Glob input folder → validate supported files exist
4. Show file list → user confirms (AskUserQuestion: "Dùng tất cả" / "Chọn subset" / "Hủy")

**Post**: save config to state (`input_files`, `dev_unit`)
**State**: `current_step: "2"`, `steps.1.status: "done"`

---

## Step 2 — Init workspace + copy files

**Pre**: Step 1 done, `config.input_files` populated
**Do**:
1. `mkdir -p {workspace}/docs/source {workspace}/docs/intel`
2. `cp` each input file → `docs/source/`
3. Check `workspace_preexisting` (AGENTS.md or package.json exists)

**Artifacts**: files in `docs/source/`
**State**: `current_step: "3"`, `steps.2.status: "done"`

---

## Step 3 — Document analysis (doc-intel)

**Pre**: Step 2 done, files in `docs/source/`
**Do**:

```
Agent(
  subagent_type: doc-intel,
  run_in_background: false,     # BLOCKING — Gate A needs output
  prompt: |
    ## Agent Brief
    role: doc-intel
    vision-model: claude-opus-4-6
    output-mode: lean

    ## Feature Context
    docs-path: {workspace}/docs/intel
    source-path: {workspace}/docs/source
    multi-file-mode: true

    ## Inputs
    mode: fresh
    input-files: [{absolute paths in docs/source/}]
    file-roles: {json map path→type}
    existing-artifacts: [{valid artifacts from state where step="3"}]
)
```

> Cache note: `## Agent Brief` + `## Feature Context` stable across mode-fresh/patch iterations. Only `## Inputs` changes. Saves ~80% prefix re-tokenization on Gate A correction loops.

> Foreground (blocking) because Gate A immediately reads doc-brief.md.
> doc-intel uses native Read for PDF/DOCX, parallel extraction for multi-file.
> WebSearch for legal/standards references. Context7 for stack validation.

**Gap handling loop** (MANDATORY check, bounded max 2 iterations):

```
After doc-intel completes:
  Read docs/intel/doc-brief.md §11 Ambiguities → count blocking-gaps

  Print (ALWAYS — user must see result):
    "📋 Blocking gaps detected: {N}"

LOOP (max 2 iterations, iter_count tracked in state):
  IF blocking-gaps ≤ 3:
    Print: "✅ Gaps ≤ 3, proceed to Step 3b validation."
    BREAK
  
  # gaps > 3, need user input
  Print: "⚠️ {N} blocking gaps exceed threshold (3). Need clarification."
  Collect answers via AskUserQuestion (1 question per gap, max 4 options each)
  Write docs/intel/gap-answers.md
  Agent(doc-intel, mode: patch, patch-input: gap-answers.md)
  iter_count += 1, save to state
  Re-read doc-brief → re-count blocking-gaps
  CONTINUE LOOP

After 2 iterations AND gaps still > 3:
  Print: "⚠️ Sau 2 lần patch, vẫn còn {N} gaps > 3."
  AskUserQuestion:
    - "Tiếp tục (gắn [CẦN BỔ SUNG] flags trong doc-brief)"
    - "Hủy pipeline"
```

**Artifacts**: `docs/intel/raw-extract.md`, `docs/intel/doc-brief.md`, `docs/intel/tech-brief.md`, `docs/intel/consultation-log.md`
**State**: `current_step: "3b-validate"`, `steps.3.status: "done"`

---

## Step 3b — Validation (catches silent failures)

**Pre**: Step 3 done
**Do**:

```
Agent(
  subagent_type: doc-intel-validator,
  run_in_background: false,
  prompt: |
    ## Agent Brief
    role: doc-intel-validator
    output-mode: lean

    ## Feature Context
    docs-path: {workspace}/docs/intel
    source-files: {from state.config.input_files}

    ## Inputs
    mode: {SMALL|LARGE from strategy.json}
    strict: false
)
```

Validator produces `docs/intel/validation-report.json`.

**Interpret report** (MANDATORY: always print summary to user):

```
report = read validation-report.json

Print (ALWAYS, regardless of severity):
  "📊 Validation report:
     HIGH issues:   {count}
     MEDIUM issues: {count}
     LOW issues:    {count}
     Metrics:
       - Features/modules ratio: {X}
       - Rules/features ratio: {X}
       - Source traceability: {XX%}
       - SDLC readiness: {XX%}"

Branch (ALWAYS reach state update):

IF report.summary.HIGH == 0 AND report.summary.MEDIUM == 0:
  Print: "✅ No issues detected. Proceed to Gate A."
  → Proceed to state update

IF report.summary.HIGH == 0 AND report.summary.MEDIUM > 0:
  Print: "⚠️ {M} MEDIUM issues. Acceptable to proceed but note for Gate A review."
  → Proceed to state update

IF report.summary.HIGH > 0:
  Display top 5 HIGH issues grouped by type
  AskUserQuestion (max 4):
    1. "🔧 Auto-fix (re-run doc-intel patch với issues list)"
    2. "👁️ Xem chi tiết + review"
    3. "⏭️ Bỏ qua warnings, tiếp tục Gate A"
    4. "❌ Hủy pipeline"
  
  IF "Auto-fix":
    Write issues summary → docs/intel/validator-fixes.md
    Agent(doc-intel, mode: patch, patch-input: validator-fixes.md)
    Re-run validator (loop max 2 times)
    After 2 iterations → force decision (Xác nhận / Hủy)
  IF "Xem chi tiết" → display full report, then re-ask
  IF "Bỏ qua" → proceed with warning flag in state
  IF "Hủy" → cleanup Path A, STOP
  → Proceed to state update
```

**State**: `current_step: "gate-a"`, `steps.3b.status: "done"`

---

## Gate A — Confirm analysis

**Pre**: Step 3 done, doc-brief.md + tech-brief.md on disk
**Do**: EXPLICIT LOOP

```
LOOP:
  iter = state.steps["gate-a"].iterations
  
  IF iter >= 3:
    AskUserQuestion: ["Xác nhận và tiếp tục" / "Hủy"]
    BREAK
  
  # RE-READ from disk every iteration (files may have changed)
  Read docs/intel/doc-brief.md → extract summary
  Read docs/intel/tech-brief.md → extract stack info
  Display Vietnamese summary to user
  
  answer = AskUserQuestion:
    1. "✅ Xác nhận"
    2. "✏️ Sửa"
    3. "🔄 Chạy lại doc-intel"
    4. "❌ Hủy"
  
  IF "Xác nhận" → BREAK
  IF "Sửa":
    Collect corrections → write user-corrections.md
    Agent(doc-intel, mode: patch)
    iter += 1
    
    # O3: Quality tracking across iterations
    new_metrics = { feature-count, rule-count, entity-count, blocking-gaps } from doc-brief
    prev_metrics = state.steps["gate-a"].iteration-metrics[iter-1]
    Append new_metrics to iteration-metrics[]
    
    IF new_metrics.feature-count < prev_metrics.feature-count × 0.9:
      Display: "⚠️ Iter {iter}: features={new} (prev={prev}, -{%}). Chất lượng giảm."
      AskUserQuestion:
        - "Giữ iter {iter} (current)"
        - "Rollback về iter {iter-1} (restore doc-brief)"
        - "Full rerun (reset iter=0)"
    
    save state → CONTINUE
  IF "Chạy lại":
    Agent(doc-intel, mode: fresh)
    iter = 0 → save to state
    CONTINUE
  IF "Hủy" → cleanup, STOP
```

**State**: `gate-a.confirmed: true`, `current_step: "4"`

---

## Step 4 — Scaffold workspace

**Pre**: Gate A confirmed, tech-brief.md on disk
**Do**: MUST execute sub-steps 4a → 4b → 4c in order. NONE are skippable at section level — each has its OWN skip conditions internally.

### 4a. Workspace scaffold — MANDATORY SUB-STEP

This sub-step is NEVER skipped at section level. It ALWAYS runs through the decision tree below.

**Step 4a.1 — Detect workspace state** (MANDATORY READ, print result to user):
```
Read workspace {workspace-path} for signals:
  has_agents_md       = file exists AND contains "feature-prefix" or "repo-type" (avoid false positive from unrelated AGENTS.md)
  has_package_json    = file exists AND has "workspaces" or "name" field matching tech-brief recommendation
  has_project_dirs    = dirs src/apps/ OR src/services/ exist AND non-empty
  has_workspace_tool  = nx.json OR turbo.json OR pnpm-workspace.yaml exists

scaffold_state =
  FULLY_SCAFFOLDED   IF (has_agents_md AND has_workspace_tool AND has_project_dirs)
  PARTIALLY_SCAFFOLDED IF (any signal present but not all)
  EMPTY              IF (no signals)
```

Print to user (Vietnamese):
```
🔍 Workspace state detection:
   - AGENTS.md: {có/không}
   - package.json: {có/không}
   - Project dirs (src/apps, src/services): {có/không}
   - Workspace tool (nx/turbo/pnpm): {có/không}
   → Classification: {FULLY_SCAFFOLDED | PARTIALLY_SCAFFOLDED | EMPTY}
```

**Step 4a.2 — Branch based on state** (MANDATORY):

```
IF scaffold_state == FULLY_SCAFFOLDED:
  Action: Read existing structure into memory (list services, apps, config)
  Output: Print "✅ Workspace đã scaffold đầy đủ. Dùng existing structure."
  Update _pipeline-state.json: steps.4.sub-state = "4a-existing"
  → Proceed to Gate B

IF scaffold_state == PARTIALLY_SCAFFOLDED:
  AskUserQuestion (max 4):
    1. "Scaffold missing pieces via new-workspace (Recommended)"
    2. "Dùng as-is, chỉ tạo thư mục features"
    3. "Full scaffold (overwrite — BACKUP first)"
    4. "Hủy"
  Handle each option, update sub-state accordingly
  → Proceed to Gate B

IF scaffold_state == EMPTY:
  AskUserQuestion (max 3):
    1. "Scaffold SDLC infra (intel + AGENTS.md + module folders) — Recommended"
    2. "Full project + starter code (gọi /new-workspace — sẽ hỏi stack/auth/db/Docker/CI)"
    3. "Hủy"

  IF option 1 (SDLC scaffold — DEFAULT path cho from-doc):
    # Direct ai-kit CLI — minimal scaffold đủ cho SDLC pipeline
    # Stack đã biết từ tech-brief.repo_type + tech-brief.stack_hint
    repo_type = tech-brief.repo_type  # mini|mono
    stack = tech-brief.stack_hint || 'none'  # nodejs|python|go|rust|none

    Bash("ai-kit sdlc scaffold workspace \
      --workspace . \
      --type {repo_type} \
      --stack {stack} \
      --force")
    parse stdout JSON → if !ok: STOP with error

    # ai-kit creates: AGENTS.md, CLAUDE.md, .gitignore, docs/intel/ stubs (catalogs + _meta),
    # docs/modules/, docs/inputs/, docs/generated/. KHÔNG có starter code Docker/CI —
    # đó là scope của /new-workspace (option 2).

    Update sub-state = "4a-scaffolded-base"

  IF option 2 (full project — gọi /new-workspace với 14 phase):
    # Heavy path — only when project chưa có starter code, user muốn full skeleton
    # /new-workspace sẽ hỏi: stack, auth provider, database, cache, CI tool, etc.
    # (KHÔNG khuyến nghị nếu chỉ cần SDLC infra)
    Skill(new-workspace,
      args: workspace-path={workspace-path},
            intel-path={workspace-path}/docs/intel/tech-brief.md,
            auto-confirm=true)
    Retry 1x on failure. Fallback: option 1 (SDLC-only scaffold).
    Update sub-state = "4a-scaffolded-full"

  IF option 3: cleanup, STOP
  → Proceed to Gate B
```

**Step 4a.3 — State update** (MANDATORY):
```
Update _pipeline-state.json:
  steps.4.sub-state: "4a-{existing|scaffolded|minimal}"
  steps.4a.completed_at: {ISO}

Print: "✅ Step 4a hoàn tất. Proceed to Gate B."
```

> **Why mandatory explicit state**: prevents Claude from silently skipping 4a when workspace has partial signals. Each branch produces a visible output and state record.

**Artifacts**: workspace dirs
**State**: `current_step: "gate-b"`, `steps.4.status: "done"`

**MANDATORY EXIT** (DO NOT STOP — continue to Gate B):

```
Print: "✅ Step 4 complete. Proceeding to Gate B (Architecture + SDLC plan confirmation)."
→ IMMEDIATELY execute Gate B below. DO NOT pause. DO NOT treat this section boundary as end of pipeline.
```

---

## Gate B — Confirm architecture and SDLC plan — MANDATORY GATE

**This gate ALWAYS runs after Step 4. Never skippable.**

**Entry print (MANDATORY)**:
```
Print: "▶️ Entering Gate B: Architecture + SDLC path confirmation"
```

**Pre**: Step 4 done (verified by `steps.4.status == "done"`)
**Do**:

### Phase 1 — Risk assessment (MANDATORY)

```
Read docs/intel/doc-brief.md → extract counts + signals
Score 1-5 each dimension:
  business-rules | actors | integrations | auth | ui | data-sensitivity
risk_score = ceil(avg of 6 dimensions)
path = S (1-2) | M (3) | L (4-5)
```

Save `risk_score`, `selected_path`, `output_mode` to `state.steps["gate-b"]`.

**Display to user** (MANDATORY — print before asking):
```
📊 Risk Assessment:
| Dimension | Score |
|---|---|
| Business rules: {N} | {score} |
| Actors: {N} | {score} |
| Integrations: {N} | {score} |
| Auth: {type} | {score} |
| UI complexity: {score} |
| Data sensitivity: {score} |
| **Total risk_score** | **{score}/5** → Path **{S|M|L}** |

Stages-queue (after ba):
  {derived list}

Dependencies between pipelines:
  {if multi-pipeline, show DAG}
```

### Phase 2 — Confirmation loop (MANDATORY)

```
LOOP:
  iter = state.steps["gate-b"].iterations
  
  IF iter >= 3:
    AskUserQuestion (forced 2-option): ["Xác nhận và tiếp tục" / "Hủy"]
    IF "Xác nhận" → BREAK (proceed to Phase 3)
    IF "Hủy" → cleanup, STOP
  
  answer = AskUserQuestion (max 4):
    1. "✅ Xác nhận plan"
    2. "✏️ Sửa pipeline (đổi path, adjust stages)"
    3. "🏗️ Chỉ scaffold, KHÔNG tạo _state.md (⚠️ handoff sẽ incomplete, user tự tạo trong Cursor)"
    4. "❌ Hủy"
  
  IF answer == "Xác nhận":
    BREAK → proceed to Phase 3
  
  IF answer == "Sửa":
    AskUserQuestion (nested): {which aspect: path / stages-queue / output-mode / deps}
    Apply user edits to state
    iter += 1 → save state
    CONTINUE LOOP (re-display)
  
  IF answer == "Chỉ scaffold":
    Print WARNING: "⚠️ Confirm: skip Step 5 means NO _state.md created. Cursor /resume-feature won't work until you manually create them."
    confirmAskUserQuestion: ["Xác nhận skip Step 5" / "Quay lại"]
    IF confirm:
      state.steps["gate-b"].skip_step_5 = true
      state.steps["gate-b"].confirmed = true
      BREAK → jump to Step 6 (handoff with note)
    ELSE:
      CONTINUE LOOP
  
  IF answer == "Hủy":
    → cleanup Path B, STOP
```

### Phase 3 — State update + exit print (MANDATORY)

```
Update state:
  gate-b.confirmed: true
  gate-b.skip_step_5: {true|false}
  current_step: {"5" | "6" if skip_step_5}

Print: "✅ Gate B confirmed. Path: {S|M|L}. Risk: {score}/5."
Print: "▶️ Proceeding to Step {5|6}."
```

**MANDATORY EXIT**: DO NOT STOP. Immediately execute Step 5 (or Step 6 if skip_step_5=true).

---

## Step 5 — Create feature _state.md files — MANDATORY

**This step ALWAYS runs after Gate B confirmation (except when `gate-b.skip_step_5: true`).**

**Entry print (MANDATORY)**:
```
Print: "▶️ Starting Step 5: Create feature _state.md + feature-brief.md files"

# Pre-check (MANDATORY — abort if violated):
IF state.steps["gate-b"].confirmed != true:
  STOP with error: "Gate B not confirmed. Pipeline integrity violated. Run resume."
IF state.steps["gate-b"].skip_step_5 == true:
  Print: "⏭️ Step 5 skipped per Gate B user choice. Jumping to Step 6 with 'manual _state.md' note."
  → Jump to Step 6 (do NOT create _state.md)
```

**Pre** (enforced): Gate B confirmed, all intel on disk, scaffold done (steps.4.status == "done")
**Do**:

### 5a. Read data from disk (MANDATORY first action)

```
Read doc-brief.md → system-name, modules, features, screen-count, integration-flags, pii
Read tech-brief.md → repo-type, services list, auth-model
Read state.steps["gate-b"] → risk_score, selected_path, output_mode
```

### 5b. ID sequence allocation

Canonical ID format (CD-10 alignment with from-code):

```
mini-repo:   F-NNN              e.g. F-001, F-042
monorepo:    {service}-F-NNN    e.g. api-F-001, web-F-014

Rules:
  - NNN: 3-digit zero-padded, sequential per service (or per workspace in mini)
  - Forbidden in ID: date, source-prefix (BOTP/SRS/BRD), module name
  - Immutable: ID không đổi sau khi commit lần đầu
```

**Allocation algorithm** (per service in mono, or per workspace in mini):

```
1. Scan existing IDs:
   - Read {features-root}/feature-map.yaml if exists → collect feature IDs
   - Glob {features-root}/F-*/ and {features-root}/{svc}-F-*/ → collect dir names
   - Parse NNN from each, take max → max_seq (default 0 if none)

2. Allocate NNN starting from max_seq + 1, incrementing per pipeline.

3. Reserve all NNN for current batch BEFORE writing any file (prevents collision
   if multiple pipelines computed in this run).
```

Note: this skill does NOT match against existing feature-catalog.json semantically
(verify mode is out of scope for now). Sequential allocation only — duplicates with
existing features are a known limitation tracked separately.

### 5c. Resolve features-root (repo-type aware)

```
IF mini → features-root = docs/features
IF mono AND project dirs exist → features-root = {project-path}/docs/features
IF mono AND no project dirs → features-root = docs/features, pre-scaffold = true
mkdir -p {features-root}
```

### 5d. Decompose modules into pipelines + dependency graph (EXHAUSTIVE branching)

```
# Exhaustive cases — cover ALL combinations of modules × features

IF modules ≤ 3 AND features ≤ 10:
  → 1 pipeline covering all modules (depends-on: [])
  → pipeline.id = mini ? "F-{NNN}" : "{service}-F-{NNN}"   (NNN from 5b)
  → pipeline.name = system-name

ELIF modules ≤ 3 AND features > 10:
  → 1 pipeline per module (even though few modules, many features needs separation)
  → Analyze dependencies between modules

ELIF modules > 3 AND features ≤ modules × 2:
  → Consolidate: merge adjacent small modules, aim for 2-3 pipelines
  → Analyze dependencies

ELIF modules > 3 AND features > modules × 2:
  → 1 pipeline per module (default)
  → Analyze dependencies

POST: Merge modules with ≤ 1 feature into nearest related module (before finalizing pipelines list).
```

**Dependency analysis** (only when multiple pipelines):
```
FOR each pair (pipeline_A, pipeline_B):
  A depends-on B IF any of:
    - A's entities reference B's entities (foreign keys, lookups)
    - A's business rules reference B's features
    - A's screens display data owned by B
    - A's integration points consume B's APIs
    - doc-brief explicitly states ordering

Build depends-on list per pipeline. Cycle detection:
  IF cycle found → merge cycled pipelines into one (too coupled to separate)
```

Output: `pipelines[]` = `[{id, name, modules, feature-ids, service, features-root, depends-on: [ids]}]`

### 5e. Derive stages-queue

```
(current-stage = 'ba', so stages-queue = stages AFTER ba)

Base by path (from Gate B):
  S → [tech-lead, dev-wave-1, reviewer]
  M → [sa, tech-lead, dev-wave-1, qa-wave-1, reviewer]
  L → [sa, security-design, tech-lead, dev-wave-1, qa-wave-1, security-review, reviewer]

Conditional additions (from agent-flags):
  IF screen-count > 0 → insert designer after first position (before sa)
  IF screen-count > 0 → add fe-dev-wave-1 parallel with dev-wave-1
  IF integration-flags > 0 AND path == S → upgrade: insert sa
  IF pii-found AND path != L → append security-review before reviewer
  IF IoT involved → insert devops before qa

Convention: Cursor dispatcher routes `ba` stage → `ba` agent (handles both BA + domain modeling in one invocation).
```

### 5f. Write _state.md — PARALLEL

Issue all Write calls in ONE message (parallel execution):

```
FOR pipeline in pipelines:
  Write({workspace}/{pipeline.features-root}/{pipeline.id}/_state.md, ...)
```

Template — contract: `.cursor/skills/from-doc/SKILL.md`

```yaml
# --- Contract: must match Cursor stub at .cursor/skills/from-doc/SKILL.md ---
# --- Consumed by: resume-feature, dispatcher, pm, ba ---
feature-id: {pipeline.id}
feature-name: {pipeline.name}
pipeline-type: sdlc
status: in-progress
depends-on: [{pipeline.depends-on from Step 5d — empty [] if no deps}]
blocked-by: []   # auto-computed by resume-feature at dispatch time
created: {today}
last-updated: {today}
current-stage: ba   # Cursor convention: `ba` stage routes to `ba` agent (handles BA + domain modeling)
output-mode: {from gate-b — lean|full}
repo-type: {from tech-brief — mono|mini}
repo-path: "."   # relative to workspace root
project: {pipeline.service}
project-path: {resolved — "." for mini/cross-cutting, "src/apps/{name}" or "src/services/{name}" for mono}
docs-path: {pipeline.features-root}/{pipeline.id}
intel-path: docs/intel   # shared across features (Claude Code) — at workspace root
stages-queue: [{from 5e — stages AFTER ba}]
completed-stages:
  doc-intel:
    verdict: "Ready for BA"
    completed-at: "{today}"
kpi:
  tokens-total: 0
  cycle-time-start: "{today}"
  tokens-by-stage: {}
rework-count: {}
source-type: {from doc-brief — document-type}
agent-flags:
  ba:   # keyed by AGENT name (current-stage: ba → ba agent)
    source-type: {type}
    blocking-gaps: {count}
    total-modules: {pipeline.modules.length}
    total-features: {pipeline.feature-ids.length}
  designer: {only if screens > 0 — else omit block}
    screen-count: {count}
  sa: {only if integration flags > 0}
    integration-flags: [list]
  security: {only if PII/auth found}
    pii-found: {true/false}
    auth-model: {rbac/abac/unknown}
pre-scaffold: {true | omitted — set only when mono AND project dirs don't exist}
pre-scaffold-target: {intended {project-path}/docs/features — only when pre-scaffold: true}
clarification-notes: ""   # initialized empty. PM writes question here if blocking
feature-req: |
  file:{docs-path}/feature-brief.md
  canonical-fallback:{intel-path}/doc-brief.md
  scope-modules: [{pipeline.modules}]
  scope-features: [{pipeline.feature-ids}]
  dev-unit: {config.dev_unit}
```

**Body sections (required for resume-feature status display + PM tracking):**

```markdown
# Pipeline State: {pipeline.name}

## Business Goal
{1-2 sentences synthesized from feature-brief scope}

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
**ba** — Ready to start. Input: feature-brief.md (scope: {pipeline.modules})

## Next Action
Invoke `ba` with feature-req pointing to feature-brief.md (scope: {pipeline.modules}).

## Active Blockers
none

## Wave Tracker
| Wave | Tasks | Dev Status | QA Status |
|---|---|---|---|

## Escalation Log
| Date | Item | Decision |
|---|---|---|
```

> `feature-req` primary = `feature-brief.md` (pre-scoped per feature, 60-80% smaller context).
> Agents read feature-brief first; fall back to canonical doc-brief only for deep content.
> `scope-modules` limits `ba` to this pipeline's modules only.

### 5f.5 Write feature-brief.md per pipeline (scoped digest — Artifact Format compliant)

**Purpose**: Pre-computed scoped digest for SDLC agents. Saves 60-80% context per agent invocation.

**Format compliance** (per AGENTS.md § Artifact Format Standard, cross-ref `.cursor/agents/ba.md`):
- English structural (IDs, field keys, section headers, verdicts)
- Tables / YAML preferred over prose
- Metrics upfront (YAML frontmatter)
- Source quotes preserve original language (VN) — ONLY inside `source:` field with double quotes
- Prose allowed ONLY in: risk analysis, trade-offs narrative (§Insights blocks)
- Minimize token footprint — agents read structured data, not descriptions

For each `pipeline` in `pipelines[]`, Write `{workspace}/{pipeline.features-root}/{pipeline.id}/feature-brief.md`:

```markdown
---
# Metadata (machine-parseable — YAML keys in English)
feature-id: {pipeline.id}
feature-name: {pipeline.name}
canonical-source: docs/intel/doc-brief.md
canonical-hash: sha256:{hash at gen time}
generated-at: {ISO-8601}
scope:
  modules: [{M-ids}]
  features: [{F-ids}]
  depends-on: [{feature-ids}]
metrics:
  features-in-scope: {N}
  rules-applied: {N}
  entities-scoped: {N}
  screens-scoped: {N}
  integrations: {N}
  ambiguities-total: {N}
  blocking-gaps: {N}
  priority-distribution:
    P0: {N}
    P1: {N}
    P2: {N}
    P3: {N}
  complexity-estimate: {S|M|L}
  risk-score: {1-5}
---

# Feature Brief: {pipeline.name}

## Scope

| Dimension | Value |
|---|---|
| Modules | {list} |
| Feature IDs | {list} |
| Rules applied | {count: list IDs} |
| Entities | {count: list names} |
| Screens | {count} |
| Integrations | {count or "none"} |
| Depends-on features | {list or "none"} |

## Scope boundary

| Type | Items |
|---|---|
| IN scope | {aggregate from feature §In-scope fields — bullet list} |
| OUT scope | {aggregate from feature §Out-of-scope — explicit exclusions} |
| Deferred | {explicitly deferred features referenced but not in scope} |

## Features in scope

### {F-001}: {feature-name}

| Property | Value |
|---|---|
| Type | CRUD \| Report \| Config \| Workflow \| Integration \| Monitor |
| Priority | P0 \| P1 \| P2 \| P3 |
| Actors | {canonical names from §3} |
| Entities | {entity names} |
| Screens | {list: list, create-modal, detail, ...} |
| Workflow | {state transitions} OR "simple CRUD" |
| Applied rules | {BR-IDs} |
| Source | explicit: "{VN quote verbatim ≥15 chars}" OR implied: {ref + reasoning} |

**Key fields** (inferred types — VARCHAR lengths from domain):
| Field | Type | Constraints | Notes |
|---|---|---|---|
| {field} | VARCHAR(N) | UNIQUE, NOT NULL, FK→table | {1-line hint} |

**Validations**: {required-fields}, {cross-field rules}, {uniqueness}
**Reports/Exports**: {formats} OR "none"

(Repeat per feature in scope — one block per feature, all tables.)

## Business Rules (scoped)

| ID | Rule | Type | Applies-to | Severity | Source |
|---|---|---|---|---|---|
| BR-INTEL-{NNN} | {brief statement} | Validation\|Authorization\|Computation\|State-transition\|Notification | {F-IDs} | High\|Med\|Low | explicit "..." OR implied §{ref} |

## Entities + Relationships (scoped)

```yaml
entities:
  - name: {EntityName}
    key-fields: [id, field1, field2, ...]
    pii-fields: [CCCD, email, phone]   # if any, else []
    field-types:
      field1: VARCHAR(50) UNIQUE
      field2: DECIMAL(18,2)
    source: "explicit §3.1" | "implied from OCR img-04"

relationships:
  - from: EntityA
    to: EntityB
    cardinality: "1:1 | 1:N | N:1 | N:N | 1:N (tree)"
    fk: {field}
    source: {ref}

state-machines:
  - entity: {EntityName}
    states: [State1, State2, State3]
    transitions:
      - from: State1
        to: State2
        trigger: {action}
        guard: {condition}
```

## Screens (scoped)

| # | Screen | Type | Feature | Key fields | Actions | OCR src |
|---|---|---|---|---|---|---|
| 1 | {title} | list\|detail\|form-create\|form-edit\|dashboard\|wizard\|modal | {F-ID} | {list} | {list} | img-NN |

## Integrations (touching scope)

| From | To | Direction | Protocol | Data | Confidence |
|---|---|---|---|---|---|

## NFRs Applicable

| Area | Requirement | Target | Source |
|---|---|---|---|
| Performance | | {number or range} | |
| Security | | | |
| Reliability | | | |
| Audit/Logging | | | |
| Operability | | | |

## Ambiguities (blocking `ba` to resolve upfront)

| ID | Severity | Question | Options | Impact-if-wrong |
|---|---|---|---|---|
| GAP-{NNN} | Blocking\|Non-blocking\|Unresolvable | {question} | A / B / C | {impact} |

---

## § Agent Hints (Opus-precomputed — scoped to THIS feature only)

### § for ba

| Hint | Value |
|---|---|
| Complexity class | Simple \| Medium \| Complex |
| Classify rationale | {1 line: "4-10 rules + 2-3 actors" or similar} |
| Implicit user stories to infer | {N items} — see insights below |
| Compliance mappings | NĐ 13/2023 (PII), TT 77/2017 (accounting), ... |
| Blocking clarifications to prepare | {list of ambiguity IDs to ask user upfront} |

**Inferred implicit stories** (domain knowledge — verify against source):
- As {actor}, I want {capability}, so that {value}. [source: inferred from {domain}]
- ...

### § for sa

| Hint | Value |
|---|---|
| Recommended pattern | {Event Sourcing \| CQRS \| Outbox \| Simple CRUD} |
| Pattern rationale | {1 line} |
| Anti-pattern risks | {N+1, distributed transaction, ...} |
| Scalability bottleneck | {entity or endpoint} — reason |
| Similar-system reference | {e.g. "SAP FI general ledger"} |

### § for tech-lead

| Feature | Complexity | Risk | Rationale | Parallel-safe with |
|---|---|---|---|---|
| {F-ID} | S\|M\|L\|XL | 1-5 | {reason} | {other F-IDs or "none"} |

**Tasks likely needed** (beyond spec):
- Migration script for {entity} seed data
- Catalog seed for {entities}
- Permission matrix seed

### § for dev

| Hint | Value |
|---|---|
| Stack library (validated) | {e.g. @nestjs/cqrs, CASL, TypeORM tree} |
| Money handling | DECIMAL(18,2), use `decimal.js`, NEVER float |
| Charset | utf8mb4 for all VN text fields |
| Timezone | ICT (UTC+7) for gov/accounting |
| PII handling | Encrypt CCCD at rest, mask in logs, audit export |

### § for qa

| Hint | Value |
|---|---|
| Test ratios | unit 60 / int 30 / e2e 10 |
| Critical edge cases | {concurrent writes, period boundary, permission inheritance} |
| Performance SLA | list 1000 rows < 500ms, approval flow < 2s |
| Test data | `docs/intel/test-data-hints.md#{entity}` |

### § for reviewer — Feature-specific DoD

```
[ ] All ACs from ba spec implemented and tested
[ ] All applied-rules have unit tests (BR-IDs: {list})
[ ] Entity schema matches sa ER (cardinality respected)
[ ] Validations match feature-brief field constraints
[ ] Priority-respected delivery (P0 first)
[ ] Out-of-scope NOT implemented ({list})
[ ] PII encrypted per NĐ 13/2023 (if pii-fields present)
[ ] Audit trail for state-transition rules (if any)
[ ] SLA targets met (see qa §)
[ ] Vietnamese error messages, no English leak
[ ] Migration up+down tested
[ ] Permission check at controller AND service layer
[ ] No secrets in code/config
[ ] README/CHANGELOG updated
```

### § for security (if in stages-queue)

| Attack surface | Mitigation |
|---|---|
| Privilege escalation via `{field}` | Server-side validation of ma_don_vi scope |
| Mass assignment | Whitelist allowed fields, reject client-set status |
| IDOR on list endpoints | Enforce permission filter per query |
| PII exposure | No CCCD in logs, URLs, error messages |

---

## Agent Read Order (est. tokens — budget reference)

| Agent | Sections | Est. tokens |
|---|---|---|
| ba | Scope, Scope boundary, Features, Rules, Ambiguities, §ba | ~3K |
| sa | Entities, Screens, Integrations, NFRs, §sa | ~2K |
| tech-lead | Scope boundary, Features (Priority), §tech-lead | ~1.5K |
| dev (per task) | Entities subset, §dev | ~1K |
| qa | Rules, Screens, §qa, test-data-hints.md | ~2K |
| reviewer | §reviewer DoD, Out-scope list | ~0.5K |

## Canonical Reference

- Source of truth: `docs/intel/doc-brief.md` (hash: sha256:...)
- IF digest stale → regenerate before agent runs (resume-feature Step 3.0 handles)
- IF deep context needed (beyond digest) → read canonical directly
```

**Language rules** (strict):
- Section headers, field keys, IDs, verdicts, YAML keys → **English**
- Source quotes → preserve original (VN) inside `source: "..."` field
- Inferred descriptions, rationale, narrative → **English** (concise)
- `§for qa` edge case descriptions → English (tech terms)
- NEVER translate technical VN terms that have no English equivalent (e.g. "bút toán", "đơn vị cấp II") — keep verbatim in quotes

**Generation logic**:
```
For each pipeline in pipelines[]:
  scope_rules = filter(doc-brief §5 rules, where applies-to-features ∩ pipeline.feature-ids)
  scope_entities = collect from scope features' Entities field
  scope_screens = filter(§7, by feature-name match)
  scope_insights = filter(§13 bullets, mentioning scope features or scope entities)
  
  Write feature-brief with all scoped content
```

Issue all Write calls PARALLEL with _state.md writes (single message, multiple Write tools).

### 5g. Populate feature-catalog.json via ai-kit scaffold feature loop — MANDATORY

**Purpose**: Step 4a `scaffold workspace` only creates an EMPTY feature-catalog.json stub. Step 5g MUST iterate over each feature in each pipeline and call `ai-kit sdlc scaffold feature` to populate the catalog atomically + create `_feature.md` (FeatureSpec per CD-23) + update sitemap/permission-matrix placeholders. WITHOUT this loop, Step 5h Tier 1 gate fails with `feature-catalog EMPTY`.

```
FOR each pipeline in pipelines[]:
  parent_module_id = pipeline.module_id  # the M-NNN owning this pipeline (per Step 5d module catalog scaffold)

  FOR each feature in pipeline.features:
    # Derive slug from feature.name (kebab-case ASCII; transliterate VN if no name_en)
    slug = derive_slug(feature.name_en || transliterate(feature.name))

    # Build acceptance_criteria JSON array (ACs from doc-brief Section per feature)
    ac_json = JSON.stringify(feature.acceptance_criteria || [])

    # Detect cross-cutting consumers (modules that reference this feature in doc-brief)
    consumed_by_csv = feature.consumed_by_modules.join(',') || ''

    Bash("ai-kit sdlc scaffold feature \
      --workspace . \
      --module {parent_module_id} \
      --id {feature.id} \
      --name '{feature.name}' \
      --slug '{slug}' \
      --description '{feature.description}' \
      --business-intent '{feature.business_intent}' \
      --flow-summary '{feature.flow_summary}' \
      --acceptance-criteria '{ac_json}' \
      --consumed-by '{consumed_by_csv}' \
      --priority {feature.priority || 'medium'}")

    # Idempotent error handling — partial-run resume must not fail on existing entries
    parse stdout JSON
    IF !ok:
      IF error.code == 'MCP_E_ID_COLLISION' (Feature ID already exists):
        # Likely from partial run before — treat as already scaffolded, skip
        Print "⏭ Feature {feature.id} already scaffolded — skip"
        increment skip_count; continue to next feature
      ELIF error.code == 'MCP_E_NOT_FOUND' (Parent module not found):
        # Module wasn't scaffolded by Step 5d for this feature — bug
        STOP "Parent module {parent_module_id} missing for {feature.id}. Re-run Step 5d first."
      ELSE:
        STOP "Feature {feature.id} scaffold failed: {error.message}. Inspect via 'ai-kit sdlc scaffold feature --help' for valid args."

    # Verify CLI flag list correct anytime by running:
    #   ai-kit sdlc scaffold feature --help
    # Currently accepts: workspace, module, id, name, slug, description, business-intent,
    # flow-summary, acceptance-criteria, consumed-by, priority, expected-version.

    # Post-scaffold: populate fields not supported by scaffold CLI (per CLI --help note)
    # role_visibility / expected_pipeline_path / depends_on / references go here
    IF feature.role_visibility (map):
      Bash("ai-kit sdlc state update --op field \
        --kind feature --id {feature.id} \
        --path role_visibility \
        --value '{JSON.stringify(feature.role_visibility)}'")
    IF feature.depends_on (csv):
      Bash("ai-kit sdlc state update --op field \
        --kind feature --id {feature.id} \
        --path depends_on \
        --value '{JSON.stringify(feature.depends_on)}'")
    IF feature.expected_pipeline_path (S|M|L from heuristic):
      Bash("ai-kit sdlc state update --op field \
        --kind feature --id {feature.id} \
        --path expected_pipeline_path \
        --value '\"{feature.expected_pipeline_path}\"'")
```

After loop:
- `feature-catalog.json` populated with N entries (N = total feature count)
- `sitemap.json` placeholders added per feature (status: planned, confidence: low)
- `permission-matrix.json` placeholders per role_visibility (when set)
- `feature-map.yaml` updated atomically (F-NNN → parent_module + path)
- Each F-NNN folder created at `docs/modules/M-NNN-{slug}/_features/F-NNN-{slug}/` with `_feature.md`, `implementations.yaml`, `test-evidence.json`

### 5g.5. Emit business-context.json — MANDATORY (T3 primary producer per OUTLINE_COVERAGE.md § 5)

**Purpose**: `from-doc` is the SOLE producer of `business-context.json`. Step 5h Tier 3 gate hard-stops if missing. Synthesize from doc-brief + tech-brief sections.

```
business_context = {
  schema_version: "1.0",
  project: {
    name: doc-brief.system_name,
    name_vn: doc-brief.system_name_vn,
    code: doc-brief.project_code || derive_from_name,
    sector: doc-brief.sector || 'public-administration',
  },
  legal_basis: doc-brief.legal_references[],         # MUST be ≥3 entries — extract NĐ/QĐ/CT/Luật from §1 of doc
  objectives: {
    general: doc-brief.objectives.general,
    specific: doc-brief.objectives.specific[],       # MUST be ≥3
  },
  pain_points: doc-brief.pain_points[],              # MUST be ≥3 — extract from §2 problem statement
  scope: {
    in_scope: doc-brief.scope.in_scope[],            # MUST be non-empty
    out_of_scope: doc-brief.scope.out_of_scope[],
    deferred: doc-brief.scope.deferred[],
  },
  stakeholders: doc-brief.stakeholders[],
  expected_outcomes: doc-brief.expected_outcomes[],
  ...
}

Write docs/intel/business-context.json (validate via JSON schema before write)
Bash("python ~/.claude/scripts/intel/validate.py docs/intel/business-context.json --schema business-context")
IF validation fails → STOP with field-level error, suggest [r] re-run Step 3 OR [i] interactive fill at Step 5h gate
```

**Hard-stop conditions** (matches Step 5h gate):
- `project.name` empty
- `legal_basis[]` count < 3
- `objectives.specific[]` count < 3
- `pain_points[]` count < 3
- `scope.in_scope[]` empty

If doc-brief section missing required content for any field → set field to `[CẦN BỔ SUNG: <description>]` placeholder string and Print warning. Step 5h will catch and prompt user [i] interactive fill.

### 5g.6. Update _state.md feature-req to point to feature-brief

```yaml
repo-type: {mono|mini}
features:
  {pipeline.id}:
    name: {pipeline.name}
    project: {pipeline.service}
    docs_path: {pipeline.features-root}/{pipeline.id}
    status: in-progress
    current-stage: ba
    depends-on: [{dep-ids or empty}]
    created: {today}
    updated: {today}
```

Register all files in artifacts map.

**Artifacts**: per-feature `_feature.md` (via 5g scaffold loop), per-pipeline `_state.md` + `feature-brief.md`, `feature-catalog.json` populated, `business-context.json`, `feature-map.yaml`
**State**: `current_step: "6"`, `steps.5.status: "done"`

**MANDATORY EXIT** (DO NOT STOP — continue to Step 5h):
Print: "✅ Step 5 complete (5g feature scaffold + 5g.5 business-context emit done). Proceeding to Step 5h (intel quality gate)..."
→ IMMEDIATELY execute Step 5h below. DO NOT pause.

---

## Step 5h — Intel quality gate (HARD-STOP — Tier 1 + business-context)

**Entry print**: "▶️ Starting Step 5h: Intel quality gate"

**Purpose**: Before handoff to Cursor `/resume-feature` and `/generate-docs`, verify that doc-derived intel artifacts meet downstream consumer minimums per `~/.claude/schemas/intel/OUTLINE_COVERAGE.md` § 5.

### What from-doc is responsible for

`from-doc` emits **Tier 1 (doc-derived) + Tier 3 (project metadata)** per `OUTLINE_COVERAGE.md` § 8.2:

| Artifact | Tier | from-doc role |
|---|---|---|
| `actor-registry.json` | T1 | Primary — extract roles from doc-brief |
| `permission-matrix.json` | T1 | Primary when doc declares RBAC; from-code merges later |
| `sitemap.json` | T1 | Primary for menu_tree (doc-side); from-code merges routes |
| `feature-catalog.json` | T1 | Primary (business prose); from-code merges code-grounded fields |
| `business-context.json` | T3 | **Primary — from-doc is the only producer** |
| `nfr-catalog.json` | T3 | Partial — if doc declares NFRs; otherwise warn |
| `security-design.json` | T3 | Partial — ATTT level + policies from doc; otherwise warn |
| `integrations.json` | T2 | Partial — LGSP/NGSP business level; from-code merges code calls |

### Tier 1 quality gates (HARD-STOP if violated)

```
for artifact in [actor-registry, permission-matrix, sitemap, feature-catalog]:
  python ~/.claude/scripts/intel/validate.py docs/intel/{artifact}.json --schema {artifact}
```

| Artifact | Hard-stop condition |
|---|---|
| `actor-registry.json` | `roles[]` empty AND project clearly has multiple actor types in doc-brief |
| `feature-catalog.json` | feature count = 0; OR per feature: description < 200 chars, business_intent < 100, flow_summary < 150, acceptance_criteria < 3 items × 30 chars (existing rule) |
| `sitemap.json` | menu_tree empty when doc-brief mentions UI navigation |
| `permission-matrix.json` | empty `permissions[]` when actor-registry.rbac_mode != implicit |

### Tier 3 quality gates — `business-context.json` (HARD-STOP)

`from-doc` MUST emit `business-context.json` (the primary producer). Hard-stop conditions per `OUTLINE_COVERAGE.md` § 5:

```
python ~/.claude/scripts/intel/validate.py docs/intel/business-context.json --schema business-context
```

| Field | Hard-stop condition |
|---|---|
| `project.name` | empty |
| `legal_basis[]` | count < 3 (or empty) |
| `objectives.specific[]` | count < 3 |
| `pain_points[]` | count < 3 |
| `scope.in_scope[]` | empty |

### Tier 3 quality gates — others (WARN-only at this stage)

`from-doc` reads documents; if documents do not contain NFR / security / infrastructure / cost detail, these schemas remain unstarted. Warn user that downstream `/generate-docs` will block on these fields. Suggested remediation: run `/new-document-workspace` for interview-driven completion, OR populate manually after from-doc.

```
for artifact in [nfr-catalog, security-design, infrastructure, cost-estimate, project-plan, handover-plan]:
  IF artifact does not exist:
    print: "⚠ {artifact}.json not produced — downstream /generate-docs will block. Run /new-document-workspace for interview-driven completion."
  ELSE:
    python ~/.claude/scripts/intel/validate.py docs/intel/{artifact}.json --schema {artifact}
    IF schema validation fails: print warnings (non-blocking)
```

### Cross-reference integrity (HARD-STOP at T1 only)

```
intel-validator agent runs T1 cross-ref rules (1-9) per ~/.claude/schemas/intel/README.md.
T2/T3 cross-ref rules deferred to from-code/full-pipeline validation.
```

### Failure handling

```
IF any T1 hard-stop OR business-context hard-stop:
  Print: "❌ Intel quality gate FAILED"
  Per failure show: artifact, rule, current vs required
  
  Options:
    [r] Re-run Step 3 (doc-intel re-extract) for failing artifact
    [i] Interactive fill — prompt user per gap
    [a] Abort handoff — pipeline incomplete
  
  Default: [r] for actor/feature/sitemap; [i] for business-context (BA interview).
```

### Update _meta.json after pass

```
for artifact in produced_artifacts:
  python ~/.claude/scripts/intel/meta_helper.py update docs/intel/ {artifact-basename} \
    --producer from-doc --ttl-days {ttl-per-README} \
    --source-evidence "doc-brief.md + tech-brief.md"
```

**State**: `current_step: "5i"`, `steps.5h.status: "done"`
**Exit print**: "✅ Step 5h complete (Intel gate passed). Proceeding to Step 5i (snapshot regen)..."
→ IMMEDIATELY execute Step 5i below.

---

## Step 5i — Generate intel snapshot (MANDATORY — non-blocking)

**Entry print**: "▶️ Starting Step 5i: Intel snapshot regen"

After Tier 1 artifacts validated + `_meta.json` updated, regenerate `_snapshot.md` so base-tier consumers (Cursor SDLC `dev`/`qa`/`reviewer`/`ba`/`sa`) read compressed view (~95% smaller). Without this, base-tier agents in subsequent SDLC stages re-read full canonical → ≥40K duplicate tokens per agent dispatch.

```bash
python ~/.cursor/skills/intel-snapshot/generate.py --intel-path {workspace}/docs/intel
python ~/.cursor/skills/intel-snapshot/generate.py --intel-path {workspace}/docs/intel --check
```

Expected sequential output:
- `[WROTE] {workspace}/docs/intel/_snapshot.md (X.X KB ~ NNN tokens)`
- `[WROTE] {workspace}/docs/intel/_snapshot.meta.json`
- `[OK] Snapshot fresh`

**Failure handling** (per intel-snapshot SKILL.md "snapshot is optimization, not correctness"):
- IF generator exits non-zero → WARN: "Snapshot regen failed — base-tier agents fall back to canonical JSON (slower, no correctness impact)". Continue.
- IF Tier 1 inputs missing → snapshot generates partial. Continue.

**State**: `current_step: "6"`, `steps.5i.status: "done"`, `steps.5i.snapshot_regenerated: true|false_with_reason`
**Exit print**: "✅ Step 5i complete. Proceeding to Step 6 (handoff report)..."
→ IMMEDIATELY execute Step 6 below.

---

## Step 6 — Handoff report — MANDATORY (always runs)

**Entry print (MANDATORY)**:
Print: "▶️ Starting Step 6: Handoff report"

**Pre-check**:
- IF `state.steps["gate-b"].skip_step_5 == true`: set `mode = scaffold-only`
- ELSE: set `mode = full`

**Do**: Display summary (Vietnamese):

**IF mode == full**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ from-doc hoàn tất
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  System:     {system-name}
  Features:   {N} pipelines created
  Path:       {S|M|L} (risk score: {score})
  Workspace:  {workspace-path}

  📁 Files:
  {list all _state.md paths}
  {feature-map.yaml path}

  ▶ Trong Cursor, chạy:
    /resume-feature {first-feature-id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**IF mode == scaffold-only** (Gate B Option 3 chosen):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️  from-doc hoàn tất (scaffold-only mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  System:     {system-name}
  Workspace:  {workspace-path}

  📁 Files created:
  - docs/intel/doc-brief.md
  - docs/intel/tech-brief.md
  {scaffold paths if created}

  ⚠️  _state.md NOT created (user opted for scaffold-only).
  ⚠️  feature-map.yaml NOT created.

  ▶ Next steps (manual):
    1. Review docs/intel/doc-brief.md
    2. Create docs/features/{id}/_state.md manually
    3. Create docs/feature-map.yaml manually
    4. Then run /resume-feature {id} in Cursor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**State**: `current_step: "complete"`, `steps.6.status: "done"`
**Exit print (MANDATORY)**: "🏁 from-doc pipeline complete."

---

## Failure Matrix

| Step | Failure | Retry | Fallback |
|------|---------|-------|----------|
| 1 | Missing dependency | 0 | Stop |
| 1 | No supported files | 0 | Stop |
| 2 | Disk/permission error | 1 | Stop |
| 3 | doc-intel agent error | 1 | Stop + suggest standalone |
| 3 | Blocking gaps > 3 | 2 patch rounds | User: proceed-with-gaps or cancel |
| Gate A | 3 correction iterations | 0 | Force: confirm or cancel |
| 4a | new-workspace fail | 1 | Degrade: minimal mkdir |
| 4c | Stack ambiguous | 1 question | Skip materialize |
| Gate B | 3 correction iterations | 0 | Force: confirm or cancel |
| 5 | Write fail | 1 | Stop (critical) |

## Cleanup on Cancel

```
IF cancel before Gate A → offer: keep workspace / delete docs/source+intel / delete all
IF cancel at Gate B → offer: keep all / keep scaffold only / rollback
ALWAYS: print file list before delete, require explicit confirmation
NEVER: delete files not created by this pipeline (check workspace_preexisting)
```

## Invariants

- **I1**: _pipeline-state.json exists before Step 3
- **I2**: AskUserQuestion ≤ 4 options, always
- **I3**: Every loop has integer bound in state. After bound → 2-option forced choice
- **I4**: Optional steps (e.g. token extraction) have explicit skip + downstream consistent state
- **I5**: Every failure path has forward option (degrade) except pre-Step-2 preflight
- **I6**: current_step monotonic forward (except explicit rerun which backs up state)
- **I7**: Cleanup never deletes non-pipeline files
- **I8**: Sub-agent output ignored for progression — only artifacts on disk + state file govern
- **I9**: feature-req uses `docs/intel/` (shared), never `{docs-path}/intel/`
- **I10**: Decompose + stages-queue derived AFTER scaffold (Step 5d/5e), not before

## Anti-Skip Protocol (MANDATORY for every step)

To prevent Claude from silently skipping steps, EVERY step and sub-step MUST follow this 3-phase pattern:

**Phase 1 — Entry print** (mandatory):
```
Print to user: "▶️ Starting Step {N}: {name}"
```

**Phase 2 — State detection + branching** (mandatory):
- Read preconditions explicitly (not assume)
- Print detected state to user (visible decision)
- ALL branches must reach Phase 3 (no silent exit)
- Never use "IF ... skip" without ELSE clause

**Phase 3 — State update + exit print** (mandatory):
```
Update _pipeline-state.json: steps.{N}.{status|sub-state|completed_at}
Print: "✅ Step {N} hoàn tất. Next: Step {N+1}"
```

**Forbidden patterns** (cause silent skip):
- ❌ `IF condition → skip` (no else, Claude treats as optional)
- ❌ Conditional branches without state update
- ❌ "Optional" labels on substeps (Claude skips)
- ❌ Broad OR conditions (`AGENTS.md OR package.json`) → false positives
- ❌ No user-visible output → user can't verify step ran
- ❌ Sub-steps without explicit 1/2/3/... numbered phases

**Required patterns**:
- ✅ Entry print BEFORE any action
- ✅ Every branch has explicit action + state update + exit print
- ✅ Precise detection conditions (AND multiple signals, not OR)
- ✅ Numbered sub-steps (4a.1, 4a.2, 4a.3) — Claude follows sequentially
- ✅ "MANDATORY" label on sub-steps that could look optional
