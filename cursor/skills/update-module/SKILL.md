---
name: update-module
description: Cập nhật module SDLC đã tồn tại (M-NNN) — thay đổi business goal, mở rộng scope, hoặc xử lý change request đụng nhiều features. Bao gồm sub-flow `--change-feature F-NNN` cho update feature nested (post-ADR-003: feature không có pipeline riêng, change request chạy ở cấp module). Re-open module sealed khi cần. Triage starting stage + risk re-eval + ripple analysis. Trigger - module có sẵn cần thay đổi requirement / arch / scope; "update module"; F-NNN nested cần update (auto redirect tới đây). Anti-trigger - module chưa tồn tại thì /new-module; module đang in-progress muốn tiếp tục thì /resume-module; chỉ thay đổi nhỏ 1 feature legacy thì /update-feature legacy path. Example - "/update-module M-001" (interactive) hoặc "/update-module M-001 --change-feature F-022".
---

# Update Module — Change Request Entry Point

User-facing prompts: Vietnamese. Skill prose + dispatcher prompts: English.

## ⚠️ ai-kit CLI Enforcement (ADR-005)

| Step | ai-kit CLI command |
|---|---|
| Resolve M-NNN | `ai-kit sdlc resolve --kind module --id M-NNN --include-metadata` |
| Read state | `Read {module_path}/_state.md` |
| Pre-flight verify | `ai-kit sdlc verify --scopes structure,cross_references` |
| Backup catalog snapshot | `ai-kit sdlc state backup --kind module --id M-NNN` |
| State reset (status) | `ai-kit sdlc state update --op status --kind module --id M-NNN --status in-progress --evidence '<json>'` |
| State reset (current-stage) | `ai-kit sdlc state update --op field --kind module --id M-NNN --path current-stage --value '"{stage}"'` |
| Stages-queue rewrite | `ai-kit sdlc state update --op field --kind module --id M-NNN --path stages-queue --value '<json>'` |
| Append re-open log | `ai-kit sdlc state update --op log --kind module --id M-NNN --entry '<json>'` |
| Rollback | `ai-kit sdlc state restore --kind module --id M-NNN --backup-id <id>` |

**Forbidden** per ADR-005 D3:
- ❌ Direct Write/Edit on `_state.md` (use state update CLI ops)
- ❌ Skip backup before reset (data loss risk)
- ❌ Reset state when in-progress feature exists in module (race risk — Step 2 gate)

---

## ⚠️ SKILL ROLE — UPDATE INTAKE ONLY

This skill prepares module for re-pipeline by mutating state. It does NOT drive pipeline. After reset, user runs `/resume-module {ID}` to start re-work.

### Forbidden:
- ❌ Calling `Task(pm)` — driver is /resume-module
- ❌ Auto-spawning /resume-module — Q2: skill ends with suggestion
- ❌ Reading agent definitions

### Required:
- ✅ Steps 0-9 = update intake (validate, interview, triage, ripple, backup, reset)
- ✅ Step 10 ends with suggestion `/resume-module {ID}`

---

## Step 0 — Argument validation + mode detection

```
IF arg empty:
  Print Vietnamese: "Vui lòng nhập module-id (M-NNN). Hoặc liệt kê modules để chọn:"
  Display module-catalog summary (id, name, status)
  PROMPT user input

IF arg matches `^F-\d+$`:
  Print Vietnamese: "ℹ Bạn nhập feature ID. /update-module yêu cầu module ID.
                     -> Dùng /update-feature {arg} (sẽ tự redirect nếu nested)."
  next-action: /update-feature {arg}
  EXIT

IF arg has `--change-feature F-NNN` flag:
  mode = "feature-change"
  feature_id = F-NNN
ELSE:
  mode = "module-only"
  feature_id = null
```

## Step 1 — Resolve + read state

```
result = Bash("ai-kit sdlc resolve --workspace . --kind module --id {M-NNN} --include-metadata")
parse stdout JSON for { ok, data: { path, exists, metadata: { status, current_stage, ... } } }

IF error.code = MCP_E_NOT_FOUND:
  Levenshtein suggest top 3 <= 3 distance.
  Else: STOP with "Module {arg} not found. Use /new-module to create."
  EXIT

state = Read({module_path}/_state.md)
catalog_entry = read module-catalog.json[id={M-NNN}]
features_in_module = read feature-catalog.features[].filter(module_id == {M-NNN})

IF mode == "feature-change":
  feature_entry = read feature-catalog.features[id={feature_id}]
  IF feature_entry.module_id != {M-NNN}:
    STOP "Feature {feature_id} không thuộc module {M-NNN} (owner: {feature_entry.module_id}).
          Re-run với --change-feature trên đúng owner module."
    EXIT
```

## Step 2 — Pre-flight gates

### 2.1 — Sealed module re-open prompt

```
IF state.status == "done" (sealed):
  Print Vietnamese:
    "⚠ Module {M-NNN} đã sealed (status=done, closed-at: {close_date}).
     Update sẽ:
       1. Re-open status -> in-progress
       2. Backup state hiện tại tại _state.md.bak.{ISO}
       3. Append re-open log với rationale
       4. PM sẽ chạy lại pipeline từ stage triage được ở Step 5.

     Lựa chọn:
       [c] Continue re-open
       [a] Abort"
  IF user picks 'a' then EXIT
```

### 2.2 — In-progress feature conflict

```
in_progress_features = features_in_module.filter(status in ['in-progress', 'blocked'])

IF in_progress_features non-empty AND mode == "module-only":
  Print Vietnamese:
    "⚠ {N} features đang in-progress trong {M-NNN}:
       - F-NNN ({name}, status: {status})
       - ...
     Update module-only sẽ reset module pipeline -> ảnh hưởng các features đang chạy.

     Lựa chọn:
       [w] Wait — đợi các features done trước (recommend)
       [o] Override — reset anyway (sẽ block dev-wave hiện tại)
       [a] Abort"
  IF user picks 'w' or 'a' then EXIT
  IF user picks 'o' then log warning to re-open log entry

IF mode == "feature-change":
  # Single feature change OK even if other features in-progress
  # PM will append change request to module pipeline at appropriate stage
  CONTINUE
```

### 2.3 — Lock conflict

```
Check {module_path}/.resume-lock:
  IF exists, < 10min old:
    "Module có session resume đang chạy. Update sẽ conflict.
     Lựa chọn: [w]ait / [f]orce-takeover / [a]bort"
  ELSE:
    Create lock for this update session
```

## Step 3-9 — Delegated to shared notepad

Load `~/.cursor/skills/_shared/update-flow.md` with caller context:

```
{
  kind: "module",
  id: {M-NNN},
  state_path: {module_path}/_state.md,
  catalog_kind: "module-catalog",
  resume_command: "/resume-module {M-NNN}",
  feature_id: {feature_id or null}      # for --change-feature mode
}
```

Notepad executes Steps 3-9: interview, active CR check, triage, risk re-eval, ripple analysis, backup + reset, post-reset review.

## Step 10 — Final guidance (Q2)

When user picks `[enter]` at notepad Step 9:

```
Print Vietnamese:
  "✅ Update intake hoàn tất.

   Để bắt đầu re-pipeline:
       /resume-module {M-NNN}

   PM sẽ pick up tại stage `{triaged_stage}`, queue đã set với extended roles được suggest.

   {IF mode == feature-change:
     Change request liên kết với F-{NNN} sẽ được PM đưa vào dev-wave plan
     (tech-lead stage sẽ produce plan riêng cho feature này).
   }

   Để xem change-impact report:
       Read {module_path}/change-requests/{ISO}-impact.md"

Release lock. EXIT.
```

---

## Edge cases

| Condition | Action |
|---|---|
| Arg empty | Prompt + display catalog |
| Arg matches F-NNN | Suggest /update-feature, EXIT |
| Module not found | Levenshtein suggest, else /new-module |
| Module status=done | Step 2.1 prompt re-open |
| In-progress features in module (mode=module-only) | Step 2.2 wait/override/abort |
| `--change-feature` arg with mismatched module_id | STOP, suggest correct owner |
| Active change requests existing | Notepad Step 4 merge/new/abort |
| Trivial change (<=1 file code-only) | Notepad Step 5 suggest /hotfix |
| Risk jump >= 2 levels | Notepad Step 6 explicit accept/edit/keep |
| Lock conflict | Wait/force/abort |
| User aborts mid-flow | Release lock, no state mutation |
| ai-kit CLI fail mid-reset | Atomic rollback to backup |
| User picks `[d]` rollback at notepad Step 9 | Confirmation phrase + atomic restore |
| User picks `[h]` hotfix at trivial trigger | EXIT, suggest /hotfix |

---

## What's next

| Outcome | Next |
|---|---|
| Update intake done, ready to re-pipeline | `/resume-module {M-NNN}` |
| Trivial change detected | `/hotfix` |
| Rollback at notepad Step 9 | (state restored — re-run /update-module if needed) |
| Active CR merge | Continue with merged CR description |
| Update aborted | (no mutation — re-run if needed) |

Reference: `~/.cursor/skills/_shared/update-flow.md` + `~/.cursor/skills/_shared/preflight-interview.md` + `D:\AI-Platform\maintainer-notes\adr\ADR-003-sdlc-2tier-module-feature.md` D8 + ADR-005 D3 (state update CLI ops) + CD-22 (structure) + CD-24 (cross-cutting ripple) + LIFECYCLE.md §5.10.C (PM contract).
