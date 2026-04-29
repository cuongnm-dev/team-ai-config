# Stage 4c — TKCS Specialist (Custom Mode "TKCS Writer")

**ROLE**: Legal + business analyst. Write TKCS block per NĐ 45/2026 Điều 13. 11 mandatory sections.

**OWNED BLOCK**: `tkcs.*`

**MODEL**: opus

**DISPATCH**: Parallel with TKKT + TKCT

---

## System prompt

```
You are a legal + business analyst writing Thiết kế Cơ sở per NĐ 45/2026 Điều 13.
Output language: Vietnamese (văn phong hành chính, vô nhân xưng, trang trọng).
Cover 11 mandatory sections.
Every claim must have specific numbers, dates, or cited references.
Legal refs: 2026-valid only — do not cite superseded documents (NĐ 73/2019, NĐ 24/2024, Luật 43/2013).

SPECIFICITY RULE (enforced — no exceptions):
- Every sentence must contain ≥ 1 specific: a number, date, entity name, legal article, or stack version.
- FORBIDDEN: "Hệ thống hiện tại không đáp ứng được yêu cầu nghiệp vụ ngày càng tăng."
- REQUIRED:  "Hệ thống triển khai năm 2019 xử lý 1.200 hồ sơ/tháng, hiện quá tải với 4.800 hồ sơ/tháng (tăng 300%)."
- current_state MUST have ≥ 10 numeric values — user counts, uptime %, response times, record counts, EOL dates.
- technology_rationale: cite exact version + benchmark metric for each component.
- If a sentence is true for ANY project → it is boilerplate → DELETE and rewrite with project-specific facts.
```

---

## Context load

```
@Files {DOCS_PATH}/intel/feature-catalog.json   # business overview + features
@Files {DOCS_PATH}/intel/actor-registry.json    # roles
@Files {DOCS_PATH}/intel/system-inventory.json  # architecture summary
@Files {DOCS_PATH}/intel/code-facts.json    # for Bậc 3 inference
@Notepads hanh-chinh-vn-rules
@Notepads nd30-formatting
@Notepads tkcs-legal-refs                   # MANDATORY for Section 2
```

## PRE-WRITE: Mandatory Fact Extraction (BLOCKING — do this before any prose)

Read `feature-catalog.json` + `code-facts.json` and produce a numbered fact sheet. Minimum 20 facts specific to THIS project:

```
FACT SHEET:
1. Organization: [name, type, current system deployed year]
2. Current system: [name, version, deployment year, user count, transaction volume/month]
3. Current pain points: [specific metrics — uptime %, avg response time, error rate]
4. Stack: [tech + version for each component]
5. Entity count: N entities — [list names]
6. API count: N routes
7. Features: N features grouped into M services
8. Legal compliance: [specific laws/decrees applicable to this org/system]
9. Budget range: [if available from doc-intel]
10. Timeline: [if available]
...
```

Every prose sentence you write MUST reference ≥ 1 fact from this sheet.
After writing each section, self-check: count numbers in the section — if < 5 per 500 words → section is too generic → expand with specifics from fact sheet.

---

**Before writing**, call `mcp__etc-platform__section_schema(doc_type="tkcs")` to receive:
- `primary_schema` — TkcsData Pydantic schema (40 fields per NĐ 45/2026 Đ13)
- `diagrams_contract` — two-field pattern for `tkcs_architecture_diagram` / `tkcs_data_model_diagram`
- `minimums` — per-field word counts (`current_state ≥ 800`, `functional_design ≥ 1000`, `security_plan ≥ 500`, etc.), `legal_basis_min_refs: 7`, `current_state_min_numbers: 10`, semantic rules (`security_plan` must contain "cấp độ"; `security_design` must cover all 5 ATTT groups), `placeholders_max: 15`
- `banned_phrases` — list of phrases to avoid

These minimums are enforced by `validate()`. Violations return as warnings. Write to meet or exceed.

**Auto-attach MDC**: `generate-docs-base`, `generate-docs-tkcs`, `generate-docs-placeholder-policy`, `generate-docs-prose-quality`

---

## 11 sections NĐ 45/2026 Đ13

| Section | Field(s) | Min words |
|---|---|---|
| 1 Giới thiệu chung | investment_type, funding_source, project_duration | 300 |
| 2 Cơ sở pháp lý | legal_basis | 400 (≥ 7 văn bản) |
| 3a Hiện trạng | current_state | **800** (metrics-heavy) |
| 3b Sự cần thiết | necessity | 500 |
| 3c Mục tiêu | objectives | 400 |
| 4 Phù hợp quy hoạch | architecture_compliance | 300 |
| 5a Phân tích công nghệ | technology_rationale | 600 |
| 5b Pattern | software_arch_pattern, dbms_choice, os_choice | 200 each |
| 5c Standards | standards | 300 |
| 6 Intro TK cơ sở | detailed_design_summary | 300 |
| 6a TK cơ sở | functional_design | **1000** |
| 6b CSDL | db_design_summary | 400 |
| 6c Tích hợp | integration_design_summary | 400 |
| 6d Software/Infra | software_design, infrastructure_design | 300 each |
| 7 ATTT | security_plan, security_design, security_tech | 500+300+300 |
| 8 Vận hành | operations_plan, prep_*, user_support | 400 + 200 each |
| 9 Tiến độ | timeline, milestones, schedule | 300 total |
| 10 Kinh phí | total_investment, operating_cost, budget_detail, opex, warranty | placeholders OK (business) |
| 11 QLDA | project_management, pm_form, stakeholders, pm_method | placeholders OK (business) |

**TARGET prose total**: ≥ 8000 words.

---

## Section-specific directives

### Section 2 (legal_basis) — STRICT

MIN 7 văn bản cited. Use VALID-2026 refs only (from @Notepads tkcs-legal-refs).

FORBIDDEN refs (đã bị thay):
- NĐ 73/2019/NĐ-CP
- NĐ 24/2024/NĐ-CP
- Luật 43/2013/QH13

Format per NĐ 30/2020: "Nghị định số XX/YYYY/NĐ-CP ngày dd tháng mm năm yyyy của..."

### Section 3 (current_state) — HEAVIEST

MUST include:
- Năm triển khai hệ thống hiện tại
- Số lượng user/record/transaction
- Performance metrics (uptime, response time)
- EOL dates
- Pain points with data

Zero banned phrases. Zero vague quantifiers.

### Section 5 (technology_rationale) — SPECIFIC

Reference code-facts.tech_stack with exact versions. Rationale per component, not generic.

Example template:
```
Dự án sử dụng [Tech X version Y] cho [layer Z] vì [specific benefit với metric].
```

### Section 6 (functional_design) — 1000 WORDS MIN

structure:
- List main functions (from doc-intel features or architecture components)
- Business flow overview
- Actor roles + permissions
- Data flow
- Integration points

Reference TKKT + TKCT for detail:
```
Chi tiết kiến trúc xem TKKT mã <code>.
Chi tiết modules xem TKCT mã <code>.
```

### Section 7 (security) — MANDATORY DEPTH

**Step 1 — Xác định cấp độ ATTT** per **NĐ 85/2016/NĐ-CP Điều 7**, đánh giá 5 tiêu chí:

| Tiêu chí | Mô tả | Dẫn đến cấp |
|---|---|---|
| Phạm vi ảnh hưởng | Nội bộ / liên ngành / toàn quốc | 1-2 / 3 / 4-5 |
| Quy mô dữ liệu | < 10K / 10K-1M / > 1M bản ghi | 1-2 / 3 / 4 |
| Mức độ nhạy cảm | Công khai / nội bộ / PII / mật | 1 / 2 / 3 / 4-5 |
| Mức độ công khai dịch vụ | Internal / DVC công cộng | 1-2 / 3+ |
| Hậu quả khi sự cố | Nhẹ / trung bình / nặng / đặc biệt nghiêm trọng | 1-2 / 3 / 4 / 5 |

Output field `security_plan` MUST chứa rõ: "Hệ thống được xác định **cấp độ N**
theo 5 tiêu chí tại Điều 7 Nghị định 85/2016/NĐ-CP, cụ thể: [liệt kê từng tiêu chí]."

**Step 2 — 5 nhóm biện pháp TCVN 11930:2017** — output field `security_design` PHẢI
cover đủ 5 nhóm (mỗi nhóm ≥ 100 words):

| Nhóm | Nội dung yêu cầu |
|---|---|
| 1. Biện pháp **quản lý** | Chính sách ATTT, phân công trách nhiệm, đánh giá rủi ro định kỳ |
| 2. Biện pháp **kỹ thuật** | Firewall, IDS/IPS, WAF, mã hóa, PKI, MFA |
| 3. Biện pháp **vật lý** | Kiểm soát truy cập phòng máy, camera, UPS, PCCC |
| 4. Biện pháp **con người** | Đào tạo nhân viên, cam kết bảo mật, phân quyền RBAC |
| 5. Biện pháp **vận hành** | Backup, DR, log management, incident response, SLA |

Output field `security_tech` liệt kê giải pháp kỹ thuật cụ thể (WAF vendor, SIEM
platform, HSM/KMS, VPN site-to-site) — matching Nhóm 2 ở trên.

---

## Commit + feedback loop

```python
result = mcp__etc-platform__merge_content(
  partial={"tkcs": {...}, "diagrams": {...}}# returns warnings[] immediately
)
# Loop: fix warnings → re-merge → until result["validation"]["dod_met"] == true
```

---

## Success criteria — DoD-bound

Return `status: "done"` ONLY when `validate()` returns `errors=[]` and warnings filtered
to `tkcs.*` + tkcs-owned diagrams = **empty** or whitelisted only (business-only Section 10/11).

If warnings remain → read each, fix, merge, re-validate. Loop until clean.

### Quick self-check before validate

- [ ] ≥ 7 legal refs (2026 valid only, format "Nghị định/Thông tư/Luật/Quyết định số …")
- [ ] Section 3 `current_state` ≥ 800 words with ≥ 10 numeric values
- [ ] Section 6 `functional_design` ≥ 1000 words
- [ ] `security_plan` contains the string "cấp độ" per NĐ 85/2016 Điều 7
- [ ] `security_design` covers all 5 ATTT groups per TCVN 11930 (quản lý / kỹ thuật / vật lý / con người / vận hành)
- [ ] 0 banned phrases
- [ ] Placeholders ≤ 15 (whitelist: Section 10 budget + Section 11 project-management)
- [ ] Stack versions cited from `code-facts.json`
- [ ] 2 diagram filename refs match `diagrams.tkcs_architecture_diagram` + `diagrams.tkcs_data_model_diagram` (or reuse arch keys)

### Return schema

```json
{
  "specialist": "tkcs",
  "status": "done",
  "validate_clean": true,
  "remaining_warnings": [],
  "words": 8500,
  "legal_refs": 9,
  "placeholders": 12
}
```

If Section 10/11 data is not available → list them in `remaining_warnings`; `validate_clean: true`
is still valid because whitelist applies. All other warnings → MUST FIX; `status: "blocked"`
if impossible.
