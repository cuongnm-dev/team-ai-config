---
name: new-module
description: Khởi tạo module SDLC mới (M-NNN) cho project có sẵn. Hỏi metadata, gọi MCP scaffold_module atomic, hand off PM agent cho stage ba. Trigger - thêm bounded context/domain mới vào project; "tạo module mới"; M-NNN chưa tồn tại trong module-catalog. Anti-trigger - module đã tồn tại in-progress/blocked thì /resume-module; cả project mới (chưa có docs/modules/) thì /from-doc hoặc /from-code hoặc /from-idea; thêm feature vào module có sẵn thì /new-feature. Example - "/new-module M-021" hoặc "/new-module" (auto-suggest next ID).
---

# Module Entry Point — Single-module incremental scaffold

User-facing output: Vietnamese. Artifact files and dispatcher prompts: English.

## ⚠️ ai-kit CLI Enforcement (ADR-005)
**MUST call `Bash("ai-kit sdlc scaffold module ...")` for atomic create.** Skill = thin entry point.

| Step | ai-kit CLI command |
|---|---|
| Validate ID/slug uniqueness | `ai-kit sdlc verify --scopes id_uniqueness --strict block` |
| Atomic create folder + catalog + map | `ai-kit sdlc scaffold module --id M-NNN --name "..." --slug ... ...` |
| Verify post-scaffold | `ai-kit sdlc verify --scopes structure,cross_references` |
| Hand off to PM for ba stage | `Task(pm, mode=orchestrate)` |

**Forbidden** per ADR-005 D3:
- ❌ Write tool for `_state.md` / `module-brief.md` / `implementations.yaml`
- ❌ mkdir for `docs/modules/**`
- ❌ Direct edit of `module-catalog.json` / `module-map.yaml`

---

## ⚠️ SKILL ROLE — THIN ENTRY POINT

Steps 1-4 = setup (gather inputs, MCP scaffold). Step 5 = single `Task(pm)` call. Surface PM verdict.

### Forbidden:
- ❌ Reading `ba.md`/`sa.md`/`dev.md` agent definitions and "doing the work yourself"
- ❌ Writing artifact files (`ba/`, `sa/`, dev outputs, etc.)
- ❌ Re-implementing routing/validation — PM owns this

### Required:
- ✅ Steps 1-4 = ai-kit CLI-only scaffold + verify
- ✅ Step 5 = single `Task(pm)` call
- ✅ Surface PM's final verdict to user

---

## Step 1 — Detect mode (NEW | REDIRECT)

If user provides `module-id` (e.g. `/new-module M-021`):

```
result = Bash("ai-kit sdlc resolve --workspace . --kind module --id {module-id}")
parse stdout JSON
```

| Result | Action |
|---|---|
| Found + `status` ∈ `{in-progress, blocked}` | → **REDIRECT to `/resume-module {module-id}`** |
| Found + `status: done` | → ERROR refuse (sealed module; create new ID instead) |
| `error.code = MCP_E_NOT_FOUND` | → **NEW FLOW** (continue Step 2) |

No `module-id` provided → **NEW FLOW** with auto-suggest next M-NNN.

## Step 2 — NEW FLOW: gather inputs (interactive)

Read existing `docs/intel/module-catalog.json` to compute next available M-NNN (`max(numeric IDs) + 1`).

Prompt user via Cursor's interactive UI (or single-prompt batch):

| Field | Required? | Notes |
|---|---|---|
| `module_id` | yes (auto-suggest) | Format `M-NNN`. User can override suggestion |
| `module_name` | yes | English preferred for ASCII slug derivation |
| `name_en` | recommended | If `module_name` is Vietnamese, provide English alias for slug |
| `slug` | optional | If absent: `derive_slug(name_en or module_name)` per CD-22 precedence |
| `primary_service` | optional | E.g. `services/iam-service` (mono only). Maps to `implementations.yaml` |
| `depends_on` | optional | `[M-NNN, ...]` modules this depends on (FK enforced) |
| `business_goal` | yes (≥50 chars) | 1-2 sentences for `_state.md` body |
| `risk_path` | yes | `S` / `M` / `L` — controls `stages-queue` length |
| `agent_flags` | optional | Conditional inserts: `designer` if `screens > 0`, `security-design` if `pii_found`, `data-governance` if `pii > 0`, etc. |
| `tier` | optional | Tier 0/1/2/3 per project capability map |
| `mvp_wave` | optional | Wave 1/2/3 |

If user already provided JSON via `/new-module {json-blob}` syntax, parse + skip prompts.

## Step 3 — Pre-flight validate via ai-kit CLI

```
result = Bash("ai-kit sdlc verify --workspace . --scopes id_uniqueness --strict block")
parse stdout JSON
```

→ if `error.code == "MCP_E_VERIFICATION_FAILED"` → display findings, STOP. User must resolve before retry.

Also validate `depends_on`:
```
for dep in depends_on:
  Bash("ai-kit sdlc resolve --workspace . --kind module --id <dep>")
  → if `error.code = MCP_E_NOT_FOUND` → STOP with error: "depends_on <dep> not found in module-catalog"
```

## Step 4 — Scaffold atomic via ai-kit CLI

```
result = Bash("ai-kit sdlc scaffold module \
  --workspace . \
  --id <module_id> \
  --name '<module_name>' \
  --slug <slug> \
  --primary-service '<primary_service>' \
  --depends-on '<csv depends_on>' \
  --business-goal '<business_goal>' \
  --risk-path <S|M|L> \
  --agent-flags '<json agent_flags>'")
parse stdout JSON
```

CLI atomically:
- Creates `docs/modules/M-NNN-{slug}/` with `_state.md`, `module-brief.md`, `implementations.yaml`
- Creates 7 stage subdirs (ba/sa/designer/security/tech-lead/qa/reviewer) with `.gitkeep`
- Updates `module-catalog.json` (append entry)
- Updates `module-map.yaml` (append entry)
- Bumps versions in `_meta.json`

Returns manifest with `data.module_path`, `data.files_created`, `data.new_versions`.

## Step 5 — Verify post-scaffold

```
result = Bash("ai-kit sdlc verify --workspace . --scopes structure,cross_references --strict warn")
parse stdout JSON
```

If MEDIUM/HIGH findings → display warnings but proceed (these are followup polish issues).

## Step 6 — Hand off to PM (single Task call)

Build PM Orchestrate prompt (4-block cache-aware, mirror `resume-feature` §6.1):

```
## Agent Brief
You are PM in Orchestrate mode. Mission: drive module pipeline to completion. See ~/.cursor/agents/pm.md § Orchestrate Mode.

## Mode
orchestrate

## Project Conventions
{≤5 lines from rules/40-project-knowledge.mdc relevant to this module; "(none)" if absent}

## Feature Context
feature-id:        {module_id}    # field name kept for back-compat with PM parser
feature-name:      {module_name}
pipeline-type:     sdlc
docs-path:         docs/modules/{module_id}-{slug}
intel-path:        docs/intel
output-mode:       {output-mode default lean}

## Inputs
session-context:   "(none — fresh module)"
```

Call `Task(subagent_type="pm", prompt=prompt_above)` ONCE.

PM internally:
- Reads `_state.md`, dispatches `Task(specialist)` per stage
- Validates artifacts, updates `_state.md` via `update_state` MCP tool
- Loops until `done | hard-blocked | user-needed | iter≥200`

## Step 7 — Surface result

| `result.status` | Surface |
|---|---|
| `done` | "✅ Module {module_id} hoàn tất ba stage. Use `/new-feature` để thêm features hoặc `/resume-module {module_id}` cho stages tiếp" |
| `blocked` | "❌ Module pipeline blocked: {description}". Suggest fix |
| `user-needed` | "⚠ PM cần thông tin: {clarification_notes}". Re-run `/resume-module {module_id}` after answer |
| `iter≥200` | "⚠ Pipeline hit safety cap. State preserved at {final_stage}" |

---

## Edge cases

| Condition | Action |
|---|---|
| `module-id` already done | Refuse — display existing module info |
| `depends_on` references unknown M-NNN | STOP — list missing IDs, suggest fix |
| `slug` collision (different M-NNN, same slug) | STOP — `MCP_E_NAME_COLLISION` |
| `module_name` only Vietnamese, no `name_en` | WARN — slug will be transliteration; recommend providing `name_en` |
| MCP server down | BLOCK — instruct `docker compose up -d` from `~/.ai-kit/team-ai-config/mcp/etc-platform/` |

---

## What's next

| Outcome | Next |
|---|---|
| Module ba stage done | `/new-feature` to add features OR `/resume-module {id}` for sa/designer/etc. |
| Module blocker | `/feature-status {id}` for current state inspection |
| All module features added + done | `/close-feature` per feature, then module reviewer DoD via `/resume-module` |

Reference: `D:\AI-Platform\maintainer-notes\adr\ADR-003-sdlc-2tier-module-feature.md` D8/D11 + `plans/p0-mcp-tool-spec.md` §3.3.
