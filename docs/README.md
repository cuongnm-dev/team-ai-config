---
title: Team AI Config — Documentation Hub
order: 0
---

# Team AI Config

> Bộ công cụ AI dùng chung cho team: **Cursor + Claude Code agents/skills + etc-platform MCP**, đóng gói qua `ai-kit` CLI.

```
┌─────────────────────────────────────────────────┐
│  ~/.ai-kit   ai-kit CLI + repo clone (git)      │
│  ~/.claude   Claude Code agents + skills        │
│  ~/.cursor   Cursor agents + skills             │
│  Docker      etc-platform MCP  @  :8001         │
└─────────────────────────────────────────────────┘
```

`ai-kit` là **single source of truth**. Khi bạn chạy `ai-kit update`, CLI sẽ pull repo mới, deploy agents/skills vào `~/.claude` và `~/.cursor`, refresh image MCP, và tự nâng cấp chính nó. Bạn không cần biết các bước bên trong — chỉ cần một lệnh.

---

## Quick start

| Bạn cần | Lệnh |
|---|---|
| Cài lần đầu | `irm <bootstrap.ps1> \| iex` (Win) hoặc `curl -sL <bootstrap.sh> \| bash` (Mac/Linux) |
| Update hằng ngày | `ai-kit update` |
| Kiểm tra trạng thái | `ai-kit status` |
| Chẩn đoán lỗi | `ai-kit doctor` |
| Xem MCP logs | `ai-kit logs` |
| Liệt kê tài liệu | `ai-kit doc` |
| Tìm kiếm | `ai-kit doc --search <từ khoá>` |

Xem **reference/ai-kit** cho tất cả lệnh.

---

## Học theo vai trò

### Luồng 🅰 SDLC

| Vai trò | Bắt đầu ở đâu | Skills quan trọng nhất |
|---|---|---|
| **BA** (nghiệp vụ) | from-doc | `/from-doc`, agent `ba` |
| **SA** (kiến trúc) | agents reference | agent `sa`, agent `tech-lead` |
| **Dev** | resume-feature | `/resume-feature`, agent `dev`/`fe-dev` |
| **QA** | resume-feature | agent `qa`, test-evidence |

### Luồng 🅱 Tài liệu nhà nước

| Vai trò | Bắt đầu ở đâu | Skills quan trọng nhất |
|---|---|---|
| **Cán bộ soạn Đề án CĐS** | `/new-strategic-document` | `new-strategic-document`, `strategic-critique` |
| **Cán bộ làm thầu CNTT** | `/new-document-workspace` | `new-document-workspace` (chọn TKCS/HSMT/HSDT/dự toán/NCKT) |
| **Người duyệt** | `/strategic-critique <draft>` | `strategic-critique` adversarial review |

### Chung

| Vai trò | Bắt đầu ở đâu | Skills quan trọng nhất |
|---|---|---|
| **PM/Maintainer** | maintainer | `ai-kit publish`, `release-mcp` |
| **Người mới** | glossary → faq | `ai-kit doc` |

---

## Tổng quan tài liệu

### 📘 Workflows — task-oriented (theo skill)

**Pipeline SDLC trong Cursor:**

- new-feature — Khởi tạo feature mới (phỏng vấn tương tác)
- resume-feature — Chạy đường dây SDLC (ba → sa → tech-lead → dev/fe-dev → qa → reviewer)
- close-feature — Đóng feature, đồng bộ canonical intel + bằng chứng

**Sinh tài liệu trong Claude Code:**

- from-doc — Phân tích SRS/BRD → seed feature-catalog + sitemap
- from-code — Reverse-engineer codebase → canonical intel

### 📗 Reference — chi tiết tra cứu

- ai-kit — Tất cả lệnh CLI
- agents — Stage agents + Class A/B/C/D
- mcp-server — etc-platform MCP

### 📙 Khái niệm + bối cảnh

- on-board — Bắt đầu ở đâu (router 2 luồng)
- on-board-sdlc — 🅰 Onboarding luồng SDLC (sản xuất phần mềm)
- on-board-tailieu — 🅱 Onboarding luồng Tài liệu nhà nước (Đề án CĐS / đấu thầu)
- skills — Catalog curated, "khi nào dùng skill nào?"
- agents — Catalog curated, vai trò + ví dụ

### 📕 Hỗ trợ + tham khảo nhanh

- glossary — Thuật ngữ (intel, LIFECYCLE, Class A/B/C/D, ...)
- faq — Câu hỏi thường gặp
- troubleshooting — Xử lý lỗi thường gặp
- decision-log — Quyết định kiến trúc (ADRs)
- contributing — Đóng góp + maintainer guide
- maintainer — Quy trình release MCP image

---

## ⭐ Hai luồng công việc — Chọn đúng luồng trước khi tìm skill

`ai-kit` phục vụ **2 nhóm công việc khác nhau**. Đừng nhầm lẫn skill/agent giữa 2 luồng. Sau khi chọn luồng, đọc onboard tương ứng (`on-board-sdlc.md` hoặc `on-board-tailieu.md`).

### 🅰 Luồng A — SDLC (sản xuất phần mềm để bàn giao)

**Đối tượng**: dev / BA / QA / SA team. **Input**: tài liệu yêu cầu HOẶC codebase. **Output**: code + Office docs nghiệm thu (TKKT/TKCS/TKCT/HDSD/test-cases) theo NĐ 45/2026.

```
  Tài liệu (SRS/BRD)              Codebase
        │                            │
        ▼                            ▼
   /from-doc  (Claude)         /from-code  (Claude)
        │                            │
        └──────► docs/intel/ ◄───────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
  /new-feature  /resume-feature  /generate-docs
   (Cursor)      (Cursor SDLC)    (Claude → MCP)
        │            │            │
        ▼            ▼            ▼
   _state.md    Stage agents   Office docs
                (ba→sa→...)    (TKKT/TKCS/HDSD/test-cases)
```

Skills luồng A: `from-doc` `from-code` `new-feature` `resume-feature` `close-feature` `feature-status` `generate-docs` `intel-fill` `intel-refresh` `new-workspace` `new-project` `configure-workspace` `plan` `implement` `code-change` `hotfix` `quality` `arch-review` `adr` `spike` `ui-catalog` `release` `incident` `runbook` `cache-lint` `zip-disk`.

Agents luồng A: stage agents (`ba` `sa` `tech-lead` `dev` `fe-dev` `qa` `reviewer` `pm` `dispatcher`) + tdoc-* (researcher/test-runner/data-writer/exporter/tkkt/tkcs/tkct/testcase/manual writers).

### 🅱 Luồng B — Tài liệu nhà nước (Đề án CĐS / đấu thầu CNTT)

**Đối tượng**: cán bộ soạn Đề án Chuyển đổi số, hồ sơ thầu CNTT, NCKT cấp Bộ/Tỉnh/Sở. **Input**: nhu cầu chiến lược + KB chính sách + DEDUP catalog (NDXP/LGSP/CSDLQG/Gov Cloud). **Output**: Đề án CĐS, NCKT, HSMT, HSDT, dự toán, TKCS độc lập theo NĐ 45/2026 + CT 34.

```
  Nhu cầu chiến lược             Tài liệu sẵn có
        │                            │
        ▼                            ▼
  /new-strategic-document     /new-document-workspace
   (4 spirals: research →       (TKCS/HSMT/HSDT/dự toán/
    DEDUP → outline → write)     NCKT — wizard chọn loại)
        │                            │
        └──────────────┬─────────────┘
                       │
                       ▼
                /resume-document      /strategic-critique
                (tiếp tục dở dang)    (adversarial review
                                       trước khi nộp)
```

Skills luồng B: `new-strategic-document` `new-document-workspace` `resume-document` `strategic-critique`.

Agents luồng B: `strategy-analyst` `policy-researcher` `structure-advisor` `doc-orchestrator` `doc-writer` `doc-reviewer` `doc-diagram`.

### Phân biệt nhanh

| Câu hỏi | Luồng |
|---|---|
| "Tôi có code/SRS, cần sinh tài liệu nghiệm thu phần mềm" | 🅰 SDLC |
| "Tôi cần soạn Đề án Chuyển đổi số nộp Sở/Bộ" | 🅱 Tài liệu nhà nước |
| "Tôi cần làm hồ sơ thầu HSMT/HSDT" | 🅱 Tài liệu nhà nước |
| "Tôi cần quản lý vòng đời tính năng (BA→SA→Dev→QA)" | 🅰 SDLC |
| "Tôi cần adversarial review Đề án trước khi nộp" | 🅱 Tài liệu nhà nước |

> **Quy tắc**: 2 luồng dùng intel layer (`docs/intel/`) khác nhau, output dir khác nhau, agents khác nhau. KHÔNG mix skill giữa 2 luồng (vd không dùng `/strategic-critique` để review code, không dùng `/quality` để critique Đề án CĐS).

Tất cả skills + agents tuân theo **LIFECYCLE contract** — mỗi khâu có `ROLE`, `READ-GATES`, `OWN-WRITE`, `FORBID`, `EXIT-GATES`. Xem `on-board-sdlc.md` (Luồng A) hoặc `on-board-tailieu.md` (Luồng B) và `agents.md`.

---

## Yêu cầu môi trường

| Tool | Tối thiểu | Ghi chú |
|---|---|---|
| Node.js | ≥ 18 | `ai-kit` CLI là Node + Ink |
| Docker | bất kỳ | Cần để chạy MCP image |
| git | ≥ 2.30 | Bootstrap clone repo |
| Python 3 | ≥ 3.10 | Dùng bởi vài skill nội bộ |
| glow *(tuỳ chọn)* | — | Render markdown đẹp trên terminal |

`ai-kit doctor` kiểm tra tất cả tự động.

---

## Hỗ trợ

- **Lỗi**: chạy `ai-kit doctor` → nếu vẫn không hết, mở issue ở repo
- **Đóng góp**: xem contributing
- **Maintainer**: xem maintainer

> Triết lý: **giảm rào cản — tăng nhất quán — bảo vệ context của LLM**. Mọi skill phải có giá trị "tự xài được", mọi agent phải có hợp đồng LIFECYCLE rõ ràng.
