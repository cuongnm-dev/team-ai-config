# Sitemap Schema — Canonical Reference

**Purpose**: Định nghĩa schema chuẩn cho `sitemap.json` — file mô tả workspace, menu tree, navigation paths và workflow variants per role. Đây là **contract** giữa producer (doc-intel / tdoc-researcher) và consumer (generate-docs writers / capture phase).

**Path**: `{DOCS_PATH}/intel/sitemap.json`

**Trigger conditions**:
- Producer ghi file này khi `multi-role: true` được phát hiện
- Khi `multi-role: false` → file optional, có thể omit
- Consumer kiểm tra file tồn tại trước khi load; missing → fallback single-role behavior

---

## Top-level schema

```json
{
  "version": "1.0",
  "multi-role": true,
  "source": "doc-intel | tdoc-researcher | manual",
  "confidence": "high | medium | low",
  "generated-at": "2026-04-25T10:30:00Z",

  "roles": [ <Role object>, ... ],
  "feature_overrides": [ <FeatureOverride object>, ... ],
  "warnings": [ "<warning text>", ... ]
}
```

**Field rules**:
- `version`: bump khi schema breaking change
- `source`: ai sinh file này (truy vết khi merge conflict)
- `confidence`: tổng quan độ tin của data
  - `high`: extracted từ explicit menu config / sitemap document
  - `medium`: inferred từ route guards + decorators
  - `low`: best-guess từ implied structure → consumer phải emit `[CẦN BỔ SUNG]` markers
- `feature_overrides`: chỉ list features có `role-variants` hoặc `workflow_variants` — các feature đơn giản dùng default từ flow-report

---

## Role object

```json
{
  "slug": "admin",
  "display": "Quản trị hệ thống",
  "credentials_ref": 0,

  "auth": {
    "login_url": "/login",
    "post_login_redirect": "/admin/dashboard",
    "session_timeout_minutes": 30,
    "logout_url": "/logout"
  },

  "workspace": {
    "entry_url": "/admin/dashboard",
    "layout": "sidebar | topbar | mixed",

    "dashboard": {
      "title": "Bảng điều khiển quản trị",
      "summary": "Trang chủ hiển thị thống kê toàn hệ thống và nhật ký hoạt động.",
      "widgets": [ <Widget object>, ... ]
    },

    "menu_tree": [ <MenuGroup object>, ... ],

    "global_actions": [
      {"label": "Thông báo",   "icon": "bell",      "type": "dropdown"},
      {"label": "Tài khoản",   "icon": "user",      "type": "dropdown"},
      {"label": "Đăng xuất",   "icon": "logout",    "type": "button"}
    ]
  }
}
```

**Field rules**:
- `slug`: lowercase, kebab-case, ASCII only — match flow-report.roles[].slug
- `display`: tiếng Việt, không bao giờ raw technical name (admin/staff/user)
- `credentials_ref`: index trong `auth.json.credentials[]`
- `auth.login_url`: chia sẻ giữa các role nếu cùng login page; per-role nếu khác (vd `/admin/login` vs `/staff/login`)
- `workspace.entry_url`: URL sau khi đăng nhập thành công (dùng cho capture step đầu tiên)
- `layout`: gợi ý cho HDSD render — sidebar = menu trái, topbar = menu trên

---

## Widget object (dashboard)

```json
{
  "id": "stats-users",
  "name": "Thống kê người dùng",
  "type": "stats | activity-feed | chart | list | calendar | shortcut",
  "position": "row1-col1 | row1-col2 | ...",
  "screenshot_state": "dashboard",
  "description": "Hiển thị tổng số người dùng, người dùng online, người dùng mới trong tuần."
}
```

**Field rules**:
- `id`: kebab-case, unique trong widget list của role
- `type` controlled vocab: `stats | activity-feed | chart | list | calendar | shortcut | banner | other`
- `description`: 1-2 câu mô tả nội dung widget (cho HDSD viết)

---

## MenuGroup object (menu_tree)

```json
{
  "id": "admin-mgmt",
  "label": "Quản trị",
  "icon": "shield",
  "order": 1,
  "items": [
    {
      "id": "users",
      "label": "Người dùng",
      "url": "/admin/users",
      "icon": "users",
      "feature_id": "F-007",
      "submenu": []
    },
    {
      "id": "roles",
      "label": "Phân quyền",
      "url": "/admin/roles",
      "feature_id": "F-008",
      "submenu": [
        {"id": "roles-list",   "label": "Danh sách vai trò", "url": "/admin/roles", "feature_id": "F-008"},
        {"id": "roles-matrix", "label": "Ma trận quyền",     "url": "/admin/roles/matrix", "feature_id": "F-009"}
      ]
    }
  ]
}
```

**Field rules**:
- `id`: unique trong menu_tree của role; dùng làm anchor cho HDSD
- `label`: tiếng Việt, exact text hiển thị trên UI
- `order`: integer — sort order khi render menu
- `items[].url`: relative path từ base_url; null nếu chỉ là menu group không clickable
- `items[].feature_id`: link sang flow-report.features — null nếu menu item là external link / không tương ứng feature
- `submenu`: nested 1 level (không hỗ trợ ≥2 level — flatten ở producer side nếu UI có)

---

## FeatureOverride object

Chỉ ghi vào file những feature có **per-role differences** (variants hoặc workflow). Feature đồng nhất giữa các role → không cần override entry, dùng default từ flow-report.

```json
{
  "feature_id": "F-021",

  "navigation_paths": {
    "admin": ["Quản trị", "Đề xuất", "Tất cả đề xuất"],
    "manager": ["Tác nghiệp", "Đề xuất chờ duyệt"],
    "staff": ["Tác nghiệp", "Đề xuất của tôi"]
  },

  "ui_variants": {
    "admin": {
      "extra_actions": ["Xóa cứng", "Khôi phục", "Đóng đề xuất"],
      "hidden_columns_for_other_roles": ["created_by_ip", "approval_chain_full"],
      "extra_filters": ["Theo phòng ban", "Theo trạng thái nội bộ"],
      "screenshot_note": "Toolbar đầy đủ, hiển thị thêm cột IP và chuỗi duyệt."
    },
    "manager": {
      "extra_actions": ["Duyệt", "Từ chối", "Yêu cầu chỉnh sửa"],
      "screenshot_note": "Có nhóm nút Duyệt/Từ chối nổi bật phía trên danh sách."
    },
    "staff": {
      "extra_actions": ["Tạo mới", "Sửa nháp", "Nộp"],
      "hidden_columns_for_other_roles": ["assigned_reviewer", "internal_priority"],
      "screenshot_note": "Chỉ thấy các đề xuất của bản thân, không có cột người duyệt."
    }
  },

  "workflow_variants": {
    "staff": {
      "states_visible":    ["draft", "submitted"],
      "states_actionable": ["draft"],
      "available_actions": [
        {"action": "Tạo mới",    "from_state": null,        "to_state": "draft"},
        {"action": "Sửa nháp",   "from_state": "draft",     "to_state": "draft"},
        {"action": "Nộp",        "from_state": "draft",     "to_state": "submitted"},
        {"action": "Hủy nháp",   "from_state": "draft",     "to_state": null}
      ]
    },
    "manager": {
      "states_visible":    ["submitted", "approved", "rejected", "revising"],
      "states_actionable": ["submitted"],
      "available_actions": [
        {"action": "Duyệt",                "from_state": "submitted", "to_state": "approved"},
        {"action": "Từ chối",              "from_state": "submitted", "to_state": "rejected"},
        {"action": "Yêu cầu chỉnh sửa",    "from_state": "submitted", "to_state": "revising"}
      ]
    },
    "admin": {
      "states_visible":    "all",
      "states_actionable": ["draft", "submitted", "approved", "rejected", "revising", "closed"],
      "available_actions": [
        {"action": "Đóng",         "from_state": "approved",  "to_state": "closed"},
        {"action": "Khôi phục",    "from_state": "closed",    "to_state": "approved"},
        {"action": "Xóa vĩnh viễn", "from_state": "*",         "to_state": null}
      ]
    }
  }
}
```

**Field rules**:
- `navigation_paths`: array of menu labels từ root → menu item — consumer dùng để click navigate (không dùng url trực tiếp)
- `ui_variants[role]`: chỉ liệt kê **delta** so với base — base UI lấy từ feature.ui_elements trong content-data
- `workflow_variants[role].states_visible`: list state names hoặc string `"all"`
- `workflow_variants[role].available_actions[].from_state`: `null` = action tạo mới (no from); `"*"` = từ bất kỳ state nào
- `workflow_variants[role].available_actions[].to_state`: `null` = action xóa/hủy (terminal)

---

## Producer responsibility (Stage 2.3 UX Architecture)

| Producer | Stage | Khi nào ghi file | Lookup priority |
|---|---|---|---|
| `doc-intel` | Stage 2.3 (Path A) | Trong Phase 3 deep semantic, sau khi consume actor-registry từ Stage 1.2 | (1) explicit sitemap doc → (2) wireframe with menu visible → (3) actor permissions table |
| `tdoc-researcher` | Stage 2.3 (Path B) | After Stage 1 complete, scope=stage2 dispatch | (1) explicit menu config (sidebar.tsx, menu.json) → (2) route guards + RouteData metadata → (3) inferred từ Link/NavLink usage |
| Manual | — | User edit trực tiếp khi 2 nguồn trên không đủ | — |

**Conflict resolution** (khi có cả doc-intel và tdoc-researcher output):
- doc-intel.sitemap.json wins for `roles[].display`, `menu_tree[].label` (BA spec authoritative cho user-facing text)
- tdoc-researcher.sitemap.json wins for `menu_tree[].url`, `feature_id` mapping (code is source of truth cho technical mapping)
- Merge logic: load both, deep-merge với priority rules trên, ghi `confidence: medium` khi có conflict

---

## Consumer responsibility

| Consumer | Cách dùng |
|---|---|
| `s3a-capture.md` | Load `roles[]` → bootstrap auth per role; load `workspace.entry_url` → screenshot dashboard; load `menu_tree` → render menu screenshot; load `navigation_paths` → click navigate đến từng feature |
| `s4e-write-hdsd.md` | Mỗi `role_chapters[]` mở đầu bằng: §1 Đăng nhập (auth), §2 Giao diện sau đăng nhập (workspace.dashboard), §3 Cấu trúc menu (menu_tree), §4+ Các chức năng. Apply `ui_variants` khi viết feature steps. Apply `workflow_variants` khi mô tả chu trình xử lý |
| `s4f-write-xlsx.md` | Sinh TC: (1) menu visibility per role, (2) dashboard widget visibility, (3) workflow state actionability per role, (4) navigation path correctness |

---

## Validation rules (consumer-side)

Trước khi load, consumer chạy self-check:

```python
sitemap = json.load(open("{DOCS_PATH}/intel/sitemap.json"))
flow    = json.load(open("{DOCS_PATH}/intel/flow-report.json"))

# 1. Slug consistency
flow_slugs    = {r["slug"] for r in flow.get("roles", [])}
sitemap_slugs = {r["slug"] for r in sitemap["roles"]}
assert flow_slugs == sitemap_slugs, f"Role slug mismatch: flow={flow_slugs}, sitemap={sitemap_slugs}"

# 2. Feature ID linkage
all_feature_ids = {f["id"] for svc in flow["services"] for f in svc["features"]}
for role in sitemap["roles"]:
  for grp in role["workspace"]["menu_tree"]:
    for item in grp["items"]:
      if item.get("feature_id"):
        assert item["feature_id"] in all_feature_ids, \
          f"Menu item {item['id']} refs unknown feature_id {item['feature_id']}"

# 3. Override coverage — features có role-variants in flow-report PHẢI có override entry
for svc in flow["services"]:
  for feat in svc["features"]:
    if feat.get("role-variants") or len(feat.get("role-visibility", [])) > 1:
      override = next((o for o in sitemap.get("feature_overrides", []) if o["feature_id"] == feat["id"]), None)
      if not override:
        warn(f"Feature {feat['id']} has multiple roles but no sitemap override")
```

---

## Examples

### Minimal (3 roles, 1 entity, no workflow)

```json
{
  "version": "1.0",
  "multi-role": true,
  "source": "tdoc-researcher",
  "confidence": "high",
  "roles": [
    {
      "slug": "admin",
      "display": "Quản trị hệ thống",
      "auth": {"login_url": "/login", "post_login_redirect": "/admin"},
      "workspace": {
        "entry_url": "/admin",
        "layout": "sidebar",
        "dashboard": {"title": "Bảng điều khiển", "widgets": []},
        "menu_tree": [
          {"id": "mgmt", "label": "Quản trị", "items": [
            {"label": "Người dùng", "url": "/admin/users", "feature_id": "F-001"}
          ]}
        ]
      }
    }
  ],
  "feature_overrides": []
}
```

### Full (3 roles + workflow variants)

Xem ví dụ FeatureOverride bên trên — applies cho hệ thống có Đề xuất / Phê duyệt / Quản trị.
