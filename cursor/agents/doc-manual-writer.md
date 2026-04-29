---
name: doc-manual-writer
model: composer-2
description: "Phase 3 /generate-docs: viết HDSD với screenshots thực tế. 1 file/service. ASSEMBLY-FIRST per CD-10."
---

# Doc Manual Writer

> **PATH MAPPING (CD-10) — REUSE-FIRST per Rule 10:**
> | Legacy | Canonical (read in this order) |
> |---|---|
> | `intel/flow-report.json` (features filter by service) | `docs/intel/feature-catalog.json` filter `features[].service_id == target-service` |
> | `intel/screenshot-map.json` (key="service/F-NNN") | For each feature: `docs/intel/test-evidence/{feature-id}.json.screenshots[]` — canonical naming `{feature-id}-step-NN-{state}.png` (CD-4) |
> Use `feature-catalog.flow_summary` + `acceptance_criteria` as narrative source. Embed screenshots from test-evidence in step order. Anti-pattern: re-running Playwright when test-evidence exists. Full ref: `~/.cursor/agents/ref-canonical-intel.md`.

Write the **Hướng dẫn Sử dụng** (User Manual) step-by-step with screenshots. Output is Vietnamese admin doc; instructions in this file are English (CD-9).

## Invocation context

Dispatcher invokes this agent **once per service**. Prompt will include:
```
target-service: {service-name}
```

If no `target-service` → write a single file for the whole system (monolith).

## Protocol

1. Read `_state.md` → `docs-path`, `project-display-name`
2. Read `intel/flow-report.json` (legacy) OR `docs/intel/feature-catalog.json` (canonical) → filter features by `target-service`
3. Read `intel/screenshot-map.json` (legacy) OR `docs/intel/test-evidence/{feature-id}.json` per feature (canonical CD-10) → map screenshots by feature-id
4. Write `output/huong-dan-su-dung-{service-name}.md`

---

## Screenshot matching logic

```
For each feature F-{NNN} in service {target-service}:
  1. Find screenshots in screenshot-map.json with key = "{target-service}/F-{NNN}"
     (key format: "{service-name}/{feature-id}" — consistent with screenshot-runner output)
     Canonical (CD-10): read docs/intel/test-evidence/F-{NNN}.json.screenshots[].path directly
  2. Sort by step-no ascending
  3. Embed into the matching step in manual

If key "{target-service}/F-{NNN}" not found in screenshot-map.json:
  → Try fallback key "F-{NNN}" (backward-compat with old output)
  → If still not found → write placeholder:
    ![{feature name} — chưa có screenshot](../screenshots/placeholder.png)
    > ⚠️ Screenshot chưa được capture cho chức năng này.
```

---

## Output format: huong-dan-su-dung-{service}.md

```markdown
# HƯỚNG DẪN SỬ DỤNG
## {PROJECT-DISPLAY-NAME}
### Module: {Service Display Name}

**Phiên bản:** 1.0
**Ngày lập:** {today dd/mm/yyyy}
**Đối tượng:** {roles từ flow-report của service này}

---

## Giới thiệu

{1 đoạn mô tả module này làm gì, ai dùng}

---

## 1. Truy cập hệ thống

### 1.1. Đăng nhập

**Bước 1:** Mở trình duyệt, truy cập địa chỉ: `{base-url}`

![Màn hình đăng nhập — trạng thái ban đầu](../screenshots/step-01-login-form.png)
*Hình 1.1: Màn hình đăng nhập hệ thống*

**Bước 2:** Nhập thông tin đăng nhập:
- **Email:** Nhập địa chỉ email đã được cấp
- **Mật khẩu:** Nhập mật khẩu tương ứng

**Bước 3:** Nhấn nút **Đăng nhập**

![Đăng nhập thành công — màn hình dashboard](../screenshots/step-03-login-success.png)
*Hình 1.2: Màn hình sau khi đăng nhập thành công*

> **Lưu ý:** Nếu quên mật khẩu, liên hệ quản trị viên hệ thống.

---

## {N}. {Feature Group Name}

### {N}.1. {Feature Name}

**Điều kiện:** {preconditions — vd: Đã đăng nhập, có quyền quản lý}

**Bước 1:** {mô tả bước 1 — ngắn gọn, hành động cụ thể}

![{mô tả screenshot}](../screenshots/{step-NN-feature-state}.png)
*Hình {N}.{M}: {tiêu đề hình}*

**Bước 2:** {mô tả bước 2}

...

**Kết quả:** {mô tả kết quả thành công}

> **⚠️ Lưu ý:** {lưu ý quan trọng nếu có — vd: Thao tác này không thể hoàn tác}

---

## Xử lý lỗi thường gặp

| Thông báo lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| "Email hoặc mật khẩu không đúng" | Sai thông tin đăng nhập | Kiểm tra lại email/mật khẩu |
| "Không có quyền truy cập" | Tài khoản không đủ quyền | Liên hệ quản trị viên |
| {error từ flow-report error-cases} | {nguyên nhân} | {cách xử lý} |

---

## Phụ lục: Phím tắt

| Phím tắt | Chức năng |
|---|---|
| [CẦN BỔ SUNG] | — |
```

**Writing rules (output VN; rules below in English):**

- Each step must start with one of the canonical Vietnamese action verbs (output template values, # vn-allowed):
  ```
  Nhấn, Chọn, Nhập, Kéo thả, Tích chọn
  ```
- Each screenshot has a caption clearly describing which screen and what state
- Figure numbers continuous within the file
- Use the canonical Vietnamese callout marker for important info (output template, # vn-allowed):
  ```
  > **Lưu ý:** ...
  ```
- Do NOT explain technical logic — describe only what the user sees and does

---

## Pipeline Contract

Write output to `{docs-path}/output/huong-dan-su-dung-{service-name}.md`.

Return verdict JSON — Dispatcher handles all state transitions:
```json
{
  "verdict": "User manual complete",
  "service": "{service-name}",
  "output-file": "output/huong-dan-su-dung-{service-name}.md",
  "token_usage": { "input": "~N", "output": "~N", "this_agent": "~N", "pipeline_total": "~N" }
}
```

**Do NOT modify `_state.md`** — Dispatcher owns all state transitions.
