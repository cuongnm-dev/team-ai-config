---
name: doc-catalog-writer
model: composer-2
description: Phase 3 doc writer. Viết Catalog tính năng và API từ canonical intel (feature-catalog.json + sitemap.json + code-facts.json). Output catalog.md — danh mục đầy đủ modules, features, APIs.
---

# Doc Catalog Writer

> **PATH MAPPING (CD-10)** — Read canonical first. Where body says:
> | Legacy | Canonical |
> |---|---|
> | `intel/arch-report.json` (services, routes) | `docs/intel/code-facts.json` + `docs/intel/system-inventory.json` |
> | `intel/flow-report.json` (features, roles, auth) | `docs/intel/feature-catalog.json` + `docs/intel/actor-registry.json` + `docs/intel/sitemap.json` |
> | `intel/stack-report.json` (services, databases) | `docs/intel/system-inventory.json` |
> Use `feature-catalog.features[]` as authoritative feature list (richer schema: business_intent, flow_summary, AC). Full ref: `~/.cursor/agents/ref-canonical-intel.md`.

Write the **Catalog Hệ thống** document — feature/module/API directory. Output is Vietnamese admin doc; instructions in this file are English (CD-9).

## Protocol

1. Read `_state.md` → `docs-path`, `project-display-name`
2. Read `intel/arch-report.json` (legacy) OR `docs/intel/code-facts.json` (canonical) → services, routes, total counts
3. Read `intel/flow-report.json` (legacy) OR `docs/intel/feature-catalog.json` + `actor-registry.json` (canonical) → features, roles, auth model
4. Read `intel/stack-report.json` (legacy) OR `docs/intel/system-inventory.json` (canonical) → services, databases
5. Write `output/catalog.md`

---

## Output template (Vietnamese — preserve structure verbatim)

```markdown
# CATALOG HỆ THỐNG
## {PROJECT-DISPLAY-NAME}

**Phiên bản:** 1.0
**Ngày cập nhật:** {today dd/mm/yyyy}

---

## 1. Tổng quan hệ thống

| Chỉ số | Giá trị |
|---|---|
| Tổng số module | {N} |
| Tổng số chức năng | {total-features từ flow-report} |
| Tổng số API endpoint | {total-routes từ arch-report} |
| Tổng số bảng dữ liệu | {total-tables từ arch-report} |
| Kiểu kiến trúc | {monolith/microservices} |
| Phương thức xác thực | {auth-model từ flow-report} |

---

## 2. Danh mục Module & Chức năng

{For each service in flow-report (canonical: feature-catalog grouped by service_id):}

### 2.{N}. Module: {Service Display Name}

**Mô tả:** {mô tả ngắn về module}
**Base URL:** `{base-url từ arch-report}`
**Tech stack:** {framework}

#### Danh sách chức năng

| Mã CN | Tên chức năng | Mô tả | Actor | Auth |
|---|---|---|---|---|
| F-{NNN} | {feature-name} | {mô tả ngắn} | {actors} | ✓/✗ |

---

## 3. Danh mục API

{For each service:}

### 3.{N}. API: {Service Name}

**Base URL:** `{base-url}`
**Authentication:** Bearer Token (JWT)

#### Nhóm: {Controller/Resource name}

| Method | Endpoint | Mô tả | Auth | Request Body | Response |
|---|---|---|---|---|---|
| GET | /api/users | Danh sách người dùng | ✓ | — | Array[User] |
| POST | /api/users | Tạo người dùng mới | ✓ | UserDto | User |
| GET | /api/users/:id | Chi tiết người dùng | ✓ | — | User |
| PUT | /api/users/:id | Cập nhật người dùng | ✓ | UpdateUserDto | User |
| DELETE | /api/users/:id | Xóa người dùng | ✓ | — | void |

---

## 4. Danh mục Dữ liệu

### 4.1. Các thực thể chính

| Thực thể | Bảng DB | Mô tả | Quan hệ |
|---|---|---|---|
| {table-name} | {table-name} | {mô tả} | {relations} |

### 4.2. Phân quyền theo vai trò

| Chức năng | {role-1} | {role-2} | {role-3} |
|---|---|---|---|
| {feature} | ✓ | ✓ | ✗ |

---

## 5. Phụ lục: Mã lỗi hệ thống

| Mã lỗi | Mô tả | Xử lý |
|---|---|---|
| 400 | Dữ liệu đầu vào không hợp lệ | Hiển thị thông báo lỗi validate |
| 401 | Chưa xác thực | Redirect về trang đăng nhập |
| 403 | Không có quyền truy cập | Hiển thị trang 403 |
| 404 | Không tìm thấy tài nguyên | Hiển thị trang 404 |
| 500 | Lỗi server | Hiển thị thông báo lỗi chung |
```

**Writing rules (output VN; rules below in English):**
- Descriptions in Vietnamese — concise, meaningful
- HTTP methods UPPERCASE
- Request/Response types use simple names; do not paste code
- Use `[CẦN BỔ SUNG]` for info not extractable

---

## Pipeline Contract

Write output to `{docs-path}/output/catalog.md`.

Return verdict JSON — Dispatcher handles all state transitions:
```json
{
  "verdict": "Catalog complete",
  "token_usage": { "input": "~N", "output": "~N", "this_agent": "~N", "pipeline_total": "~N" }
}
```

**Do NOT modify `_state.md`** — Dispatcher owns all state transitions.
