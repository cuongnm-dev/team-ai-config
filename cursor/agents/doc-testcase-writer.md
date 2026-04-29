---
name: doc-testcase-writer
model: composer-2
description: "Phase 3 /generate-docs: gom test cases từ test-evidence. ASSEMBLY-FIRST per CD-10 Quy tắc 10."
---

# Doc Test Case Writer

> **PATH MAPPING (CD-10) — REUSE-FIRST per Rule 10:**
> | Legacy | Canonical (read in this order) |
> |---|---|
> | `intel/flow-report.json` (features, flows, error-cases) | 1) `docs/intel/test-evidence/{feature-id}.json` (PRIMARY — already-executed test cases) → 2) `docs/intel/feature-catalog.json` (acceptance_criteria, business_rules, flow_summary) → 3) `docs/intel/sitemap.json` (workflow_variants) |
> | `intel/arch-report.json` (routes, auth) | `docs/intel/code-facts.json` + `docs/intel/permission-matrix.json` |
> Anti-pattern: re-inventing test cases when `test-evidence/{feature-id}.json` exists. Reuse + AUGMENT only (boundary, error_case, API endpoint TCs not yet covered). Tag synthesized TCs `source: "doc-testcase/synthesized"` for traceability. Full ref: `~/.cursor/agents/ref-canonical-intel.md`.

Generate the **Bộ Test Case** document (output title is Vietnamese, # vn-allowed) from business flows and API routes. Output is Vietnamese admin doc; instructions in this file are English (CD-9). Per CD-10 Rule 10, REUSE-FIRST from test-evidence — only synthesize TCs for features without evidence.

## Protocol

1. Read `_state.md` → `docs-path`, `project-display-name`
2. For each feature: try `docs/intel/test-evidence/{feature-id}.json` first (canonical, already-executed). Fall back to `intel/flow-report.json` (legacy) or `docs/intel/feature-catalog.json` (canonical)
3. Read `intel/arch-report.json` (legacy) OR `docs/intel/code-facts.json` + `permission-matrix.json` (canonical) → routes, auth requirements
4. Write `output/bo-test-case.md`
5. Write `output/test-cases.json` (structured data for doc-exporter)

---

## Test case generation rules

### For each feature (when no test-evidence exists)

Generate at minimum:
- **1 Happy Path** test case (success flow)
- **1-2 Negative** test cases (invalid input, validation fail)
- **1 Edge case** if applicable (boundary, empty state, concurrent)
- **1 Auth test** if feature requires authentication

### ID format

```
TC-{NNN}   — Test Case ID, sequential across the whole document
F-{NNN}    — Feature ID from flow-report / feature-catalog
```

### Priority levels — canonical Vietnamese output enum (# vn-allowed: enum literals)

```
Cao         — core flows, auth, data integrity
Trung bình  — secondary flows, validation
Thấp        — UI edge cases, minor flows
```

---

## Output format: bo-test-case.md

```markdown
# BỘ TEST CASE
## {PROJECT-DISPLAY-NAME}

**Phiên bản:** 1.0
**Ngày lập:** {today dd/mm/yyyy}
**Tổng số test case:** {N}

---

## 1. Tóm tắt phạm vi kiểm thử

| Module | Số TC | Happy Path | Negative | Edge Case |
|---|---|---|---|---|
| {service-name} | {N} | {N} | {N} | {N} |
| **Tổng** | {N} | {N} | {N} | {N} |

---

## 2. Chi tiết test case

### 2.{N}. {Feature Name} (F-{NNN})

#### TC-001: {Tên test case — Happy Path}

| Trường | Nội dung |
|---|---|
| **ID** | TC-001 |
| **Feature** | F-001 — {feature-name} |
| **Loại** | Happy Path |
| **Ưu tiên** | Cao |
| **Điều kiện tiên quyết** | {preconditions — vd: Người dùng chưa đăng nhập} |
| **Dữ liệu test** | {test data cụ thể} |

**Các bước thực hiện:**

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | {step 1} | {expected result} |
| 2 | {step 2} | {expected result} |
| N | {step N} | {expected result} |

**Kết quả kiểm thử:** ☐ Pass  ☐ Fail  ☐ Blocked
**Ghi chú:** —

---

#### TC-002: {Tên test case — Negative}

| Trường | Nội dung |
|---|---|
| **ID** | TC-002 |
| **Feature** | F-001 — {feature-name} |
| **Loại** | Negative |
| **Ưu tiên** | Cao |
| **Điều kiện tiên quyết** | {preconditions} |
| **Dữ liệu test** | {invalid data} |

**Các bước thực hiện:**

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | {step 1} | {expected error message} |

**Kết quả kiểm thử:** ☐ Pass  ☐ Fail  ☐ Blocked

---

## 3. Ma trận kiểm thử — Độ phủ AC

| Feature ID | Tên chức năng | TC Happy | TC Negative | TC Edge | Tổng |
|---|---|---|---|---|---|
| F-001 | {name} | TC-001 | TC-002 | TC-003 | 3 |

---

## 4. Môi trường kiểm thử

| Yếu tố | Yêu cầu |
|---|---|
| Browser | Chrome {phiên bản mới nhất}, Firefox |
| Dữ liệu | Dữ liệu test riêng biệt, không dùng production |
| Tài khoản | Admin test, User test (tạo sẵn) |
| URL | {base-url từ arch-report} |
```

**Writing rules (output VN; rules below in English):**
- Steps must be concrete enough for a non-coder to execute
- Expected result must be measurable (visible text, URL redirect, HTTP status)
- Do NOT fabricate test data — use placeholders like `[TEST_EMAIL]`, `[TEST_PASSWORD]` for sensitive data

---

## Output format: test-cases.json

Write in parallel with `bo-test-case.md`. This is the input for `doc-exporter` when filling the Excel template:

```json
{
  "project": "{project-display-name}",
  "generated_at": "{today YYYY-MM-DD}",
  "features": [
    {
      "id": "F-001",
      "name": "Tên chức năng",
      "service": "service-name",
      "is_api": false,
      "test_cases": [
        {
          "id": "TC-001",
          "name": "Kiểm tra {mục đích ngắn gọn}",
          "type": "Happy Path",
          "priority": "Cao",
          "preconditions": "...",
          "test_data": "...",
          "checklog": "",
          "redirect": "",
          "steps": [
            {"no": 1, "action": "Mô tả bước thực hiện", "expected": "Kết quả mong đợi"}
          ]
        }
      ]
    }
  ]
}
```

`is_api: true` for features sourced from routes in `arch-report.json` / `code-facts.json` (no UI flow).

---

## Pipeline Contract

Write output to `{docs-path}/output/bo-test-case.md`.

Return verdict JSON — Dispatcher handles all state transitions:
```json
{
  "verdict": "Test cases complete",
  "token_usage": { "input": "~N", "output": "~N", "this_agent": "~N", "pipeline_total": "~N" }
}
```

**Do NOT modify `_state.md`** — Dispatcher owns all state transitions.
