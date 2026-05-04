---
title: On-board — Phân biệt 4 tình huống công việc
order: 1
---

# On-board — Bạn đang ở tình huống nào?

> **Đọc tài liệu qua CLI**: `ai-kit doc` (mở menu interactive với mục Tìm kiếm) hoặc `ai-kit doc <tên>` để mở thẳng. Phím tắt menu: ↑↓ điều hướng, Enter chọn, Q thoát pager (`less`).

`ai-kit` hỗ trợ **4 tình huống công việc** khác nhau. Xác định đúng tình huống rồi mới đọc onboarding tương ứng — nếu nhầm, anh/chị sẽ dùng sai skill, sai agent, sai output dir.

---

## Bảng phân biệt 4 tình huống

| Bạn có gì? | Tình huống | Skill bắt đầu | Onboarding |
|---|---|---|---|
| 📄 **SRS/BRD .docx** (tài liệu yêu cầu đầy đủ) | Sản xuất phần mềm — có tài liệu | `/from-doc` | `on-board-sdlc` |
| 💻 **Codebase** đã ship hoặc đang dev | Sản xuất phần mềm — có code | `/from-code` | `on-board-sdlc` |
| 💡 **Chỉ có ý tưởng** (chưa doc, chưa code) | Sản xuất phần mềm — greenfield | `/from-idea` | `on-board-idea` |
| 🏛 **Yêu cầu hành chính** (Đề án CĐS, hồ sơ thầu, NCKT, dự toán...) | Soạn tài liệu nhà nước | `/new-strategic-document` hoặc `/new-document-workspace` | `on-board-tailieu` |

3 tình huống đầu (📄 💻 💡) → cùng vào pipeline **SDLC** (output: code + bộ Office nghiệm thu).
Tình huống thứ 4 (🏛) → pipeline **Tài liệu nhà nước** (output: 1 file Word độc lập).

---

## 📄 Tình huống 1 — Có sẵn SRS/BRD/wireframe

**Anh/chị có** tài liệu yêu cầu chi tiết (SRS, BRD, đặc tả, wireframe, slide pitch).

- **Skill bắt đầu**: `/from-doc <path-to-srs.docx>`
- **Output bước 1**: `docs/intel/{actor-registry, feature-catalog, sitemap}.json` + per-feature `_state.md`
- **Bước tiếp**: `/resume-feature F-NNN` (Cursor) chạy SDLC pipeline → `/generate-docs` sinh Office files
- **Onboarding chi tiết**: `ai-kit doc on-board-sdlc`
- **Workflow chi tiết**: `ai-kit doc from-doc`

---

## 💻 Tình huống 2 — Đã có codebase

**Anh/chị có** project đang chạy production HOẶC đang dev. Cần reverse-engineer + sinh tài liệu.

- **Skill bắt đầu**: `/from-code <path-to-project>`
- **Output bước 1**: 9 intel artifacts (system-inventory, code-brief, arch-brief, actor-registry, permission-matrix, sitemap, feature-catalog, data-model, integrations) + per-feature `_state.md` (status: implemented)
- **Bước tiếp**: `/intel-fill` (T3 fields như NFR/ATTT/dự toán) → `/generate-docs`
- **Onboarding chi tiết**: `ai-kit doc on-board-sdlc`
- **Workflow chi tiết**: `ai-kit doc from-code`

---

## 💡 Tình huống 3 — Chỉ có ý tưởng (greenfield)

**Anh/chị là** founder/PM/product owner — chỉ có ý tưởng trong đầu, chưa có doc, chưa có code.

- **Skill bắt đầu**: `/from-idea` (4 spirals + pre-mortem, ~1.5-3h, có thể chia nhiều session)
- **Vai trò skill**: thinking partner (không phải voice recorder) — echo/paraphrase, gợi alternatives, lộ assumption, calibrate confidence
- **Output bước 1**: 4 intel artifacts + workshop docs (PRFAQ, impact-map, event-storming, story-map, pre-mortem) + per-feature `_state.md` (status: proposed, source-type: idea-brainstormed)
- **Bước tiếp**: `/resume-feature F-NNN` (Cursor) — Cursor SDLC tiếp nhận identical với tình huống 1/2
- **Onboarding chi tiết**: `ai-kit doc on-board-idea`
- **Workflow chi tiết**: `ai-kit doc from-idea`

---

## 🏛 Tình huống 4 — Soạn tài liệu hành chính nhà nước

**Anh/chị là** cán bộ phòng CNTT/QLDA, soạn Đề án Chuyển đổi số / hồ sơ thầu / NCKT / dự toán cho cơ quan nhà nước (Bộ/Tỉnh/Sở/Cục).

- **Skill bắt đầu**:
  - `/new-strategic-document` cho Đề án CĐS lớn (4 spirals: research → DEDUP → outline → write)
  - `/new-document-workspace` cho 1 tài liệu rời (TKCS/HSMT/HSDT/dự toán/NCKT — wizard chọn loại)
  - `/strategic-critique <draft.docx>` cho adversarial review trước khi nộp
- **Output**: 1 tài liệu Word duy nhất, tuân thủ NĐ 45/2026 + CT 34 + QĐ 749 + TT 04/2020
- **Onboarding chi tiết**: `ai-kit doc on-board-tailieu`

---

## Nguyên tắc chung — KHÔNG dùng skill chéo

| Anti-pattern | Fix |
|---|---|
| Dùng `/strategic-critique` để review code | → `/quality review` (skill SDLC) |
| Dùng `/from-code` để soạn Đề án CĐS | → `/new-strategic-document` |
| Dùng `/generate-docs` để xuất Đề án CĐS | → tài liệu hành chính có pipeline riêng |
| Trộn `_state.md` (SDLC) với `_doc_state.md` / `_strategy_state.md` (tài liệu) | → mỗi pipeline có state file riêng, output dir riêng |

3 tình huống SDLC (📄 💻 💡) dùng intel layer chung (`docs/intel/*.json`) — sau bước 1, pipeline xử lý identical. Tình huống 4 (🏛) dùng KB chính sách + DEDUP catalog (NDXP/LGSP/CSDLQG/Gov Cloud) hoàn toàn khác.

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
