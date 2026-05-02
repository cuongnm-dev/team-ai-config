---
title: On-board — Chọn luồng công việc (SDLC hoặc Tài liệu nhà nước)
order: 1
---

# On-board — Bắt đầu ở đâu?

`ai-kit` phục vụ **2 luồng công việc khác nhau**. **PHẢI xác định luồng trước** rồi mới đọc onboarding tương ứng — nếu nhầm, anh/chị sẽ dùng sai skill, sai agent, sai output dir.

---

## 🅰 Luồng A — SDLC (Sản xuất phần mềm)

Anh/chị đang **làm phần mềm để bàn giao cho khách hàng**.

- **Input**: tài liệu yêu cầu (SRS/BRD) HOẶC codebase đã ship
- **Quy trình**: from-doc/from-code → SDLC pipeline (BA→SA→TL→Dev→QA→Reviewer) → generate-docs
- **Output**: code chạy được + 5 file Office nghiệm thu (TKKT, TKCS, TKCT, HDSD, test-cases) theo NĐ 45/2026
- **Đối tượng**: BA, SA, Dev, FE-Dev, QA, Reviewer, PM
- **Onboarding**: đọc `on-board-sdlc.md`

---

## 🅱 Luồng B — Tài liệu nhà nước (Đề án CĐS, đấu thầu CNTT)

Anh/chị đang **soạn tài liệu nộp cơ quan nhà nước** (Bộ/Tỉnh/Sở).

- **Input**: nhu cầu chiến lược + KB chính sách + DEDUP catalog (NDXP/LGSP/CSDLQG/Gov Cloud)
- **Quy trình**: 4 spirals (research → DEDUP → outline → write) → adversarial review trước nộp
- **Output**: 1 tài liệu Word duy nhất (Đề án CĐS, NCKT, HSMT/HSDT, dự toán, TKCS độc lập), tuân thủ NĐ 45/2026 + CT 34 + QĐ 749 + TT 04/2020
- **Đối tượng**: cán bộ phòng CNTT/QLDA, người soạn đề án, người duyệt thầu
- **Onboarding**: đọc `on-board-tailieu.md`

---

## Quyết định nhanh

| Câu trả lời | Luồng | Onboard | Skill bắt đầu |
|---|---|---|---|
| "Tôi đang code phần mềm" | 🅰 SDLC | `on-board-sdlc.md` | `/from-doc` hoặc `/from-code` hoặc `/new-feature` |
| "Tôi nghiệm thu phần mềm cho khách" | 🅰 SDLC | `on-board-sdlc.md` | `/from-code` → `/generate-docs` |
| "Tôi soạn Đề án Chuyển đổi số" | 🅱 Tài liệu | `on-board-tailieu.md` | `/new-strategic-document` |
| "Tôi làm HSMT/HSDT/dự toán/NCKT" | 🅱 Tài liệu | `on-board-tailieu.md` | `/new-document-workspace` |
| "Tôi review Đề án trước khi nộp" | 🅱 Tài liệu | `on-board-tailieu.md` | `/strategic-critique` |

---

## Nguyên tắc chung

> 2 luồng KHÔNG dùng skill chéo. KHÔNG dùng `/strategic-critique` cho code review (đã có `/quality review`). KHÔNG dùng `/from-code` để soạn Đề án CĐS. Skill orchestrator phân biệt qua state file (`_state.md` cho SDLC, `_doc_state.md` / `_strategy_state.md` cho Luồng B) và output dir (`docs/generated/{slug}/output/` cho SDLC, `<slug>.docx` rời cho Luồng B).

---

## Tham khảo nhanh

| Mục đích | File |
|---|---|
| Catalog skill kèm decision matrix | `skills.md` |
| Agent organization + Class A/B/C/D | `agents.md` |
| Lệnh CLI ai-kit | `reference/ai-kit.md` |
| Câu hỏi thường gặp | `faq.md` |
| Lỗi thường gặp | `troubleshooting.md` |
| Thuật ngữ | `glossary.md` |
| Quyết định kiến trúc lớn (ADRs) | `decision-log.md` |
| Đóng góp + maintainer | `contributing.md`, `maintainer.md` |
