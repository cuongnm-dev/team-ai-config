---
description: Pipeline rút gọn cho lỗi nghiêm trọng đã xác định nguyên nhân. Bỏ qua BA + SA, chạy thẳng tech-lead → dev → QA → reviewer. Scope ≤3 files, max 1 wave. Anti-trigger - root cause chưa rõ /code-change; tính năng mới /new-feature.
---

# /hotfix {description?}

User-facing: Vietnamese.

## Step 1 — Qualify hotfix (do not skip)

Confirm ALL conditions. If any false → route to `/new-feature`.

| Qualification | Required |
|---|---|
| Root cause identified? | Yes — specific file/function known |
| Scope contained (≤ 3 files)? | Yes |
| Regression or production bug? | Yes — not new feature |
| Requires new BA or new architecture? | No |

## Step 2 — Read AGENTS.md + scope

Read `AGENTS.md` for `repo-type`, `feature-prefix`. If `mono` → ask which app/service.

| Scope | hotfix-root |
|---|---|
| mini-repo | `docs/hotfixes` |
| mono — any | `docs/hotfixes` (cross-cutting; root-level for urgent) |

## Step 3 — Collect inputs

Ask if not provided:
- Bug description (broken vs expected)
- Reproduction steps
- Severity (Critical / High / Medium)
- Affected version / environment

Generate hotfix-id: `hotfix-{YYYYMMDD}-{slug}`

## Step 3b — Root-cause investigation

Surface candidate root-cause via Cascade `@Codebase`:
```
@Codebase "<error message OR symptom keywords>"
@Codebase "<feature/module name>"
```

Capture top 3-5 candidate files into `_state.md.hotfix-investigation.candidate-locations[]`.

If unclear → still continue with empty candidates + note "no high-confidence match" (tech-lead does deeper investigation).

## Step 4 — Create `_state.md`

Per `ref-pm-templates` skill template (hotfix variant) at `docs/hotfixes/{hotfix-id}/_state.md`. Pre-populated:
- `current-stage: tech-lead`
- `pipeline-path: S`
- `risk-score: 2`
- `stages-queue: [dev-wave-1, qa-wave-1, reviewer]`
- `completed-stages.ba.verdict: Skipped — root cause known, no BA needed`
- `completed-stages.sa.verdict: Skipped — no new boundaries`

## Step 5 — Update feature-map.yaml + intel

5a. `feature-map.yaml`: append entry with `is-hotfix: true`.

5b. `feature-catalog.json` (CD-10):
- **Existing feature** (hotfix fixing F-XXX bug): UPDATE `features[F-XXX]`:
  - Append to `tags[]`: `"hotfix-{hotfix-id}"`
  - Append `evidence[]`: `{kind: hotfix, file: docs/hotfixes/{id}/_state.md, pattern: "hotfix initiated"}`
  - Don't change status
- **New micro-feature** (rare): CREATE entry per templates with `tags: [hotfix-initiated]`, `priority: critical`

After write: `python ~/.ai-kit/scripts/intel/meta_helper.py update docs/intel/ feature-catalog.json --producer hotfix`

## Step 5.5 — Worktree detection

Same as `/new-feature` Step 4.8 — detect `$ROOT_WORKTREE_PATH`, record in state, info-only tip if not in worktree.

## Step 6 — Hand off to PM

Build context block:
```
## Mode
orchestrate

## Feature Context
feature-id: {hotfix-id}
docs-path: docs/hotfixes/{hotfix-id}
repo-path: {worktree-path or "."}
intel-path: docs/intel/
worktree-mode: {true | false}
output-mode: lean
pipeline-path: S

## Inputs
session-context: |
  Hotfix scope: {short description}
  Root cause: {file/function}
  Severity: {Critical|High|Medium}
  pre-scaffold: ba+sa already marked Skipped in _state.md.
```

PM auto-loads via Cascade. Drives: tech-lead → dev → reviewer (Path S inline_qa).

## Step 7 — Post-merge checklist

```
⚠️ Checklist:
  [ ] Verify fix in staging
  [ ] Confirm bug no longer reproducible
  [ ] Notify stakeholders if severity = Critical
```

## Guardrails

- Don't use hotfix for features → `/new-feature`
- Don't skip QA/reviewer (even hotfixes)
- Max 1 wave — if needs multi-wave, not a hotfix
- Dev MUST Read every target file before Edit/Write

## What's next

| Outcome | Next |
|---|---|
| Reviewer Approved | `/release` or `/close-feature` |
| Severity Critical | postmortem (close-feature auto-generates) |
| Related bugs found | `/incident` if production impact |
| Scope grew beyond hotfix | Stop, switch to `/new-feature` |
