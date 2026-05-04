---
description: Đóng pipeline tính năng đã hoàn thành. Verify reviewer Approved + QA atomic triple gate, niêm phong _state.md, sync feature-catalog.json, regen intel snapshot. Bước cuối trước merge code.
mode: primary
model: anthropic/claude-sonnet-4-20250514
---

# /close-feature {feature-id?}

User-facing: Vietnamese.

## Step 1 — Identify pipeline

If ID provided → Step 2.
Else → list active pipelines from `feature-map.yaml` (status ≠ done), ask user pick. None active → "No active pipelines."

## Step 2 — Locate `_state.md`

Same resolution as `/resume-feature` Step 2.

Extract: `docs-path`, `feature-name`, `pipeline-type`, `status`, `current-stage`, reviewer verdict from completed-stages.

Not found → "No pipeline found for `{id}`."

## Step 3 — Validate close condition

| Condition | Action |
|---|---|
| Reviewer verdict = `Approved` or `Approved with follow-ups` | Proceed |
| `status: done` or `current-stage: closed` | Already closed — report and stop |
| Reviewer verdict missing | Ask: "Reviewer chưa approve. Force-close? (yes/no)" |
| `status: blocked` | Warn: "Pipeline blocked at {stage}. Force-close sẽ discard. Tiếp tục?" |

## Step 3b — QA artifact gate (CD-10 Q.14, 15, 16) — HARD-STOP

Before sealing, verify QA atomic triple:

```
1. Read docs/intel/feature-catalog.json → features[id={feature-id}]
   Extract: AC count, roles count, dialogs count, error_cases count

2. Compute min_tc per CD-10 Q.15:
     min_tc = max(5, len(AC)*2 + len(roles)*2 + len(dialogs)*2 + len(error_cases) + 3)

3. Verify 3 artifact groups:
   A. test-evidence/{feature-id}.json:
      - len(test_cases) >= min_tc
      - Every TC has execution.status set
      - passed_count == len(test_cases)

   B. Playwright spec at:
      - tests/e2e/{feature-id}*.spec.ts OR
      - tests/e2e/{feature-id}/*.spec.ts OR
      - docs/intel/playwright/{feature-id}.spec.ts
      - File size > 200 bytes

   C. Screenshots at docs/intel/screenshots/{feature-id}-step-NN-{state}.png
      - count >= max(3, count of state-changing TCs)
      - Each TC with state-change has screenshot_refs[] populated

4. Cross-check coverage:
   - acceptance_criteria_coverage_pct == 100%
   - role_coverage_pct == 100%

5. IF all pass → PROCEED
   ELSE → HARD-STOP with itemized verdict
   Override (legacy/pre-MVP only): /close-feature {id} --skip-qa-gate
```

`--skip-qa-gate` persists `intel-warning: qa-gate-bypassed` + `qa_status: incomplete-bypass` in feature-catalog.

## Step 4 — Run retrospective (if missing)

Check `{docs-path}/09-retrospective.md`. If missing → auto-generate via PM context (loads `ref-pm-retrospective` skill template).

## Step 5 — Seal `_state.md`

```yaml
status: done
current-stage: closed
last-updated: {YYYY-MM-DD}
closed-by: close-feature
closed-at: {YYYY-MM-DD}
```

Append to Stage Progress: `| — | Pipeline Closed | — | Done | {date} |`

### 5b Compress historical sections

After 5+ stages, `_state.md` accumulates 500+ lines. Compress:
1. Stage Progress: keep header + last 3 + Closed row, archive rest to `{docs-path}/.archive/state-stage-history.md`
2. Wave History: keep summary line per wave, archive details
3. Inline change-digest blocks → keep title + 1-line, archive full

Skip if `_state.md < 200 lines` OR pipeline-type=hotfix OR output-mode=full.

## Step 6 — Update feature-map.yaml

```yaml
features:
  {id}:
    status: "done"
    current-stage: "closed"
    updated: "{YYYY-MM-DD}"
```

## Step 6.5 — Sync canonical intel (CD-10) — MANDATORY

```
1. Read feature-catalog.json → features[id={feature-id}]
2. Update fields:
   - status: "implemented"
   - implementation_evidence:
       commits: [git log main..HEAD --pretty=%H]
       test-files: [globbed paths]
       coverage-pct: {parsed or null}
       adrs: [docs/adr/* paths]
       manual-qa-passed: {ask user, default yes if reviewer=Approved}
       closed-at: {ISO timestamp}
   - test_evidence_ref: "docs/intel/test-evidence/{feature-id}.json" (validated)
3. python ~/.ai-kit/scripts/intel/meta_helper.py update docs/intel/ feature-catalog.json --producer close-feature
```

## Step 6.6 — Persist test-evidence

Consolidate Playwright artifacts → `docs/intel/test-evidence/{feature-id}.json` per schema. Move screenshots → `docs/intel/screenshots/` with CD-4 naming.

## Step 6.7 — Regen intel snapshot — MANDATORY (Cursor Rule 24)

```
python ~/.ai-kit/scripts/intel-snapshot/generate.py --intel-path docs/intel
python ~/.ai-kit/scripts/intel-snapshot/generate.py --intel-path docs/intel --check
```

Expected: `[OK] Snapshot fresh`. If --check fails → investigate before sealing.

### 6.7.1 Intel-refresh handoff

If `_state.md.intel-drift: true` (set by dev/fe-dev when code touched auth/role/route):
```
⚠ intel-drift set in this pipeline.
Snapshot regen done but may be stale vs new code state.
Khuyến nghị: chạy /intel-refresh trước /new-feature kế tiếp.
```
Set `feature-catalog.features[id].intel-refresh-pending: true`.

## Step 6.8 — Worktree handoff (Wave 13+)

If `_state.md.worktree-path` set:
```
worktree_path = state.worktree-path
branch = state.worktree-branch
base = state.worktree-base

uncommitted = `git status --porcelain` (in worktree)
ahead_count = `git rev-list --count {base}..HEAD`

Print:
  ## Worktree handoff
  Pipeline ran in: {worktree_path}
  Branch: {branch} (base: {base}, {ahead_count} commits ahead)
  Uncommitted: {YES — review/commit | clean}

  Next steps:
    1. git diff {base}..HEAD       (review)
    2. (commit any leftover)
    3. /apply-worktree              (Windsurf merges branch → base)
    4. /delete-worktree             (cleanup)
    5. (if intel-drift) /intel-refresh in main checkout
```

DO NOT auto-merge / auto-remove. User controls via Windsurf slash commands.

## Step 6.9 — Update global_rules.md (knowledge base)

Scan retrospective + reviewer findings for transferable lessons. Append at least 1 entry per applicable section in `~/.codeium/windsurf/memories/global_rules.md`:

| Section | Trigger |
|---|---|
| Domain Glossary | New VN business term coined |
| Architecture Decisions | ADR-NNN produced this feature |
| Recurring Issues | QA found bug class repeated ≥ 2× |
| Performance Notes | NFR target measured |
| Integration Quirks | External API surprise |

If no new lesson → leave explicit "no-lesson" comment.

## Step 7 — Output summary

```
## Pipeline Closed: {feature-name}

**ID:** {id}
**Type:** {feature | hotfix}
**Duration:** {created} → {closed-at}

### Results
| Metric | Value |
|---|---|
| Cycle time | {days} |
| Rework count | {count} |
| Reviewer verdict | {verdict} |

### Artifacts
{list files under docs-path}

---
Pipeline closed: {docs-path}
To free context: /clear then /new-feature
```

## What's next

| Outcome | Next |
|---|---|
| Closed successfully | Done |
| `intel-drift: true` was set | `/intel-refresh` |
| Rework count > 0 | retrospective analysis (PM auto-generates) |
| Hotfix Critical | postmortem (PM expanded retro) |
