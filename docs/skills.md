---
title: Skills Catalog — Khi nào dùng skill nào?
order: 2
---

# Skills Catalog

Tài liệu này giúp anh/chị **chọn đúng skill** cho từng tình huống cụ thể, kèm ví dụ thực tế.

> Đọc xong, bạn nên trả lời được:
> - "Tôi đang ở case X, dùng skill nào?"
> - "Skill này input/output là gì?"
> - "Có pitfall nào hay gặp không?"

---

## Decision matrix — Tôi đang ở tình huống nào?

| Tình huống bạn đang gặp | Skill primary | Skill follow-up |
|---|---|---|
| Có SRS/BRD docx, project chưa có code | `/from-doc` | `/resume-feature` cho từng F-NNN, rồi `/generate-docs` |
| Có codebase đã ship, cần tài liệu nghiệm thu | `/from-code` | `/intel-fill` (T3 fields) → `/generate-docs` |
| Đã có cả SRS + code, cần verify alignment | `/from-code` rồi `/from-doc` (verify mode) | Review `drift-report.json` |
| Thêm 1 feature mới vào project có sẵn | `/new-feature` | `/resume-feature F-NNN` |
| Pipeline đang dở dang, tiếp tục | `/resume-feature F-NNN` | Lặp đến reviewer Pass |
| Feature đã reviewer Pass | `/close-feature F-NNN` | (sau đó `/generate-docs` nếu cần Office) |
| Code thay đổi auth/RBAC/route → intel stale | `/intel-refresh` | Check `_meta.json.stale` |
| Cần fill ATTT/NFR/dự toán (chỉ con người biết) | `/intel-fill` | (interactive interview) |
| Đề án CĐS chiến lược (không phải feature SDLC) | `/new-strategic-document` | `/strategic-critique` |
| Tạo 1 tài liệu hành chính riêng lẻ (TKCS/HSMT/...) | `/new-document-workspace` | (theo wizard) |
| Muốn đóng gói deliverable ZIP | `/zip-disk` | (sau `/generate-docs`) |

---

## Skills — Onboarding pipeline (most common)

### `/from-doc` — Phân tích tài liệu nguồn

**Một câu**: Đọc PDF/DOCX/ảnh wireframe → khởi tạo intel layer + sinh nhiều `_state.md` cho team SDLC.

**Khi nào**: Bắt đầu project mới có SRS/BRD, hoặc khi cần đối chiếu code-vs-docs.

**Input**: 1 hoặc nhiều file (`.docx`, `.pdf`, `.md`, ảnh wireframe).

**Output**:
- `docs/intel/doc-brief.md` — narrative summary
- `docs/intel/{actor-registry, feature-catalog, sitemap}.json` — seeds
- `docs/features/F-NNN/_state.md` — 1 file/feature, status: planned

**Ví dụ session**:
```
$ /from-doc D:/Projects/be-portal/docs/source/SRS-v0.3.docx

Detected:
  - 2 modules (M1: User Mgmt, M2: Transactions)
  - 7 features (SRS-F001 to SRS-F007)
  - 3 roles (admin, hqdk, lanh-dao)
  - 12 screens

Pipeline split:
  Modules ≤ 3 AND features ≤ 10 → 1 pipeline cover all
  
Confirm? [y]
> y

✓ Generated F-001..F-007
✓ docs/intel/doc-brief.md (4.2 KB)
✓ docs/intel/feature-catalog.json (status: planned for all)
```

**Tip — flexibility**:
- Có thể gọi nhiều lần với nhiều SRS (tích lũy vào catalog)
- Nếu intel layer đã tồn tại → tự động chuyển VERIFY mode (không tạo lại entries)

**Pitfall**:
- SRS quá lớn (>50 features) → skill chuyển LARGE mode, dispatch `doc-intel-module` parallel. Tốn token, nhưng cần thiết.
- Hình ảnh wireframe không có alt text → OCR hạn chế, cần `/intel-fill` bổ sung sau.

[Chi tiết workflow →](workflows/from-doc.md)

---

### `/from-code` — Reverse-engineer từ codebase

**Một câu**: Quét toàn bộ codebase → trích xuất features, routes, RBAC, entities → sinh canonical intel layer.

**Khi nào**: Project đã có code đang chạy, cần sinh tài liệu nghiệm thu hoặc onboard team mới.

**Input**: Path tới project root (vd `D:/Projects/be-portal`).

**Output**:
- `docs/intel/system-inventory.json` — tech stack
- `docs/intel/code-brief.md`, `arch-brief.md` — narrative
- `docs/intel/{actor-registry, permission-matrix, sitemap, feature-catalog, data-model, integrations}.json`
- `docs/features/F-NNN/_state.md` — status: implemented (vì code đã có)

**Ví dụ session**:
```
$ /from-code D:/Projects/be-portal

Phase 0 Preflight:
  Detected: Angular 18 + .NET 9 + PostgreSQL

Phase 1 Static harvest (silent-fail detection):
  Routes: 84 found
  Entities: 32 found
  RBAC decorators: 47 found

Phase 1.5 Actor enumeration:
  Roles: hqdk, lanh-dao, kiem-tra, admin

Phase 2 Feature synthesis:
  Group endpoints + UI → 47 features

Phase 4 Architecture diagrams:
  context.mmd, container.mmd, components.mmd...

Phase 5 Scaffold:
  47 _state.md files (status: implemented)

✓ Generated F-001..F-047
```

**Tip — flexibility**:
- Monorepo: skill detect nhiều services → tạo `docs/feature-map-aggregate.yaml`
- Có thể chạy lại sau khi code thay đổi — sẽ refresh intel (không phá entries đã có)

**Pitfall**:
- Stub-as-done detection: nếu hàm trả `throw NotImplementedException` → skill mark `current-implementation-status: stubbed` thay vì `done`.
- Test files có sẵn (Jest/Pytest) → tự extract test seeds vào `test-evidence/`.

[Chi tiết workflow →](workflows/from-code.md)

---

### `/new-feature` — Khởi tạo 1 feature mới (interactive)

**Một câu**: Wizard hỏi chi tiết feature → tạo `_state.md` + đăng ký vào `feature-catalog.json`.

**Khi nào**: Có yêu cầu mới (từ stakeholder), cần thêm feature vào project hiện có.

**Khác `/from-doc`**: `/from-doc` xử lý hàng loạt từ tài liệu; `/new-feature` interactive cho 1 feature.

**Input** (hỏi user):
- Feature name (ngắn, tiếng Việt)
- Business goal (≥100 chars)
- Scope in/out, flow summary, constraints
- Module, role visibility, dependencies, priority

**Output**:
- `docs/features/F-NNN/_state.md` (status: planned)
- `docs/features/F-NNN/feature-brief.md`
- `feature-catalog.json` thêm entry với placeholders `[CẦN BỔ SUNG]`

**Ví dụ session** (Cursor):
```
> /new-feature

Feature name: Xuất báo cáo doanh thu hàng tháng
Business goal: Cho phép kế toán xuất báo cáo doanh thu theo tháng,
   theo trạm thu phí, để đối chiếu với BOO partner...
Module: revenue-reporting
Role visibility: kế-toán:full, lãnh-đạo:readonly
Priority: high

→ Generated F-048 (status: planned)
→ Updated feature-catalog.json + sitemap placeholder
```

**Tip — flexibility**:
- Có thể bypass intel (nếu chưa từng chạy `/from-doc`/`/from-code`) — chỉ ghi vào `feature-map.yaml` legacy mode
- Sau khi tạo, chạy `/resume-feature F-048` để bắt đầu SDLC

**Pitfall**:
- Trùng business intent với feature đã có → skill cảnh báo qua semantic search
- Module name không trong sitemap → suggest closest match

[Chi tiết workflow →](workflows/new-feature.md)

---

### `/resume-feature` — Chạy SDLC pipeline 1 stage

**Một câu**: Đọc `_state.md`, dispatch agent của `current-stage`, advance khi Pass.

**Khi nào**: Sau `/new-feature` hoặc `/from-doc`, cần chạy pipeline qua các stage.

**Input**: Feature ID hoặc path tới `_state.md`.

**Output**: Mỗi stage tạo file riêng:
- `ba/00-lean-spec.md` (ba)
- `sa/00-lean-architecture.md` (sa)
- `04-tech-lead-plan.md` (tech-lead)
- `05-dev-w{N}-{task}.md` (dev)
- `07-qa-report.md` + `test-evidence/F-NNN.json` (qa)
- `08-review-report.md` (reviewer)

**Ví dụ session** (Cursor — gọi nhiều lần):
```
> /resume-feature F-001
[ba] Verdict: Pass. AC: 5 items, business_rules: 3.
   Advance: in_design → in_development.

> /resume-feature F-001
[sa] Verdict: Pass. routes: 4 endpoints, entities: 2 new.

> /resume-feature F-001
[tech-lead] Verdict: Pass. Wave 1 (3 tasks), Wave 2 (2 tasks).

> /resume-feature F-001
[dev-wave-1] Verdict: Pass. Task T1.1 + T1.2 + T1.3 done.

> /resume-feature F-001
[fe-dev-wave-1] Verdict: Pass.

> /resume-feature F-001
[qa-wave-1] Verdict: Pass. 12 TCs (12 passed), 8 screenshots.

> /resume-feature F-001
[reviewer] Verdict: Approved. Ready to close.

> /close-feature F-001
✓ Sealed.
```

**Tip — flexibility**:
- Có thể auto-loop: `/loop 5m /resume-feature F-001` → mỗi 5 phút tự advance 1 stage
- Stage dừng ở `pm-required` → invoke `pm` agent → user trả lời → resume
- Có thể skip stage: edit `stages-queue` trong `_state.md` (advanced)

**Pitfall**:
- Dependency check: nếu F-001 depends-on F-005 mà F-005 chưa done → skill ask wait/override/cancel
- Intel stale → STOP với hint chạy `/intel-refresh`
- Mid-wave dừng giữa chừng — resume đọc tasks done từ glob `05-*-w{N}-*.md` → tiếp tục từ task chưa làm

[Chi tiết workflow →](workflows/resume-feature.md)

---

### `/close-feature` — Đóng feature, sync canonical

**Một câu**: Sau reviewer Pass, seal `_state.md` + sync `feature-catalog.json` với evidence.

**Khi nào**: Reviewer verdict = `Approved`, QA atomic triple đã có đủ.

**Input**: Feature ID.

**Output** (UPDATE):
- `_state.md`: status=done, sealed
- `feature-map.yaml`: status=done
- `feature-catalog.json`: status=implemented + implementation_evidence (commits, coverage, ADRs)
- `_meta.json`: provenance updated
- `intel-snapshot/{timestamp}/`: snapshot regen

**Ví dụ session**:
```
> /close-feature F-001

Validating close conditions:
  ✓ Reviewer verdict: Approved
  ✓ QA atomic triple complete:
     - test-evidence/F-001.json    (12 TCs, all passed)
     - playwright/F-001.spec.ts    (executable)
     - screenshots/F-001-*.png     (8 files, CD-4 named)
  ✓ min_tc check: 12 >= max(5, 5*2 + 3*2 + 2 + 3) = 21? NO

✗ FAIL: TC count 12 < required 21.
   Run /resume-feature F-001 → qa stage thêm TCs.
```

**Tip**:
- Có flag `--skip-qa-gate` cho trường hợp đặc biệt — sẽ logged + audit
- Sau close: auto-suggest `/generate-docs` nếu trong `docs/generated/{slug}` chưa có output

**Pitfall**:
- KHÔNG thể close khi `feature.status: blocked` — phải resolve blocker trước
- Atomic triple incomplete → STOP nghiêm ngặt (CD-10 Quy tắc 16)

[Chi tiết workflow →](workflows/close-feature.md)

---

### `/generate-docs` — Sinh tài liệu Office

**Một câu**: Đọc canonical intel → sinh content-data.json → render 5 Office files qua etc-platform MCP.

**Khi nào**: Features đã `done` (hoặc legacy mode), cần xuất TKKT/TKCS/HDSD/test-cases.

**Input**: (đọc từ workspace)
- `docs/intel/feature-catalog.json` (Tier 1)
- `docs/intel/test-evidence/*.json` (assembly mode)
- T3 fields (NFR, ATTT, dự toán) — phải có sẵn hoặc chạy `/intel-fill` trước

**Output**:
- `docs/generated/{slug}/output/tkkt.docx` — Thiết kế Kiến trúc
- `docs/generated/{slug}/output/tkcs.docx` — Thiết kế Cơ sở
- `docs/generated/{slug}/output/tkct.docx` — Thiết kế Chi tiết
- `docs/generated/{slug}/output/hdsd.docx` — HDSD với screenshots
- `docs/generated/{slug}/output/test-cases.xlsx` — Bộ test case (BM.QT.04.04)

**Ví dụ session**:
```
$ /generate-docs

Stage 1 Preflight: ✓ intel fresh, MCP healthy
Stage 2 Discovery: 47 features loaded
Stage 3 Analysis: 0 thin, 2 features missing test-evidence
Stage 4a Capture: skipped 45 (have evidence)
                  capturing 2 (Playwright fresh)
Stage 4b-d Synthesis (parallel):
  ► tdoc-tkkt-writer building architecture.* block
  ► tdoc-tkcs-writer building tkcs.* block
  ► tdoc-tkct-writer building tkct.* block
Stage 5 Quality: ✓ schema validated
Stage 6 Delivery (etc-platform MCP):
  ✓ tkkt.docx (1.4 MB)
  ✓ tkcs.docx (2.6 MB)
  ✓ tkct.docx (3.1 MB)
  ✓ hdsd.docx (8.2 MB — 47 screenshots)
  ✓ test-cases.xlsx (980 KB, 580 TCs)

Output: docs/generated/be-portal/output/
```

**Tip — flexibility**:
- ASSEMBLY mode (default): healthy project, có sẵn test-evidence → assembly thuần
- FALLBACK mode: legacy không có test-evidence → synthesize TC qua ISTQB techniques, đánh dấu `proposed`
- `--rerun-stage N` để chạy lại 1 stage cụ thể

**Pitfall**:
- MCP down → BLOCK (CD-8). Skill instruct user `ai-kit mcp start`.
- Intel stale → BLOCK với hint `/intel-refresh`.
- T3 fields chưa fill → các block tkcs.* sẽ có `[CẦN BỔ SUNG]`. Fix: `/intel-fill` interview.

[Chi tiết workflow →](workflows/from-doc.md#3-sinh-tài-liệu-office-claude-code)

---

## Skills — Maintenance & utilities

### `/intel-fill` — Interactive interview cho T3 fields

**Một câu**: Wizard hỏi anh/chị về NFR, ATTT, dự toán, business context — fill 35% fields chỉ con người biết.

**Khi nào**: Sau `/from-code` hoặc trước `/generate-docs` — khi T3 doc-only schemas chưa có data.

**Ví dụ**:
```
$ /intel-fill

Question 1/12: ATTT level theo NĐ 85/2016?
   [1] Cấp 1 - Thông thường
   [2] Cấp 2 - Quan trọng
   [3] Cấp 3 - Rất quan trọng (mặc định)
> 3

Question 2/12: Đã thực hiện DPIA (NĐ 13/2023)?
> yes

Question 3/12: RPO/RTO mục tiêu?
> RPO 1h, RTO 4h
...
```

**Tip**: Skill skip questions đã có data, chỉ hỏi missing → ít phiền user.

---

### `/intel-refresh` — Re-derive intel sau code change

**Một câu**: Re-extract sitemap + permission-matrix + data-model từ code hiện tại.

**Khi nào**: Sau khi dev/fe-dev set `_state.md.intel-drift: true` (vì touch auth/RBAC/route).

**Ví dụ**:
```
$ /intel-refresh

Detected stale: sitemap.json (intel-drift flag set 2 features)
Re-running:
  ✓ tdoc-researcher Phase 1 (routes)
  ✓ tdoc-actor-enum (RBAC)
  ✓ intel-merger (resolve conflict với manual locks)
  ✓ intel-validator (schema + cross-ref)
  ✓ intel-snapshot (regen)

✓ stale=false cho 4 artifacts
```

**Pitfall**: Không phá manual edits — fields trong `_meta.locked_fields[]` được preserve.

---

### `/zip-disk` — Đóng gói deliverable

**Một câu**: Bundle Office files + src + Dockerfile thành 1 ZIP gửi khách.

**Khi nào**: Sau `/generate-docs`, project sẵn sàng nghiệm thu.

**Output**: `{project-name}-ban-giao-{YYYYMMDD}.zip` (root chứa file VN có dấu, src/ folder có Docker).

---

## Skills — Advanced (Đề án CĐS / tài liệu chiến lược)

| Skill | Khi nào |
|---|---|
| `/new-strategic-document` | Tạo Đề án CĐS/CNTT cho cơ quan nhà nước (4 spirals, KB + DEDUP) |
| `/new-document-workspace` | Scaffold 1 tài liệu hành chính (TKCS/HSMT/HSDT/dự toán/NCKT/...) |
| `/strategic-critique` | Adversarial review Đề án CĐS — role-play thẩm định Bộ/Tỉnh |
| `/resume-document` | Tiếp tục pipeline tài liệu dang dở |

Đây là tooling cho **research-heavy strategic work**, khác hẳn SDLC pipeline. Xem [`new-strategic-document` SKILL.md](../claude/skills/new-strategic-document/SKILL.md) để hiểu rõ.

---

## Common pitfalls (chung cho mọi skill)

### 1. "Intel layer chưa khởi tạo"
- Cause: chưa chạy `/from-doc` hoặc `/from-code` lần nào
- Fix: chạy 1 trong 2 skill đó trước khi `/new-feature` / `/generate-docs`

### 2. "MCP down → BLOCK"
- Cause: Docker container etc-platform stopped
- Fix: `ai-kit mcp start` rồi retry

### 3. "Intel stale → STOP"
- Cause: code đã thay đổi, sitemap/permission-matrix lỗi thời
- Fix: `/intel-refresh`

### 4. "Local changes detected" khi `ai-kit update`
- Cause: anh/chị edit file trong `~/.ai-kit/team-ai-config/` (không nên)
- Fix: `ai-kit reset` (interactive)

### 5. "intel-missing: <file>" khi run agent
- Cause: agent yêu cầu artifact mà chưa có
- Fix: chạy upstream skill (vd: missing `actor-registry.json` → chạy `/from-code` hoặc `/from-doc`)

---

## Liên quan

- [`architecture.md`](architecture.md) — Bản đồ tổng thể
- [`agents.md`](agents.md) — Agent organization
- [`workflows/`](workflows/) — Hướng dẫn theo từng skill
- [`troubleshooting.md`](troubleshooting.md)

## Quick reference (machine-readable index)

Để xem auto-extracted descriptions từ SKILL.md frontmatter:
```bash
ai-kit doc skills --brief
```
