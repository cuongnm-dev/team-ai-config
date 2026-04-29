# Stage 4e — HDSD Specialist (Custom Mode "HDSD Writer")

**ROLE**: UX writer for end-user manual. Plain language, step-by-step with screenshots.

**OWNED BLOCKS**: `services[].features[]`, `troubleshooting[]`

**MODEL**: sonnet

**DISPATCH**: AFTER Group A (needs architecture.components for service grouping)

---

## System prompt

```
You are a technical writer producing HDSD (user manual) for end-users (cán bộ, nhân viên).
Output language: Vietnamese (end-user tone — NOT technical).
Forbidden vocabulary: API, endpoint, component, framework, dispatch, mount, emit.
Allowed vocabulary: "Click", "Nhập", "Chọn", "Hiển thị", "Thông báo", button names in quotes.
Format: step-by-step with screenshot filename per step. MIN 5 ui_elements per feature.
```

---

## Context load

```
@Files {DOCS_PATH}/intel/feature-catalog.json            # roles[], role-visibility, multi-role flag
@Files {DOCS_PATH}/intel/sitemap.json                    # multi-role only: workspace, menu_tree, workflow_variants
@Files docs/intel/test-evidence/*.json                   # CD-10 canonical: per-feature screenshots + step mapping (replaces legacy screenshot-map.json)
@Files {DOCS_PATH}/intel/screenshot-validation.json      # coverage status
@Files {DOCS_PATH}/output/content-data.json              # architecture.components (from TKKT)
@Notepads hanh-chinh-vn-rules
@Notepads sitemap-schema                                 # canonical sitemap.json schema reference
```

**Auto-attach MDC**: `generate-docs-base`, `generate-docs-hdsd`

---

## Output structure

**Single-role** (feature-catalog.multi-role: false or absent):
```json
"services": [
  {
    "slug": "<service-slug>",
    "display_name": "Phân hệ <Name>",
    "features": [ <Feature object> ]
  }
],
"role_chapters": [],
"troubleshooting": [ <Troubleshooting object> ]
```

**Multi-role** (feature-catalog.multi-role: true) — add `role_chapters[]` from `sitemap.json`:
```json
"services": [
  {
    "slug": "<service-slug>",
    "display_name": "Phân hệ <Name>",
    "features": [ <Feature object> ]   // flat list, unchanged
  }
],
"role_chapters": [
  {
    "role_slug":    "admin",
    "role_display": "Quản trị hệ thống",
    "feature_ids":  ["F-001", "F-003", "F-007"],
    "intro":        "Chương này hướng dẫn các chức năng dành cho Quản trị hệ thống...",
    "workspace_intro": {
      "login":          { "title": "...", "steps": [...] },
      "dashboard":      { "title": "...", "screenshot": "...", "widgets_overview": [...] },
      "menu_overview":  { "title": "...", "screenshot": "...", "menu_groups": [...] }
    }
  }
],
"troubleshooting": [ <Troubleshooting object> ]
```

**Rules for `role_chapters`** (multi-role only):
- Build from `sitemap.roles[]` × `feature.role-visibility[]`
- `feature_ids` = all feature IDs where `role-visibility` includes this role slug
- `workspace_intro.login/dashboard/menu_overview` from `sitemap.roles[].workspace`
- See full schema at `~/.claude/skills/generate-docs/phases/s4e-write-hdsd.md` (canonical Claude version)

Service groupings MUST match `architecture.components[]` from TKKT.

---

## Feature object schema (MIN 300 words total)

```json
{
  "id": "F-001",
  "name": "<business-function-name-vn>",
  "description": "<50+ words, 2-4 câu business context>",
  "actors": ["<role-vn>"],
  "preconditions": "<20+ words>",
  "ui_elements": [
    {"label": "<vn-label>", "type": "<Input text|Button|Dropdown|...>", "rules": "<constraints>"},
    ...
  ],
  "steps": [
    {
      "no": 1,
      "action": "<end-user-language action>",
      "screenshot": "{feature-id}-step-{NN}-{state}.png",
      "expected": "<what-user-sees>"
    }
  ],
  "dialogs": [
    {
      "title": "<dialog title in UI>",
      "type": "confirm | form | alert | info",
      "trigger": "<which step triggers this, e.g. 'Click nút Xóa ở bước 3'>",
      "message": "<body text shown to user>",
      "buttons": [
        {"label": "Xác nhận", "action": "Thực hiện xóa, đóng dialog, hiển thị thông báo thành công"},
        {"label": "Hủy", "action": "Hủy thao tác, đóng dialog, giữ nguyên dữ liệu"}
      ],
      "fields": []
    }
  ],
  "error_cases": [
    {
      "trigger_step": 3,
      "condition": "<what went wrong, e.g. 'Tiêu đề bỏ trống'>",
      "message": "<error message user sees>"
    }
  ]
}
```

**MIN per feature**: 5 ui_elements, 3 steps, 2 error_cases.

**Dialogs — MANDATORY when feature has**: delete/confirm actions, modal forms, warning popups, bulk operations. Document ALL dialogs — do NOT skip.

### Dialog types
| type | When to use | fields[] needed? |
|---|---|---|
| `confirm` | Delete, submit, approve — yes/no prompt | No |
| `form` | Modal with input fields (e.g. add item inline) | Yes |
| `alert` | System warning/error/success toast/banner | No |
| `info` | Read-only detail popup | No |

### Step ↔ Dialog linkage
When a step triggers a dialog, the `expected` field of that step MUST reference it:
```json
{"no": 3, "action": "Click nút 'Xóa'", "expected": "Hộp thoại xác nhận xuất hiện với tiêu đề 'Xác nhận xóa'"}
```
And the corresponding dialog `trigger` must reference the step number.

---

## Language rules

### Correct (end-user)
- "Click menu Tác nghiệp > Tạo mới"
- "Nhập tiêu đề vào ô 'Tiêu đề'"
- "Click nút 'Lưu'"
- "Hệ thống hiển thị thông báo thành công"

### Forbidden (technical)
- "Gọi POST /api/v1/requests"
- "Dispatch action CREATE_REQUEST"
- "Mount RequestForm component"
- "Emit event onSubmit"

---

## Screenshot handling

Read `screenshot-validation.json`. Per feature:

```
if status == "complete":
    include all steps with screenshots
elif status == "partial":
    include only steps with valid screenshots
elif status == "failed":
    feature.steps = [{"no": 1, "action": "[CẦN BỔ SUNG: BA fill steps]", "screenshot": null}]
```

NEVER reference non-existent screenshot filename.

---

## Troubleshooting section (MIN 5 items)

Categories:
- Session/auth
- Permission denied
- Network/timeout
- Data validation
- Business logic errors

Schema:
```json
{
  "situation": "<what user sees>",
  "cause": "<technical cause in plain vn>",
  "resolution": "<step-by-step fix>"
}
```

---

## Commit + feedback loop

```python
result = mcp__etc-platform__merge_content(
  partial={"services": [...], "troubleshooting": [...]}# returns warnings[] immediately
)
# Loop: fix warnings → re-merge → until result["validation"]["dod_met"] == true
```

---

## Feature ID rules (CRITICAL — downstream dependency)

Every feature MUST have a non-empty, unique `id` field in `F-NNN` format:

```python
# Self-check before merge
all_ids = [f["id"] for svc in services for f in svc["features"]]
assert all(id.startswith("F-") and len(id) > 2 for id in all_ids), "Empty feature IDs found"
assert len(all_ids) == len(set(all_ids)), f"Duplicate IDs: {set(id for id in all_ids if all_ids.count(id) > 1)}"
```

**Why this matters**: xlsx specialist (03f) uses `feature_id` to link TCs to features. Stage 5b Pass 6 uses `feature_id` for TC scaling. Empty or duplicate IDs cause:
- TCs with `feature_id: ""` → every feature shows 0 TCs → BLOCK at quality gate.
- Duplicate IDs → TC counts merged → wrong scaling calculation.

## Excluded features — explicit handling

When a feature cannot be documented (screenshot failed, feature incomplete, out of scope):

```python
# DO: log the exclusion, do NOT add the feature to services[] at all
append_to("{DOCS_PATH}/intel/excluded-features.md",
    f"## {feature_id}: {feature_name}\n"
    f"Reason: {reason}\n"
    f"Action required: {ba_action}\n\n")

# DON'T: add a stub feature with placeholder steps
# DON'T: add a feature with id="" or id="TBD"
```

Report excluded count in return schema: `"features_excluded": N`.
Orchestrator Guard 4.7 will verify remaining features all have valid IDs.

---

## Success criteria

- [ ] All features from doc-intel extracted (or excluded with reason logged)
- [ ] All features have non-empty, unique `id` in `F-NNN` format
- [ ] Per feature ≥ 300 words total content
- [ ] Per feature ≥ 5 ui_elements, ≥ 3 steps, ≥ 2 error_cases
- [ ] All features with delete/confirm/modal actions have ≥ 1 dialog documented
- [ ] Every dialog has: title, type, trigger, message, ≥ 1 button with action
- [ ] Steps that trigger dialogs have `expected` referencing the dialog
- [ ] All step.screenshot filenames exist in validation.found_valid
- [ ] 0 placeholders in prose (exclude features instead of placeholdering)
- [ ] Troubleshooting ≥ 5 items
- [ ] Service groupings match architecture.components
- [ ] `intel/excluded-features.md` created (empty file if nothing excluded)

Return:
```json
{"specialist": "hdsd", "status": "done", "features_total": 28, "features_excluded": 2, "screenshots_ref": 112, "troubleshooting": 6}
```
