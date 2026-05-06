---
name: update-feature
description: Cập nhật feature đã tồn tại (F-NNN). Post-ADR-003 nested feature -> tự động redirect sang /update-module {parent} --change-feature F-NNN (vì pipeline drive ở cấp module). Legacy F-NNN tại docs/features/F-NNN/ -> handle trực tiếp với update flow như cũ. Trigger - feature có sẵn cần thay đổi requirement / scope / implementation; "update feature"; change request 1 feature cụ thể. Anti-trigger - feature chưa tồn tại thì /new-feature; module-level change đụng nhiều features thì /update-module. Example - "/update-feature F-022".
---

# Update Feature — Variant-aware Redirect / Update

User-facing prompts: Vietnamese. Skill prose: English.

## ⚠️ ai-kit CLI Enforcement (ADR-005)

| Step | ai-kit CLI command |
|---|---|
| Resolve F-NNN | `ai-kit sdlc resolve --kind feature --id F-NNN --include-metadata` |
| Read feature spec / state | `Read {feature_path}/_feature.md` (post-ADR-003) or `Read {feature_path}/_state.md` (legacy) |
| Variant detection | path prefix check (per CD-23) |

**Forbidden** per ADR-005 D3:
- ❌ Skip variant detection (handles post-ADR-003 redirect to /update-module)
- ❌ Direct Write/Edit on `_feature.md` or `_state.md` (use /update-module --change-feature flow OR legacy flow)

---

## ⚠️ SKILL ROLE — VARIANT-AWARE DISPATCHER

Two paths:
- **Post-ADR-003 nested**: redirect to `/update-module {parent_M} --change-feature F-NNN`
- **Legacy**: handle in-place with feature-level update flow (delegate to shared notepad)

Skill is thin: detect variant, route, OR execute legacy update flow via shared notepad.

---

## Step 0 — Argument validation

```
IF arg empty OR arg not matches `^F-\d+$`:
  Print Vietnamese: "Vui lòng nhập feature-id (F-NNN). Liệt kê features:"
  Display feature-catalog summary (id, name, owner_module, status)
  PROMPT user input
```

## Step 1 — Resolve + variant detection

```
result = Bash("ai-kit sdlc resolve --workspace . --kind feature --id {F-NNN} --include-metadata")
parse stdout JSON for { ok, data: { path, exists, metadata: { module_id, status, ... } } }

IF error.code = MCP_E_NOT_FOUND:
  Levenshtein suggest top 3 <= 3 distance.
  Else: STOP with "Feature {arg} not found. Use /new-feature to create."
  EXIT

resolved_path = result.data.path
parent_M = result.data.metadata.module_id

# CD-23 path-prefix routing
IF resolved_path matches `docs/modules/M-NNN-*/_features/F-NNN-*/`
   AND `_feature.md` exists in resolved_path
   AND `_state.md` does NOT exist:
  variant = "post-ADR-003-nested"
ELIF resolved_path matches `docs/features/F-NNN-*/`
   AND `_state.md` exists:
  variant = "legacy"
ELSE:
  STOP with "Path resolved but variant unclear: {resolved_path}. Manual investigation."
  EXIT
```

## Step 2 — Variant routing

### 2.A — Post-ADR-003 nested -> redirect

```
Print Vietnamese:
  "ℹ Feature {F-NNN} là post-ADR-003 nested dưới {parent_M}.
   Pipeline drive ở cấp module — change request feature sẽ được xử lý qua /update-module
   với mode --change-feature.

   -> Đang redirect sang: /update-module {parent_M} --change-feature {F-NNN}

   /update-module sẽ:
     - Đọc _feature.md (FeatureSpec) hiện tại
     - Hỏi change request specific cho feature
     - Triage starting stage trong scope module pipeline
     - Reset module state với CR linked tới {F-NNN}

   Lựa chọn:
     [enter] Continue redirect
     [a]     Abort"

IF user picks 'a' then EXIT
IF user picks enter then
  # Skill emits invocation hint; user re-invokes manually per Q2 (skill không tự spawn)
  Print Vietnamese:
    "Vui lòng gõ lệnh sau để tiếp tục:
         /update-module {parent_M} --change-feature {F-NNN}"
  EXIT
```

### 2.B — Legacy -> in-place update flow

Legacy F-NNN at `docs/features/F-NNN/_state.md` retain full pipeline.

Pre-flight gates (mirror update-module Step 2):

```
state = Read({feature_path}/_state.md)

IF state.status == "done":
  Print Vietnamese:
    "⚠ Feature {F-NNN} đã sealed (status=done).
     Update sẽ re-open + backup. Lựa chọn: [c] Continue / [a] Abort"
  IF abort then EXIT

Lock check {feature_path}/.resume-lock (mirror update-module 2.3)
```

Then delegate to shared notepad:

```
Load `~/.cursor/skills/_shared/update-flow.md` with caller context:
{
  kind: "feature",
  id: {F-NNN},
  state_path: {feature_path}/_state.md,
  catalog_kind: "feature-catalog",
  resume_command: "/resume-feature {F-NNN}",
  feature_id: null   # legacy feature is itself the unit
}
```

Notepad executes Steps 3-9: interview, active CR check, triage, risk re-eval, ripple analysis (depends_on F-NNN scope), backup + reset, post-reset review.

## Step 3 — Final exit

| Variant | Final action |
|---|---|
| post-ADR-003-nested | Print redirect command, EXIT |
| legacy | After update-flow notepad complete, suggest `/resume-feature {F-NNN}` |

---

## Edge cases

| Condition | Action |
|---|---|
| Arg empty | Prompt + display catalog |
| Feature not found | Levenshtein suggest, else /new-feature |
| Variant unclear (path doesn't match either pattern) | STOP, manual investigation |
| Post-ADR-003 detect | Redirect to /update-module --change-feature, EXIT |
| Legacy detect | Run update-flow notepad in-place |
| Feature in module that's currently being update-moduled | Lock conflict warn |
| User aborts redirect at Step 2.A | EXIT, no mutation |
| `_feature.md` AND `_state.md` both exist (mixed migration) | Prefer post-ADR-003 path; warn user |

---

## What's next

| Variant + outcome | Next |
|---|---|
| Post-ADR-003 redirect | User runs `/update-module {parent_M} --change-feature {F-NNN}` |
| Legacy update done | `/resume-feature {F-NNN}` |
| Aborted | (no mutation — re-run if needed) |

Reference: `~/.cursor/skills/_shared/update-flow.md` + `~/.cursor/skills/_shared/preflight-interview.md` + ADR-003 D8 (variant routing) + CD-23 (schema variants) in `~/.claude/CLAUDE.md`.
