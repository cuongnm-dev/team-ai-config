# tdoc-researcher — Stage 2.1 + 2.2 (Information + Functional Architecture)

> Loaded on-demand by `tdoc-researcher` agent when `scope ∈ {stage2, full}`. Do NOT load eagerly.
> Prerequisite: `intel/actor-registry.json` from Stage 1 MUST exist.
> Outputs: `intel/data-model.json`, `intel/feature-catalog.json`.
> Stage 2.2 uses **extended thinking** for flow→feature grouping.
> Schemas: `~/.claude/schemas/intel/{data-model,feature-catalog}.schema.json`.

## Stage 2.1 — Information Architecture (Routes data + DB schema + Diagrams)

**Output**: `{docs-path}/intel/data-model.json`


### 2.1.1 Extract routes per stack (standard patterns — see Cursor ref if needed)

### 2.1.2 Extract DB schema
Priority: Prisma > JPA/GORM > SQL migrations (newest wins). Record source.

### 2.1.3 Generate diagrams

**Use `mcp__...__generate_diagram` (Figma MCP) if available** — produces better diagrams than Mermaid fallback.

```
IF Figma MCP available:
  generate_diagram(name="Kiến trúc C4", mermaidSyntax=<c4-container>)
  → save intel/diagrams/arch-container.png
  → set "diagram-route": "figma"
ELSE:
  write intel/architecture.mmd (Mermaid C4Container)
  write intel/erd.mmd (Mermaid erDiagram)
  → set "diagram-route": "mermaid-fallback"
```

### 2.1.4 Write `intel/data-model.json`

```json
{
  "services": [{"name":"api","framework":"NestJS","base-url":"http://localhost:3000",
    "routes":[{"method":"GET","path":"/api/users","controller":"UsersController.findAll","auth":true}]}],
  "databases": [{"name":"main-db","type":"PostgreSQL",
    "tables":[{"name":"users","columns":[{"name":"id","type":"uuid","pk":true}]}]}],
  "schema-source": "prisma",
  "diagram-route": "figma | mermaid-fallback",
  "diagram-files": ["intel/diagrams/arch-container.png"],
  "total-routes": 42,
  "total-tables": 15
}
```

---

## Stage 2.2 — Functional Architecture (Features + Workflows) 🧠 EXTENDED THINKING

**Output**: `{docs-path}/intel/feature-catalog.json`
**Pre-requisite**: actor-registry.json from Stage 1.2 (DO NOT re-detect roles)

**Deep reasoning required for:**
- Group nhiều controllers/methods thành features nghiệp vụ (CRUD merge, role-based split)
- Generate Vietnamese `description` field từ docstring/context
- Map actors technical → Vietnamese business roles chính xác

### 2.2.1 Extract flows per stack (ref Cursor table)

### 2.2.2 (DEPRECATED — moved to Stage 1.2 Actor Enumeration; consume actor-registry.json instead)

Scan for role definitions in priority order:
1. `README.md` / `docs/roles.md` / `docs/glossary.md` → section "Roles" / "Vai trò"
2. `@Roles` / `@Guards` / `@Permission` decorators in controllers
3. Enum/constant files: `role.enum.ts`, `roles.constant.ts`, `UserRole`
4. DB seed / migration files → roles table insert

For each role found, record:
```json
{"slug": "<technical-name>", "display": "<Vietnamese name from C3.5 table>", "credentials-ref": <index in frontend-report.credentials[]>}
```

**Multi-role detection rule**: `multi-role = true` when ≥ 2 roles have DIFFERENT route access (different `@Roles` decorators on same entity). Single role or same-access-all roles → `multi-role = false`.

### 2.2.3 Group flows into features (role-tagged from actor-registry) — **use extended thinking block**

**IMPORTANT CHANGE (quality fix):** DO NOT merge CRUD into a single "Quản lý X" feature — SPLIT into 5 separate features so downstream writers have enough depth.

```
<thinking>
For each controller file:
  - Read method list + decorators
  - Identify entity (noun in controller name, e.g., UserController → User)
  - Check for @Roles — if differ between methods → split per role

  FOR CRUD pattern detection (create/findAll/findOne/update/delete/search):
    **SPLIT into separate features (NOT merge):**
    - "Danh sách {Entity}"       — from findAll/search/list endpoints
    - "Chi tiết {Entity}"         — from findOne/get endpoints
    - "Tạo mới {Entity}"          — from create/add endpoints (separate flow, separate form)
    - "Cập nhật {Entity}"         — from update/patch endpoints
    - "Xóa {Entity}"              — from delete endpoints (includes confirm dialog)

  FOR ROLE-BASED SPLIT:
    If same endpoint accessible by multiple roles BUT with different UI/data → keep as ONE feature,
    set `role-visibility` and `role-variants`. Only split into separate features when role has
    COMPLETELY DIFFERENT flows (e.g., admin "Duyệt đơn" vs staff "Tạo đơn" — different entity lifecycle).

  Additional sub-features to detect:
    - "Tìm kiếm {Entity}"         — if search endpoint separate or complex filters
    - "Xuất báo cáo {Entity}"     — if export endpoint exists
    - "Nhập dữ liệu {Entity}"     — if import endpoint exists
    - "Phân quyền {Entity}"       — if permissions endpoint exists
    - "Duyệt {Entity}"            — if approve/reject endpoints exist

  Check shared service methods — mark `shared: true` without duplicating feature

For each resulting feature:
  - Name: Vietnamese, business context (NOT technical)
  - Description: 1-2 sentences generated from docstring OR synthesized from action+outcome
  - Actors: Vietnamese business roles (see C3.5 mapping table)
  - Steps: sequential, no gaps in step-no (used downstream for screenshot step-match)
  - Error-cases: object format with trigger-step link
  - **related-ui-artifacts**: from frontend-report Stage 2.3.3 — list dialogs/confirmations for this feature
</thinking>
```

**Why split (not merge):** Downstream writers generate output PER feature. If "Quản lý User" merged as 1 feature → only 1 section in docx, 3-4 test cases. If split into 5 features → 5 sections in docx, 20-40 test cases. Complaints of "sparse test cases" trace back to this merge pattern.

**Depth target:**
- 1 entity (User, Product, Order, etc.) → tối thiểu **5 features** (List/Detail/Create/Update/Delete)
- Entity phức tạp (có approve flow, import/export) → **8-10 features**
- System có 10 entities → **50+ features** total — pipeline phải handle qua batching (chunking-threshold=30)

### 2.2.4 — Actors mapping (technical → Vietnamese business)

Default table:

| Technical | Vietnamese |
|---|---|
| `admin`, `administrator` | Quản trị hệ thống |
| `manager`, `lead` | Lãnh đạo |
| `staff`, `employee`, `user` | Cán bộ nhân viên |
| `customer`, `client` | Khách hàng |
| `operator` | Người vận hành |
| `supervisor` | Giám sát viên |
| `auditor` | Kiểm toán viên |
| `guest`, `anonymous` | Khách (chưa đăng nhập) |

**Lookup priority BEFORE default:**
1. `README.md` → section "Roles" / "Vai trò"
2. `docs/glossary.md`, `docs/roles.md`
3. Comments near `@Roles` decorator
4. Fallback default table

**NEVER use raw technical names** trong `features[].actors[]`.

### C3.6 — Feature description generation

```
1. Extract controller class comment / docstring if present
2. Extract first meaningful comment near main service method
3. IF neither: synthesize template:
   "Chức năng cho phép {actors} {main-verb} {entity}. {success-outcome}."
```

**REQUIRED field — never empty.**

### 2.2.6 Write `intel/feature-catalog.json`

```json
{
  "multi-role": true,
  "roles": [
    {"slug": "admin", "display": "Quản trị hệ thống", "credentials-ref": 0},
    {"slug": "staff", "display": "Cán bộ nhân viên",  "credentials-ref": 1}
  ],
  "services": [{"name":"api","display-name":"Quản lý Người dùng",
    "features":[{
      "id":"F-001","name":"Đăng nhập hệ thống",
      "description":"Chức năng cho phép Cán bộ nhân viên đăng nhập vào hệ thống bằng email và mật khẩu.",
      "actors":["Cán bộ nhân viên","Quản trị hệ thống"],
      "role-visibility": ["admin", "staff"],
      "role-variants": null,
      "entry-ui":"/login","auth-required":false,
      "preconditions":"Người dùng chưa đăng nhập",
      "steps":[
        {"no":1,"action":"Truy cập trang đăng nhập","expected":"Form hiển thị"},
        {"no":2,"action":"Nhập email và mật khẩu","expected":"Validation pass"},
        {"no":3,"action":"Click Đăng nhập","expected":"Redirect dashboard"}
      ],
      "success-state":"Redirect về dashboard, JWT lưu localStorage",
      "error-cases":[
        {"trigger-step":2,"condition":"Email/mật khẩu sai","message":"Thông tin đăng nhập không đúng"}
      ],
      "screenshot-targets":["initial","filled","success","error"],
      "evidence": [
        {"kind": "code", "file": "src/auth/auth.controller.ts", "line": 23, "pattern": "@Post('login')"},
        {"kind": "code", "file": "web/src/pages/Login.tsx", "line": 1, "pattern": "export default function LoginPage"}
      ],
      "confidence": "high",
      "source_producers": ["tdoc-researcher"]
    },{
      "id":"F-007","name":"Xóa Người dùng",
      "actors":["Quản trị hệ thống"],
      "role-visibility": ["admin"],
      "role-variants": {
        "admin": {"extra-actions": ["Xóa", "Khóa tài khoản"], "screenshot-note": "Hiển thị nút Xóa trên thanh công cụ"}
      },
      "entry-ui":"/users",
      "evidence": [
        {"kind": "code", "file": "src/users/users.controller.ts", "line": 87, "pattern": "@Delete(':id')"}
      ],
      "confidence": "medium",
      "source_producers": ["tdoc-researcher"]
    }]
  }],
  "total-features": 24,
  "auth-model": "JWT Bearer Token",
  "roles-mapping": {"admin":"Quản trị hệ thống","staff":"Cán bộ nhân viên"},
  "scale-metrics": {"features-per-service":{"api":12,"web":12},"large-codebase-warning":false}
}
```

**Confidence emission per feature** (CD-10 §13 — MANDATORY):

| Signal pattern | Tier |
|---|---|
| Backend route + frontend component + test file all link to same flow | `high` |
| Backend route + frontend component agree (no test) | `high` |
| Single side only (e.g. controller exists but no UI yet) | `medium` |
| Inferred from controller name only (no body inspection done) | `low` |
| User confirmed via interview when ambiguous | `manual` |

Always emit `evidence[]` with file:line refs. ≥ 2 evidence entries → can emit `high`. Single entry → `medium` max.

**Field rules (STRICT schema — downstream writers depend on exact format):**

- `id`: F-NNN, 3 digits, reset per service
- `description`: REQUIRED, Vietnamese, business context. **Min 50 chars**. NEVER empty string. NEVER "TODO" or placeholder.
- `actors[]`: Vietnamese business roles ONLY. Min 1 item. **NEVER** raw technical names ("admin", "staff", "user", "manager", "root")
- `steps[].no`: sequential 1,2,3,... (no gaps). Both `action` and `expected` required, non-empty
- **`error-cases[]`: MANDATORY OBJECT FORMAT ONLY (Issue #1 fix)** — never plain string
  ```json
  {
    "trigger-step": 2,           // INT matching steps[].no, or null
    "condition": "string",       // REQUIRED, non-empty
    "message": "string"          // REQUIRED, non-empty — user-facing error text
  }
  ```
  Object format required — tdoc-data-writer needs structured fields for docx fill.
- `screenshot-targets[]`: controlled vocab `initial|filled|success|error|loading|modal|list|detail`
- `shared`: `true` only when shared across features (omit if false)

**Pre-write schema validation (block if fails):**

```python
role_slugs = {r['slug'] for r in output.get('roles', [])}

for service in output.services:
  for feat in service.features:
    assert feat['id'].startswith('F-') and len(feat['id']) == 5, f"{feat['id']}: bad id format"
    assert len(feat['description']) >= 50, f"{feat['id']}: description too short ({len(feat['description'])} chars)"
    assert len(feat['actors']) >= 1, f"{feat['id']}: no actors"
    assert all(a not in {'admin','staff','user','manager','root','administrator'} for a in feat['actors']), \
      f"{feat['id']}: raw technical role names detected"
    steps_nos = [s['no'] for s in feat['steps']]
    assert steps_nos == list(range(1, len(steps_nos)+1)), f"{feat['id']}: non-sequential steps"
    for err in feat.get('error-cases', []):
      assert isinstance(err, dict), f"{feat['id']}: error-case must be object"
      assert err.get('condition') and err.get('message'), f"{feat['id']}: error-case missing condition/message"
    # Multi-role validation
    if output.get('multi-role') and role_slugs:
      rv = feat.get('role-visibility', [])
      assert isinstance(rv, list) and len(rv) >= 1, f"{feat['id']}: role-visibility missing/empty on multi-role project"
      assert all(r in role_slugs for r in rv), f"{feat['id']}: role-visibility references unknown slug: {rv}"
```

If any validation fails → return verdict `BlockedSchemaInvalid` with list of violations. Do NOT write partial flow-report.json.

### 2.2.7 Chunking for large codebase

IF `features-per-service[svc] > chunking-threshold`:
- Write index `flow-report.json` với `split-mode: true, parts[]`
- Write parts `flow-report-{service}-part{N}.json` (max 30 features each)

---

