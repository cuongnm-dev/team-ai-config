---
name: hotfix
description: Pipeline rút gọn dành riêng cho lỗi nghiêm trọng đã xác định rõ nguyên nhân. Bỏ qua bước phân tích nghiệp vụ (BA) và kiến trúc (SA), chạy thẳng tech-lead → dev → QA → reviewer để vá nhanh, đẩy lên production. Scope ≤3 files, max 1 wave. Trigger - bug prod severity Critical/High; root cause đã biết file/function cụ thể; cần rollback path. Anti-trigger - root cause chưa rõ thì /code-change fix; tính năng mới (không phải regression) thì /new-feature; cần BA/SA thì pipeline đầy đủ. Example - "/hotfix 'NullReference khi user null trong AuthGuard'".
disable-model-invocation: true
---

# Hotfix Pipeline

User-facing output: Vietnamese. Artifact files and dispatcher prompts: English.

---

## ⚠️⚠️⚠️ ORCHESTRATOR DISCIPLINE — READ FIRST

You are the outer orchestrator for hotfix pipeline. After Steps 1-5 setup, Step 6 = dispatcher loop. You are NOT the worker.

**Forbidden:** Reading `tech-lead.md`/`dev.md`/`qa.md` to "do work yourself". Writing artifacts directly. Stopping after 1 stage transition. Returning to user with "chạy lại /resume-feature ..." after only 1 stage.

**Required:** Loop `Task(dispatcher)` until status ∈ {`done`, hard `blocked`, `pm-required`→`resume:false`, `iter>=200`}. Anything else = LOOP.

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

## Step 6 — Dispatcher loop (INLINE — same protocol as resume-feature SKILL.md § 6)

```
iter = 0; pm_count = 0; transient_retry_count = 0; last_verdict = "none"
FROZEN_HEADER = "## Pipeline Context\npipeline-type: sdlc\nfeature-id: {hotfix-id}\ndocs-path: docs/hotfixes/{hotfix-id}\nrepo-path: .\noutput-mode: lean".rstrip("\n")
PM_FROZEN = build_pm_frozen().rstrip("\n")

WHILE iter < 200:
  iter++
  prompt = FROZEN_HEADER + "\n\n## Current State\ncurrent-stage: {current-stage}\niter: {iter}\nlast-verdict: {last_verdict}"

  result = Task(subagent_type="dispatcher", prompt=prompt)
  status = result.get("status") or "continuing"

  CASE status:
    "continuing":
      last_verdict = result.verdict or "in-progress"
      print "[{stage}] ✓ {verdict}"
      loop                                  # ← do NOT exit on stage transition

    "done":
      reread _state.md
      IF stages-queue non-empty: last_verdict="auto-continue"; loop
      ELSE: proceed to Step 7

    "blocked":
      IF result.blockers contains PARSE-001 or NO-INVOKE-001 AND transient_retry_count < 1:
        transient_retry_count++; continue
      surface blockers, stop                # ← legitimate stop

    "pm-required":
      pm_count++
      IF pm_count > 5: STOP
      pm_result = Task(subagent_type="pm", prompt=PM_FROZEN + "\n\n" + truncate(result.pm-context, 8K))
      IF pm_result invalid OR missing `resume`: surface raw output; STOP
      IF pm_result.resume == true: last_verdict="pm-resolved"; loop   # ← baton back
      ELSE: surface pm_result.message + clarification; STOP   # ← legitimate stop (user-needed)

    default:
      print "⚠ Unknown status — treating as continuing"
      last_verdict = result.verdict or "unknown-status"
      loop
```

**Stop conditions (only 4):** `done` + queue empty (proceed Step 7) | hard `blocked` | `pm-required`→`resume:false` | iter ≥ 200. Anything else = LOOP.

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
