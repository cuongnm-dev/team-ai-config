---
name: hotfix
description: Fast-path pipeline cho lỗi nghiêm trọng đã xác định rõ. Bỏ qua ba + SA, chạy thẳng tech-lead → dev → qa → reviewer.
---

# Hotfix Pipeline

User-facing output: Vietnamese. Artifact files and dispatcher prompts: English.

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
  candidate_locations:
    - file: "src/path/to/file.ts"
      reason: "@Codebase top match — contains <symbol>"
    - file: "..."
      reason: "..."
  searched_at: "{YYYY-MM-DD HH:MM}"
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
risk_score: 2
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
  Bug: {description}
  Root cause: {specific file/function/behavior}
  Reproduction: {steps}
  Scope: {files/modules affected}
  Severity: {Critical|High|Medium}
  Constraints: fix scoped to root cause only, rollback must be possible
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
    docs_path: "docs/hotfixes/{hotfix-id}"
    status: "in-progress"
    current-stage: "tech-lead"
    created: "{YYYY-MM-DD}"
    updated: "{YYYY-MM-DD}"
    catalog_id: "{F-NNN if hotfix targets existing feature, else null}"
    is_hotfix: true
```

**5b — Canonical intel: link or create entry in `docs/intel/feature-catalog.json`** (only when intel layer exists)

Hotfix targets one of two cases:
- **Existing feature** (hotfix fixing a bug in F-XXX): UPDATE `feature-catalog.features[F-XXX]`:
  - Append to `tags[]`: `"hotfix-{hotfix-id}"`
  - Append to `evidence[]`: `{ "kind": "hotfix", "file": "docs/hotfixes/{hotfix-id}/_state.md", "pattern": "hotfix initiated" }`
  - Do NOT change `status` (still `implemented`); close-feature for hotfix will append to `implementation_evidence.commits[]`
- **New micro-feature** (rare; hotfix introduces small new capability): CREATE entry as in `new-feature` Step 4.5 but with `tags: ["hotfix-initiated"]` and `priority: critical`.

After write: `python ~/.claude/scripts/intel/meta_helper.py update docs/intel/ feature-catalog.json --producer hotfix --append-merged-from`

If intel layer absent: skip — hotfix uses `feature-map.yaml` only (legacy).

## Step 6 — Dispatcher loop (with PM escalation)

```
Loop:
  # Cache-aware prompt (see new-feature/SKILL.md for rationale)
  result = Task(
    subagent_type="dispatcher",
    prompt="
## Feature Context
feature-id: {hotfix-id}
docs-path: docs/hotfixes/{hotfix-id}
repo-path: .
output-mode: lean

## Inputs
(dispatcher reads current-stage from _state.md)
"
  )
  → status=continuing: print "[{stage}] ✓ {verdict}", loop
  → status=done:       proceed to Step 7
  → status=blocked:    surface blockers, stop
  → status=pm-required:
      pm_result = Task(subagent_type="pm", prompt="pm-trigger: {result.pm-trigger}\npm-context: {result.pm-context}\ndocs-path: ...\nfeature-id: ...")
      if pm_result is not valid JSON or missing "resume" field: surface raw output, stop
      if pm_result.resume = true: loop
      else: surface PM's message, stop
  → unknown status: surface result to user, stop
```

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

## What's next

| Outcome | Next skill |
|---|---|
| Reviewer Approved | `/release` or `/close-feature` |
| Severity Critical/High | `/postmortem` after fix deployed |
| Related bugs discovered | `/incident` if production impact |
| Scope grew beyond hotfix | Stop, switch to `/new-feature` with full pipeline |
