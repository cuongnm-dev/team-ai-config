---
name: hotfix
description: Pipeline rút gọn dành riêng cho lỗi nghiêm trọng đã xác định rõ nguyên nhân. Bỏ qua bước phân tích nghiệp vụ (BA) và kiến trúc (SA), chạy thẳng tech-lead → dev → QA → reviewer để vá nhanh, đẩy lên production. Scope ≤3 files, max 1 wave. Trigger - bug prod severity Critical/High; root cause đã biết file/function cụ thể; cần rollback path. Anti-trigger - root cause chưa rõ thì /code-change fix; tính năng mới (không phải regression) thì /new-feature; cần BA/SA thì pipeline đầy đủ. Example - "/hotfix 'NullReference khi user null trong AuthGuard'".
disable-model-invocation: true
---

# Hotfix Pipeline

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

## Step 4 — Create `_state.md`

Create `docs/hotfixes/{hotfix-id}/_state.md`.

Schema matches contract at `.cursor/skills/from-doc/SKILL.md`:

```yaml
feature-id: {hotfix-id}
feature-name: "Hotfix — {short description}"
pipeline-type: sdlc
status: in-progress
depends-on: []
created: {YYYY-MM-DD}
last-updated: {YYYY-MM-DD}
current-stage: tech-lead
output-mode: lean
risk-score: 2
pipeline-path: S
repo-type: {mini | mono}
repo-path: "."
project: {app/service name | cross-cutting}
project-path: {resolved — "." for mini/cross-cutting}
docs-path: docs/hotfixes/{hotfix-id}
stages-queue: [dev-wave-1, qa-wave-1, reviewer]
completed-stages:
  ba:
    verdict: "Skipped — root cause known, no BA needed"
    completed-at: "{YYYY-MM-DD}"
  sa:
    verdict: "Skipped — no new boundaries"
    completed-at: "{YYYY-MM-DD}"
feature-req: |
  bug: {description}
  Root cause: {specific file/function/behavior}
  reproduction: {steps}
  scope: {files/modules affected}
  severity: {Critical|High|Medium}
  constraints: fix scoped to root cause only, rollback must be possible
kpi:
  tokens-total: 0
  cycle-time-start: {YYYY-MM-DD}
  tokens-by-stage: {}
rework-count: {}
```

Body includes: Root Cause, Reproduction Steps, Scope, Stage Progress table (ba+sa marked Skipped), Active Blockers, Wave Tracker.

## Step 5 — Update feature-map.yaml + canonical intel (CD-10)

**5a — feature-map.yaml** at workspace root:

```yaml
features:
  {hotfix-id}:
    name: "Hotfix — {short description}"
    project: "{project}"
    docs-path: "docs/hotfixes/{hotfix-id}"
    status: "in-progress"
    current-stage: "tech-lead"
    created: "{YYYY-MM-DD}"
    updated: "{YYYY-MM-DD}"
    catalog-id: "{F-NNN if hotfix targets existing feature, else null}"
    is-hotfix: true
```

**5b — Canonical intel: link or create entry in `docs/intel/feature-catalog.json`** (only when intel layer exists)

Hotfix targets one of two cases:
- **Existing feature** (hotfix fixing a bug in F-XXX): UPDATE `feature-catalog.features[F-XXX]`:
  - Append to `tags[]`: `"hotfix-{hotfix-id}"`
  - Append to `evidence[]`: `{ "kind": "hotfix", "file": "docs/hotfixes/{hotfix-id}/_state.md", "pattern": "hotfix initiated" }`
  - Do NOT change `status` (still `implemented`); close-feature for hotfix will append to `implementation_evidence.commits[]`
- **New micro-feature** (rare; hotfix introduces small new capability): CREATE entry as in `new-feature/notepads/new-flow.md` Step 4.5 but with `tags: ["hotfix-initiated"]` and `priority: critical`.

After write: `python ~/.claude/scripts/intel/meta_helper.py update docs/intel/ feature-catalog.json --producer hotfix --append-merged-from`

If intel layer absent: skip — hotfix uses `feature-map.yaml` only (legacy).

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
