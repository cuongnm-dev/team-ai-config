---
name: close-feature
description: Đóng pipeline phát triển 1 tính năng đã hoàn thành. Kiểm tra đã có người duyệt cuối, chạy phiên rút kinh nghiệm (retrospective), niêm phong file _state.md, cập nhật bản đồ tính năng feature-map.yaml. Là bước cuối trước khi merge code.
---

# Close Pipeline

User-facing output: Vietnamese.

## ⚠️ ai-kit CLI Enforcement (ADR-005)
**Status seal MUST use `Bash("ai-kit sdlc state update --op status ...")` for atomic cross-file update.** Per ADR-005 D3 (supersedes prior CD-8 v3 MCP wording).

| Legacy step | New ai-kit CLI command |
|---|---|
| Path resolution glob `docs/features/` + `docs/hotfixes/` | `ai-kit sdlc resolve --kind feature --id F-NNN` |
| Update `_state.md` status + Update `feature-catalog.json` status | `ai-kit sdlc state update --file <path> --op status --entity-id F-NNN --status done --evidence '<json>'` — atomic 2-file write |
| Update `feature-map.yaml` | Auto-updated by `ai-kit sdlc state update --op status` |
| Append Stage Progress row "Closed" | `ai-kit sdlc state update --op progress --stage close --verdict Sealed --artifact close-report.md` |
| Pre-close verify | `ai-kit sdlc verify --scopes completeness,cross_references,id_uniqueness --strict block` — hard-stop if HIGH severity findings |

**Forbidden**:
- ❌ Glob fallback for path resolution
- ❌ Direct Write to feature-map.yaml or catalogs
- ❌ Edit `_state.md` to seal — must use `ai-kit sdlc state update --op status`

**ai-kit CLI unavailable → BLOCK pipeline** (ADR-005): hard-stop with message: "Install/update ai-kit CLI: `ai-kit update`. Verify via `ai-kit doctor`." NO silent local fallback — sealing without atomic CLI txn corrupts feature-catalog under concurrent close-feature runs.

**Reference**: ADR-003 D8 + ADR-005 D3.

---

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

## Step 0 — Flag handling (Resume Protocol Lockout escape — audit-2026-05-06 T1-8)

**Purpose**: Allow user to UN-SEAL a closed feature when reviewer verdict was wrong or sealing was premature. Without `--reopen`, sealed features are irreversible at skill level (only `git revert` + manual edit works).

**Recognized flag**:

| Flag | Effect |
|---|---|
| `--reopen <feature-id>` | Reverse seal: `status: done → in-progress`, `current-stage: closed → reviewer`, restore archived sections from `.archive/`, push reviewer back to `stages-queue` front. Backup `_state.md.bak.{ISO}`. Optionally clear `intel-warning: qa-gate-bypassed` if user fixed gap. |

**Detection logic** (Step 0.1, BEFORE Step 1):

```
IF --reopen <feature-id> present:
  Resolve _state.md path via Bash("ai-kit sdlc resolve --kind feature --id <feature-id>")
  Read _state.md
  IF _state.md.status != "done":
    REFUSE: "Feature {id} is not sealed (status={current}). --reopen only valid for status=done."
    EXIT
  
  Confirm with user:
  Print: "⚠️ Reopening sealed feature {id} (closed at {closed-at} by {closed-by}). 
          This will:
          - Set status: done → in-progress
          - Set current-stage: closed → reviewer
          - Push reviewer back to stages-queue front
          - Restore .archive/{ISO}/ sections to {features-root}/{id}/
          - Optionally clear intel-warning if user has addressed gap
          Confirm? (yes/no/cancel)"
  
  IF confirmed:
    cp _state.md _state.md.bak.{ISO}
    
    # Restore archived sections (if .archive/ exists)
    IF {features-root}/{feature-id}/.archive/ exists:
      latest_archive = ls .archive/ | sort | tail -1
      Move .archive/{latest_archive}/* → {features-root}/{feature-id}/
      Remove .archive/{latest_archive}/
    
    # State mutation
    status = "in-progress"
    current-stage = "reviewer"
    stages-queue = ["reviewer"] + stages-queue
    closed-by = null
    closed-at = null
    reopened-at = {ISO}
    reopened-reason = AskUserQuestion: "Reason for reopen?" (free-text, recorded)
    
    # Optional: clear intel-warning
    IF feature-catalog.features[id].intel-warning == "qa-gate-bypassed":
      AskUserQuestion: "Clear intel-warning? (only if QA gap addressed) (yes/no)"
      IF yes: feature-catalog.features[id].intel-warning = null
    
    Write _state.md
    
    Print: "✅ Feature {id} reopened. Run /resume-feature {id} to continue from reviewer stage."
    EXIT
  ELSE:
    EXIT (no mutation)

IF no flag → continue to Step 1 (normal close flow)
```

**Why skill-side state mutation, not MCP `update_state(op=status, status=in-progress)`**: Pending MCP backend support for "reopen" status transition (T1-12 in audit-2026-05-06 roadmap). Skill-side mutation works today; switch to MCP when primitive ships.

**Audit trail**: every reopen records `reopened-at`, `reopened-by`, `reopened-reason` in `_state.md` frontmatter — searchable by reviewer in next intake (CD-10 #6.7 retrospective).

---

## Step 1 — Identify the pipeline

**If ID provided** → go to Step 2.

**If no ID** → call `Bash("ai-kit sdlc resolve --kind feature|hotfix")` then filter by `metadata.status` ≠ `done`. ai-kit CLI unavailable → BLOCK per ADR-005 D3. NO Glob fallback (audit-2026-05-06 T1-1).

Show only pipelines where `status` ≠ `done`:

```
## Active Pipelines

| ID | Type | Current Stage | Last Updated |
|---|---|---|---|
| {id} | feature | {stage} | {date} |

Which pipeline do you want to close?
```

No active pipelines → stop: "No active pipelines found."

## Step 2 — Locate `_state.md` via ai-kit CLI (audit-2026-05-06 T1-1; ADR-005)

```
result = Bash("ai-kit sdlc resolve \
  --workspace . \
  --kind {feature|hotfix|module} \
  --id {feature-id} \
  --include-metadata")
parse stdout JSON for { ok, data: { path, exists, metadata } }
```

Returns: `{path, status, current_stage, pipeline_type, verdict_history}`.

**MCP unavailable → BLOCK** per CD-8 v3: "Run `docker compose up -d` from `~/.ai-kit/team-ai-config/mcp/etc-platform/` then retry." NO Glob fallback (forbidden patterns audit T1-1).

**Not found** → stop: "No pipeline found for `{id}`. Run /resume-feature OR /new-feature {id} first."

**Forbidden patterns** (audit T1-1 — replaced):
- ❌ `Glob **/docs/features/{id}/_state.md` last-resort → `resolve_path(include_metadata=true)`
- ❌ Read `docs/feature-map.yaml` direct → MCP reads it server-side via `resolve_path`
- ❌ Read `_state.md` directly to extract fields → `resolve_path` returns metadata in same call

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

## Step 5 — Seal `_state.md` via ai-kit CLI atomic txn (audit-2026-05-06 T1-1; ADR-005)

**Replaced legacy direct frontmatter mutation with `ai-kit sdlc state update --op status` per ADR-005 D3.**

```
Bash("ai-kit sdlc state update \
  --workspace . \
  --file '{features-root}/{feature-id}/_state.md' \
  --op status \
  --entity-id '{feature-id}' \
  --status done \
  --evidence '<json: {closed-by, closed-at, final-verdict}>'")
# CLI atomically: bumps _state.md status + feature-catalog.features[id].status='implemented'
# + records implementation_evidence{}. Cascade fields below kept as comments for migration trace:
legacy_cascade_block = {
    feature-catalog: {
      target_field: "status",
      target_value: "implemented",
      additional_fields: {
        implementation_evidence: {
          commits: ["{git log main..HEAD --pretty=%H}"],
          test-files: ["{paths under tests/}"],
          coverage-pct: {parsed from coverage report or null},
          adrs: ["{docs/adr/* paths}"],
          manual-qa-passed: {boolean from user prompt},
          closed-at: "{ISO}"
        },
        test_evidence_ref: "docs/intel/test-evidence/{feature-id}.json" (if exists)
      }
    },
    feature-map.yaml: {
      target_field: "status", target_value: "done",
      additional_fields: { current-stage: "closed", updated: "{YYYY-MM-DD}" }
    },
    _meta.json: {
      operation: "provenance-update", producer: "close-feature"
    }
  }
)
```

**MCP atomic guarantees**:
- 4 files updated in single txn: `_state.md` + `feature-catalog.json` + `feature-map.yaml` + `_meta.json`
- Schema validation inline (no drift between SDLC state + canonical intel)
- Concurrent close-feature on different features safe (per-feature lock)
- On any failure → rollback all writes; surface error

**Forbidden patterns** (audit T1-1 — replaced):
- ❌ Direct Edit `_state.md` frontmatter → use `update_state(op=status)`
- ❌ Direct Write `feature-map.yaml` → cascade in `update_state`
- ❌ Direct Write `feature-catalog.json` → cascade in `update_state`
- ❌ `python ~/.claude/scripts/intel/meta_helper.py update` subprocess → cascade in `update_state`

**Stage Progress table append** (still valid — small append, no race):
```
| — | Pipeline Closed | — | Done | {date} |
```
This MAY use direct Edit since `_state.md` body sections (below frontmatter) are append-only by close-feature only (P1 single-writer at this terminal stage).

**MCP unavailable → BLOCK pipeline** per CD-8 v3 (no silent fallback — sealing without atomic txn corrupts feature-catalog).

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

## Step 6 + 6.5 — Merged into Step 5 atomic update_state (audit-2026-05-06 T1-1)

**Removed**: legacy Step 6 (`feature-map.yaml` direct write) + Step 6.5 (read+modify+write `feature-catalog.json` + `meta_helper.py` subprocess). Both operations now atomic in Step 5's `update_state(op=status, cascade=...)` MCP call.

**Why merged**: Step 5 + 6 + 6.5 were 3 separate file mutations with race risk. CD-8 v3 mandates atomic txn — concurrent `/close-feature` on different features could corrupt `feature-catalog.json` if Step 6.5 ran with stale Read. MCP `update_state` cascade guarantees atomicity.

**Migration impact** (for legacy mode if MCP unavailable):
- MCP-down → BLOCK per CD-8 v3 (no silent local fallback)
- User runs `docker compose up -d` then retries
- No skill-side fallback to legacy Read+Write+meta_helper subprocess

## Step 6.6 — Validate test-evidence presence (assembly-not-testing per CD-10 #17)

**Ownership** (audit-2026-05-06 T2-6 + CD-10 #16 atomic triple): test-evidence is the **QA stage's deliverable**, not close-feature's. QA agent in resume-feature MUST produce 3 artifacts atomically:
- (a) `docs/intel/test-evidence/{feature-id}.json` (test_cases[] with execution status)
- (b) `playwright/{id}.spec.ts` (re-runnable script)
- (c) `screenshots/{id}-step-NN-{state}.png` (CD-4 naming, captured during Playwright)

**close-feature ONLY validates presence** — does NOT consolidate, parse, or generate evidence. If QA didn't produce, that's a contract violation and should have been caught by Step 3b QA artifact gate (line 119+).

**Validation logic**:

```
test_evidence_path = docs/intel/test-evidence/{feature-id}.json

IF test_evidence_path NOT exists:
  Step 3b QA gate should have caught this — re-check:
  IF feature.intel-warning == "qa-gate-bypassed":
    OK — bypass was explicit; record `intel-warning: no-test-evidence` in summary
  ELSE:
    REFUSE close: "test-evidence missing despite Step 3b passed. QA stage contract violated. 
                  Run /resume-feature {id} --rerun-stage qa to produce."
    EXIT

IF test_evidence_path exists:
  Validate via Bash("ai-kit sdlc verify --workspace . --scopes schemas --strict warn") OR
  Fall back: python ~/.claude/scripts/intel/validate.py {test_evidence_path} --schema test-evidence
  
  IF validation fails:
    REFUSE close: "test-evidence schema invalid: {errors}. QA stage must fix before close.
                  Run /resume-feature {id} --rerun-stage qa."
    EXIT
  
  IF all test_cases[].execution.status populated AND ac_coverage_pct >= 80:
    OK — proceed
    Set features[].test_evidence_ref = "docs/intel/test-evidence/{feature-id}.json" (in feature-catalog Step 6.5)
  ELSE:
    REFUSE close: "test-evidence has gaps: {N} unexecuted TCs, AC coverage {pct}%. Re-run qa."
    EXIT
```

**Removed from this step** (delegated to QA stage as canonical producer per CD-10 #16):
- ❌ Locating Playwright artifacts → QA stage knows its own outputs
- ❌ Parsing JSON reporter output → QA stage produces structured test-evidence directly
- ❌ Moving/renaming screenshots → QA captures with CD-4 naming during execution
- ❌ Computing coverage → QA emits in test-evidence.coverage block
- ❌ Writing test-evidence/{feature-id}.json → QA owns this path (P1 single-writer)

**Forbidden patterns** (audit-2026-05-06 T2-6):
- ❌ close-feature parsing Playwright JSON (was a workaround when QA didn't own evidence — now obsolete)
- ❌ close-feature renaming screenshots (CD-4 naming is QA capture-time responsibility)
- ❌ close-feature writing test-evidence (P1 violation — QA single-writer)

**Why validation-only**: assembly-not-testing principle (CD-10 #17). close-feature is downstream consumer; if QA contract violated, fix at QA stage, not paper over here.

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

## Step 6.8 — Populate `40-project-knowledge.mdc` (MANDATORY when lessons exist)

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

## Step 6.9 — Worktree handoff (Cursor 3+ native — only if `worktree-path` set in _state.md)

If feature ran inside a Cursor-managed worktree, surface next-steps for the user. **DO NOT** auto-merge or auto-delete — those are user-controlled Cursor slash commands (`/apply-worktree`, `/delete-worktree`).

```
worktree_path = _state.md.worktree-path

IF worktree_path is set:
  branch = _state.md.worktree-branch
  base   = _state.md.worktree-base    # usually "main"

  # Sanity check before suggesting apply
  uncommitted = `git status --porcelain` (run in worktree dir)
  ahead_count = `git rev-list --count {base}..HEAD`

  Print:
    ## Worktree handoff
    Pipeline ran in worktree: {worktree_path}
    Branch: {branch} (base: {base}, {ahead_count} commits ahead)
    Uncommitted: {len(uncommitted) > 0 ? "YES — review/commit before apply" : "clean"}

    Next steps (user runs in Cursor):
      1. Review diff:        git diff {base}..HEAD
      2. Commit any leftover changes (if "Uncommitted: YES")
      3. Merge to {base}:    /apply-worktree
      4. Cleanup worktree:   /delete-worktree
      5. (If intel-drift was set) /intel-refresh in main checkout

  Append banner to summary (Step 7) so user doesn't miss the handoff.

ELSE (legacy / main-checkout flow):
  Skip — no worktree handoff needed.
```

**Forbidden in this skill:**
- ❌ Running `git merge` directly — user uses `/apply-worktree` for review-able merge
- ❌ Running `git worktree remove` — user uses `/delete-worktree` (or Cursor cleanup interval handles it)
- ❌ Forcing apply when uncommitted changes exist — let user decide

Reference: https://cursor.com/docs/configuration/worktrees

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
