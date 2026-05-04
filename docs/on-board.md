---
title: On-board — Chọn luồng công việc (SDLC hoặc Tài liệu nhà nước)
order: 1
---

# On-board — Bắt đầu ở đâu?

> **Đọc tài liệu qua CLI**: `ai-kit doc` (mở menu interactive với mục Tìm kiếm) hoặc `ai-kit doc <tên>` để mở thẳng. Phím tắt menu: ↑↓ điều hướng, Enter chọn, Q thoát pager (`less`).

`ai-kit` phục vụ **2 luồng công việc khác nhau**. **PHẢI xác định luồng trước** rồi mới đọc onboarding tương ứng — nếu nhầm, anh/chị sẽ dùng sai skill, sai agent, sai output dir.

---

## 🅰 Luồng A — SDLC (Sản xuất phần mềm)

Anh/chị đang **làm phần mềm để bàn giao cho khách hàng**.

- **Input** (3 entry-points):
  - 🅐 Có SRS/BRD/wireframe → `/from-doc` (onboarding chung: `on-board-sdlc`)
  - 🅑 Có codebase đã ship → `/from-code` (onboarding chung: `on-board-sdlc`)
  - 🅒 Chỉ có ý tưởng, chưa có doc/code (Luồng C) → `/from-idea` (onboarding riêng: `on-board-idea`)
- **Quy trình**: ingestion → SDLC pipeline (BA→SA→TL→Dev→QA→Reviewer) → generate-docs
- **Output**: code chạy được + 5 file Office nghiệm thu (TKKT, TKCS, TKCT, HDSD, test-cases) theo NĐ 45/2026
- **Đối tượng**: BA, SA, Dev, FE-Dev, QA, Reviewer, PM, Founder/PM (Luồng C)
- **Onboarding**:
  - SDLC chung (Luồng A + B): `ai-kit doc on-board-sdlc`
  - Luồng C (greenfield brainstorm): `ai-kit doc on-board-idea`

---

## 🅱 Luồng B — Tài liệu nhà nước (Đề án CĐS, đấu thầu CNTT)

Anh/chị đang **soạn tài liệu nộp cơ quan nhà nước** (Bộ/Tỉnh/Sở).

- **Input**: nhu cầu chiến lược + KB chính sách + DEDUP catalog (NDXP/LGSP/CSDLQG/Gov Cloud)
- **Quy trình**: 4 spirals (research → DEDUP → outline → write) → adversarial review trước nộp
- **Output**: 1 tài liệu Word duy nhất (Đề án CĐS, NCKT, HSMT/HSDT, dự toán, TKCS độc lập), tuân thủ NĐ 45/2026 + CT 34 + QĐ 749 + TT 04/2020
- **Đối tượng**: cán bộ phòng CNTT/QLDA, người soạn đề án, người duyệt thầu
- **Onboarding**: `ai-kit doc on-board-tailieu`

---

## Quyết định nhanh

| Câu trả lời | Luồng | Onboard | Skill bắt đầu |
|---|---|---|---|
| "Tôi có SRS/BRD, chưa có code" | 🅰 SDLC (Luồng A) | `on-board-sdlc` | `/from-doc` |
| "Tôi có codebase đã ship" | 🅰 SDLC (Luồng B) | `on-board-sdlc` | `/from-code` |
| "Tôi chỉ có ý tưởng, chưa có doc/code" | 🅰 SDLC (Luồng C) | `on-board-sdlc` | `/from-idea` |
| "Tôi nghiệm thu phần mềm cho khách" | 🅰 SDLC | `on-board-sdlc` | `/from-code` → `/generate-docs` |
| "Tôi thêm 1 feature vào project có sẵn" | 🅰 SDLC | `on-board-sdlc` | `/new-feature` (Cursor) |
| "Tôi soạn Đề án Chuyển đổi số" | 🅱 Tài liệu | `on-board-tailieu` | `/new-strategic-document` |
| "Tôi làm HSMT/HSDT/dự toán/NCKT" | 🅱 Tài liệu | `on-board-tailieu` | `/new-document-workspace` |
| "Tôi review Đề án trước khi nộp" | 🅱 Tài liệu | `on-board-tailieu` | `/strategic-critique` |

---

## Nguyên tắc chung

> 2 luồng KHÔNG dùng skill chéo. KHÔNG dùng `/strategic-critique` cho code review (đã có `/quality review`). KHÔNG dùng `/from-code` để soạn Đề án CĐS. Skill orchestrator phân biệt qua state file (`_state.md` cho SDLC, `_doc_state.md` / `_strategy_state.md` cho Luồng B) và output dir (`docs/generated/{slug}/output/` cho SDLC, `<slug>.docx` rời cho Luồng B).

---

## Tham khảo nhanh

| Mục đích | Lệnh |
|---|---|
| Catalog skill kèm decision matrix | `ai-kit doc skills` |
| Agent organization + Class A/B/C/D | `ai-kit doc agents` |
| Lệnh CLI ai-kit | `ai-kit doc ai-kit` |
| Câu hỏi thường gặp | `ai-kit doc faq` |
| Lỗi thường gặp | `ai-kit doc troubleshooting` |
| Thuật ngữ | `ai-kit doc glossary` |
| Quyết định kiến trúc lớn (ADRs) | `ai-kit doc decision-log` |
| Đóng góp + maintainer | `ai-kit doc contributing` · `ai-kit doc maintainer` |
