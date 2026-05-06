---
name: resume-module
description: Tiếp tục pipeline SDLC của 1 module (M-NNN) đang dở từ checkpoint cuối. Đọc M-NNN/_state.md, dispatch PM agent loop tự động giao việc cho đúng stage agent (ba/sa/designer/security/tech-lead/qa/reviewer), có cơ chế escalation khi gặp blocker. Trigger - module-id đang in-progress hoặc blocked; muốn advance qua stage tiếp theo. Anti-trigger - module chưa tạo thì /new-module; tất cả features đã done thì /close-feature từng feature; muốn xem status thì /feature-status; muốn dispatch 1 feature cụ thể thì /resume-feature F-NNN. Example - "/resume-module M-001" (auto-loop tới done hoặc blocked).
---

# Resume Module Pipeline

User-facing: Vietnamese. Dispatcher prompts: English.

## ⚠️ ai-kit CLI Enforcement (ADR-005)
**Path resolution + state read via ai-kit CLI. PM hand-off pattern identical to `/resume-feature`.**

| Step | ai-kit CLI command |
|---|---|
| Resolve M-NNN → folder path | `Bash("ai-kit sdlc resolve --kind module --id M-NNN")` |
| Pre-flight integrity check | `Bash("ai-kit sdlc verify --scopes structure,cross_references")` |
| State updates during pipeline | `Bash("ai-kit sdlc state update --op field|progress|kpi|log|status ...")` |
| Hand off to PM agent | `Task(pm, mode=orchestrate)` (unchanged) |

**Forbidden**:
- ❌ Glob `docs/modules/M-*/_state.md` for resolution
- ❌ Direct Write/Edit on locked-fields[] entries in `_state.md`
- ❌ Skill loops Task(dispatcher) per-stage (PM owns)

---

## ⚠️ SKILL ROLE — THIN ENTRY POINT

Steps 1-5 = setup. Step 6 = single `Task(pm)` call. PM drives pipeline end-to-end.

### Forbidden:
- ❌ Reading agent definitions, "doing the work yourself"
- ❌ Writing artifact files (`ba/`, `sa/`, etc. owned by stage agents)
- ❌ Looping `Task(dispatcher)` per-stage — deprecated 2026-05-04

### Required:
- ✅ Steps 1-5 = setup (parse args, resolve, verify, lock)
- ✅ Step 6 = single Task(pm) call
- ✅ Surface PM final verdict

---

## Step 1 — Receive input

If no arg → prompt: "Nhập module-id (M-NNN) hoặc danh sách module để chọn".

Display module-catalog summary if interactive:
```
Bash("ai-kit sdlc verify --workspace . --scopes id_uniqueness --strict info")
# parse stdout JSON for data.findings to derive module count + status
```

## Step 2 — Locate module via ai-kit CLI

```
result = Bash("ai-kit sdlc resolve --workspace . --kind module --id {module-id} --include-metadata")
parse stdout JSON for { ok, data: { path, exists, resolved_via_alias, metadata } }
```

| Result | Action |
|---|---|
| `ok=true, exists=true` | Continue Step 3 with `result.data.path` |
| `result.data.resolved_via_alias = true` | Display alias info: legacy F-NNN → canonical M-NNN per `id-aliases.json` |
| `error.code = MCP_E_NOT_FOUND` AND input matches `^F-\d+$` | Fallback: `Bash("ai-kit sdlc resolve --kind feature --id {input} --include-metadata")`. If found nested under M-NNN (path matches `docs/modules/M-NNN-*/features/`) → read `_feature.md` `module-id` → suggest `/resume-module {parent_M}` (do NOT auto-redirect — print and exit). If found legacy (`docs/features/F-NNN-*/`) → suggest `/resume-feature {input}`. Else fall through. |
| `error.code = MCP_E_NOT_FOUND` AND input matches `^H-\d+$` | Fallback: input is a hotfix ID — suggest `/resume-feature {input}` (resume-module does not handle hotfix). Exit. |
| `error.code = MCP_E_NOT_FOUND` (default) | Compute Levenshtein distance to all module IDs in catalog; suggest top 3 ≤ 3 distance. Else: "Module {id} not found. Use `/new-module` to create." |

**Advisory lock**: Check `{module_path}/.resume-lock`:
- Exists, < 10min old → ask user: wait or force-takeover
- Create lock (session-id + timestamp) before proceed
- Delete lock on every exit path

## Step 3 — Parse + validate `_state.md`

Read `{module_path}/_state.md`. Validate frontmatter:
- Required: `feature-id` (= module_id), `feature-name`, `pipeline-type: sdlc`, `status`, `current-stage`, `stages-queue`, `docs-path`, `intel-path`, `repo-type`
- Status must be `in-progress` or `blocked`. If `done` → refuse (corrupts sealed state). If `proposed` → suggest `/new-module` to start.

### 3a. Pre-flight integrity verify

```
Bash("ai-kit sdlc verify --workspace . \
  --scopes structure,cross_references \
  --strict warn \
  --context '{\"current_stage\": \"<state.current_stage>\", \"feature_id\": \"<module_id>\"}'")
```

If HIGH findings → display + ask user: continue or fix first.

### 3b. Worktree alignment (Cursor 3+ native)

Same logic as `/resume-feature` §3.1a:
- `_state.md.worktree-path` set vs `$ROOT_WORKTREE_PATH` env var
- Backfill or warn on mismatch

### 3c.1 — Module-level dependency check (`module-catalog.depends_on`)

Read `module-catalog.json`. For each `depends_on` M-NNN of `{module_id}`:

```
resolve_path(kind='module', id=dep) + read its _state.md.status
```

**Cycle detection (DFS)** — build directed graph from `module-catalog[*].depends_on`. Run DFS starting at `{module_id}`. If cycle found:

```
STOP blocker MOD-CYCLE-001:
  "Cyclic module dependency: {cycle_path}.
   Edit module-catalog.json depends_on to break cycle."
next-action: edit docs/intel/module-catalog.json
EXIT (no lock created — config error)
```

**Blocked deps**:

| dep status | Action |
|---|---|
| `done` | OK, continue |
| `in-progress` / `blocked` | Ask user: A) wait (`/resume-module {dep}` first), B) override (set `sync-warning: true`), C) cancel |
| `proposed` | Ask user: A) `/new-module {dep}` then resume, B) override, C) cancel |
| dep missing in catalog | STOP `MOD-DEP-MISSING-001` — config error, list missing IDs, `next-action: edit docs/intel/module-catalog.json` |

### 3c.2 — Cross-cutting feature dependency check (CD-24 reverse-lookup)

Per CD-24 in `~/.claude/CLAUDE.md`, features owned by other modules but consumed by `{module_id}` must be implemented BEFORE `{module_id}` enters dev waves. Catalog reverse-lookup:

```
read feature-catalog.json
consumed_features_pending = []

FOR each feature in feature-catalog.features:
  IF {module_id} IN feature.consumed_by_modules[]
     AND feature.status != "implemented":
    consumed_features_pending.append({
      feature_id:    feature.id,
      feature_name:  feature.name,
      owner_module:  feature.module_id,
      current_status: feature.status,
      readiness:     feature.readiness    # CD-13 — may be missing on legacy entries
    })
```

**Stage-aware enforcement** — only block on stages that produce code touching consumed features. Map current-stage to action:

| current-stage | Pending consumed-feature action |
|---|---|
| `ba` / `sa` / `designer` | WARN — print pending list, allow continue (analysis stages can document the dependency) |
| `tech-lead` | ASK — tech-lead plan must reference how `{module_id}` calls into pending features. Default: wait. |
| `dev-wave-*` / `qa-wave-*` / `security-design` / `security-review` | BLOCK — these stages assume consumed features are implemented |
| `reviewer` | BLOCK — reviewer cannot Approve when consumed deps are non-`implemented` |

**On BLOCK or ASK**:

```
Print Vietnamese to user:
  "⚠ Module {module_id} đang ở stage {current-stage} (cần consumed feature implemented).
   {N} cross-cutting features chưa sẵn sàng (CD-24):
     - {feature_id} ({feature_name}): owner {owner_module}, status {current_status}
     ...
   Options:
     A) Wait — chạy /resume-module {owner_module} cho từng owner trước
     B) Override — set sync-warning: true, tiếp tục (rủi ro integration drift, sẽ bị reviewer block sau)
     C) Cancel"
next-action (default): /resume-module {first owner_module by topological order}
```

If user picks Override, write to `_state.md` frontmatter:
```yaml
sync-warnings:
  - type: cross-cutting-feature-pending
    features: [F-NNN, F-NNN, ...]
    overridden-at: <ISO timestamp>
```

Reviewer stage MUST read `sync-warnings[]` and refuse Approved verdict if any cross-cutting deps still non-`implemented` at that point.

**Topological hint** — when suggesting `next-action`, order pending owner modules by their own `depends_on` chain so user resumes in valid order.

## Step 4 — Display status

```
## Pipeline: {module_name}
Module ID: {module_id}
Stage:     {current-stage}
Stages-queue: {stages-queue}
Done:      {completed-stages keys}
Features:  {feature_ids count} ({F-NNN list, first 5 + "..." if more})
Blockers:  {blocked-by | "không có"}
```

### 4b. Clarification answer check

If `clarification-notes` non-empty AND no `User answer:` line:
```
⚠️ PM đã hỏi: {question}
options:
  A) Trả lời
  B) Dừng (/resume sau)
  C) Rollback stage
```
Same handling as `/resume-feature` §4b.

## Step 5 — Distill conversation (optional)

Silent review for unpersisted decisions (scope changes, agreed directions). Skip if nothing relevant.

## Step 6 — Hand off to PM (single Task call)

Build the Orchestrate prompt (4-block, cache-aware mirror `resume-feature` §6.1):

```
## Agent Brief
You are PM in Orchestrate mode. Mission: drive module pipeline to completion. See ~/.cursor/agents/pm.md § Orchestrate Mode.

## Mode
orchestrate

## Project Conventions
{≤5 lines from rules/40-project-knowledge.mdc; "(none)" if absent}

## Feature Context
feature-id:        {module_id}
feature-name:      {module_name}
pipeline-type:     sdlc
docs-path:         {module_path}
repo-path:         {worktree-path if set, else "."}
intel-path:        docs/intel
worktree-mode:     {true/false}
worktree-branch:   {branch or "(none)"}
output-mode:       {output-mode}
pipeline-path:     {risk_path: S | M | L}

## Inputs
session-context:   {distilled context from Step 5; else "(none)"}
```

Call `Task(subagent_type="pm", prompt=prompt_above)` ONCE.

PM Orchestrate Mode:
- Reads `_state.md`, dispatches `Task(specialist)` per stage in queue
- Validates artifacts via `verify(scopes=['completeness', 'schemas'])`
- Updates `_state.md` via `update_state` MCP tool
- Loops until `done | hard-blocked | user-needed | iter≥200`

## Step 7 — Surface result

| `result.status` | Surface |
|---|---|
| `done` | "✅ Module {module_id} pipeline hoàn tất — {final_verdict}". Suggest `/close-feature` cho từng F-NNN trong module |
| `blocked` | "❌ Pipeline blocked: {blockers[].description}". Suggest fix |
| `user-needed` | "⚠ PM cần thông tin: {clarification_notes}". Re-run `/resume-module {id}` after answer |
| `iter≥200` | "⚠ Pipeline hit safety cap. State preserved at {final_stage}. Re-run if healthy" |

Release advisory lock on every exit path.

---

## Edge cases

| Condition | Action |
|---|---|
| `_state.md` not found | Map-fuzzy suggest if catalog has similar IDs; else "use `/new-module`" |
| `status: done` | Refuse — module sealed; display feature_ids for `/close-feature` if needed |
| `status: proposed` | Suggest `/new-module {id}` to start fresh OR set status to `in-progress` manually |
| `depends_on` deps not done (3c.1) | Display deps + status, ask wait/override/cancel |
| Cyclic `depends_on` chain (3c.1 DFS) | Blocker `MOD-CYCLE-001` → `next-action: edit docs/intel/module-catalog.json` |
| `depends_on` references unknown M-NNN | Blocker `MOD-DEP-MISSING-001` — config error |
| Cross-cutting feature pending (3c.2 CD-24) | Stage-aware: BA/SA/Designer warn-only, Tech-lead ask, Dev/QA/Security/Reviewer block. Default `next-action: /resume-module {owner_M topological-first}` |
| User overrides cross-cutting block | Write `sync-warnings[]` entry to `_state.md`. Reviewer reads + refuses Approved if still non-implemented at review time |
| Legacy F-NNN ID with alias entry | Auto-resolve via id-aliases.json → M-NNN, inform user |
| F-NNN ID without alias (post-ADR-003 nested) | Step 2 fallback resolves as feature → suggests `/resume-module {parent_M}` (read `_feature.md.module-id`) |
| H-NNN ID provided | Step 2 fallback suggests `/resume-feature {H-NNN}` (resume-module does not own hotfix flow) |
| MCP server down | BLOCK — `docker compose up -d` from `~/.ai-kit/team-ai-config/mcp/etc-platform/` |

---

## What's next

| Type | Outcome | Next |
|---|---|---|
| sdlc | All module stages done | `/close-feature` cho từng F-NNN trong feature_ids |
| sdlc | Blocker | `/feature-status {id}` for inspection |
| sdlc | User-needed | Answer in `clarification-notes`, re-run `/resume-module {id}` |
| sdlc | Module sealed (all features done) | `/retrospective` per project lifecycle |

Reference: `D:\AI-Platform\maintainer-notes\adr\ADR-003-sdlc-2tier-module-feature.md` D8/D11 + `plans/p0-mcp-tool-spec.md` §3.7 (resolve_path) + §3.9 (update_state).
