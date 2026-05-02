---
title: FAQ — Câu hỏi thường gặp
order: 91
---

# FAQ

Câu hỏi thường gặp khi dùng ai-kit. Nếu vấn đề không được giải, xem `troubleshooting` hoặc mở issue.

---

## Mục lục

```
1. CÀI ĐẶT             1.1 Bắt đầu thế nào    1.2 Node.js?    1.3 Docker?
2. SỬ DỤNG HẰNG NGÀY   2.1 Khi nào update?    2.2 Skill nào?  2.3 Cursor hay Claude?
3. CẤU HÌNH            3.1 File ở đâu?         3.2 Sửa local?  3.3 Local changes?
4. MCP                 4.1 MCP là gì?          4.2 Không start? 4.3 Version nào?
5. HAI LUỒNG           5.1 Chọn luồng         5.2 Mix skill?   5.3 Output khác nhau?
6. QUY ƯỚC             6.1 Naming F-NNN       6.2 Tiếng Việt/Anh
7. HIỆU NĂNG           7.1 Sao tốn token?     7.2 Parallel resume?
8. ĐÓNG GÓP            8.1 Thêm skill mới     8.2 Báo bug
```

---

## 1. Cài đặt

### 1.1 Tôi mới vào team — bắt đầu thế nào?

Chạy bootstrap one-liner:

```bash
# macOS / Linux
curl -sL https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.sh | bash

# Windows (PowerShell)
irm https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.ps1 | iex
```

Bootstrap kiểm tra môi trường, clone repo, deploy agents/skills, start MCP. Sau đó mở terminal mới rồi chạy `ai-kit status`.

### 1.2 Tôi cần Node.js? Tại sao?

`ai-kit` CLI viết bằng Node + Ink (React-for-terminal). Cần Node ≥ 18. Bootstrap có thể tự cài qua `winget` (Windows), `brew` (macOS), `apt`/`dnf`/`pacman` (Linux). Thêm flag `--auto-install`.

### 1.3 Có thể không dùng Docker không?

Không — `etc-platform` MCP chạy như Docker container. Đó là cách team đảm bảo mọi người có cùng phiên bản render engine + templates.

---

## 2. Sử dụng hằng ngày

### 2.1 Khi nào tôi cần `ai-kit update`?

Khi có thông báo từ team rằng có config mới. Hoặc cứ chạy 1 lần mỗi sáng — lệnh nhanh, idempotent.

### 2.2 Khác biệt giữa `from-doc` / `from-code` / `new-feature` / `resume-feature`?

| Skill | Input | Output | Khi nào |
|---|---|---|---|
| `from-doc` | SRS/BRD (PDF/DOCX) | Seed canonical intel | Có tài liệu nhưng chưa có code |
| `from-code` | Codebase | Canonical intel đầy đủ | Có code nhưng tài liệu thiếu |
| `new-feature` | Câu trả lời phỏng vấn | F-NNN/_state.md | Bắt đầu feature mới |
| `resume-feature` | F-NNN có sẵn | Code + tests + reports | Tiếp tục feature dở |

Catalog đầy đủ: `skills`.

### 2.3 Tôi nên dùng Cursor hay Claude Code?

| Mục đích | Công cụ |
|---|---|
| Phân tích tài liệu lớn (SRS 200 trang) | Claude Code (`/from-doc`) |
| Code feature mới | Cursor (`/resume-feature`) |
| Review code | Cursor (agent reviewer) |
| Sinh Office files nghiệm thu | Claude Code (`/generate-docs`) |
| Reverse-engineer codebase | Claude Code (`/from-code`) |
| Soạn Đề án CĐS / HSMT | Claude Code (`/new-strategic-document` hoặc `/new-document-workspace`) |

Triết lý: Claude cho **batch + production**, Cursor cho **iterative coding**.

---

## 3. Cấu hình

### 3.1 Vị trí các file?

```
~/.ai-kit/
  ├─ team-ai-config/    # repo (git pull về đây)
  └─ bin/               # ai-kit launcher

~/.claude/
  ├─ agents/            # deploy từ repo claude/agents/
  └─ skills/            # deploy từ repo claude/skills/

~/.cursor/
  ├─ agents/            # deploy từ repo cursor/agents/
  └─ skills/            # deploy từ repo cursor/skills/
```

### 3.2 Tôi tự sửa file trong `~/.claude/agents/` được không?

**Không nên** — lần `ai-kit update` tiếp theo sẽ ghi đè. Nếu muốn customize:

1. Sửa trong repo: `~/.ai-kit/team-ai-config/claude/agents/...`
2. Chạy `ai-kit pack` để snapshot vào repo
3. Chạy `ai-kit publish "<msg>"` để push lên team (nếu là maintainer)
4. Hoặc tạo PR lên repo

### 3.3 `ai-kit update` báo "Local changes detected"?

Repo `~/.ai-kit/team-ai-config/` có thay đổi chưa commit. Hai lựa chọn:

```bash
# Bỏ thay đổi local, pull mới (mất sửa của bạn)
ai-kit reset

# Hoặc giữ thay đổi
git -C ~/.ai-kit/team-ai-config stash push -u
ai-kit update
git -C ~/.ai-kit/team-ai-config stash pop
```

---

## 4. MCP

### 4.1 MCP là gì? Tại sao cần Docker?

MCP (Model Context Protocol) là server chứa render engines (DOCX/XLSX) + templates + outline registry + KB. Team đóng gói thành 1 Docker image (`o0mrblack0o/etc-platform:latest`) để mọi người có cùng phiên bản. Image multi-arch (amd64 + arm64), Mac M1/M2 chạy native.

### 4.2 MCP không khởi động được?

```bash
ai-kit doctor       # check Docker daemon
ai-kit mcp pull     # tải image mới
ai-kit mcp start    # docker compose up -d
ai-kit logs         # xem lỗi
```

### 4.3 Tôi cần MCP version nào?

`ai-kit status` hiển thị `MCP image`. Mặc định `:latest`. Maintainer tag cụ thể trong `mcp/etc-platform/.env` của repo.

---

## 5. Hai luồng công việc

### 5.1 Tôi đang trong luồng A hay B?

| Câu hỏi | Luồng |
|---|---|
| "Tôi đang code phần mềm" | 🅰 SDLC |
| "Tôi nghiệm thu phần mềm cho khách" | 🅰 SDLC |
| "Tôi soạn Đề án Chuyển đổi số" | 🅱 Tài liệu nhà nước |
| "Tôi làm HSMT/HSDT/dự toán/NCKT" | 🅱 Tài liệu nhà nước |
| "Tôi review Đề án trước khi nộp" | 🅱 Tài liệu nhà nước |

Onboarding cụ thể: `on-board-sdlc` (🅰) hoặc `on-board-tailieu` (🅱).

### 5.2 Có thể mix skill giữa 2 luồng không?

**Không**. Skill 2 luồng có schema input/output khác nhau:

- `/strategic-critique` cho code review → sẽ flag toàn bộ vì kỳ vọng văn bản hành chính. Dùng `/quality review` thay.
- `/from-code` cho Đề án CĐS → đọc codebase không liên quan. Dùng `/new-strategic-document` thay.
- `/generate-docs` cho HSMT → output bộ 5 file phần mềm, không phải 1 Word độc lập. Dùng `/new-document-workspace` thay.

### 5.3 Output 2 luồng khác nhau thế nào?

| Luồng | Output | Vị trí |
|---|---|---|
| 🅰 SDLC | Bộ 5 Office files nghiệm thu (TKKT, TKCS, TKCT, HDSD, test-cases) | `docs/generated/{slug}/output/` |
| 🅱 Tài liệu nhà nước | 1 file Word độc lập (Đề án/NCKT/HSMT/HSDT/dự toán) | `<slug>-vN.docx` rời |

State file cũng khác: 🅰 dùng `_state.md`, 🅱 dùng `_doc_state.md` hoặc `_strategy_state.md`.

---

## 6. Quy ước

### 6.1 Naming convention cho features?

- **Mini-repo**: `F-001`, `F-002`, ...
- **Monorepo**: `<service>-F-001`, ví dụ `auth-F-001`

ID **bất biến** sau khi commit. Đừng đổi.

### 6.2 Tiếng Việt hay tiếng Anh?

| Vị trí | Ngôn ngữ |
|---|---|
| Giao tiếp với LLM | Tiếng Việt |
| Nội dung tài liệu hành chính | 100% tiếng Việt |
| Agent/skill prompts (frontmatter, body) | Tiếng Anh (token economy) |
| Output content examples | Có thể tiếng Việt |
| Tên sản phẩm, mã chuẩn | Giữ nguyên (PostgreSQL, ISO 27001) |

Quy tắc CD-9 trong `~/.claude/CLAUDE.md`.

---

## 7. Hiệu năng + chi phí

### 7.1 Sao Claude tốn nhiều token?

Skills lớn (`from-doc`, `from-code`) đọc cả codebase. Tip:

- Dùng `--rerun-stage N` thay vì re-discover toàn bộ
- Tin canonical intel khi FRESH (`_meta.json.stale: false`)
- Không re-fetch khi đã có (CD-10 quy tắc 9 — Reuse-first mandate)

### 7.2 `resume-feature` có thể chạy song song nhiều feature?

**Không khuyến khích**. Mỗi feature dùng `_state.md` riêng nhưng share canonical intel. Chạy song song dễ race condition. Nếu thật sự cần, mở terminal khác và đảm bảo các feature không touching cùng intel artifact.

---

## 8. Đóng góp

### 8.1 Tôi muốn thêm 1 skill mới?

Xem `contributing`. Tóm tắt:

1. Tạo branch
2. Viết SKILL.md (frontmatter + body markdown)
3. Test với `ai-kit pack` trên máy local
4. PR + reviewer phê duyệt

### 8.2 Tôi tìm bug — báo ở đâu?

GitHub issue ở https://github.com/cuongnm-dev/team-ai-config. Kèm output `ai-kit doctor` + `ai-kit version`.

---

> Câu hỏi không có ở đây? Mở PR thêm vào hoặc hỏi trên kênh team.
