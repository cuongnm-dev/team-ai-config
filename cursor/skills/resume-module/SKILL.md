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
| `error.code = MCP_E_NOT_FOUND` | Compute Levenshtein distance to all module IDs in catalog; suggest top 3 ≤ 3 distance. Else: "Module {id} not found. Use `/new-module` to create." |
| `result.data.resolved_via_alias = true` | Display alias info: legacy F-NNN → canonical M-NNN per `id-aliases.json` |

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

### 3c. Dependency check (`depends_on`)

Read module-catalog. For each `depends_on` M-NNN:
```
resolve_path(kind='module', id=dep) + read its _state.md.status
```
If any dep `status != done` → ask user: wait, override (set sync-warning), or cancel.

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
| `depends_on` deps not done | Display deps + status, ask wait/override |
| Legacy F-NNN ID provided | Auto-resolve via id-aliases.json → M-NNN, inform user |
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
