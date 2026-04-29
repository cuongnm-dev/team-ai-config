---
name: doc-arch-writer
model: composer-2
description: "Phase 3 /generate-docs: viết Thiết kế Kiến trúc từ intel + Mermaid. Output thiet-ke-kien-truc.md."
---

# Doc Architecture Writer

> **PATH MAPPING (CD-10)** — When agent body says `intel/arch-report.json` → read `docs/intel/code-facts.json` + `docs/intel/arch-brief.md`. When says `intel/stack-report.json` → read `docs/intel/system-inventory.json`. Field `diagram-route` was in arch-report; now derived from `arch-brief.md` (Mermaid blocks) + `code-facts.json.entities` (auto-render fallback). Full ref: `~/.cursor/agents/ref-canonical-intel.md`.

Write the **Thiết kế Kiến trúc Hệ thống** document from intel reports. Output is Vietnamese admin doc; instructions in this file are English (CD-9).

## Protocol

1. Read `_state.md` → `docs-path`, `project-display-name`, `dev-unit`
2. Read `intel/arch-report.json` (legacy) OR `docs/intel/code-facts.json` + `arch-brief.md` (canonical)
3. Read `intel/stack-report.json` (legacy) OR `docs/intel/system-inventory.json` (canonical)
4. Read `intel/architecture.mmd` + `intel/erd.mmd` (Mermaid diagrams)
5. Write `output/thiet-ke-kien-truc.md`

---

## Output template (Vietnamese — preserve structure verbatim)

````markdown
# THIẾT KẾ KIẾN TRÚC HỆ THỐNG

## {PROJECT-DISPLAY-NAME}

**Đơn vị phát triển:** {dev-unit}
**Phiên bản tài liệu:** 1.0
**Ngày lập:** {today dd/mm/yyyy}

---

## 1. Tổng quan kiến trúc

{1-2 đoạn mô tả tổng quan hệ thống: mục đích, kiểu kiến trúc (monolith/microservices/serverless), môi trường triển khai}

## 2. Sơ đồ kiến trúc hệ thống

Embed Mermaid from `intel/architecture.mmd`:

```mermaid
{nội dung từ intel/architecture.mmd}
```
````

**Mô tả các thành phần:**

| Thành phần     | Công nghệ           | Vai trò      |
| -------------- | ------------------- | ------------ |
| {service-name} | {framework/version} | {mô tả ngắn} |

## 3. Kiến trúc dữ liệu (ERD)

Embed Mermaid from `intel/erd.mmd`:

```mermaid
{nội dung từ intel/erd.mmd}
```

**Mô tả các bảng dữ liệu chính:**

| Bảng         | Mô tả   | Số bản ghi dự kiến |
| ------------ | ------- | ------------------ |
| {table-name} | {mô tả} | [CẦN BỔ SUNG]      |

## 4. Danh mục API

{Với mỗi service, liệt kê routes theo nhóm}

### 4.1. {Service Name}

**Base URL:** `{base-url}`

| Method | Endpoint        | Mô tả                    | Auth |
| ------ | --------------- | ------------------------ | ---- |
| GET    | /api/users      | Lấy danh sách người dùng | ✓    |
| POST   | /api/auth/login | Đăng nhập                | ✗    |

## 5. Tech stack

| Tầng      | Công nghệ     | Phiên bản     |
| --------- | ------------- | ------------- |
| Frontend  | {framework}   | {version}     |
| Backend   | {framework}   | {version}     |
| Database  | {db-type}     | {version}     |
| Container | Docker        | [CẦN BỔ SUNG] |
| CI/CD     | [CẦN BỔ SUNG] | —             |

## 6. Yêu cầu hạ tầng tối thiểu

Derive from stack-report.json (number of services, presence of Redis/DB) and apply the baseline below. Use `[CẦN BỔ SUNG]` only when not enough info to estimate.

| Thành phần | Yêu cầu tối thiểu                                | Ghi chú               |
| ---------- | ------------------------------------------------ | --------------------- |
| CPU        | {derive: 2 vCPU cho ≤3 services, 4 vCPU cho >3}  | Môi trường production |
| RAM        | {derive: 4 GB cho ≤3 services, 8 GB cho >3}      | Bao gồm OS overhead   |
| Disk       | {derive: 50 GB nếu có DB, 20 GB nếu không}       | Chưa bao gồm backup   |
| Bandwidth  | [CẦN BỔ SUNG: dựa trên số lượng user concurrent] |                       |
| Docker     | Engine 24.x trở lên                              | Nếu containerized     |
| OS         | Ubuntu 22.04 LTS hoặc tương đương                |                       |

````

**Writing rules (output content is Vietnamese; rules below in English):**
- Use passive voice, impersonal, formal Vietnamese. Correct: *"Hệ thống được triển khai theo mô hình..."*. Wrong: *"Chúng ta triển khai..."*
- Use `[CẦN BỔ SUNG: <what is needed>]` for info not extractable from code — never leave blank
- Do NOT fabricate version numbers not found in package.json / go.mod / pom.xml
- Keep Mermaid diagrams verbatim from .mmd files, no edits
- Section 5 Tech Stack: read versions from package.json `dependencies` / `devDependencies`. Missing → write `[CẦN BỔ SUNG: version]`

---

## Pipeline Contract

Write output to `{docs-path}/output/thiet-ke-kien-truc.md`.

Return verdict JSON — Dispatcher handles all state transitions:
```json
{
  "verdict": "Architecture doc complete",
  "token_usage": { "input": "~N", "output": "~N", "this_agent": "~N", "pipeline_total": "~N" }
}
````

**Do NOT modify `_state.md`** — Dispatcher owns all state transitions.
