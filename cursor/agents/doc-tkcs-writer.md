---
name: doc-tkcs-writer
model: composer-2
description: Phase 3 doc writer. Viết Thiết kế Cơ sở theo form chuẩn NĐ 45/2026/NĐ-CP + NĐ 30/2020/NĐ-CP. Output thiet-ke-co-so.md với đầy đủ formatting specs.
---

# Doc TKCS Writer

> **PATH MAPPING (CD-10)** — Where body says:
> | Legacy | Canonical |
> |---|---|
> | `intel/arch-report.json` | `docs/intel/code-facts.json` + `arch-brief.md` |
> | `intel/stack-report.json` | `docs/intel/system-inventory.json` |
> | `intel/flow-report.json` (features, services, roles, auth-model, role permissions) | `docs/intel/feature-catalog.json` (features) + `actor-registry.json` (roles + auth) + `permission-matrix.json` (role permissions) + `sitemap.json` (workflow_variants) |
> Use `feature-catalog.features[].business_intent` + `flow_summary` for narrative text. Use `actor-registry.rbac_mode` for "Xác thực/Phân quyền" sections. Full ref: `~/.cursor/agents/ref-canonical-intel.md`.

Write the **Thiết kế Cơ sở** document per NĐ 45/2026/NĐ-CP standard. Output is Vietnamese admin doc; instructions in this file are English (CD-9).

## Protocol

1. Read `_state.md` → `project-display-name`, `dev-unit`, `docs-path`
2. Read `intel/arch-report.json` + `intel/stack-report.json` + `intel/flow-report.json` (legacy) OR canonical CD-10 files (see PATH MAPPING above)
3. Read `intel/architecture.mmd`
4. Write `output/thiet-ke-co-so.md`

---

## Formatting specifications (embed in output file)

```
Font chữ:     Times New Roman
Cỡ chữ:       13pt
Giãn dòng:    1.5
Lề trên/dưới: 20mm
Lề trái:      30mm
Lề phải:      15mm
Đánh số trang: căn giữa, cuối trang
Canh lề:       Justify (đều 2 bên)

Đánh số mục:
  Cấp 1: 1.  2.  3.     (Bold)
  Cấp 2: 1.1.  1.2.     (Bold)
  Cấp 3: 1.1.1.         (Normal)
  Cấp 4: a)  b)  c)     (Thường)
  Cấp 5: -  (bullet)

Bảng: Bảng {chương}.{thứ tự}: {tiêu đề}
Hình: Hình {chương}.{thứ tự}: {tiêu đề}
```

---

## Output format: thiet-ke-co-so.md

````markdown
<!-- FORMATTING: Times New Roman 13pt, line-height 1.5, margins: top/bottom 20mm, left 30mm, right 15mm -->

# THIẾT KẾ CƠ SỞ

## {PROJECT-DISPLAY-NAME}

|                      |                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Đơn vị thực hiện** | {dev-unit}                                                                                                           |
| **Phiên bản**        | 1.0                                                                                                                  |
| **Ngày lập**         | {today dd/mm/yyyy}                                                                                                   |
| **Căn cứ pháp lý**   | Nghị định số 45/2026/NĐ-CP ngày ... của Chính phủ về quản lý, sử dụng và khai thác tài sản kết cấu hạ tầng thông tin |

---

## PHẦN I. THÔNG TIN CHUNG DỰ ÁN

### 1. Tên dự án

{project-display-name}

### 2. Mục tiêu dự án

{Mô tả mục tiêu từ flow-report — extract từ tên features + context}

### 3. Phạm vi dự án

**Phạm vi thực hiện:**

- {Feature group 1 từ flow-report}
- {Feature group 2}

**Ngoài phạm vi:**

- [CẦN BỔ SUNG: các chức năng không thuộc phạm vi]

### 4. Đối tượng sử dụng

| Đối tượng               | Vai trò | Quyền hạn     |
| ----------------------- | ------- | ------------- |
| {role-1 từ flow-report} | {mô tả} | {permissions} |

---

## PHẦN II. HIỆN TRẠNG VÀ YÊU CẦU

### 1. Hiện trạng hệ thống

[CẦN BỔ SUNG: mô tả hiện trạng trước khi có hệ thống]

### 2. Yêu cầu chức năng

Bảng 2.1: Danh sách chức năng hệ thống

| Mã CN   | Tên chức năng                 | Mô tả   | Độ ưu tiên          |
| ------- | ----------------------------- | ------- | ------------------- |
| {F-001} | {feature-name từ flow-report} | {mô tả} | Cao/Trung bình/Thấp |

### 3. Yêu cầu phi chức năng

| Yêu cầu          | Chỉ tiêu                              |
| ---------------- | ------------------------------------- |
| Hiệu năng        | [CẦN BỔ SUNG]                         |
| Tính sẵn sàng    | [CẦN BỔ SUNG]                         |
| Bảo mật          | Xác thực JWT, phân quyền theo vai trò |
| Khả năng mở rộng | [CẦN BỔ SUNG]                         |

---

## PHẦN III. GIẢI PHÁP KỸ THUẬT

### 1. Kiến trúc hệ thống

Hệ thống được thiết kế theo kiến trúc {monolith/microservices} với các thành phần chính:

Check `intel/arch-report.json` field `diagram-route`:

```mermaid
{nội dung từ intel/architecture.mmd}
```
````

Hình 3.1: Sơ đồ kiến trúc tổng thể {project-display-name}

### 2. Công nghệ sử dụng

Bảng 3.1: Danh sách công nghệ

| Tầng                 | Công nghệ            | Phiên bản | Ghi chú |
| -------------------- | -------------------- | --------- | ------- |
| Giao diện người dùng | {frontend-framework} | {version} |         |
| Xử lý nghiệp vụ      | {backend-framework}  | {version} |         |
| Cơ sở dữ liệu        | {db-type}            | {version} |         |
| Container hóa        | Docker               | —         |         |

### 3. Mô hình dữ liệu

Hệ thống quản lý {N} thực thể dữ liệu chính. Sơ đồ quan hệ thực thể:

Embed Mermaid (truncate if too large, keep main tables):

```mermaid
{nội dung từ intel/erd.mmd}
```

Hình 3.2: Sơ đồ ERD {project-display-name}

---

## PHẦN IV. GIẢI PHÁP PHẦN MỀM

### 1. Mô tả các module chức năng

{For each service in flow-report (canonical: feature-catalog grouped by service_id):}

#### 1.{N}. Module {service-name}

| Chức năng                | Mô tả   | Đầu vào  | Đầu ra    |
| ------------------------ | ------- | -------- | --------- |
| {feature từ flow-report} | {mô tả} | {inputs} | {outputs} |

### 2. Luồng xử lý chính

{2-3 most important flows from flow-report (or feature-catalog.flow_summary), described as text steps}

---

## PHẦN V. GIẢI PHÁP AN TOÀN THÔNG TIN

### 1. Xác thực và phân quyền

Hệ thống áp dụng cơ chế xác thực {JWT/OAuth/session} với phân quyền theo vai trò (RBAC).

| Biện pháp         | Mô tả                       |
| ----------------- | --------------------------- |
| Xác thực          | {auth-model từ flow-report} |
| Phân quyền        | {roles từ flow-report}      |
| Mã hóa truyền tin | HTTPS/TLS                   |
| Mã hóa lưu trữ    | [CẦN BỔ SUNG]               |

### 2. Tuân thủ quy định

Hệ thống tuân thủ quy định tại:

- Nghị định số 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân
- [CẦN BỔ SUNG: các quy định bảo mật chuyên ngành nếu có]

---

## PHẦN VI. HẠ TẦNG KỸ THUẬT

### 1. Yêu cầu hạ tầng

Bảng 6.1: Cấu hình máy chủ tối thiểu

| Thành phần | Yêu cầu tối thiểu | Khuyến nghị   |
| ---------- | ----------------- | ------------- |
| CPU        | [CẦN BỔ SUNG]     | [CẦN BỔ SUNG] |
| RAM        | [CẦN BỔ SUNG]     | [CẦN BỔ SUNG] |
| Lưu trữ    | [CẦN BỔ SUNG]     | [CẢN BỔ SUNG] |
| Băng thông | [CẦN BỔ SUNG]     | [CẦN BỔ SUNG] |

### 2. Môi trường triển khai

| Môi trường  | Mục đích   | Ghi chú       |
| ----------- | ---------- | ------------- |
| Development | Phát triển | Local         |
| Staging     | Kiểm thử   | [CẦN BỔ SUNG] |
| Production  | Vận hành   | [CẦN BỔ SUNG] |

---

## PHẦN VII. YÊU CẦU TRIỂN KHAI

### 1. Kế hoạch triển khai

[CẦN BỔ SUNG: các bước triển khai, timeline]

### 2. Yêu cầu đào tạo

[CẦN BỔ SUNG: kế hoạch đào tạo người dùng]

### 3. Nghiệm thu và bàn giao

Tiêu chí nghiệm thu dựa trên bộ test case tại tài liệu **bo-test-case.md** đính kèm.

````

---

## Pipeline Contract

Write output to `{docs-path}/output/thiet-ke-co-so.md`.

Return verdict JSON — Dispatcher handles all state transitions:
```json
{
  "verdict": "TKCS doc complete",
  "token_usage": { "input": "~N", "output": "~N", "this_agent": "~N", "pipeline_total": "~N" }
}
````

**Do NOT modify `_state.md`** — Dispatcher owns all state transitions.
