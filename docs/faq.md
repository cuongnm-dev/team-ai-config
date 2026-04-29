---
title: FAQ — Câu hỏi thường gặp
order: 91
---

# FAQ

Câu hỏi thường gặp khi dùng team-ai-config. Nếu vấn đề không được giải, xem [troubleshooting](troubleshooting.md) hoặc mở issue.

---

## Cài đặt

### Tôi mới vào team — bắt đầu thế nào?

Chạy bootstrap one-liner:

```bash
# macOS / Linux
curl -sL https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.sh | bash

# Windows (PowerShell)
irm https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.ps1 | iex
```

Bootstrap sẽ kiểm tra môi trường, clone repo, deploy agents/skills, start MCP. Sau đó mở terminal mới rồi chạy `ai-kit status`.

### Tôi cần Node.js? Tại sao?

`ai-kit` CLI viết bằng Node + Ink (React-for-terminal). Cần Node ≥ 18. Bootstrap có thể tự cài qua `winget` (Windows), `brew` (macOS), `apt`/`dnf`/`pacman` (Linux). Chỉ cần thêm `--auto-install` flag.

### Có thể không dùng Docker không?

Không — `etc-platform` MCP chạy như Docker container. Đó là cách team đảm bảo mọi người có cùng phiên bản render engine + templates.

---

## Sử dụng hằng ngày

### Khi nào tôi cần `ai-kit update`?

Khi có thông báo từ team rằng có config mới. Hoặc cứ chạy 1 lần mỗi sáng — lệnh nhanh, idempotent.

### Khác biệt giữa `from-doc`, `from-code`, `new-feature`, `resume-feature`?

| Skill | Input | Output | Khi nào |
|---|---|---|---|
| **from-doc** | SRS/BRD (PDF/DOCX) | Seed canonical intel | Có tài liệu nhưng chưa có code |
| **from-code** | Codebase | Canonical intel đầy đủ | Có code nhưng tài liệu thiếu |
| **new-feature** | Câu trả lời phỏng vấn | F-NNN/_state.md | Bắt đầu feature mới |
| **resume-feature** | F-NNN có sẵn | Code + tests + reports | Tiếp tục feature dở |

→ [skills](skills.md) cho catalog đầy đủ.

### Tôi nên dùng Cursor hay Claude Code?

| Mục đích | Công cụ |
|---|---|
| Phân tích tài liệu lớn (SRS 200 trang) | **Claude Code** (`/from-doc`) |
| Code feature mới | **Cursor** (`/resume-feature`) |
| Review code | **Cursor** (agent reviewer) |
| Sinh Office files | **Claude Code** (`/generate-docs`) |
| Reverse-engineer codebase | **Claude Code** (`/from-code`) |

Triết lý chung: Claude cho **production**, Cursor cho **PoC + iterative coding**.

---

## Cấu hình

### Vị trí các file gì?

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

### Tôi tự sửa file trong `~/.claude/agents/` được không?

**Không nên**. Lần `ai-kit update` tiếp theo sẽ ghi đè. Nếu muốn customize:

1. Sửa trong repo: `~/.ai-kit/team-ai-config/claude/agents/...`
2. Chạy `ai-kit pack` để snapshot vào repo
3. Chạy `ai-kit publish "<msg>"` để push lên team (nếu là maintainer)
4. Hoặc tạo PR lên repo

### `ai-kit update` báo "Local changes detected"?

Nghĩa là repo `~/.ai-kit/team-ai-config/` có thay đổi chưa commit. Hai lựa chọn:

```bash
# Bỏ thay đổi local, pull mới (mất sửa của bạn)
ai-kit reset

# Hoặc giữ thay đổi
git -C ~/.ai-kit/team-ai-config stash push -u
ai-kit update
git -C ~/.ai-kit/team-ai-config stash pop
```

---

## MCP

### MCP là gì? Tại sao cần Docker?

MCP (Model Context Protocol) là server chứa render engines (DOCX/XLSX) + templates + outline registry + KB. Team đóng gói thành 1 Docker image (`o0mrblack0o/etc-platform:latest`) để mọi người có cùng phiên bản. Image multi-arch (amd64 + arm64), Mac M1/M2 chạy native.

### MCP không khởi động được?

```bash
ai-kit doctor       # check Docker daemon
ai-kit mcp pull     # tải image mới
ai-kit mcp start    # docker compose up -d
ai-kit logs         # xem lỗi
```

### Tôi cần MCP version nào?

`ai-kit status` sẽ hiển thị `MCP image`. Mặc định là `:latest`. Maintainer tag cụ thể trong `mcp/etc-platform/.env` của repo.

---

## Quy ước

### Naming convention cho features?

- **Mini-repo**: `F-001`, `F-002`, ...
- **Monorepo**: `<service>-F-001`, ví dụ `auth-F-001`

ID **bất biến** sau khi commit. Đừng đổi.

### Tiếng Việt hay tiếng Anh?

| Vị trí | Ngôn ngữ |
|---|---|
| Giao tiếp với LLM | Tiếng Việt |
| Nội dung tài liệu hành chính | 100% tiếng Việt |
| Agent/skill prompts (frontmatter, body) | Tiếng Anh (token economy) |
| Output content examples | Có thể tiếng Việt |
| Tên sản phẩm, mã chuẩn | Giữ nguyên (PostgreSQL, ISO 27001) |

→ Quy tắc CD-9 trong `~/.claude/CLAUDE.md`.

---

## Hiệu năng + chi phí

### Sao Claude tốn nhiều token?

Skills lớn (`from-doc`, `from-code`) đọc cả codebase. Tip:

- Dùng `--rerun-stage N` thay vì re-discover toàn bộ
- Tin canonical intel khi nó FRESH (`_meta.json.stale: false`)
- Không re-fetch khi đã có (CD-10 quy tắc 9 — Reuse-first mandate)

### `resume-feature` có thể chạy song song nhiều feature?

**Không khuyến khích**. Mỗi feature dùng `_state.md` riêng nhưng share canonical intel. Chạy song song dễ race condition. Nếu thật sự cần, mở terminal khác và đảm bảo các feature không touching cùng intel artifact.

---

## Đóng góp

### Tôi muốn thêm 1 skill mới?

Xem [contributing](contributing.md). Tóm tắt:

1. Tạo branch
2. Viết SKILL.md (frontmatter + body markdown)
3. Test với `ai-kit pack` trên máy local
4. PR + reviewer phê duyệt

### Tôi tìm bug — báo ở đâu?

GitHub issue ở [cuongnm-dev/team-ai-config](https://github.com/cuongnm-dev/team-ai-config). Kèm output `ai-kit doctor` + `ai-kit version`.

---

> Câu hỏi không có ở đây? Mở PR thêm vào hoặc hỏi trên kênh team.
