---
name: hotfix
description: Pipeline rút gọn dành riêng cho lỗi nghiêm trọng đã xác định rõ nguyên nhân. Bỏ qua bước phân tích nghiệp vụ (BA) và kiến trúc (SA), chạy thẳng tech-lead → dev → QA → reviewer để vá nhanh, đẩy lên production. Scope ≤3 files, max 1 wave. Trigger - bug prod severity Critical/High; root cause đã biết file/function cụ thể; cần rollback path. Anti-trigger - root cause chưa rõ thì /code-change fix; tính năng mới (không phải regression) thì /new-feature; cần BA/SA thì pipeline đầy đủ. Example - "/hotfix 'NullReference khi user null trong AuthGuard'".
disable-model-invocation: true
---

# Hotfix Pipeline

## ⚠️ ai-kit CLI Enforcement (ADR-005)
**Hotfix scaffold MUST call `Bash("ai-kit sdlc scaffold hotfix ...")`** instead of direct `Write`/`mkdir`. Per ADR-005 D3 (supersedes prior CD-8 v3 MCP wording).

| Legacy step | New ai-kit CLI command |
|---|---|
| mkdir `docs/hotfixes/{hotfix-id}/` + Write `_state.md` (skipped ba+sa) | `ai-kit sdlc scaffold hotfix --workspace . --id H-NNN --name "..." --slug ... --patch-summary "..." --affected-modules csv --severity high` — atomic |
| ID allocation (legacy: scan + increment) | NEW: H-NNN canonical format (per CD-19); skill resolves next available H-NNN via `ai-kit sdlc verify --scopes id_uniqueness` before invoke |
| Update root `feature-map.yaml` with hotfix entry | Hotfix-specific routing handled by `ai-kit sdlc resolve --kind hotfix --id H-NNN` walking filesystem |

**Hotfix folder convention** (post-ADR-003 D8): `docs/hotfixes/H-NNN-{slug}/` (NEW prefix `H-`, separate from F-NNN namespace). Skipped stages: `[ba, sa, designer]`. Initial stage: `tech-lead`.

**Forbidden**:
- ❌ Write `_state.md` for hotfix directly
- ❌ mkdir `docs/hotfixes/**`
- ❌ Use `F-NNN` prefix for hotfix (must use `H-NNN`)

**ai-kit unavailable → BLOCK pipeline** (ADR-005): hard-stop with message: "Install/update ai-kit CLI: `ai-kit update`. Verify via `ai-kit doctor`." NO silent local fallback — hotfix without atomic ai-kit scaffold races feature-catalog updates.

**Reference**: ADR-003 D8 + ADR-005 D3.

---

User-facing output: Vietnamese. Artifact files and dispatcher prompts: English.

---

## ⚠️ SKILL ROLE — THIN ENTRY POINT (2026-05-04 architecture)

This skill is a thin entry point. After Steps 1-5 setup, Step 6 hands off to **PM agent** via single `Task(pm, mode=orchestrate)` call. PM drives hotfix pipeline (tech-lead → dev → qa → reviewer) end-to-end.

**Forbidden:** Read agent definitions to do work yourself. Write artifacts directly. Loop Task(dispatcher) — deprecated 2026-05-04.
**Required:** Build Orchestrate prompt → 1× Task(pm) → relay verdict to user.

---

## Step 1 — Qualify the hotfix (do not skip)

Confirm ALL conditions are true. If any is false → route to `/new-feature`.

| Qualification | Required |
|---|---|
| Root cause identified? | Yes — specific file/function/behavior known |
| Scope contained (≤ 3 files)? | Yes |
| Regression or production bug? | Yes — not a new feature |
| Requires new BA or new architecture? | No |

If uncertain → ask user before proceeding.

## Step 2 — Read AGENTS.md and resolve scope

Read `AGENTS.md` at project root → extract `repo-type`, `feature-prefix`.

If `repo-type: mono` → ask which app/service the bug is in.

Resolve paths using same formula as new-feature:

| Scope | hotfix-root |
|---|---|
| mini-repo | `docs/hotfixes` |
| mono — any | `docs/hotfixes` |

> Hotfixes always at root `docs/hotfixes/` regardless of repo-type — they are urgent cross-cutting fixes.

## Step 3 — Collect inputs

Ask if not provided:
- **Bug description**: what is broken, what is expected
- **Reproduction steps**: how to reproduce
- **Severity**: Critical / High / Medium
- **Affected version / environment**

Generate hotfix-id: `hotfix-{YYYYMMDD}-{short-slug}`

## Step 3b — Root-cause investigation (Cursor @Codebase)

Before dispatching `tech-lead`, surface candidate root-cause locations using Cursor's semantic search — saves tech-lead 1-2 rounds of exploration.

```
@Codebase "<error message OR symptom keywords>"
@Codebase "<feature/module name where bug surfaces>"
```

Capture top 3-5 candidate files into `_state.md`:

```yaml
hotfix-investigation:
  symptom: "<from Step 3 bug description>"
  candidate-locations:
    - file: "src/path/to/file.ts"
      reason: "@Codebase top match — contains <symbol>"
    - file: "..."
      reason: "..."
  searched-at: "{YYYY-MM-DD HH:MM}"
```

`tech-lead` then narrows to actual root-cause line, proposes minimal diff, and Path S (Simple) skips heavy SA/QA cycles.

When unclear → still continue to tech-lead with `candidate_locations: []` + note that semantic search returned no high-confidence match (tech-lead does deeper investigation).

## Step 4 + 5 — Scaffold via ai-kit CLI (atomic, replaces legacy Write/mkdir + 2-step intel sync)

```
# Skill resolves next H-NNN first via verify scope id_uniqueness, then:
result = Bash("ai-kit sdlc scaffold hotfix \
  --workspace {repo-path} \
  --id H-NNN \
  --name 'Hotfix — {short description}' \
  --slug '{kebab-case derived from name}' \
  --patch-summary '{1-line description}' \
  --affected-modules '{csv module IDs}' \
  --severity {critical|high|medium}")
parse stdout JSON; legacy params below are ignored (kept as comments for migration trace):
legacy_unused_block = {
  pipeline_path = "S",                          # default for hotfix
  feature_req = {
    bug: "{description}",
    root_cause: "{specific file/function/behavior}",
    reproduction: ["{step 1}", "{step 2}", ...],
    scope: ["{file/module 1}", ...],
    constraints: "fix scoped to root cause only, rollback must be possible"
  },
  target_feature_id = "{F-NNN if hotfix targets existing feature, else null}",
  scaffold_options = {
    create_state_md: true,                      # docs/hotfixes/H-NNN-{slug}/_state.md per CD-23 HotfixState
    skip_stages: ["ba", "sa", "designer"],      # hotfix flow per CD-23 discriminator
    initial_stage: "tech-lead",
    update_feature_catalog: true,                # if target_feature_id given: append tags + evidence; else: create with tags=["hotfix-initiated"], priority="critical"
    update_feature_map_yaml: true,
    update_meta_json: true
  }
)
```

**MCP atomic guarantees**:
- `hotfix_id` allocated atomically as H-NNN (CD-19 namespace, separate from F-NNN)
- 4 files updated in single txn: `_state.md`, `feature-catalog.json`, `feature-map.yaml`, `_meta.json`
- _state.md schema: HotfixState variant per CD-23 oneOf discriminator (`pipeline-type: hotfix`, `severity`, `affected-modules`, `skipped-stages: [ba, sa, designer]`)
- Returns: `{hotfix_id, paths: [...], catalog_action: "linked"|"created"|"none", errors: []}`
- On failure → rollback all writes; surface error

**Forbidden patterns** (replaced):
- ❌ `Bash mkdir docs/hotfixes/...` → `scaffold_hotfix.create_state_md`
- ❌ `Write _state.md` directly → MCP scaffold
- ❌ `Edit feature-map.yaml` → cascade in scaffold
- ❌ `Read+modify+Write feature-catalog.json` → cascade in scaffold
- ❌ `python ~/.claude/scripts/intel/meta_helper.py update` subprocess → cascade in scaffold

**MCP unavailable → BLOCK pipeline** per CD-8 v3 (no silent local fallback — hotfix without atomic MCP scaffold races feature-catalog updates).

Body sections (auto-generated by MCP scaffold engine): Root Cause, Reproduction Steps, Scope, Stage Progress table (ba+sa marked Skipped), Active Blockers, Wave Tracker.

## Step 6 — Hand off to PM (single Task call)

Build Orchestrate prompt + call `Task(pm)` ONCE. PM drives hotfix pipeline (tech-lead → dev → qa → reviewer) end-to-end since `_state.md` already has `completed-stages.ba` and `completed-stages.sa` pre-populated as Skipped.

### 6.1 — Build PM Orchestrate prompt

```
## Agent Brief
You are PM in Orchestrate mode (hotfix variant). See ~/.cursor/agents/pm.md § Orchestrate Mode.

## Mode
orchestrate

## Project Conventions
{≤5 lines from rules/40-project-knowledge.mdc; "(none)" if none}

## Feature Context
feature-id:        {hotfix-id}
docs-path:         docs/hotfixes/{hotfix-id}
repo-path:         .
intel-path:        docs/intel/    # if intel layer exists; else "(none)"
output-mode:       lean
pipeline-path:     S    # hotfix is always Path S (no SA, no dedicated QA — reviewer inline)

## Inputs
session-context:   |
  Hotfix scope: {short bug description}
  Root cause: {file/function}
  Severity: {Critical|High|Medium}
  pre-scaffold: ba+sa already marked Skipped in _state.md.
```

### 6.2 — Single Task(pm) call

```
result = Task(subagent_type="pm", prompt=prompt_above)
```

### 6.3 — Surface result + proceed

| `result.status` | Action |
|---|---|
| `done` | Proceed to Step 7 (post-merge checklist) |
| `blocked` (hard) | Surface blockers, stop |
| `user-needed` | Surface PM message + clarification, stop. User answers + re-runs `/resume-feature {hotfix-id}`. |
| `iter≥200` | Surface safety-cap message, stop |

## Step 7 — Post-merge checklist

```
⚠️ Checklist:
  [ ] Verify fix in staging
  [ ] Confirm bug no longer reproducible
  [ ] Notify stakeholders if severity = Critical
```

## Guardrails

- Do not use hotfix for features — route to `/new-feature`
- Do not skip QA — even hotfixes need regression verification
- Do not skip reviewer — security/data bugs especially need review
- Max 1 wave — if fix needs multiple waves, it is not a hotfix
- Dev MUST Read every target file (or relevant range) before any Edit/Write — no exceptions

## What's next

| Outcome | Next skill |
|---|---|
| Reviewer Approved | `/release` or `/close-feature` |
| Severity Critical/High | `/postmortem` after fix deployed |
| Related bugs discovered | `/incident` if production impact |
| Scope grew beyond hotfix | Stop, switch to `/new-feature` with full pipeline |
