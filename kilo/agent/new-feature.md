---
description: Khởi tạo pipeline cho 1 tính năng MỚI. Tạo _state.md + intel entries + feature-map. Hand off to PM orchestrator. Anti-trigger - feature đang in-progress dùng /resume-feature thay; chỉ xem status thì /feature-status.
mode: primary
model: anthropic/claude-sonnet-4-20250514
---

# /new-feature {feature-id?}

Single workflow for NEW pipeline OR UPDATE of completed feature. Resume in-progress → redirect to `/resume-feature`.

User-facing output: Vietnamese. Artifact files: English structural + VN narrative.

## Step 1 — Detect mode

If user provided `feature-id`:

Locate `_state.md` (resolution order — stop on first match):
1. `docs/feature-map.yaml` → `features.{feature-id}.docs_path` → `{docs_path}/_state.md`
2. `docs/features/{feature-id}/_state.md` (mini-repo fallback)
3. `docs/hotfixes/{feature-id}/_state.md`
4. Glob `**/docs/features/{feature-id}/_state.md` (last resort)

| Result | Action |
|---|---|
| Found + status in {in-progress, blocked} | → "Pipeline {id} ở stage {stage} ({status}). Dùng `/resume-feature {id}` thay." STOP. |
| Found + status: done | → UPDATE FLOW (Step 4) |
| Not found | → NEW FLOW (Step 2) |

No feature-id → NEW FLOW.

## Step 2 — Read AGENTS.md + intel

1. Read project-root `AGENTS.md` for `repo-type`, `feature-prefix`, Docs-Path Formula
2. Read intel: `docs/intel/_meta.json` for staleness check, then `_snapshot.md` (or full JSONs if not exists)
3. Stale-block: if required artifact (`actor-registry`, `permission-matrix`, `sitemap`, `feature-catalog`) missing OR stale → STOP "intel-missing", suggest `/intel-refresh`

## Step 2.7 — Semantic duplicate check

`@Codebase "<feature description keywords>"` → top 3-5 matches. If duplicate found → ask user: A) extend existing F-NNN, B) treat as new variant, C) abort.

## Step 3 — Determine scope (monorepo only)

| repo-type | Scope | project-path | docs-path |
|---|---|---|---|
| mini | any | `.` | `docs/features/{feature-id}` |
| mono | cross-cutting | `.` | `docs/features/{feature-id}` |
| mono | app/service | `src/apps/{name}` or `src/services/{name}` | `{project-path}/docs/features/{feature-id}` |

For mono: ask which app/service if unclear.

## Step 4 — Gather info + create state

Ask: feature name, business goal, scope in/out, constraints, priority.

Generate `feature-id`: `{PREFIX}-{NNN}` (next available). Confirm.

Create `{docs-path}/_state.md` per `ref-pm-templates` skill template (feature variant).
Create `{docs-path}/feature-brief.md` with feature-req detail.
Update `docs/feature-map.yaml` — append entry.

## Step 4.5 — Initialize canonical intel

Append to `docs/intel/feature-catalog.json` per `ref-pm-templates` § feature-catalog entry. Set `status: planned`, `confidence: manual`.
Run `python ~/.ai-kit/scripts/intel/meta_helper.py update docs/intel/ feature-catalog.json --producer new-feature`.

## Step 4.6 — Register placeholders

- `sitemap.json`: add planned routes (mark `confidence: low`, link to feature-id)
- `permission-matrix.json`: add placeholder permissions per role × feature

## Step 4.7 — Exit gate verification

Verify all of:
- `_state.md` exists + parseable + required fields set
- `feature-brief.md` exists + size > 200 bytes
- `feature-map.yaml` updated
- `feature-catalog.json` has entry
- Intel snapshot valid (`_meta.stale: false`)

If any fail → STOP, surface gap.

## Step 4.8 — Worktree detection (Windsurf Wave 13+)

```
worktree_path = $ROOT_WORKTREE_PATH    # set by Windsurf when agent runs in worktree

IF worktree_path is set:
  branch = `git rev-parse --abbrev-ref HEAD`
  base   = `git symbolic-ref --short refs/remotes/origin/HEAD | sed s|origin/||`
  base_sha = `git merge-base {base} HEAD`

  Append to _state.md frontmatter:
    worktree-path:   "{worktree_path}"
    worktree-branch: "{branch}"
    worktree-base:   "{base}"
    worktree-base-sha: "{base_sha}"

ELSE:
  Tell user (info-only, don't block):
    "💡 Tip: chạy /new-feature trong agent worktree để isolate (parallel work safe).
     Mở agent dropdown → 'Worktree' location, rồi re-run nếu muốn."
  Continue in main checkout.
```

## Step 5 — Hand off to PM

Output context block:
```
## Mode
orchestrate

## Feature Context
feature-id: {feature-id}
docs-path: {docs-path}
repo-path: {worktree-path if worktree-mode, else repo-path}
intel-path: {repo-path}/docs/intel/
worktree-mode: {true | false}
output-mode: {lean | full}
pipeline-path: unknown
```

This context triggers Cascade to auto-load `pm` skill (matches description "Pipeline orchestrator..."). PM drives feature pipeline end-to-end.

Surface PM's final verdict to user.

## Step 4U — UPDATE FLOW (status: done)

Triggered when `_state.md` found with `status: done` and user wants change.

1. Read existing artifacts (`ba/`, `sa/`, `04-tech-lead-plan.md`)
2. Collect change request from user
3. Triage starting stage based on change type:
   - Requirements change → `ba`
   - Architecture change → `sa`
   - Implementation only → `tech-lead`
   - Bug-like → suggest `/hotfix` instead
4. Reset `_state.md`: `status: in-progress`, `current-stage: {triaged}`, append rework log
5. Hand off to PM (Step 5)

guardrails: same feature-id (no new ID), agents overwrite artifacts in place.

## What's next

| Outcome | Next action |
|---|---|
| Pipeline started (NEW) | PM runs end-to-end automatically |
| Pipeline reset (UPDATE) | PM re-runs from triaged stage |
| Pipeline blocked | `/feature-status` to inspect |
| Pipeline complete | `/close-feature` |
