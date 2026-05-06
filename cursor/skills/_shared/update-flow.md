# Update Flow — abstracted intake (kind-aware)

Loaded by `/update-module` and `/update-feature` (legacy variant) with caller context:

- `kind`: "module" or "feature"
- `id`: M-NNN or F-NNN
- `state_path`: full path to `_state.md`
- `catalog_kind`: "module-catalog" or "feature-catalog"
- `resume_command`: "/resume-module {ID}" or "/resume-feature {ID}"

Caller skill provides these as parameters before invoking notepad steps. Notepad is stateless — caller owns Steps 0-2 (arg validate, resolve, pre-flight gates) and Step 10 (final guidance).

---

## Step 3 — Collect change request (interview)

Load `~/.cursor/skills/_shared/preflight-interview.md` Step A but with UPDATE-specific questions:

```
Print Vietnamese:
  "{kind} hiện tại: {id} — {name}
   {kind=module: Business goal: {existing_business_goal}
                  Stages completed: {completed-stages keys}}
   {kind=feature: Acceptance criteria: {top 3 ACs}
                   Status: {status}, current-stage: {current-stage}}

   Trả lời 5 câu sau (change request):

   1. Loại thay đổi (change-type) — chọn 1:
      [a] Business rule change (acceptance criteria, validation logic)
      [b] Architecture / boundary change (new entity, new integration, auth model)
      [c] Implementation approach change (new tech, refactor, performance)
      [d] Scope expansion (thêm flow / use case / sub-feature)
      [e] Scope shrink (xoá flow / deprecate sub-feature)
      [f] Dependency change (depends_on / consumed_by)
   2. Mô tả change (>= 80 chars) — vấn đề + giải pháp đề xuất
   3. Acceptance criteria mới hoặc thay đổi (list, hoặc 'không có')
   4. Constraints — deadline / không break backward compat / migration phải reversible / 'none'
   5. Risk delta — change này có làm tăng risk_score không? [+0 / +1 / +2 / -1] và lý do"
```

Validation: Q2 >= 80 chars; Q1 enum; Q5 numeric delta + rationale.

User abort then EXIT (release lock, no state mutation).

## Step 4 — Active change request check

```
Read state.frontmatter.active-change-requests[] (if exists)
IF non-empty:
  Print Vietnamese:
    "⚠ {kind} đã có {N} change requests đang xử lý:
       - CR-{id}: {description excerpt} (started: {date})
       ...
     Lựa chọn:
       [m] Merge với CR existing — describe how
       [n] New CR independent
       [a] Abort"
```

`[m]` merge: append to existing CR. `[n]` new: continue Step 5. `[a]` exit.

## Step 5 — Triage starting stage

Map change-type (Q1 from Step 3) -> starting stage:

| change-type | Starting stage | Reset stages-queue |
|---|---|---|
| `a` Business rule | `ba` | `[ba, sa-conditional, tech-lead, dev-wave-1, qa-wave-1, reviewer]` |
| `b` Architecture | `sa` (skip ba unless AC also changed) | `[sa, tech-lead, dev-wave-1, qa-wave-1, security-conditional, reviewer]` |
| `c` Implementation | `tech-lead` | `[tech-lead, dev-wave-1, qa-wave-1, reviewer]` |
| `d` Scope expansion | `ba` (re-define scope) | full path per new risk_score |
| `e` Scope shrink | `tech-lead` (re-plan tasks) | `[tech-lead, dev-wave-1, qa-wave-1, reviewer]` |
| `f` Dependency change | `sa` (re-evaluate boundaries) | `[sa, tech-lead, dev-wave-1, reviewer]` |

If trivial (<= 1 file code-only change with no AC delta):

```
Print Vietnamese:
  "ℹ Change này có vẻ trivial (<=1 file, không AC delta).
   -> Cân nhắc dùng /hotfix thay vì /update-{kind} (skip ba+sa, faster path).
   Lựa chọn: [u] Update-{kind} anyway / [h] Hotfix instead / [a] Abort"
```

Print proposed triage:

```
Triage starting stage: {stage}
Reset stages-queue: {queue}
[enter] confirm | [s {stage}] override starting stage | [a] abort
```

## Step 6 — Risk re-evaluation

```
original_risk = state.frontmatter.risk_score (or fallback to catalog.risk_path)
risk_delta = Q5 from Step 3 (+0/+1/+2/-1)
new_risk = original_risk + risk_delta

IF abs(risk_delta) >= 2:
  Print Vietnamese:
    "⚠ Risk jump lớn: {original_risk} -> {new_risk}.
     Pipeline-path có thể đổi:
       Old: {derive S/M/L from original_risk}
       New: {derive S/M/L from new_risk}

     Stages-queue có thể cần thêm/bớt extended roles:
       Suggested additions: {designer | security-design | data-governance | release-manager based on triggers}
       Suggested removals: {if downgrade}

     Lựa chọn:
       [a] Accept proposed queue
       [e] Edit queue manually
       [k] Keep original (override risk_delta=0)"
```

Update `risk_score` in state frontmatter via state update CLI.

## Step 7 — Ripple analysis

Inline heuristic — generate change-impact report:

```
ripple_report = {
  "consumed_by_modules_affected": [],
  "downstream_features_affected": [],
  "code_paths_likely_impacted": [],
  "data_migration_required": false,
  "auth_model_changed": false
}

# Consumed-by impact (kind=feature OR kind=module with --change-feature)
IF feature_id specified:
  consumed_by = feature_entry.consumed_by_modules
  FOR each consumer_M in consumed_by:
    consumer_state = read consumer_M._state.md
    IF consumer_state.status in ['in-progress', 'done']:
      ripple_report.consumed_by_modules_affected.append({
        module_id: consumer_M,
        status: consumer_state.status,
        impact: "consumer integration may break — notify owner"
      })

# Downstream features (depends_on this feature)
FOR each f in feature-catalog.features:
  IF feature_id in f.depends_on:
    ripple_report.downstream_features_affected.append({feature_id: f.id, ...})

# Auth model heuristic
IF Q2 description contains keywords ['auth', 'permission', 'role', 'PII', 'OAuth', 'SSO']:
  ripple_report.auth_model_changed = true
  -> security-design auto-add to stages-queue

# Data migration heuristic
IF Q2 contains keywords ['schema', 'migration', 'entity', 'table', 'column']:
  ripple_report.data_migration_required = true
  -> devops auto-add to stages-queue

Print ripple_report Vietnamese:
  "Ripple analysis:
     - Consumer modules ảnh hưởng: {list with status}
     - Downstream features depends_on: {list}
     - Auth model changed: {y/n}
     - Data migration required: {y/n}

   Recommend additional stages: {list}

   Lựa chọn:
     [enter] confirm + add recommended stages
     [s] Skip stages (override — log warning)
     [a] Abort"
```

Save `change-impact-report.md` at `{state_dir}/change-requests/{ISO}-impact.md` for audit.

## Step 8 — Backup + atomic state reset

```
# 8.1 Backup
backup_id = Bash("ai-kit sdlc state backup --kind {kind} --id {id}")
# Returns backup_id; CLI snapshots state.md + catalog entry + map entry

# 8.2 Reset state
Bash("ai-kit sdlc state update --op status --kind {kind} --id {id} \
  --status in-progress \
  --evidence '<json: {reason: 'update-{kind} CR', cr_id: '<new ID>', risk_delta: <N>}>'")

Bash("ai-kit sdlc state update --op field --kind {kind} --id {id} \
  --path current-stage \
  --value '\"{triaged_stage}\"'")

Bash("ai-kit sdlc state update --op field --kind {kind} --id {id} \
  --path stages-queue \
  --value '{json array}'")

Bash("ai-kit sdlc state update --op field --kind {kind} --id {id} \
  --path risk_score \
  --value '{new_risk}'")

# 8.3 Append re-open log
Bash("ai-kit sdlc state update --op log --kind {kind} --id {id} \
  --entry '<json: {timestamp, change_type, description, mode, feature_id?, risk_delta, backup_id, ...}>'")

# 8.4 Append active-change-requests
Append CR entry to state.frontmatter.active-change-requests[]:
  {id, description, change_type, feature_id?, started_at, status: "open"}
```

On any failure -> CLI atomic rollback to backup. Surface error to user.

## Step 9 — Post-reset review (Q2 confirmed)

```
Print Vietnamese:
  "═══════════════════════════════════════════════════
   ✅ {kind} {id} đã được reset cho update
   ═══════════════════════════════════════════════════
   Backup: {backup_id} (rollback via [d] below)
   Status: in-progress
   Current stage: {triaged_stage}
   Stages-queue: {queue}
   Risk score: {original} -> {new}
   Change request: CR-{id}
   Impact report: {state_dir}/change-requests/{ISO}-impact.md

   Bạn còn bổ sung gì không?
     [enter]   Hoàn tất — gõ {resume_command} để bắt đầu re-pipeline
     [field]   Sửa: stages-queue | current-stage | risk_score | description
     [d]       Rollback — phục hồi state về backup, huỷ change request"
```

`[field]` edit loop via state update CLI.

`[d]` rollback path:

```
Print: "CONFIRM ROLLBACK — sẽ phục hồi state về backup_id {backup_id}, huỷ change request CR-{id}.
        Type 'CONFIRM ROLLBACK' to proceed: ▌"
IF user types exact phrase:
  Bash("ai-kit sdlc state restore --kind {kind} --id {id} --backup-id {backup_id}")
  Print "✅ Rolled back. {kind} trở về trạng thái trước update."
  EXIT
ELSE: Cancel rollback, return to review prompt
```

Caller skill owns Step 10 (final guidance with `{resume_command}` substitution + lock release).
