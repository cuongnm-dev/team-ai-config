---
title: Team AI Config — Documentation Hub
order: 0
---

# Team AI Config

Bộ công cụ AI dùng chung cho team: **Cursor agents/skills + Claude Code agents/skills + etc-platform MCP**, được phân phối qua `ai-kit` CLI.

```
┌──────────────────────────────────────────────┐
│  ~/.ai-kit  ── ai-kit CLI + team-ai-config   │
│  ~/.claude  ── Claude Code agents + skills   │
│  ~/.cursor  ── Cursor agents + skills        │
│  Docker     ── etc-platform MCP @:8001       │
└──────────────────────────────────────────────┘
```

## Quick Start

```bash
ai-kit help          # 16 commands
ai-kit status        # health check
ai-kit update        # pull latest team config + restart MCP
ai-kit doctor        # diagnose nếu vấn đề
```

## Tài liệu

### Workflows — Skills 1:1 (task-oriented)

**SDLC pipeline (Cursor):**
- [`new-feature`](workflows/new-feature.md) — Khởi tạo 1 feature mới (interactive interview)
- [`resume-feature`](workflows/resume-feature.md) — Chạy SDLC pipeline (ba → sa → dev → qa → reviewer)
- [`close-feature`](workflows/close-feature.md) — Đóng feature, sync canonical intel + evidence

**Doc generation (Claude):**
- [`from-doc`](workflows/from-doc.md) — Phân tích SRS/BRD → seed feature-catalog + sitemap
- [`from-code`](workflows/from-code.md) — Reverse-engineer codebase → canonical intel
- [`generate-docs`](workflows/from-doc.md#3-sinh-tài-liệu-office-claude-code) — Render Office files (TKKT/TKCS/HDSD/test-cases)

**Maintainer (anh):**
- [`maintainer`](maintainer.md) — Update team config + MCP image rollout

### Reference
- [`ai-kit`](reference/ai-kit.md) — Tất cả 16 commands
- [`claude-skills`](reference/claude-skills.md) — Skills của Claude Code
- [`cursor-skills`](reference/cursor-skills.md) — Skills của Cursor
- [`agents`](reference/agents.md) — Stage agents + Class A/B/C/D
- [`mcp-server`](reference/mcp-server.md) — etc-platform MCP

### Khác
- [`troubleshooting`](troubleshooting.md) — Xử lý lỗi thường gặp

## Khởi động cho người mới

**Lần đầu — 5 phút**:
1. Chạy bootstrap one-liner (xem `ai-kit help`)
2. Set Anthropic API key vào `~/.claude/.credentials.json`
3. Restart Cursor + Claude Code
4. Chạy `ai-kit status` để verify

**Hằng ngày**:
- Nhận update mới: `ai-kit update`
- Xem tài liệu: `ai-kit docs <topic>`

**Khi gặp lỗi**:
- `ai-kit doctor` — verify deps
- `ai-kit logs` — xem MCP logs
- [`troubleshooting`](troubleshooting.md) — common issues

## Roles

| Role | Khâu thường dùng | Skills chính |
|---|---|---|
| **BA** | Phân tích nghiệp vụ | `/from-doc` (Claude), `ba` agent (Cursor) |
| **SA** | Thiết kế kiến trúc | `sa` agent (Cursor), `/generate-docs` |
| **Dev** | Code feature | `/resume-feature` (Cursor) — `dev` / `fe-dev` agents |
| **QA** | Test + nghiệm thu | `qa` agent (Cursor) |
| **PM/Maintainer** | Update team config | `ai-kit publish`, `release-mcp.ps1` |

## Architecture

```
Source docs (PDF/DOCX/SRS)             Codebase
       │                                  │
       ▼                                  ▼
  /from-doc  (Claude)              /from-code  (Claude)
       │                                  │
       └──────────► docs/intel/ ◄─────────┘  (canonical: actor-registry, sitemap, feature-catalog, ...)
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
  /new-feature   /resume-feature  /generate-docs
   (Cursor)        (Cursor SDLC)    (Claude)
        │              │              │
        ▼              ▼              ▼
  _state.md      Stage agents      Office docs
                (ba/sa/qa/...)      (TKKT/TKCS/HDSD/...)
```

Tất cả skills/agents tuân theo **LIFECYCLE.md contract** — mỗi khâu có ROLE, READ-GATES, OWN-WRITE, FORBID rõ ràng. Xem [agents reference](reference/agents.md).
