---
title: Team AI Config — Documentation Hub
order: 0
---

# Team AI Config

> Bộ công cụ AI dùng chung cho team: **Cursor + Claude Code agents/skills + etc-platform MCP**, đóng gói qua `ai-kit` CLI.

```
┌─────────────────────────────────────────────────┐
│  ~/.ai-kit   ai-kit CLI + team-ai-config (git)  │
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

Xem **[reference/ai-kit](reference/ai-kit.md)** cho tất cả lệnh.

---

## Học theo vai trò

| Vai trò | Bắt đầu ở đâu | Skills quan trọng nhất |
|---|---|---|
| **BA** (nghiệp vụ) | [from-doc](workflows/from-doc.md) | `/from-doc`, agent `ba` |
| **SA** (kiến trúc) | [agents reference](reference/agents.md) | agent `sa`, agent `tech-lead` |
| **Dev** | [resume-feature](workflows/resume-feature.md) | `/resume-feature`, agent `dev`/`fe-dev` |
| **QA** | [resume-feature](workflows/resume-feature.md#qa) | agent `qa`, test-evidence |
| **PM/Maintainer** | [maintainer](maintainer.md) | `ai-kit publish`, `release-mcp` |
| **Người mới** | [glossary](glossary.md) → [faq](faq.md) | `ai-kit doc` |

---

## Tổng quan tài liệu

### 📘 Workflows — task-oriented (theo skill)

**Pipeline SDLC trong Cursor:**

- [new-feature](workflows/new-feature.md) — Khởi tạo feature mới (phỏng vấn tương tác)
- [resume-feature](workflows/resume-feature.md) — Chạy đường dây SDLC (ba → sa → tech-lead → dev/fe-dev → qa → reviewer)
- [close-feature](workflows/close-feature.md) — Đóng feature, đồng bộ canonical intel + bằng chứng

**Sinh tài liệu trong Claude Code:**

- [from-doc](workflows/from-doc.md) — Phân tích SRS/BRD → seed feature-catalog + sitemap
- [from-code](workflows/from-code.md) — Reverse-engineer codebase → canonical intel

### 📗 Reference — chi tiết tra cứu

- [ai-kit](reference/ai-kit.md) — Tất cả lệnh CLI
- [agents](reference/agents.md) — Stage agents + Class A/B/C/D
- [mcp-server](reference/mcp-server.md) — etc-platform MCP

### 📙 Khái niệm + bối cảnh

- [architecture](architecture.md) — Sơ đồ luồng + LIFECYCLE contract
- [skills](skills.md) — Catalog curated, "khi nào dùng skill nào?"
- [agents](agents.md) — Catalog curated, vai trò + ví dụ

### 📕 Hỗ trợ + tham khảo nhanh

- [glossary](glossary.md) — Thuật ngữ (intel, LIFECYCLE, Class A/B/C/D, ...)
- [faq](faq.md) — Câu hỏi thường gặp
- [troubleshooting](troubleshooting.md) — Xử lý lỗi thường gặp
- [decision-log](decision-log.md) — Quyết định kiến trúc (ADRs)
- [contributing](contributing.md) — Đóng góp + maintainer guide
- [maintainer](maintainer.md) — Quy trình release MCP image

---

## Đường dây sản xuất (Production line)

```
  Tài liệu (SRS/BRD)              Codebase
        │                            │
        ▼                            ▼
   /from-doc  (Claude)         /from-code  (Claude)
        │                            │
        └──────► docs/intel/ ◄───────┘
                     │
                     │  canonical artifacts:
                     │   • actor-registry.json
                     │   • permission-matrix.json
                     │   • sitemap.json
                     │   • feature-catalog.json
                     │   • test-evidence/{id}.json
                     ▼
        ┌────────────┼────────────┐
        ▼            ▼            ▼
  /new-feature  /resume-feature  /generate-docs
   (Cursor)      (Cursor SDLC)    (Claude → MCP)
        │            │            │
        ▼            ▼            ▼
   _state.md    Stage agents   Office docs
                (ba→sa→...)    (TKKT/TKCS/HDSD/test-cases)
```

Tất cả skills + agents tuân theo **LIFECYCLE contract** — mỗi khâu có `ROLE`, `READ-GATES`, `OWN-WRITE`, `FORBID`, `EXIT-GATES`. Xem [architecture](architecture.md) và [agents reference](reference/agents.md).

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
- **Đóng góp**: xem [contributing](contributing.md)
- **Maintainer**: xem [maintainer](maintainer.md)

> Triết lý: **giảm rào cản — tăng nhất quán — bảo vệ context của LLM**. Mọi skill phải có giá trị "tự xài được", mọi agent phải có hợp đồng LIFECYCLE rõ ràng.
