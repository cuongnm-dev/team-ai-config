# Phase 1 — Static Harvest

**Purpose**: Extract facts from codebase deterministically (no LLM). Produce normalized `code-facts.json`.

**Pre**: Phase 0 complete, services enumerated
**Tokens**: 0 (no LLM) — adapters run deterministically
**Gate**: none (Gate 0 after Phase 2)

## Step 1.0 — Entry print (MANDATORY)

```
Print: "▶️ Starting Phase 1: Static Harvest ({N} services, adapters: autodetect)"
```

## Step 1.1 — Run adapter detection (parallel)

```
adapters = read .claude/skills/from-code/adapters/registry.json

FOR each service in active_services:
  detect_results = PARALLEL for adapter in adapters:
    Agent(
      subagent_type: code-harvester,
      prompt: "task=detect, adapter={adapter.id}, service_path={svc.path}"
    )
  # Each returns {adapter_id, confidence: HIGH|MED|LOW|NONE, signals, version}

  service.detected_adapters = filter(detect_results, confidence != NONE)

  IF service.detected_adapters is empty:
    service.tier3_fallback = true   # flag for Gate 0 decision

save services back to state
```

Print summary per service:
```
🔎 Service {svc.id}:
   - dotnet-aspnetcore: HIGH (version 8.0, signals: 3 *.csproj, Program.cs has WebApplication)
   - angular:           NONE
   - nestjs:            NONE
   - fastapi:           NONE
   → Selected adapter: dotnet-aspnetcore
```

## Step 1.2 — Dispatch extractors in parallel (per service, per adapter)

For each service with adapter confidence >= MEDIUM, dispatch **7 extractors in parallel**:

```
PARALLEL (single message, multiple Agent() calls):

  Agent(subagent_type: code-harvester,
        prompt: "task=extract, extractor=1a stack-detector, service_id={svc.id}")

  Agent(subagent_type: code-harvester,
        prompt: "task=extract, extractor=1b routes, service_id={svc.id}, adapter={adapter.id}")

  Agent(subagent_type: code-harvester,
        prompt: "task=extract, extractor=1c entities, service_id={svc.id}, adapter={adapter.id}")

  Agent(subagent_type: code-harvester,
        prompt: "task=extract, extractor=1d auth, service_id={svc.id}, adapter={adapter.id}")

  Agent(subagent_type: code-harvester,
        prompt: "task=extract, extractor=1e integrations, service_id={svc.id}, adapter={adapter.id}")

  Agent(subagent_type: code-harvester,
        prompt: "task=extract, extractor=1f i18n, service_id={svc.id}, adapter={adapter.id}")

  Agent(subagent_type: code-harvester,
        prompt: "task=extract, extractor=1g test-map, service_id={svc.id}, adapter={adapter.id}")

# Each writes its own intel file:
#   docs/intel/stack-facts.json, routes-{svc}.json, entities-{svc}.json,
#   auth-rules-{svc}.json, integrations-{svc}.json, i18n-{svc}.json,
#   test-map-{svc}.json
```

**Tier 1 universal primitives** run inside `code-harvester` automatically:
- `scc`/`tokei` for LOC
- `tree-sitter` polyglot AST
- `ctags` symbol index
- grep for TODO/FIXME markers
- parse docker-compose.yml, k8s yaml, *.env files

## Step 1.3 — DI graph extraction (separate, per service)

```
PARALLEL per service with backend adapter:
  Agent(subagent_type: code-harvester,
        prompt: "task=extract, extractor=1h di-graph, service_id={svc.id}")
```

Writes `docs/intel/di-graph-{svc}.json`.

## Step 1.4 — Universal config scan (repo-wide)

```
Agent(subagent_type: code-harvester,
      prompt: "task=extract, extractor=1i configs, scope=repo-wide")
```

Output `docs/intel/configs.json`:
- env vars referenced (grep `process.env.X` / `Environment.GetEnvironmentVariable("X")` / `os.getenv("X")`)
- docker-compose services
- k8s resources
- feature flags (LaunchDarkly, Unleash, appsettings flags)

## Step 1.5 — Merge to normalized `code-facts.json`

Orchestrator reads all `{extractor}-{svc}.json` files + validates against [schemas/code-facts.schema.json](../schemas/code-facts.schema.json), then merges:

```
code_facts = {
  meta: { generated_at, repo_path, repo_type, adapters_used: [...] },
  services: [...],
  routes: [concat per service, re-id to R-NNN global],
  entities: [concat, dedup by (service_id, name)],
  auth_rules: [...],
  integrations: [...],
  i18n: {merge namespaces per service, prefix with service_id if collision},
  tests: {...},
  markers: [...],
  di_graph: [...],
  configs: {...},
  warnings: [collect from all extractors]
}

Validate against schema (Python jsonschema or similar)
IF validation fails:
  Print errors, STOP (cannot proceed without valid facts)

Write docs/intel/code-facts.json (atomic)
```

**Per-service additional copy** (mono):
```
IF repo_type == "mono":
  FOR each service:
    service_facts = filter code_facts where service_id == svc.id
    Write {svc.path}/docs/intel/code-facts.json
```

## Step 1.6 — Tier 3 fallback (conditional)

```
IF any service has tier3_fallback = true:
  Print: "🤖 Tier 3 LLM fallback required for service(s): {list}"
  Print: "   Rationale: no adapter matched, entry points will be read by LLM"

  FOR each fallback service:
    Agent(
      subagent_type: code-intel,
      prompt: "task=tier3-fallback-extract, service_id={svc.id}, entry_points={files}"
    )
    # Agent returns routes + entities in normalized schema
    Merge into code-facts.json (mark adapter="llm-fallback", confidence<=0.6)
```

## Step 1.7 — Coverage check

```
coverage = {
  routes_found: count(code_facts.routes),
  entities_found: count(code_facts.entities),
  services_with_routes: count(services having routes),
  tier3_services: count(tier3_fallback services)
}

IF coverage.routes_found == 0 AND coverage.entities_found == 0:
  Print: "⚠️ No routes/entities extracted anywhere. Possible causes:
          - Unsupported stack (consider contributing an adapter)
          - Repo path wrong
          - Tier 3 fallback also failed"
  AskUserQuestion:
    1. "📝 Manual: I will provide a list of endpoints/entities"
    2. "❌ Cancel pipeline"

  IF manual:
    Prompt user to paste data → save to docs/intel/manual-facts.yaml
    Re-merge into code-facts.json
```

## Step 1.8 — MC-1 Micro-checkpoint (absorbs old Interview R1)

See [_micro-checkpoint.md](_micro-checkpoint.md).

```
═══════════════════════════════════════════════════
 ✅ Phase 1 complete — harvested {X} routes, {Y} entities
═══════════════════════════════════════════════════

Stack detected:
  - {FE framework} ({service/s})
  - {BE framework} ({service/s})
  - DB: {from configs/integrations}
  - Auth: {detected model}

Extracted:
  - Routes: {N}   | Entities: {N}   | Auth rules: {N}
  - Integrations: {N} (of which: {X} external, {Y} DB/cache)
  - i18n: {N} locales, {K} keys
  - Tests: {N} files, {D} describe blocks
  - Warnings: {N}  (e.g. "parse fail in {file}", "tier-3 fallback used for service X")

Before Phase 2 (Feature Synthesis), any of these to guide clustering?

AskUserQuestion (max 4):
  1. "▶️ Continue — detection looks right"
  2. "🗣️ Add domain vocabulary (business VN terms) — improves feature naming"
  3. "🧩 Module boundary hint (DDD bounded context / by team / by feature)"
  4. "✏️ Fix stack/adapter detection OR add infra context (DB prod, legacy systems)"
```

### Edit handlers

- **Domain vocabulary**: collect 5-15 key business terms (VN) → save to `state.config.interview_context.domain_vocabulary` → Phase 2 naming prompt includes them
- **Module boundary hint**: ask "How are services/modules organized? Options: DDD bounded context / team ownership / feature cohesion / historical (no clear rule)" → weight clustering accordingly in Phase 2
- **Fix/infra context**: two sub-options — (a) adapter override (remove false-positive, add manual) → re-run relevant extractor; (b) add infra claims (DB prod version, Redis purpose, legacy integrations to mark) → write to `stack-context.md` + update `code-facts.integrations[].classification`

Iteration bound: 2.

### Special case: all adapters NONE

If Phase 1 produced 0 routes AND 0 entities AND all adapters detected NONE:
- Force checkpoint (cannot auto-continue)
- Options: (1) Tier 3 LLM fallback (reads entry points) / (2) User manually provides routes+entities in YAML / (3) Cancel
- No "Continue" default — require explicit decision

## Step 1.9 — Write stack-brief.md (LLM, small)

After MC-1 forward context captured:

```
Agent(subagent_type: code-intel, prompt: "task=write-stack-brief")
```

Composes `docs/intel/stack-brief.md` using code-facts + stack-context (from MC-1 edits) + interview_context. Every claim carries `source:`.

## Step 1.10 — State update + exit print

```
Update state.steps["1"].completed_at = now
state.steps["1"].sub = {1a..1g: done}
state.steps["1"].mini_gate = { iterations: N, forward_context_keys: [...] }
state.current_step = "2"
Flush state

Print: "✅ Phase 1 complete. Stack confirmed, intel captured.
        ▶️ Next: Phase 2 Feature Synthesis"
```
