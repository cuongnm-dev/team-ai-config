---
name: close-feature
description: Đóng pipeline phát triển 1 tính năng đã hoàn thành. Kiểm tra đã có người duyệt cuối, chạy phiên rút kinh nghiệm (retrospective), niêm phong file _state.md, cập nhật bản đồ tính năng feature-map.yaml. Là bước cuối trước khi merge code.
---

# Close Pipeline

User-facing output: Vietnamese.

**LIFECYCLE CONTRACT** (machine-readable; `~/.claude/schemas/intel/LIFECYCLE.md` §5.5):

```yaml
contract_ref: LIFECYCLE.md#5.5
role: Seal a feature dossier; sync canonical intel to implemented status with full evidence.
read_gates:
  required:
    - "{features-root}/{feature-id}/_state.md"
    - "{features-root}/{feature-id}/08-review-report.md"
    - "docs/intel/feature-catalog.json#features[id={feature-id}]"
    - "docs/intel/test-evidence/{feature-id}.json"
    - "{playwright-root}/{feature-id}.spec.ts"
    - "git log main..HEAD"
own_write: []  # creates no new artifacts
update:
  _state.md:
    - status: done
    - current-stage: closed
    - SEAL (locked_fields)
  feature-map.yaml:
    - status: done
  feature-catalog.json:
    target: features[id={feature-id}]
    fields:
      - status: implemented
      - implementation_evidence: {commits, test_files, coverage_pct, adrs, manual_qa_passed, closed_at}
      - test_evidence_ref: validated path
    operation: SEAL into _meta.locked_fields
  _meta.json:
    operation: update for 4 touched artifacts
forbid:
  - modifying sitemap.routes / permission-matrix    # intel-refresh job
  - modifying data-model / integrations             # intel-refresh job
  - re-running test cases                           # qa job
  - bypassing QA atomic triple gate                 # CD-10 Q.16
exit_gates:
  - feature-catalog has full implementation_evidence
  - test_evidence_ref points to validated file
  - intel-snapshot regen suggested to user
failure_modes:
  - QA atomic triple incomplete: STOP
  - reviewer verdict != Approved: STOP
  - required intel artifact missing: STOP
  - test-evidence schema validation fails: STOP
```

## Step 1 — Identify the pipeline

**If ID provided** → go to Step 2.

**If no ID** → read `docs/feature-map.yaml` first (fast scan). If absent, fall back to globbing `docs/features/` and `docs/hotfixes/`.

Show only pipelines where `status` ≠ `done`:

```
## Active Pipelines

| ID | Type | Current Stage | Last Updated |
|---|---|---|---|
| {id} | feature | {stage} | {date} |

Which pipeline do you want to close?
```

No active pipelines → stop: "No active pipelines found."

## Step 2 — Locate `_state.md`

Resolution order (same as resume-feature):
1. `docs/feature-map.yaml` → lookup `features.{id}.docs_path` → `{docs_path}/_state.md`
2. `docs/features/{id}/_state.md`
3. `docs/hotfixes/{id}/_state.md`
4. Glob `**/docs/features/{id}/_state.md` (last resort)

extract: `docs-path`, `feature-name`, `pipeline-type`, `status`, `current-stage`, reviewer verdict from completed-stages.

Not found → stop: "No pipeline found for `{id}`."

## Step 3 — Validate close condition

| Condition | Action |
|---|---|
| Reviewer verdict = `Approved` or `Approved with follow-ups` | Proceed |
| `status: done` or `current-stage: closed` | Already closed — report and stop |
| Reviewer verdict missing | Ask: "Reviewer chưa approve. Force-close? (yes/no)" |
| `status: blocked` | Warn: "Pipeline blocked at {stage}. Force-close sẽ discard state đó. Tiếp tục?" |

Force-close: if user confirms → note reason in _state.md, proceed.

## Step 3b — QA artifact gate (CD-10 Quy tắc 14, 15, 16) — HARD-STOP

Before sealing, verify QA stage produced complete evidence trio. This is a HARD-STOP — `--force-close` does NOT bypass.

```
1. Load docs/intel/feature-catalog.json → locate features[].id == {feature-id} → read:
   - acceptance_criteria (count)
   - roles (count)
   - dialogs (count if present)
   - error_cases (count if present)

2. Compute min_tc(feature) per CD-10 Quy tắc 15:
     min_tc = max(5,
                  len(AC) * 2 +
                  len(roles) * 2 +
                  len(dialogs) * 2 +
                  len(error_cases) +
                  3)  # 3 baseline edge cases

3. Verify 3 artifact groups exist (CD-10 Quy tắc 16):

   A. Test cases (prose):
      - File exists: docs/intel/test-evidence/{feature-id}.json
      - len(test_cases) >= min_tc(feature)
      - Every TC has execution.status set (passed | failed | skipped)
      - Aggregate: passed_count == len(test_cases) (100% pass for done status)

   B. Playwright scripts (executable):
      - File exists at one of:
          tests/e2e/{feature-id}*.spec.ts
          tests/e2e/{feature-id}/*.spec.ts
          docs/intel/playwright/{feature-id}.spec.ts
      - File size > 200 bytes (sanity check; not stub)
      - Path recorded in test_cases[].execution.playwright_script

   C. Screenshots (visual evidence):
      - Directory has CD-4-named files: docs/intel/screenshots/{feature-id}-step-NN-{state}.png
      - count >= max(3, count of state-changing TCs)
      - Each TC with state-change has screenshot_refs[] populated

4. Cross-check coverage:
   - acceptance_criteria_coverage_pct == 100% (every AC has ≥1 linked TC)
   - role_coverage_pct == 100% (every role in feature.roles has ≥1 TC tagged role-{slug})

5. Determine outcome:
   IF all 3 groups present AND coverage 100% AND all TCs passed:
     → PROCEED (display green checkmark with stats)

   else:
     → HARD-STOP with itemized verdict:

     ❌ Cannot close feature {id} — QA evidence incomplete

     Required (CD-10 Quy tắc 14-16):
     [ ] Test cases prose:    {actual} / {min_tc} TCs            ← need {gap} more
     [ ] Test execution:      {passed_count}/{total} passed       ← {failed_count} failed
     [ ] Playwright script:   {exists | MISSING}
     [ ] Screenshots:         {actual} / {expected} files
     [ ] AC coverage:         {pct}% (need 100%)
     [ ] Role coverage:       {pct}% (need 100%)

     action:
       1. Re-run /resume-feature {id} → drives QA stage
       2. QA agent will co-produce missing artifacts
       3. Then re-run /close-feature {id}

     Override (NOT recommended; for legacy/pre-MVP only):
       /close-feature {id} --skip-qa-gate
       This persists `intel-warning: qa-gate-bypassed` and
       `qa_status: incomplete-bypass` in feature-catalog.
```

**Why HARD-STOP**: CD-10 Quy tắc 17 establishes generate-docs as ASSEMBLY skill. If close-feature seals with incomplete evidence, every downstream xlsx render falls back to synthesis (low quality, marked PROPOSED). The cost of fixing QA upstream once << cost of every doc consumer falling back forever.

**Bypass policy**: `--skip-qa-gate` is logged + visible in feature-map.yaml + feature-catalog.qa_status. Reviewer audit in next feature intake will surface bypassed features (CD-10 Quy tắc 6.7 retrospective scan).

## Step 4 — Run retrospective (if missing)

Check `{docs-path}/09-retrospective.md`. If exists → skip to Step 5.

If missing → run automatically via Task(pm) to generate retrospective from KPI data.

## Step 5 — Seal `_state.md`

Update frontmatter:
```yaml
status: done
current-stage: closed
last-updated: {YYYY-MM-DD}
closed-by: close-feature
closed-at: {YYYY-MM-DD}
```

Append final row to Stage Progress table:
```
| — | Pipeline Closed | — | Done | {date} |
```

### Step 5b — Compress historical sections (token saving for resume / status checks)

After 5+ stages a `_state.md` accumulates 500+ lines; every `dispatcher`, `pm`, `feature-status`, and `resume-feature` invocation re-reads the full file. Compress at close time:

1. **Stage Progress table**: keep header + last 3 rows + "Pipeline Closed" row. Move pre-final rows to `{docs-path}/.archive/state-stage-history.md` (append-mode).
2. **Wave History**: keep summary line per wave (`W{N}: {N tasks} | {qa-verdict} | {YYYY-MM-DD}`). Move detailed dev/qa/reviewer per-wave rows to `{docs-path}/.archive/state-wave-history.md`.
3. **Inline change-digest blocks** (`05-change-digest-w{N}.md` references) → keep title + 1-line summary, archive full block.

result: `_state.md` shrinks ~60% on average; archive files preserve full audit trail (read on demand by retrospective tooling, not by routine pipeline ops).

Skip compression IF:
- `_state.md` already < 200 lines
- Pipeline is `hotfix` (typically 1-2 stages, no benefit)
- `output-mode: full` (full mode keeps everything for compliance audit)

## Step 6 — Update `feature-map.yaml`

Update the feature's entry:
```yaml
features:
  {id}:
    status: "done"
    current-stage: "closed"
    updated: "{YYYY-MM-DD}"
```

## Step 6.5 — Sync canonical intel layer (CD-10) — MANDATORY

`feature-map.yaml` and `_state.md` are SDLC-side state. `docs/intel/feature-catalog.json` is the cross-skill canonical truth. Both must be updated, otherwise `generate-docs` reads stale status.

```
1. Read docs/intel/feature-catalog.json
2. Locate features[].id == {feature-id}
3. Update fields:
   - status: "implemented"
   - implementation_evidence:
       commits: [list git commit shas in feature branch — `git log main..HEAD --pretty=%H`]
       test-files: [paths globbed under tests/, __tests__/, *.spec.* relevant to feature]
       coverage-pct: {parsed from latest coverage report if present, else null}
       adrs: [paths to docs/adr/* created/modified during this feature]
       manual-qa-passed: {ask user yes/no, default yes if reviewer verdict=Approved}
       closed-at: {ISO timestamp}
4. If test-evidence file exists at docs/intel/test-evidence/{feature-id}.json:
   - Set features[].test_evidence_ref = "docs/intel/test-evidence/{feature-id}.json"
   - Validate the file against test-evidence.schema.json — warn if invalid
5. Write back feature-catalog.json
6. Update _meta.json:
   python ~/.claude/scripts/intel/meta_helper.py update docs/intel/ feature-catalog.json \
     --producer close-feature --append-merged-from
```

**Anti-pattern (FORBIDDEN):** sealing feature in `feature-map.yaml` without syncing `feature-catalog.json`. Drift between SDLC state and canonical intel = `generate-docs` later regenerates test cases for "in_development" features that are actually shipped.

## Step 6.6 — Persist test-evidence (if QA stage produced artifacts)

QA stage in resume-feature should have written:
- Playwright test files (e.g. `tests/e2e/{feature-id}/*.spec.ts`)
- Test results (Playwright JSON reporter output)
- Screenshots (typically in `playwright-report/` or `test-results/`)

Consolidate into `docs/intel/test-evidence/{feature-id}.json` per `~/.claude/schemas/intel/test-evidence.schema.json`:

```
1. Locate Playwright artifacts (search test-results/, playwright-report/, or paths from _state.md.qa-stage.outputs)
2. Parse JSON reporter output → fill test_cases[].execution.{status, duration_ms, executed_at, failure_reason}
3. Move/copy screenshots to docs/intel/screenshots/ with canonical naming: {feature-id}-step-NN-{state}.png
   (rename from Playwright auto-generated names; map step order from test definition)
4. Compute coverage:
   - ac_covered = count of acceptance_criteria with ≥1 linked test case (idx tracked in test_cases[].linked_acceptance_criteria_idx)
   - ac_coverage_pct = ac_covered / ac_total × 100
5. Write docs/intel/test-evidence/{feature-id}.json
6. Update _meta.json (producer: close-feature)
```

If QA stage did NOT produce evidence (skipped or pre-MVP feature) → skip this step but record `intel-warning: no-test-evidence` in summary.

## Step 6.7 — Regenerate intel snapshot (Cursor Rule 24) — MANDATORY

After feature-catalog.json + _meta.json updates, snapshot is now stale. Regen:

```bash
python ~/.cursor/skills/intel-snapshot/generate.py --intel-path docs/intel
# Verify
python ~/.cursor/skills/intel-snapshot/generate.py --intel-path docs/intel --check
```

expected: `[OK] Snapshot fresh`. If `--check` returns 1 → snapshot regen failed; investigate before sealing.

**Why mandatory at close-feature**: Next pipeline run on a different feature will read this snapshot. If stale, base-tier agents either:
1. Fall back to canonical JSON (lose 95% token saving), OR
2. Use stale data (worse — drift between SDLC and intel reality)

Failure to regen at close = silent token bloat across ALL future features in this workspace.

### Step 6.7.1 — Intel-refresh handoff (when drift detected)

Read `_state.md.frontmatter.intel-drift`:

- IF `intel-drift: true` (set by dev/fe-dev when code change touched auth/role/route/RBAC/migration during this pipeline):
  - Snapshot regen ở Step 6.7 chỉ compress canonical JSON HIỆN TẠI — không re-derive từ code state mới.
  - **MUST** suggest user chạy `/intel-refresh` để re-extract sitemap + permission-matrix từ code mới (Tier 1+2 regen) trước khi feature tiếp theo bắt đầu.
  - Print prompt:
    ```
    ⚠ intel-drift được set trong pipeline này (code change đã chạm auth/role/route).
    Snapshot đã regen nhưng có thể stale vs code state mới.
    Khuyến nghị: chạy `/intel-refresh` trước khi /new-feature kế tiếp.
    Override: skip nếu drift là minor (ví dụ chỉ rename internal variable).
    ```
  - Set `feature-catalog.features[id].intel-refresh-pending: true` để feature tiếp theo (`new-feature` Step 2.5) phát hiện và block-if-missing escalate.

- IF `intel-drift: false | unset` → skip (snapshot regen ở Step 6.7 là đủ).

## Step 6.7 — Populate `40-project-knowledge.mdc` (MANDATORY when lessons exist)

This file is the team's living knowledge base — empty unless someone fills it. Before sealing, scan the retrospective + reviewer findings for transferable lessons and append at least one entry per applicable section in `~/.cursor/rules/40-project-knowledge.mdc`:

| Section | Trigger to add an entry |
|---|---|
| Domain Glossary | New VN business term coined OR existing term refined |
| Architecture Decisions | Any ADR-NNN file produced this feature → cite + 1-line summary |
| Recurring Issues | QA found bug class repeated ≥ 2× across waves OR similar to past hotfix |
| Performance Notes | NFR target measured (latency, throughput, memory) — even if pass |
| Integration Quirks | External API contract surprise / undocumented behavior encountered |

If a section truly has no new lesson this iteration, leave a comment line explaining why (e.g. `<!-- no new domain term added; feature was internal refactor -->`) — do NOT leave the bare `_No entries yet._` placeholder.

Verdict requires either ≥ 1 new entry OR an explicit "no-lesson" comment per applicable section. Reviewer audits this in next feature's intake.

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
To free context: /clear then /new-feature or /hotfix
```

## What's next

| Outcome | Next skill |
|---|---|
| Closed successfully | Done — no action needed |
| `intel-drift: true` was set | `/intel-refresh` để re-derive sitemap + permission-matrix từ code state mới (xem Step 6.7.1) |
| Rework count > 0 | `@pm` for deeper retrospective analysis (no dedicated `/retrospective` skill yet — PM agent generates inline via `ref-pm-retrospective.md`) |
| Hotfix severity Critical | `@pm` postmortem (no `/postmortem` skill yet) |
