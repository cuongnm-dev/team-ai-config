---
title: Agents Catalog — Vai trò + ví dụ thực tế
order: 3
---

# Agents Catalog

> Đọc xong, bạn sẽ biết **agent nào làm gì, khi nào dispatch, output trông ra sao**, kèm ví dụ thực tế.

54 agents được phân thành **stage agents** (làm chính cho SDLC) + **4 class** (A/B/C/D — phụ trợ).

> ⚠ **2 luồng độc lập** (xem README §Hai luồng). Agent Luồng A khác hoàn toàn agent Luồng B — đừng dispatch chéo.

---

## Phân nhóm agents theo luồng

### 🅰 Luồng A — SDLC (sản xuất phần mềm)

**Stage agents** (Cursor — interactive trong pipeline `/resume-feature`):
`ba` `sa` `tech-lead` `dev` `fe-dev` `qa` `reviewer` `pm` `dispatcher` (+ pro variants)

**Tdoc agents** (Claude — `/from-code` và `/generate-docs` orchestration):
`tdoc-researcher` `tdoc-actor-enum` `tdoc-test-runner` `tdoc-screenshot-reviewer` `tdoc-data-writer` `tdoc-exporter` `tdoc-tkkt-writer` `tdoc-tkcs-writer` `tdoc-tkct-writer` (writer cho NĐ 45/2026 phần mềm) `tdoc-testcase-writer` `tdoc-manual-writer`

**Class A/B/C/D** (phụ trợ): orchestrator, validator, merger, snapshot, ... — đa phần phục vụ Luồng A.

### 🅱 Luồng B — Tài liệu nhà nước (Đề án CĐS / đấu thầu)

**Strategic agents** (Claude — `/new-strategic-document` 4 spirals):
- `strategy-analyst` — Bộ não chiến lược, dẫn interview, phân tích gap, DEDUP
- `policy-researcher` — Nghiên cứu chính sách CNTT VN (QĐ/CT/NĐ), map ecosystem (NDXP/LGSP/CSDLQG)
- `structure-advisor` — Kiến trúc sư outline Đề án CĐS

**Doc-line agents** (Claude — `/new-document-workspace` cho HSMT/HSDT/dự toán/NCKT):
- `doc-orchestrator` — Điều phối pipeline tài liệu hành chính
- `doc-writer` — Viết section, văn phong nghị định, có web research
- `doc-reviewer` — Rà soát chất lượng theo NĐ 30/2020 + compliance pháp lý
- `doc-diagram` — Sinh sơ đồ PlantUML/Mermaid theo Khung CPĐT 4.0
- `tdoc-nckt-writer` — Specialist viết block nckt.* (NCKT NĐ 45/2026 Đ12 — 19 chương)

> Lưu ý: `tdoc-tkcs-writer` và `tdoc-tkct-writer` xuất hiện ở CẢ 2 luồng. Trong Luồng A là 1 phần của bộ nghiệm thu phần mềm; trong Luồng B là tài liệu thầu/dự toán độc lập theo NĐ 45/2026 Đ13/Đ14. Skill orchestrator phân biệt qua `content-data.json` schema.

---

## Production-line analogy

Trước khi vào chi tiết, nhớ phép ẩn dụ trong `reference/lifecycle.md`:

```
Skill          = khâu trên dây chuyền
Agent          = nhân viên trong khâu (chuyên môn hẹp)
Intel          = hồ sơ work-in-progress
Tokens         = vật tư, đắt khi sai
Drift          = phế phẩm (phát hiện sớm rẻ hơn cuối)
```

Nguyên tắc cốt lõi:
- **Mỗi agent có ROLE hẹp** — không "tiện tay làm hộ khâu khác"
- **Single-writer per field per stage** — 1 agent = 1 phần dữ liệu, không xung đột
- **Read-validate-write** — đọc upstream, validate freshness, write phần mình
- **No silent drift** — thấy hồ sơ sai → báo cáo, không tự fix

---

## Stage agents — SDLC pipeline (Cursor)

Đây là 6 agents chính mà anh/chị sẽ tương tác mỗi khi `/resume-feature`.

### `ba` — Business Analyst

**Vai trò**: Khâu đầu của SDLC. Phân tích nghiệp vụ + mô hình domain cho 1 feature.

**Trigger**: `_state.md.current-stage = ba` (mặc định khi feature mới).

**OWN**:
- `{features-root}/{feature-id}/ba/00-lean-spec.md` (file output chính)
- ENRICH `feature-catalog.json#features[id]`:
  - `description` (≥200 chars)
  - `acceptance_criteria` (≥3 items, mỗi item ≥30 chars)
  - `business_rules`

**FORBID** (tuyệt đối không touch):
- routes / entities (sa job)
- permission-matrix (sa job)
- test_case_ids (qa job)
- feature.status = implemented (close-feature job)

**Ví dụ output `ba/00-lean-spec.md`**:
```markdown
# F-001 — Tra cứu giao dịch vận tải

## Business Context
Hệ thống VEC...

## Acceptance Criteria
1. Lọc theo trạm + thời gian → trả về đúng GD trong khoảng đó
2. Phân trang 50 GD/trang, hỗ trợ navigation tới trang cuối
3. Click GD → modal xem chi tiết kèm ảnh xe vào/ra

## Business Rules
- chargeStatus: SUCC|FAIL|PENDING (3 giá trị fixed)
- ...
```

**Ví dụ enrich feature-catalog**:
```json
{
  "id": "F-001",
  "description": "Tra cứu toàn bộ giao dịch vận tải qua hệ thống thu phí... [200+ chars]",
  "acceptance_criteria": [
    "Lọc theo checkinTollId và khoảng thời gian trả về đúng GD của trạm trong khoảng đó",
    "Lọc theo chargeStatus=SUCC/FAIL/PENDING trả về đúng GD theo trạng thái",
    "Xem chi tiết hiển thị đầy đủ datetime, phí, discount, voucher, ảnh xe vào/ra"
  ]
}
```

**Khi BA gặp vấn đề**:
- Doc thiếu thông tin → set `clarification-notes` → escalate PM
- Phát hiện feature scope quá lớn → suggest split (PM quyết)

**Pro variant `ba-pro`**: Dùng Opus model — escalation tier khi `risk_score ≥ 4` hoặc compliance phức tạp.

---

### `sa` — Solution Architect

**Vai trò**: Khâu thiết kế kiến trúc 1 feature: routes, entities, integrations, permission concrete.

**Trigger**: Sau `ba` Pass, khi `current-stage = sa`.

**OWN**:
- `{features-root}/{feature-id}/sa/00-lean-architecture.md`
- ENRICH:
  - `sitemap.json#routes[]` (concrete routes, replace placeholder của new-feature)
  - `permission-matrix.json#permissions[]` (action enum cụ thể, confidence: high)
  - `data-model.json#entities[]` (entities mới)
  - `integrations.json#integrations[]` (integrations mới)
  - `feature-catalog.json#features[id]`: `routes[]`, `entities[]`

**FORBID**:
- description / AC / business_rules (ba job)
- test-evidence (qa job)
- modify `actor-registry.roles[]` (org-level, manual)
- self-fix khi ba's permission_seeds conflict — phải FLAG, không silent merge

**Ví dụ output `sa/00-lean-architecture.md`**:
```markdown
# F-001 — Tra cứu giao dịch vận tải — Architecture

## Routes
| Method | Path | Permission | Description |
|---|---|---|---|
| GET | /api/transactions | hqdk:read | List with filters |
| GET | /api/transactions/{id} | hqdk:read | Detail |

## Entities (new)
- TransportTransaction (32 fields, FK to Toll, Lane, Vehicle)

## Integrations (new)
- (none — internal only)

## Permissions
| Role | Resource | Action |
|---|---|---|
| hqdk | transaction | read |
| lanh-dao | transaction | read (readonly) |
```

**Khi SA gặp drift**:
- ba's `permission_seeds` mâu thuẫn với existing `permission-matrix` → STOP, verdict `permission-conflict-detected` → PM resolve
- Không silent merge (P4 LIFECYCLE)

**Pro variant `sa-pro`**: Khi `adr_id` assigned hoặc cross-system architecture.

---

### `tech-lead`

**Vai trò**: Phân rã implementation thành tasks + execution waves (max 4 dev/wave).

**Trigger**: Sau `sa` Pass.

**OWN**: Chỉ `{features-root}/{feature-id}/04-tech-lead-plan.md`. Không touch intel.

**Ví dụ output**:
```markdown
# F-001 — Tech Lead Plan

## Wave 1 (parallel, 4 tasks)
| Task ID | Owner | Description | Cites |
|---|---|---|---|
| T1.1 | dev   | Migrations + entity TransportTransaction | data-model.entities[T1] |
| T1.2 | dev   | Repository + service layer | code-facts.* |
| T1.3 | fe-dev| Component + table view | sitemap.routes[/transactions] |
| T1.4 | fe-dev| Filter form + pagination | feature-catalog.AC[1,2] |

## Wave 2 (sequential, 1 task)
| T2.1 | dev   | API endpoint /api/transactions/{id} | depends T1.2 |

## Risks
- Performance với >1M rows → cần index trên (toll_id, datetime_in)
```

**Class A** (LIFECYCLE.md §5.8) — Stage-report writer thuần. Không có tier `-pro`.

---

### `dev` / `fe-dev` — Developers

**Vai trò**: Implement code 1 task/wave, set `intel-drift: true` nếu touch auth/RBAC/route/DDL.

**Trigger**: Sau `tech-lead`. Có 2 dev có thể parallel cùng wave.

**OWN**:
- Source code under `/src/**/*` (per task scope)
- `{features-root}/{feature-id}/05-dev-w{N}-{task-id}.md` (task report)

**UPDATE**:
- `_state.md.intel-drift: true` khi touch:
  - role enum / RBAC decorator
  - route add/remove
  - DDL migration
  - new endpoint / new external integration

**FORBID**:
- Direct edits to `sitemap.json`, `permission-matrix.json`, `data-model.json` — đây là `intel-refresh` job. Dev chỉ touch code, intel auto-refresh sau pipeline end.
- Modify `feature-catalog.json` (close-feature job)
- Schema change không có trong data-model — STOP, escalate sa (P8 role refusal)

**Ví dụ output `05-dev-w1-T1.1.md`**:
```markdown
# T1.1 — Migrations + entity TransportTransaction

## Files changed
- migrations/202604280001_create_transport_transactions.sql
- src/Entities/TransportTransaction.cs

## Verification
$ dotnet ef database update
✓ Migration applied (1.2s)

$ dotnet test --filter Category=Entity
✓ 8 passed

## Intel drift
DDL change detected → set `_state.md.intel-drift: true`
```

**Pro variant `dev-pro`**: Khi test failure rate > 30% hoặc complex refactor.

**`fe-dev` khác `dev`**: Frontend chuyên trách (React/Vue components, pages, accessibility). Yêu cầu `designer` output trước khi chạy.

---

### `qa` — Quality Assurance

**Vai trò**: Test 1 feature, **produce 3 atomic artifacts** (CD-10 Quy tắc 16):

1. `test-evidence/{id}.json` — TC prose với `execution.status` set
2. `playwright/{id}.spec.ts` — executable spec, re-runnable bởi CI
3. `screenshots/{id}-step-NN-{state}.png` — captured DURING Playwright run (CD-4 naming)

3 artifact phải produce CÙNG LÚC trong 1 nghiệm thu pass — thiếu 1 trong 3 → block close-feature.

**Trigger**: Sau `dev/fe-dev` waves done.

**OWN**:
- `{features-root}/{feature-id}/07-qa-report.md`
- `docs/intel/test-evidence/{feature-id}.json`
- `{playwright-root}/{feature-id}.spec.ts`
- `docs/intel/screenshots/{feature-id}-step-NN-{state}.png`

**ENRICH**:
- `feature-catalog.json#features[id].test_case_ids[]`
- `feature-catalog.json#features[id].test_evidence_ref`

**FORBID**:
- Write description / AC / business_rules (ba job)
- Set feature.status = implemented (close-feature job)
- **Fabricate AC khi feature-catalog.AC empty** — REFUSE, escalate ba (P8 role refusal)

**Min TC count** (CD-10 Quy tắc 15):
```
min_tc(feature) = max(5, AC×2 + roles×2 + dialogs×2 + error_cases + 3)
```
Vd F-001 có 5 AC, 2 roles, 1 dialog, 2 error_cases:
```
min_tc = max(5, 5×2 + 2×2 + 1×2 + 2 + 3) = max(5, 21) = 21
```
QA phải tạo ≥21 test cases.

**Ví dụ output `test-evidence/F-001.json`** (rút gọn):
```json
{
  "feature_id": "F-001",
  "test_cases": [
    {
      "id": "TC-F001-001",
      "title": "Lọc theo trạm 1 + ngày 2026-04-29 → trả về 5 GD",
      "preconditions": ["DB có 5 GD trạm 1 ngày 2026-04-29"],
      "steps": ["1. Mở /transactions", "2. Chọn trạm 1, ngày 2026-04-29", "3. Click Tìm"],
      "expected": "Bảng hiện 5 GD đúng filter",
      "execution": { "status": "passed", "executed_at": "2026-04-29T14:30:00Z" }
    },
    ...
  ],
  "playwright_path": "playwright/F-001.spec.ts",
  "screenshots": [
    "F-001-step-01-initial.png",
    "F-001-step-02-filled.png",
    "F-001-step-03-success.png"
  ],
  "coverage_pct": 87
}
```

**Pro variant `qa-pro`**: Khi `ac_coverage_pct < 80` hoặc complex integration testing.

---

### `reviewer`

**Vai trò**: Quality gate cuối — kiểm tra requirement + architecture + code quality + security + test adequacy.

**Trigger**: Sau `qa` Pass.

**OWN**: Chỉ `{features-root}/{feature-id}/08-review-report.md`. Không touch intel.

**Verdict ∈** `{Approved, Changes-requested, Blocked}`.

**Ví dụ output**:
```markdown
# F-001 — Review Report

## Requirement alignment: ✓
All 5 AC mapped to test cases (TC-001..TC-021).

## Architecture alignment: ✓
Routes, entities, permissions match sa output.

## Code quality: ⚠ MINOR
- Magic number 50 in pagination — extract to const

## Security: ✓
Auth checks present. No PII leak.

## Test adequacy: ✓
21/21 TCs passed. Coverage 87%.

## Verdict: Approved
Ready for /close-feature.

## Should-fix (non-blocking)
- Extract pagination magic number to PAGE_SIZE const
```

**Class A** — Stage-report writer thuần.

**Pro variant `reviewer-pro`**: Khi `risk_score ≥ 3` hoặc breaking change.

---

## Class A — Stage-report writers

Các agents này CHỈ viết 1 file stage report, **TUYỆT ĐỐI không touch intel**.

| Agent | OWN file | Khi dispatch |
|---|---|---|
| `tech-lead` | `04-tech-lead-plan.md` | Sau sa |
| `reviewer` / `reviewer-pro` | `08-review-report.md` | Sau qa |
| `designer` | `designer/00-screens.md` | Khi BA flag UI impact |
| `devops` | `devops/00-deploy-plan.md` | Khi tech-lead flag Deploy Impact |
| `release-manager` | `release/00-release-plan.md` | risk≥3 + DB migration |

**Vì sao Class A?** Họ là "supporting roles" cho stage chính. Output là decision/plan, không phải data về feature. Nếu Class A được phép ghi intel → P1 violation (single-writer).

---

## Class B — Verifiers (read intel, FLAG drift)

| Agent | Scope | Output |
|---|---|---|
| `security` | Threat model, auth/PII/payment | `security/01-findings.md` + intel-drift flag |
| `data-governance` | Data ownership, PII, GDPR/PDPA | `data-governance/01-findings.md` + intel-drift flag |
| `sre-observability` | Resilience, SLO/SLI, monitoring | `sre/01-nfr-verification.md` + intel-drift flag |

**Đặc điểm Class B**:
- Đọc cả intel + code (re-scan code là JOB của họ — đây là EXCEPTION cho P7 anti-fishing)
- Nếu phát hiện drift giữa code vs intel → set `_state.md.intel-drift: true`, FLAG vào findings
- **KHÔNG tự fix intel** — refer to `/intel-refresh`. Tự fix = bug = P4 violation.

**Ví dụ scenario** — `security` agent:
```
Feature: F-042 đăng nhập 2FA

security agent đọc:
  - feature-catalog.F-042.acceptance_criteria
  - permission-matrix.role[admin]
  - code: src/Auth/TwoFactorService.cs

Phát hiện:
  ⚠ Code có endpoint /api/2fa/disable mà permission-matrix không có entry.
    Drift severity: HIGH (security bypass risk).

Action:
  - Write security/01-findings.md với finding chi tiết
  - Set _state.md.intel-drift: true
  - Verdict: Concerns (không Block — vì user có thể quyết định ý đồ)
```

→ Reviewer sẽ thấy finding, escalate PM. PM quyết: thêm permission entry hay xóa endpoint.

---

## Class C — Orchestrators (control flow)

| Agent | Vai trò |
|---|---|
| `dispatcher` | Pipeline executor: 1 invocation = 1 stage. Routes agents, validates artifacts, escalates PM |
| `pm` | Delivery orchestrator: judgment calls (path selection, exceptions, extended roles). Không call agents trực tiếp |
| `telemetry` | Background: token usage, cache hit, stage timing → JSONL. Read-only `_state.md` |

**Đặc điểm**:
- Không produce content
- Update `_state.md` (current-stage, completed-stages, kpi)
- KHÔNG ghi intel artifacts

**Ví dụ `pm` agent**:

User chạy `/resume-feature F-001` lần thứ 5, dispatcher không advance được stage vì có ambiguity. Dispatcher invoke `pm`:

```
PM input:
  pm-trigger: "ba detected requirement conflict"
  pm-context: "AC #3 nói 'tự động xóa GD cũ 30 ngày', nhưng business_rule nói 'không xóa GD'"

PM thinks:
  → Đây là contradiction giữa AC và business rule.
  → Không có thẩm quyền tự sửa AC (đó là ba job).
  → Cần stakeholder clarify.

PM output (JSON):
{
  "resume": false,
  "judgment": "Conflict between AC#3 (auto-delete) and business_rule (no-delete). Need stakeholder clarify.",
  "action": "Set _state.md.clarification-notes: '...'. Pause pipeline."
}
```

→ User trả lời clarification trong `_state.md`, chạy `/resume-feature` lại.

---

## Class D — Doc-generation consumers

13 agents (9 doc-* + 4 tdoc-* Cursor + 8 Claude tdoc-*). Render canonical intel → Office output.

**Đặc điểm**:
- READ-ONLY trên intel layer (cấm ghi)
- Output cuối cùng: Office files trong `docs/generated/{slug}/output/`
- Mỗi agent specialty 1 loại tài liệu

**Claude side (tdoc-*)** — chạy trong `/from-code` + `/generate-docs`:

| Agent | Vai trò |
|---|---|
| `tdoc-researcher` | Phase 1-2: discovery + analysis. Output 7 intel JSON + 2 brief.md |
| `tdoc-actor-enum` | Phase 1.5: enumerate roles + RBAC từ code |
| `tdoc-data-writer` | Phase 3: tổng hợp `content-data.json` |
| `tdoc-tkkt-writer` | Specialist viết block `architecture.*` (Thiết kế Kiến trúc) |
| `tdoc-tkcs-writer` | Specialist viết block `tkcs.*` (Thiết kế Cơ sở) |
| `tdoc-tkct-writer` | Specialist viết block `tkct.*` (Thiết kế Chi tiết) |
| `tdoc-test-runner` | Phase 2: capture Playwright screenshots |
| `tdoc-screenshot-reviewer` | Vision verification screenshots vs expected state |
| `tdoc-exporter` | Phase 4: upload + render Office qua etc-platform MCP |

**Cursor side (doc-*)** — chạy trong Cursor 3 mode generate-docs:

| Agent | Vai trò |
|---|---|
| `doc-intel` | Stage đầu khi input là file (docx/pdf/ảnh). OCR + populate _state.md |
| `doc-researcher` | Phase 1: SCAN → ARCH → FLOW → FE |
| `doc-test-runner` | Phase 2: Playwright MCP native capture |
| `doc-arch-writer` | Phase 3: viết Thiết kế Kiến trúc |
| `doc-catalog-writer` | Phase 3: viết Catalog tính năng + API |
| `doc-manual-writer` | Phase 3: viết HDSD với screenshots |
| `doc-testcase-writer` | Phase 3: gom test cases từ test-evidence |
| `doc-tkcs-writer` | Phase 3: viết TKCS theo NĐ 45/2026 |
| `doc-exporter` | Phase 4: render Office files |

**Khác biệt Cursor vs Claude**:
- Cursor: dùng MCP native (Playwright, Word/Excel) — workflow integrated trong IDE
- Claude: orchestrator mạnh, parallel dispatch tốt — tốt cho batch processing

---

## Document-related agents (Claude — tài liệu hành chính)

Khác với SDLC pipeline, đây là agents cho `/new-strategic-document`, `/new-document-workspace`:

| Agent | Vai trò |
|---|---|
| `doc-orchestrator` | Điều phối pipeline tài liệu hành chính. Dispatch doc-writer/doc-reviewer parallel |
| `doc-writer` | Viết section tài liệu hành chính VN. Văn phong nghị định, có web research |
| `doc-reviewer` | Rà soát chất lượng theo NĐ 30/2020 + compliance pháp lý + cross-reference |
| `doc-diagram` | Sinh sơ đồ Mermaid theo Khung CPĐT 4.0 |
| `policy-researcher` | Nghiên cứu chính sách CNTT VN, map hệ sinh thái (NDXP/LGSP/CSDLQG) |
| `strategy-analyst` | Bộ não chiến lược CĐS, xuyên suốt 4 spirals (interview → analysis → solution → write) |
| `structure-advisor` | Kiến trúc sư outline Đề án CĐS |
| `intel-merger` | Hợp nhất xung đột khi nhiều producer ghi cùng intel artifact |
| `intel-validator` | Validate intel theo JSON Schema + cross-reference integrity |
| `doc-intel-module` | Phân tích 1 module trong tài liệu lớn (LARGE mode của doc-intel) |
| `doc-intel-validator` | Kiểm tra hậu xử lý doc-intel (hallucination, truncation) |

---

## Khi nào dispatch agent nào?

```
Cần làm gì với 1 feature?              → Stage agents (ba/sa/dev/qa/reviewer)
Cần báo cáo điều kiện đặc biệt?         → Class A (designer/devops/release-manager)
Cần verify/audit code vs intel?         → Class B (security/data-governance/sre)
Cần routing/escalation?                 → Class C (dispatcher/pm)
Cần render tài liệu Office?             → Class D (tdoc-*/doc-*)
Cần soạn Đề án CĐS strategic?           → policy-researcher/strategy-analyst/structure-advisor
Cần soạn 1 doc hành chính lẻ?           → doc-orchestrator + doc-writer + doc-reviewer
Cần fix conflict trong intel?           → intel-merger
Cần validate intel schema?              → intel-validator
```

---

## Pitfalls khi dispatch

### 1. "fabricate" — agent tự sáng tác data thiếu
- **Triệu chứng**: ba có AC `[CẦN BỔ SUNG]` → qa tự bịa AC ra để test
- **Cause**: Class B/D agent vi phạm P8 (role refusal)
- **Fix**: Agent phải REFUSE + escalate, không bịa

### 2. "silent merge" — Class B tự fix drift
- **Triệu chứng**: security thấy permission-matrix conflict → tự sửa permission-matrix
- **Cause**: P4 violation (no silent drift)
- **Fix**: FLAG vào findings, set intel-drift, để `/intel-refresh` xử lý

### 3. "tiện tay làm hộ" — Class A ghi intel
- **Triệu chứng**: tech-lead update feature-catalog.routes
- **Cause**: P1 violation (single-writer per field)
- **Fix**: tech-lead chỉ viết 04-tech-lead-plan.md, route enrich là sa job

### 4. Re-discovery khi intel có sẵn
- **Triệu chứng**: dev agent run `Glob('**/*.controller.ts')` thay vì đọc `sitemap.json`
- **Cause**: P7 violation (anti-fishing)
- **Fix**: agent phải đọc intel trước, code chỉ là last-resort

---

## Liên quan

- `architecture.md` — Bản đồ tổng thể
- `skills.md` — Skills catalog
- `reference/lifecycle.md` — Full LIFECYCLE.md contract
- `workflows/` — Hướng dẫn từng skill chi tiết

## Quick reference (auto-extracted index)

```bash
ai-kit doc agents --brief    # 1 dòng/agent từ frontmatter description
```
