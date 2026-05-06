---
name: new-feature
description: Khởi tạo pipeline cho 1 tính năng MỚI (không có _state.md trước đó), hoặc cập nhật tính năng đã hoàn thành (status:done) khi có change request. Pipeline đang dở (status:in-progress|blocked) sẽ được redirect sang /resume-feature. Tự đọc AGENTS.md, intel layer (CD-10), tạo _state.md + feature-brief.md + feature-map.yaml + canonical intel entries theo contract chuẩn. Trigger - feature-id chưa tồn tại; user nói "thêm tính năng mới"; change request cho feature đã done. Anti-trigger - feature đang in-progress/blocked thì dùng /resume-feature; chỉ muốn xem status thì /feature-status. Example - "/new-feature" (interactive) hoặc "/new-feature F-042" để mở lại feature done.
---

# Pipeline Entry Point

## ⚠️ ai-kit CLI Enforcement (ADR-005)
**Step 4 (create new feature) MUST call `Bash("ai-kit sdlc scaffold feature ...")`** instead of direct `Write`. Per ADR-005 D3 (supersedes prior CD-8 v3 MCP wording).

| Legacy step | New ai-kit CLI command |
|---|---|
| Step 4: mkdir + Write `_state.md` + `feature-brief.md` + append `feature-map.yaml` | `ai-kit sdlc scaffold feature --workspace . --module M-NNN --id F-NNN --name "..." --slug ...` — atomic 5-file txn (feature dir + _feature.md + implementations.yaml + test-evidence.json + intel updates) |
| Step 4.8: worktree detection | unchanged — Bash for git operations OK |
| Step 1: feature_id input | unchanged — interactive prompt |
| Step 1: module_id selection | NEW — must specify parent module (FK enforced); skill prompts user to choose from existing modules in `module-catalog.json` |

**SDLC 2-tier path** (post-ADR-003): feature now lives at `docs/modules/M-NNN-{slug}/features/F-NNN-{slug}/`. NEW required input: parent `module_id`.

**Forbidden**:
- ❌ Write `_state.md` / `_feature.md` / `feature-brief.md` directly
- ❌ Glob `**/docs/features/{feature-id}/_state.md` for last-resort fallback
- ❌ Edit `feature-map.yaml` / `feature-catalog.json` directly (handled atomically)

**ai-kit unavailable → BLOCK pipeline** (ADR-005): hard-stop with message: "Install/update ai-kit CLI: `ai-kit update`. Verify via `ai-kit doctor`." NO silent local fallback — silent fallback creates non-canonical paths that violate CD-22 + drift between producer and consumer.

**Reference**: ADR-003 D8 + ADR-005 D3.

---

Single skill for NEW pipeline OR UPDATE of completed feature.
Resume of in-progress pipelines is delegated to `/resume-feature` (P2.1 dedup, 2026-05).

User-facing output: Vietnamese. Artifact files and dispatcher prompts: English.

---

## ⚠️ SKILL ROLE — THIN ENTRY POINT (2026-05-04 architecture)

This skill is a thin entry point. After Steps 1-4 setup (state, intel, feature-map), Step 5 hands off to **PM agent** via single `Task(pm, mode=orchestrate)` call. PM drives pipeline end-to-end.

### Forbidden:
- ❌ Reading `ba.md`/`sa.md`/`dev.md`/agent definitions and "doing the work yourself"
- ❌ Writing artifact files (`ba/`, `sa/`, dev outputs, qa report, review report)
- ❌ Looping `Task(dispatcher)` per-stage — that pattern is deprecated 2026-05-04
- ❌ Re-implementing routing/validation/state-update logic — PM owns this

### Required:
- ✅ Steps 1-4 = setup (state, intel, feature-map)
- ✅ Step 5 = single `Task(pm)` call. PM does the rest.
- ✅ Surface PM's final verdict to user.

---

## Step 1 — Detect mode (NEW | RESUME-redirect | UPDATE)

If user provides `feature-id` (e.g. `/new-feature F-042`):

Locate `_state.md` via ai-kit CLI atomic resolve:

```
result = Bash("ai-kit sdlc resolve --workspace . --kind {feature|hotfix} --id {feature-id} --include-metadata")
parse stdout JSON for { ok, data: { path, exists, metadata: { status, current_stage, ... } } }
```

Returns `{path, exists, metadata: {status, current_stage, ...}}` if found. Not found → `ok:false, error.code:MCP_E_NOT_FOUND`. **ai-kit CLI unavailable → BLOCK** per ADR-005 D3 (no Glob fallback).

| Result | Action |
|---|---|
| Found + `status` = `in-progress` or `blocked` | → **REDIRECT to `/resume-feature {feature-id}`** (do NOT inline resume logic) |
| Found + `status: done` | → **UPDATE FLOW** — Read `notepads/update-flow.md` |
| Not found | → **NEW FLOW** — Read `notepads/new-flow.md` |

No `feature-id` provided → **NEW FLOW** — Read `notepads/new-flow.md`.

---

## Step 2 — Redirect handling (in-progress / blocked)

When `_state.md` exists with `status` in {`in-progress`, `blocked`}:

```
Pipeline {feature-id} đang ở stage {current-stage} ({status}).
Dùng `/resume-feature {feature-id}` để tiếp tục — skill đó có dispatcher loop với cost-fix discipline.
```

STOP. Do not load any new-flow logic, do not modify `_state.md`.

---

## Step 3 — NEW FLOW

Read `notepads/new-flow.md` and follow Steps 2 → 4.7 in that file. Covers:
- Step 2: Read AGENTS.md
- Step 2.5: Read canonical intel (CD-10 + LIFECYCLE.md §5.1) with stale-block
- Step 2.7: Semantic duplicate check (Cursor @Codebase)
- Step 3: Determine scope (monorepo only)
- Step 4: Gather info, allocate feature-id, create `_state.md` + `feature-brief.md` + `feature-map.yaml`
- Step 4.5: Initialize canonical `feature-catalog.json` entry
- Step 4.6: Register placeholder in `sitemap.json` + `permission-matrix.json`
- Step 4.7: Exit-gate verification

After exit-gate passes → run worktree detection (Step 4.8 below) → dispatcher loop (Step 5).

## Step 4.8 — Worktree detection (Cursor 3+ native)

Detect if skill is running inside a Cursor-managed git worktree. If yes, record worktree context in `_state.md` so PM and downstream tooling know to operate against the worktree (not main checkout).

```
worktree_path = $ROOT_WORKTREE_PATH    # env var Cursor exposes when running inside a worktree

IF worktree_path is set:
  branch = `git rev-parse --abbrev-ref HEAD` (run in worktree dir)
  base   = `git symbolic-ref --short refs/remotes/origin/HEAD | sed s|origin/||` (or `main`/`master`)
  base_sha = `git merge-base {base} HEAD`

  Append to _state.md frontmatter:
    worktree-path:   "{worktree_path}"
    worktree-branch: "{branch}"
    worktree-base:   "{base}"
    worktree-base-sha: "{base_sha}"

ELSE (running in main checkout):
  Ask user (interactive, default skip):
    "Chạy feature trong worktree để isolate code thay đổi (recommended cho parallel work)? (y/N)"
    IF y → tell user: "Mở agent dropdown trong Cursor, chọn 'Worktree' location, rồi re-run /new-feature {id}."
           STOP setup (no _state.md created yet — user re-runs after switching).
    IF N → continue in main checkout. Skill operates as normal. Skip worktree fields in _state.md.
```

**Why this matters:**
- PM passes `repo-path = worktree_path` to specialists so file writes land in the right tree.
- close-feature reads worktree fields and suggests `/apply-worktree` + `/delete-worktree` slash commands.
- Multiple concurrent features → each in own worktree → no file-level conflict.
- Cursor cleanup auto-runs every 6h, keeps newest 20 worktrees (per `.cursor/worktrees.json` defaults).

Reference: https://cursor.com/docs/configuration/worktrees

---

## Step 4 — UPDATE FLOW

Triggered when `_state.md` found with `status: done`.

Read `notepads/update-flow.md` and follow Step 5U. Covers:
- Read existing artifacts (`ba/`, `sa/`, `04-tech-lead-plan.md`)
- Collect change request
- Triage starting stage (ba | sa | tech-lead | hotfix-redirect)
- Reset `_state.md` and `feature-map.yaml`
- Hand off to dispatcher loop (Step 5 below)

guardrails: same feature-id (no new ID), agents overwrite artifacts in place, do not skip stages in re-run path.

---

## Step 5 — Hand off to PM (single Task call, PM drives end-to-end)

Build Orchestrate prompt + call `Task(pm)` ONCE. PM internally loops dispatch+validate+update until done/blocked/user-needed.

### 5.1 — Build PM Orchestrate prompt (4-block — cache-aware)

```
## Agent Brief
You are PM in Orchestrate mode. Mission: drive feature pipeline to completion. See ~/.cursor/agents/pm.md § Orchestrate Mode.

## Mode
orchestrate

## Project Conventions
{≤5 lines from rules/40-project-knowledge.mdc; "(none)" if no relevant entries}

## Feature Context
feature-id:        {feature-id}
docs-path:         {docs-path}
repo-path:         {worktree-path if _state.md.worktree-path is set, else repo-path}
intel-path:        {repo-path}/docs/intel/
worktree-mode:     {true if worktree-path set, else false}
worktree-branch:   {worktree-branch if set, else "(none)"}
output-mode:       {output-mode}
pipeline-path:     unknown   # PM will set after BA via inline Path Selection Logic

## Inputs
session-context:   (none)    # new-feature: fresh start; UPDATE flow: pass distilled change request
```

### 5.2 — Single Task(pm) call

```
result = Task(subagent_type="pm", prompt=prompt_above)
# PM runs Orchestrate Mode internally — see resume-feature/SKILL.md § 6.2 for behavior
```

### 5.3 — Surface result (4 legitimate stops)

| `result.status` | Surface |
|---|---|
| `done` | "✅ Pipeline hoàn tất — {final_verdict}". Suggest `/close-feature {id}`. |
| `blocked` (hard) | "❌ Pipeline blocked: {blockers[].description}". Suggest fix. |
| `user-needed` | "⚠ PM cần thông tin: {clarification_notes}". Suggest answer + `/resume-feature {id}`. |
| `iter≥200` | "⚠ Safety cap. Re-run `/resume-feature {id}`." |

---

## What's next

| Outcome | Next skill |
|---|---|
| Pipeline started (NEW) | Dispatcher loop runs automatically; on long pause use `/resume-feature {id}` |
| Pipeline reset (UPDATE) | Dispatcher loop runs automatically |
| Pipeline blocked | `/feature-status` — inspect + surface blocker |
| Pipeline complete | `/close-feature` |
| Need estimate first | `/plan estimate` |
| In-progress detected | `/resume-feature {feature-id}` (auto-redirected at Step 2) |
