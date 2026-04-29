---
title: Glossary — Thuật ngữ
order: 90
---

# Glossary

Tra cứu nhanh các thuật ngữ thường gặp trong team-ai-config. Mỗi mục trỏ đến tài liệu chi tiết khi có.

---

## A

**Agent** — Một LLM-driven worker có vai trò cố định, chạy trong context riêng. Trong Cursor, mỗi stage (ba/sa/tech-lead/dev/fe-dev/qa/reviewer) là một agent. Trong Claude Code, agents thường là background workers (`tdoc-*`, `doc-*`).
→ [reference/agents](reference/agents.md)

**ai-kit** — CLI quản lý team config. Pull repo, deploy agents/skills, restart MCP. Single source of truth.
→ [reference/ai-kit](reference/ai-kit.md)

---

## C

**Canonical intel** — Tập artifacts JSON chuẩn hoá ở `docs/intel/{workspace}/`, là "shared knowledge" giữa các skills (`from-doc`, `from-code`, `resume-feature`, `generate-docs`). Mỗi skill READ → VALIDATE → WRITE theo LIFECYCLE contract.
→ Schema: `~/.claude/schemas/intel/`

**Class A/B/C/D** — Phân loại agent theo vai trò:
- **A** — Stage-report writer (ba, sa, dev, qa, ...)
- **B** — Verifier (validator, lint)
- **C** — Orchestrator (skill dispatcher)
- **D** — Doc-generation consumer (`tdoc-*`, `generate-docs`)
→ [LIFECYCLE.md §5.8–§5.11](https://github.com/cuongnm-dev/team-ai-config/blob/main/claude/skills/from-code/LIFECYCLE.md)

**close-feature** — Skill đóng 1 feature: validate test-evidence đầy đủ, đồng bộ canonical intel.
→ [workflows/close-feature](workflows/close-feature.md)

---

## D

**DEDUP / Dedup Protocol** — Quy tắc CT 34 §6: trước khi đề xuất giải pháp/dự án mới, phải kiểm tra cross-project xem đã có nền tảng dùng chung chưa. Tool: `mcp__etc-platform__dedup_check`.

---

## F

**feature-catalog.json** — Canonical artifact liệt kê tất cả features của workspace, kèm `id`, `roles[]`, `routes[]`, `acceptance_criteria[]`, `test_evidence_ref`.

**from-code** — Skill reverse-engineer codebase → canonical intel.
→ [workflows/from-code](workflows/from-code.md)

**from-doc** — Skill phân tích SRS/BRD/PDF → seed canonical intel.
→ [workflows/from-doc](workflows/from-doc.md)

---

## G

**generate-docs** — Skill assembly: gom canonical intel + test-evidence + screenshots → render Office files (TKKT/TKCS/HDSD/test-cases) qua etc-platform MCP.

**glow** — Markdown renderer cho terminal. `ai-kit doc <topic>` ưu tiên dùng glow nếu cài.

---

## I

**Intel layer** — xem *Canonical intel*.

**Ink** — Thư viện React-for-terminal. `ai-kit` CLI viết bằng Node + Ink (giống Gemini CLI).

---

## L

**LIFECYCLE contract** — Hợp đồng "production line" giữa các agents/skills. Mỗi agent có 8 trường: ROLE, READ-GATES, OWN-WRITE, ENRICH, FORBID, EXIT-GATES, FAILURE, TOKEN-BUDGET. Xem `~/.claude/schemas/intel/LIFECYCLE.md`.

---

## M

**MCP (Model Context Protocol)** — Chuẩn cho LLM tool servers. Team chạy 1 MCP server duy nhất tên `etc-platform` ở `localhost:8001`.
→ [reference/mcp-server](reference/mcp-server.md)

---

## N

**new-feature** — Skill khởi tạo 1 feature mới qua phỏng vấn tương tác. Output: thư mục `F-NNN/` + `_state.md`.
→ [workflows/new-feature](workflows/new-feature.md)

---

## R

**resume-feature** — Skill chạy đường dây SDLC cho 1 feature đang dở. Đọc `_state.md`, tiếp tục stage tiếp theo.
→ [workflows/resume-feature](workflows/resume-feature.md)

---

## S

**Skill** — Một workflow tự đóng gói (frontmatter `description` + body markdown), invoke qua slash-command (`/from-doc`, `/resume-feature`, ...). Khác với agent: skill là **luồng**, agent là **người chạy luồng**.

**sitemap.json** — Canonical artifact mô tả navigation + routes của ứng dụng + Playwright hints.

**Stage agent** — Agent đại diện 1 vai trò trong SDLC (ba/sa/tech-lead/dev/fe-dev/qa/reviewer). Mỗi stage đọc `_state.md`, làm việc của mình, ghi report, update state.

---

## T

**test-evidence** — Artifact `docs/intel/test-evidence/{feature-id}.json` chứa danh sách test cases (prose + executed) + screenshots map. Producer: agent `qa` của Cursor (Class A). Consumer: `generate-docs` (xlsx).

**TKCS** — Thiết kế cơ sở (theo NĐ 45/2026 Đ13). 1 trong các Office output của `generate-docs`.

**TKKT** — Thiết kế kiến trúc kỹ thuật. Cũng là output của `generate-docs`.

---

## W

**Workspace** — Thư mục gốc của 1 dự án (chứa `docs/intel/`). Mỗi `docs/intel/` = 1 workspace, đứng độc lập với workspace khác.

---

> Thiếu thuật ngữ? Mở PR thêm vào file này — phong cách: 1–3 câu, kèm liên kết đến tài liệu chi tiết.
