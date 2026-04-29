# Phase 0 — Preflight

**Purpose**: Detect workspace state, resolve repo path, initialize `_pipeline-state.json`, check dependencies.

**Pre**: user invoked `/from-code` (with or without args)
**Tokens**: 0 (no LLM)
**Gate**: none

---

## Step 0.1 — Entry print (MANDATORY)

```
Print: "▶️ Starting Phase 0: Preflight"
```

## Step 0.2 — Parse invocation args

```
args_parsed = {
  repo_path:       --repo-path value  OR  current working directory,
  resume:          --resume flag present,
  bridge_only:     --bridge-only flag present,
  service_filter:  --service value (mono only),
  force_tier3:     --tier-3-only flag,
  stop_after:      --stop-after value (dev debug)
}
```

Print detected args to user.

## Step 0.3 — Resume check (MANDATORY — always runs)

```
state_file = {workspace}/docs/intel/_pipeline-state.json

IF state_file exists:
  state = read + parse
  Print: "📂 Previous pipeline state found:
          - Current step: {state.current_step}
          - Last completed: {last_done_step}
          - Workspace: {state.workspace_path}"

  IF args.resume == true:
    → Proceed to Resume Protocol (see SKILL.md)
  ELSE:
    AskUserQuestion (max 3):
      1. "▶️ Tiếp tục từ step {state.current_step}"
      2. "🔄 Chạy lại từ đầu (ghi đè state)"
      3. "❌ Hủy"
    IF option 1 → set args.resume = true
    IF option 2 → archive old state to _pipeline-state.{timestamp}.bak.json, fresh start
    IF option 3 → STOP
ELSE:
  Print: "🆕 No previous state. Starting fresh."
  → Proceed to step 0.4
```

## Step 0.4 — Dependency check

Required:
- `tree-sitter` CLI or Python binding (`pip show tree-sitter tree-sitter-languages`)
- `scc` or `tokei` (choose whichever is installed)
- `universal-ctags` (optional, skip symbol index if missing)
- `python` 3.10+

```
IF tree-sitter missing:
  Print: "❌ tree-sitter required. Install: pip install tree-sitter-languages"
  STOP
IF scc and tokei both missing:
  Print: "⚠️ Neither scc nor tokei found. File inventory will use find+wc fallback (slower)."
  state.config.file_inventory_fallback = true
IF ctags missing:
  Print: "⚠️ universal-ctags not found. Symbol index skipped."
  state.config.skip_symbol_index = true
```

Register results in `state.config.tools_available`.

## Step 0.5 — Detect repo boundaries

```
repo_path = resolve args.repo_path to absolute

Checks:
  - git repo marker (.git/) — informational, not required
  - top-level manifests present: package.json | *.csproj | *.sln | pyproject.toml |
    go.mod | Cargo.toml | pom.xml | build.gradle

IF NO manifest found:
  Print: "⚠️ No recognized manifest. This may not be a source repo."
  AskUserQuestion (max 3):
    1. "▶️ Continue anyway (Tier 3 LLM fallback)"
    2. "📁 Provide different repo path"
    3. "❌ Cancel"

Record all manifests found in state.config.manifests_found
```

## Step 0.6 — Detect repo_type (mono vs mini)

Use CP-7 detection rules:

```
signals_for_mono = [
  nx.json exists,
  turbo.json exists,
  pnpm-workspace.yaml exists,
  lerna.json exists,
  package.json has "workspaces" field,
  *.sln has >= 2 *.csproj in distinct folders,
  root has src/apps/ with >= 2 subfolders each containing own manifest,
  root has src/services/ with >= 2 subfolders each containing own manifest,
  pyproject.toml has [tool.poetry.workspace] or equivalent,
  docker-compose.yml has >= 2 build: services pointing to different folders
]

repo_type = "mono" IF any signal is true ELSE "mini"
```

Print detection result:
```
🔍 Repo type detected: {mono | mini}
   Signals: {list}
```

## Step 0.7 — Enumerate services (if mono)

```
IF repo_type == "mono":
  services = []

  # Strategy 1: workspace tool
  IF nx.json: services += parse_nx_projects()
  IF turbo.json: services += parse_turbo_workspaces()
  IF pnpm-workspace.yaml: services += parse_pnpm_workspaces()

  # Strategy 2: .sln projects
  IF *.sln: services += parse_sln_projects()

  # Strategy 3: folder convention
  FOR folder in [src/apps, src/services, services, apps, packages]:
    FOR sub in folder:
      IF sub has manifest: services.append({id, path, manifest})

  # Dedup by path
  services = dedup_by_path(services)

  # Classify kind (best-effort by manifest + presence of UI/BE markers)
  FOR svc in services:
    svc.kind = classify_service_kind(svc)  # backend/frontend/worker/shared-lib/tool

  Print: "📋 {N} services found:"
  FOR svc in services:
    Print: "   - {svc.id} ({svc.kind}, {svc.language}) — {svc.path}"

ELSE:
  services = [{ id: "root", path: ".", kind: auto_detect(manifests) }]

Save services to state.config.services
```

## Step 0.8 — Service filter (if --service arg)

```
IF args.service_filter:
  IF args.service_filter NOT IN services.ids:
    Print: "❌ Service '{filter}' not found. Available: {list}"
    STOP
  state.config.active_service = args.service_filter
  Print: "🎯 Service filter: {filter} — pipeline will run for this service only."
```

## Step 0.9 — Create directory structure

```
docs_path_root = {repo_path}/docs
mkdir -p {docs_path_root}/intel
mkdir -p {docs_path_root}/architecture/sequences
mkdir -p {docs_path_root}/features
mkdir -p {docs_path_root}/adr

IF repo_type == "mono":
  FOR svc in services (filtered):
    mkdir -p {svc.path}/docs/{intel,architecture,features}

Record all dirs in state.artifacts
```

## Step 0.10 — Initialize state file

Atomic write:
```
state = {
  version: 1,
  created: now_iso,
  workspace_path: repo_path,
  repo_type: detected,
  current_step: "1",
  steps: {... all pending ...},
  config: {
    repo_path, detected_stack: {}, selected_adapters: [],
    services: [...], per_service_docs: (repo_type == "mono"),
    active_service: args.service_filter,
    tools_available: {...},
    interview_context: {}
  },
  artifacts: {}
}

Write {docs_path_root}/intel/_pipeline-state.json (atomic .tmp → rename)
```

## Step 0.11 — MC-0 Micro-checkpoint

See [_micro-checkpoint.md](_micro-checkpoint.md) for pattern.

```
═══════════════════════════════════════════════════
 ✅ Phase 0 complete — {repo_type} repo with {N} services
═══════════════════════════════════════════════════

Detected:
  - Repo: {repo_path}
  - Type: {repo_type}
  - Services: {list (first 5)}
  - Tools: tree-sitter ✓, scc ✓, ctags {✓|✗}

Before Phase 1 (Static Harvest), any of these?

AskUserQuestion (max 4):
  1. "▶️ Continue — start extraction"
  2. "📁 Exclude specific folders (vendor/, generated/, legacy/...)"
  3. "🎯 Focus on subset of services (skip some)"
  4. "✏️ Correct workspace detection"
```

### Edit handlers

- **Exclude folders**: collect globs → save to `state.config.exclude_patterns[]` → adapters skip
- **Focus services**: re-prompt service multi-select → narrow `state.config.active_services`
- **Correct detection**: re-prompt repo type (mono/mini) or manifest selection

Iteration bound: 2. After cap → proceed-with-current or cancel.

## Step 0.12 — State update + exit print

```
Update state.steps["0"].completed_at = now
state.steps["0"].mini_gate = { iterations: N, forward_context_keys: [...] }
state.current_step = "1"
Flush state

Print: "✅ Phase 0 complete. ▶️ Next: Phase 1 Static Harvest"
```
