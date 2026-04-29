# Stage 4 — Orchestrator

**Stage**: 4 SYNTHESIS
**Predecessor**: Stage 2 + (Stage 3 if HDSD)
**Successor**: Stage 5 quality

**ROLE**: Conductor. Write shared fields + dispatch 5 specialist sub-agents + merge + validate.

**INPUTS** (Stage 1+2 outputs):
- `{DOCS_PATH}/intel/actor-registry.json`     (Stage 1.2 — role catalog ★)
- `{DOCS_PATH}/intel/system-inventory.json`   (Stage 1.1 — stack/services)
- `{DOCS_PATH}/intel/domain-skeleton.json`    (Stage 1.3 — modules)
- `{DOCS_PATH}/intel/data-model.json`         (Stage 2.1 — entities, rules, state machines)
- `{DOCS_PATH}/intel/feature-catalog.json`    (Stage 2.2 — features role-tagged)
- `{DOCS_PATH}/intel/sitemap.json`            (Stage 2.3 — workspace, menu, workflow_variants — multi-role only)
- `{DOCS_PATH}/intel/code-facts.json`         (Stage 2.4 — deterministic)
- `docs/intel/test-evidence/{feature-id}.json` (CD-10 canonical, Stage 3, if hdsd — replaces legacy `screenshot-map.json`)
- `{DOCS_PATH}/intel/screenshot-validation.json` (Stage 3b, if hdsd; per-run working file)

**OUTPUT**: `{DOCS_PATH}/output/content-data.json` (merged from 6 specialist partials)

**MODEL**: Orchestrator uses Sonnet. Specialists use per-spec (see table below).

---

## Confidence-aware execution (NEW)

Each intel entry (`actor-registry.roles[]`, `feature-catalog.features[]`, `permission-matrix.permissions[]`, `sitemap.routes[]`) carries a `confidence` field (`high|medium|low|manual`). Specialists MUST read this field before rendering and route per `notepads/confidence-routing.md`. Key rules:

- `high|manual` → render normally
- `medium` → render + cite source from `evidence[]`
- `low` → emit `[CẦN BỔ SUNG: verify <field>]` for narrative; **BLOCK** for normative claims (TKCS security/role gating)
- unset (legacy) → log warning, render normally (back-compat)

Stage 5b Pass 6 collects `low_confidence_critical[]` from validation-report.json — if non-empty, escalate via Gate B.

---

## Specialist registry

| ID | Phase file | Block | Model | Parallel group |
|---|---|---|---|---|
| `shared` | `s4a-write-shared.md` | project, meta, dev_unit, overview, diagrams | sonnet | Must run FIRST |
| `tkkt` | `s4b-write-tkkt.md` | architecture.* | opus | Group A (parallel) |
| `tkcs` | `s4c-write-tkcs.md` | tkcs.* | opus | Group A (parallel) |
| `tkct` | `s4d-write-tkct.md` | tkct.* | opus | Group A (parallel) |
| `hdsd` | `s4e-write-hdsd.md` | services, troubleshooting | sonnet | After Group A |
| `xlsx` | `s4f-write-xlsx.md` | test_cases.ui, test_cases.api | sonnet | After hdsd |

---

## Execution DAG

```
03a (shared) → REQUIRED FIRST
  │
  ├→ Group A PARALLEL: 03b (tkkt), 03c (tkcs), 03d (tkct)
  │
  ├→ 03e (hdsd) — AFTER group A (reads architecture.components)
  │
  └→ 03f (xlsx) — AFTER 03e (reads services.features)

Final: 03g (depth-pass) → 03.5 (quality-gate) → Phase 4
```

---

## Dispatch pattern

### Claude Code (parallel)

Single message, 3 Agent calls for Group A — **MUST be foreground (no `run_in_background`)**:
```
Agent(subagent_type="tdoc-tkkt-writer",       # ★ specialist (Khung KT CPĐT 4.0 / QĐ 292/2025)
      run_in_background=false,                 # ★ explicit — Stop button must interrupt
      prompt="EXECUTE phases/s4b-write-tkkt.md. SLUG=<slug>. DOCS_PATH=<path>. MAX_INTERNAL_LOOPS=3.")
Agent(subagent_type="tdoc-tkcs-writer",       # ★ specialist (NĐ 45/2026 §13 + NĐ 85/2016 + TT 04/2020)
      run_in_background=false,
      prompt="EXECUTE phases/s4c-write-tkcs.md. SLUG=<slug>. DOCS_PATH=<path>. MAX_INTERNAL_LOOPS=3.")
Agent(subagent_type="tdoc-tkct-writer",       # ★ specialist (NĐ 45/2026 §14 outline-anchored)
      run_in_background=false,
      prompt="EXECUTE phases/s4d-write-tkct.md. SLUG=<slug>. DOCS_PATH=<path>. MAX_INTERNAL_LOOPS=3.")
```

**Note** (post-2026-04-28): All 3 design docs use specialist agents. Each loads its
respective audience-profile + outline (where applicable) + section_schema + intel,
enforces specificity mandate + diversity self-check + banned-jargon hard-block.
Generic `tdoc-data-writer` retained ONLY for HDSD + xlsx (Stage 4e + 4f) where
deterministic synthesis is appropriate.

**Background dispatch is FORBIDDEN for Stage 4 writers** — reason: writers run an internal
`merge_content() → fix → re-merge` loop. If the loop hangs (insufficient intel, unsatisfiable
warnings), background sub-agents continue consuming tokens AFTER the user presses Stop.
Foreground dispatch + `MAX_INTERNAL_LOOPS=3` ensures Stop is responsive AND token budget
is bounded.

`run_in_background=true` is only allowed for Stage 1/2/3 research+capture agents whose work
is naturally bounded (file I/O, fixed-step Playwright runs).

Wait all 3 → dispatch 03e → wait → dispatch 03f.

### Cursor (sequential)

User switches Custom Mode per specialist, main chat executes phase file:
```
Mode "TKKT Writer" → execute s4b-write-tkkt.md
Mode "TKCS Writer" → execute s4c-write-tkcs.md
Mode "TKCT Writer" → execute s4d-write-tkct.md
Mode "HDSD Writer" → execute s4e-write-hdsd.md
Mode "xlsx Writer" → execute s4f-write-xlsx.md
```

---

## Orchestrator steps

### 0. Pre-flight checks (BLOCKING — do not proceed if any fail)

```python
# 0a. MCP health probe
code = curl.exe -s -o /dev/null -w "%{http_code}" --max-time 2 "$MCP_URL"
if code != "200":
    BLOCK — "MCP offline (code={code}). Fix: docker compose up -d. Then retry."

# 0b. Verify code-facts.json is valid and non-empty
# FIX: code-facts schema uses key "stack" (not "tech_stack"). Accept either for back-compat.
facts = read("{DOCS_PATH}/intel/code-facts.json")
stack = facts.get("stack") or facts.get("tech_stack") or {}
stack_count = len(stack) if isinstance(stack, dict) else len(stack or [])
if not facts or stack_count < 3:
    BLOCK — "code-facts.json missing or has < 3 stack entries. Re-run Phase 1b before Phase 3."
    # Specialists hallucinate versions when code-facts is empty — do NOT proceed.

# 0c. Verify Stage 1+2 outputs exist
required = ["actor-registry", "system-inventory", "domain-skeleton",
            "data-model", "feature-catalog", "code-facts"]
missing = [f for f in required if not exists(f"{DOCS_PATH}/intel/{f}.json")]
if missing:
    BLOCK — f"Missing Stage 1+2 artifacts: {missing}. Re-run Stage 1+2 before Stage 4."

# 0c.1 Multi-role check: if actor-registry.multi-role:true, sitemap.json mandatory
actors = read_json(f"{DOCS_PATH}/intel/actor-registry.json")
if actors.get("multi-role") and not exists(f"{DOCS_PATH}/intel/sitemap.json"):
    BLOCK — "Multi-role detected but sitemap.json missing. Re-run Stage 2.3."

# 0c.2 Business-context check — REQUIRED per CD-10 Quy tắc 7 (block-if-missing).
# Producer chain: from-doc Phase 6 (preferred) OR from-code Phase 8 OR manual.
# generate-docs is downstream consumer — MUST NOT auto-generate stub
# (silent stub bypasses CD-10 quality gate, causes degraded TKCS prose).
bc_path = f"{DOCS_PATH}/intel/business-context.json"
if not exists(bc_path):
    BLOCK — (
        f"business-context.json missing at {bc_path}. CD-10 Quy tắc 7 requires this "
        f"artifact before generate-docs can run. Producer options:\n"
        f"  A. Run /from-doc on description files (PDF/DOCX) → produces business-context\n"
        f"  B. Run /from-code on existing repo → produces stub for user to enrich\n"
        f"  C. Manual: copy `~/.claude/schemas/intel/business-context.template.json`\n"
        f"     to {bc_path} and fill organization/investment/compliance facts.\n"
        f"Re-run /generate-docs after artifact present."
    )

# Quality gate — applies whenever business-context is loaded (not just TKCS).
# Producers (from-doc, from-code) write rich content; only manual edits create
# under-filled cases. Hard-stop here protects all 3 design docs (TKKT/TKCS/TKCT).
bc = read_json(bc_path)
bc_str = json.dumps(bc, ensure_ascii=False)
pending = bc_str.count("CẦN BỔ SUNG")
numeric_values = len(re.findall(r"\d+", bc_str))

# TKCS has strictest threshold (audience-profile.validation.current_state_min_numbers=10
# applies to §2 alone, so total business-context needs ≥15 numerics for safety margin).
if "tkcs" in dispatch_list:
    if pending > 30 or numeric_values < 15:
        BLOCK — (
            f"business-context.json under-filled for TKCS: {pending} [CẦN BỔ SUNG] "
            f"markers, {numeric_values} numeric values (need ≥15). "
            f"Fix: enrich business-context.json with: investment.total_investment_billion_vnd, "
            f"current_system metrics (user counts, transaction volumes, downtime hours), "
            f"compliance_requirements.security_level_attt.level. Re-run after enrichment."
        )

# TKKT/TKCT have looser threshold but still need org + tech_stack + integrations.
if any(x in dispatch_list for x in ("tkkt", "tkct")):
    required_keys = ["organization", "current_system", "external_integrations"]
    missing = [k for k in required_keys if k not in bc or not bc.get(k)]
    if missing:
        BLOCK — (
            f"business-context.json missing required keys for TKKT/TKCT: {missing}. "
            f"These keys feed audience-profile.intel_sources.business_context.allow_fields. "
            f"Fix: populate keys in business-context.json. Re-run after fix."
        )

# 0d. Initialize specialist-errors.md (will be appended by failure handlers)
write("{DOCS_PATH}/intel/specialist-errors.md",
      "# Specialist Errors\n\nGenerated by Phase 3 orchestrator.\n\n")

# 0d.1. Build per-audience briefings BEFORE dispatching writers.
# This is the SINGLE most important step in Stage 4 — it converts raw intel
# (50KB+ of JSON) into per-audience briefing.md files (~6KB each, framed for
# the persona). Writers then consume ONLY their briefing, never raw intel.
#
# Without this step, writers @Files raw intel → mirror technical content →
# produce "rác kỹ thuật" (route paths, framework names, HTTP codes leak into
# audience-inappropriate docs). See ADR: skill briefing pattern.
SKILL_DIR = "~/.claude/skills/generate-docs"
BRIEFING_BUILDER = f"{SKILL_DIR}/engine/briefings/briefing_builder.py"

for audience in dispatch_list:                           # filtered above (step 1)
    Bash(
        f"PYTHONIOENCODING=utf-8 python {BRIEFING_BUILDER} "
        f"  --audience {audience} "
        f"  --intel-dir {DOCS_PATH}/intel "
        f"  --out      {DOCS_PATH}/intel/_briefings/{audience}.md"
    )

# Verify all briefings built. Missing briefing → block dispatch.
for audience in dispatch_list:
    bp = f"{DOCS_PATH}/intel/_briefings/{audience}.md"
    if not exists(bp):
        BLOCK — f"Briefing build failed for {audience}: {bp} not created. Inspect briefing_builder logs."

# 0e. Initialize orchestrator state file (NEW — survives main-agent compaction).
# Purpose: persist current_state + per-specialist iteration count after each merge,
# so resume-document can pick up mid-stage without losing progress.
state_path = f"{DOCS_PATH}/output/_orchestrator_state.json"
if not exists(state_path):
    write_json(state_path, {
        "schema_version": "1.0",
        "stage": 4,
        "started_at": now_iso(),
        "current_state": {},
        "specialists": {
            sid: {"status": "pending", "iterations": 0, "last_warnings": []}
            for sid in dispatch_list
        }
    })
```

### 1. Filter specialists by export_targets

```
if "tkkt" in targets: dispatch_list += ["tkkt"]
if "tkcs" in targets: dispatch_list += ["tkcs"]
if "tkct" in targets: dispatch_list += ["tkct"]
if "hdsd" in targets: dispatch_list += ["hdsd"]
if "xlsx" in targets or "hdsd" in targets: dispatch_list += ["xlsx"]
# (always run shared regardless)
```

### 2. Run 03a shared (orchestrator direct, no subagent)

READ `phases/s4a-write-shared.md`, execute inline.

### 3. Dispatch specialists per DAG

For each dispatched specialist, after completion — **inline merge + auto_validate**:

```python
# MCP v1.0.0+ API: pure inline, returns merged_data + validation in one call
result = mcp__etc-platform__merge_content(
    current_data=current_state,            # dict — pass {} for first merge
    partial=specialist_output,             # dict — block from this writer
    auto_validate=True,                    # default: include validation in response
)

# Response shape:
# {
#   "success": true,
#   "merged_data": {...},                  ← persist this for next iteration
#   "validation": {
#     "valid": true/false,
#     "errors":   [...],                   ← blocking schema violations
#     "warnings": [...],                   ← quality issues
#     "dod_met":  true/false,              ← computed: errors=[] AND no blocking warnings
#     "action_required": "..."
#   }
# }

# Update orchestrator state
current_state = result["merged_data"]

# Route + re-dispatch if needed
v = result["validation"]
if not v["dod_met"]:
    ROUTE blocking issues to owning specialist (see routing table in step 4.5)
    new_partial = re-dispatch_specialist(issues=v["errors"] + v["warnings"])
    # Loop: re-merge with current_state + new_partial, re-check dod_met
```

**State management** (orchestrator-side):
- Hold `current_state` dict in memory throughout Stage 4.
- Each writer's output → `partial` → merge → updated `current_state`.
- After all specialists done: `current_state` is the final content_data → pass to Stage 6 export.

Each specialist MUST iterate until `result["validation"]["dod_met"] == True`.

**Handling specialist failure modes:**

```python
# After specialist returns, check BOTH merge feedback AND specialist status:

if specialist_return["status"] == "blocked":
    # Specialist hit max iterations and cannot fix remaining warnings
    append_to("{DOCS_PATH}/intel/specialist-errors.md",
        f"## {specialist_id} BLOCKED\n"
        f"Remaining warnings: {specialist_return['remaining_warnings']}\n"
        f"Action: provide more intel or accept placeholders\n\n")
    PROMPT user:
        "Specialist {specialist_id} is blocked on: {remaining_warnings}
         Options:
           A) Provide more source intel → re-dispatch
           B) Accept placeholders → add to whitelist, continue
           C) Abort Phase 3"
    # Do NOT silently proceed with partial content

if specialist_return["status"] == "error":
    # JSON parse failure or crash — retry once with error context
    if retry_count >= 2:
        append_to("{DOCS_PATH}/intel/specialist-errors.md", ...)
        BLOCK — user inspects specialist-errors.md
```

### 4. Cross-reference validation

After all specialists merge, verify:
- `len(architecture.components)` consistent with `tkct.modules` mapping
- `architecture.data_entities[].name` == `tkct.db_tables[].name` (unioned)
- `architecture.apis[].path` ⊇ `tkct.api_details[].path`
- `services[].features[].id` union == `test_cases.ui[].feature_id` union

Conflicts → TKKT wins for architecture facts. Report in `{DOCS_PATH}/intel/merge-conflicts.md`.

**Conflict resolution — which specialist to re-dispatch:**

| Conflict | Winner | Re-dispatch | Fix hint |
|---|---|---|---|
| `architecture.components` count ≠ `tkct.modules` count | TKKT | **TKCT** | "Align tkct.modules to match architecture.components names and count: {list}" |
| `architecture.data_entities` names ≠ `tkct.db_tables` names | TKKT | **TKCT** | "Rename/add db_tables to match architecture.data_entities: {diff}" |
| `architecture.apis` paths not in `tkct.api_details` | TKKT | **TKCT** | "Add missing API paths to tkct.api_details: {missing}" |
| `services[].features[].id` ≠ `test_cases.ui[].feature_id` | HDSD | **xlsx** | "Fix feature_id references to match HDSD feature IDs: {mapping}" |

Re-dispatch the losing specialist with the specific fix hint. Do NOT silently accept the mismatch.

### 4.5. MCP validate + autofix loop (MANDATORY, UNCAPPED)

Applies the **Definition of Done (DoD)** in `SKILL.md`: a block is `done` only when
`validate()` returns both `errors=[]` and `warnings=[]` (or whitelisted warnings only).

```
mcp__etc-platform__validate(content_data=current_state)
```

Returns `{valid, errors[], warnings[], stats}`. Beyond Pydantic schema, `warnings[]`
covers 3 quality-check phases:

| Phase | Warning class | Routing (specialist to re-dispatch) |
|---|---|---|
| 1 Integrity | `orphan filename reference`, `contains Mermaid source instead of filename`, `orphan diagram source`, `module missing flow_diagram` | `diagrams.*` → `shared` or module owner; `{block}.*_diagram` → block owner |
| 2 Quantity | `N words < M required`, `N legal refs < 7`, `banned phrase 'X'`, `placeholders > max` | `architecture.*` → `tkkt`, `tkcs.*` → `tkcs`, `tkct.*` → `tkct` |
| 3 Semantic | `missing N/5 ATTT groups`, `missing 'cấp độ N'`, `business_overview lacks 5 CPĐT layers`, `NFR not measurable` | `tkcs.security_*` → `tkcs`; `architecture.business_overview/nfr` → `tkkt` |

### Loop (HARD CAP — was uncapped, caused stuck pipeline)

```
MAX_ITERS_PER_SPECIALIST = 3        # absolute ceiling per specialist
MAX_GLOBAL_ITERS = 12               # safety net across all specialists
no_progress_streak = 0
prev_blocking_count = None
global_iter = 0

while True:
    global_iter += 1
    if global_iter > MAX_GLOBAL_ITERS:
        ESCALATE_USER("Global iteration cap reached. Pipeline cannot satisfy validate().")
        break

    result = validate(path)
    blocking = result.errors + [w for w in result.warnings if not whitelisted(w)]
    if blocking == []:
        break  # DoD met

    # Track no-progress
    if prev_blocking_count is not None and len(blocking) >= prev_blocking_count:
        no_progress_streak += 1
    else:
        no_progress_streak = 0
    prev_blocking_count = len(blocking)

    if no_progress_streak >= 2:
        ESCALATE_USER(
            "2 consecutive iterations without reducing blocking warnings. "
            "Likely cause: source intel insufficient. Options: "
            "(A) provide more intel, (B) accept whitelist, (C) abort."
        )
        break

    for specialist_id, issues in route(blocking):
        # Per-specialist hard cap
        st = read_state()["specialists"][specialist_id]
        if st["iterations"] >= MAX_ITERS_PER_SPECIALIST:
            append_to("{DOCS_PATH}/intel/specialist-errors.md",
                f"## {specialist_id} CAPPED at {MAX_ITERS_PER_SPECIALIST} iters\n"
                f"Remaining: {issues}\n")
            ESCALATE_USER(f"{specialist_id} hit {MAX_ITERS_PER_SPECIALIST}-iter cap.")
            continue  # skip — do not re-dispatch

        re-dispatch specialist with:
          - previous output (context)
          - specific issues list
          - hint: "Fix EVERY issue. Return only when validate() is clean for your block."
        new_output = wait_specialist()
        result = merge_content(new_output)

        # Persist state after EACH merge (survive main-agent compaction)
        update_state({
            "current_state": result["merged_data"],
            f"specialists.{specialist_id}.iterations": st["iterations"] + 1,
            f"specialists.{specialist_id}.last_warnings": [w for w in result["validation"]["warnings"]],
            f"specialists.{specialist_id}.status": "done" if result["validation"]["dod_met"] else "looping",
            "last_merge_at": now_iso(),
        })
```

**State persistence contract (NEW)**: After every `merge_content()` call, orchestrator
MUST write `current_state` + per-specialist counters to `output/_orchestrator_state.json`.
This lets `resume-document` reconstruct mid-stage progress instead of restarting
Stage 4 from scratch when the main agent is compacted or session is interrupted.

If 2 consecutive loops fail to reduce `len(blocking)` →
escalate to user:

- Print full warning list
- Ask: is intel source complete? Accept placeholders?
- User decides: provide more intel | accept placeholder (add to whitelist) | block Phase 4

### Whitelist (see SKILL.md DoD)

4 warning classes allowed to pass:

1. Business-only fields (TKCS Section 10/11) when `[CẦN BỔ SUNG: ...]`
2. `features_without_test_cases` before Stage 4f xlsx runs
3. `priority_distribution` stats
4. Module `flow_diagram` missing when TKCT does not require rendering that module

All other warnings → **MUST FIX**, no exception.

Stats to track: `result.stats["quality_warnings_count"]`. Target at exit: `= 0` (or whitelisted-only).

### 4.7. Guard — verify 03e complete before dispatching 03f

Before dispatching xlsx specialist (03f), verify 03e output is actually in content-data.json:

```python
data = read content-data.json
services = data.get("services", [])
feature_count = sum(len(svc.get("features", [])) for svc in services)

if feature_count == 0:
    BLOCK — "03e did not merge, or merged empty services[]. Re-dispatch 03e before proceeding."

if any(svc.get("slug") == "" for svc in services):
    WARN — "03e may have merged incomplete service stubs. Verify with user before 03f."

# Additional checks for xlsx dependency correctness:
all_feature_ids = [
    f.get("id", "")
    for svc in services
    for f in svc.get("features", [])
]
empty_ids = [i for i, fid in enumerate(all_feature_ids) if not fid]
if empty_ids:
    BLOCK — f"Features at indices {empty_ids} have empty id. Fix in 03e before dispatching 03f.
             xlsx will generate TCs with empty feature_id, breaking Stage 5b Pass 6 TC scaling."

duplicate_ids = [fid for fid in all_feature_ids if all_feature_ids.count(fid) > 1]
if duplicate_ids:
    BLOCK — f"Duplicate feature IDs found: {set(duplicate_ids)}. Fix in 03e — IDs must be unique."
```

Only dispatch 03f when: `feature_count > 0` AND all services have non-empty slugs AND all features have unique, non-empty IDs.

### 5. Run 03g depth-pass

READ `phases/s5a-depth-pass.md`, iterate short sections.

### 6. Run 03.5 quality gate

READ `phases/s5b-quality-gate.md`, execute passes (MCP validate primary, quality_score.py supplementary).

### 7. Composer exit (MANDATORY)

Propose `content-data.json` via Composer, wait user accept.

---

## Return schema to main pipeline

```json
{
  "phase": 3,
  "orchestrator_status": "done",
  "specialists": {
    "shared":  {"status": "done", "words": 3200, "diagrams": 12},
    "tkkt":    {"status": "done", "words": 4800, "nfr_count": 6, "placeholders": 2},
    "tkcs":    {"status": "done", "words": 8500, "legal_refs": 9, "placeholders": 12},
    "tkct":    {"status": "done", "modules": 5, "tables": 12, "apis": 45},
    "hdsd":    {"status": "done", "features": 28, "features_excluded": 2, "screenshots_ref": 112},
    "xlsx":    {"status": "done", "ui_tcs": 520, "api_tcs": 270}
  },
  "merge_conflicts": 0,
  "content_data_tokens": 94000,
  "runtime_seconds": 220
}
```

---

## Failure recovery

- Specialist returns invalid JSON → retry once with error context
- Specialist fails twice → abort, user inspects `intel/specialist-errors.md`
- Merge conflict TKKT↔TKCT → TKKT wins, log in conflicts file
- Cross-ref FAIL → surface, re-dispatch specific specialist with fix hints

---

## Anti-patterns

- ❌ Dispatch specialists sequentially when parallel possible (Claude Code)
- ❌ Let specialists write full content-data (each owns ONE block only)
- ❌ Skip cross-reference validation
- ❌ Merge before all Group A specialists complete
- ❌ Run xlsx before hdsd (dependency violation)
