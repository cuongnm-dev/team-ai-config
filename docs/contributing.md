---
title: Contributing — Đóng góp & Quy ước
order: 93
---

# Contributing

Hướng dẫn đóng góp vào ai-kit — agent mới, skill mới, sửa lỗi, hoặc cải tiến CLI.

---

## Trước khi đóng góp

### Đọc qua

- architecture — Hiểu LIFECYCLE contract + production line
- decision-log — Hiểu các quyết định kiến trúc lớn
- glossary — Đồng nhất thuật ngữ
- `~/.claude/CLAUDE.md` — Quy tắc CD-1 đến CD-10, CB-1, MCP-1...

### Set up dev env

```bash
git clone https://github.com/cuongnm-dev/team-ai-config.git ~/dev/team-ai-config
cd ~/dev/team-ai-config
npm install                        # Node deps cho ai-kit CLI
node bin/ai-kit.mjs help           # Test local
```

Để test trên máy bạn (deploy về `~/.claude` + `~/.cursor`):

```bash
# Snapshot deploy hiện tại trước (an toàn rollback)
ai-kit pack

# Test branch của bạn
node ~/dev/team-ai-config/bin/ai-kit.mjs update
```

---

## Loại đóng góp

### 1. Sửa lỗi (bug fix)

1. Tạo issue mô tả lỗi (kèm output `ai-kit doctor` + repro steps)
2. Branch `fix/<short-desc>`
3. Sửa + test local
4. PR + reviewer phê duyệt

### 2. Thêm skill mới

Cấu trúc:

```
{claude|cursor}/skills/<skill-name>/
  ├─ SKILL.md          # Frontmatter + body markdown
  ├─ notepads/         # (optional) ref-* files load on demand
  └─ examples/         # (optional) sample inputs
```

**SKILL.md frontmatter** bắt buộc:

```yaml
---
description: <1-2 câu tiếng Việt mô tả khi nào gọi skill này>
allowed-tools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob", "Agent"]
---
```

**Body** (English-only — CD-9):

```markdown
# Step 1 — <Title>

ROLE: ...
INPUTS: ...
OUTPUTS: ...
GATES: ...
```

Sau khi viết xong:

```bash
ai-kit pack                  # Snapshot vào repo
ai-kit publish "feat(skills): add <skill-name>"
```

### 3. Thêm agent mới

Agent là 1 file `.md`:

```
{claude|cursor}/agents/<agent-name>.md
```

Bắt buộc có **LIFECYCLE CONTRACT** block:

```yaml
---
name: <agent-name>
description: |
  <Mô tả vai trò 2-3 câu bằng tiếng Việt, kèm ví dụ ngắn>
tools: [...]
---

# LIFECYCLE CONTRACT
ROLE: <stage A/B/C/D + tên>
READ-GATES:
  - <required intel artifact>
OWN-WRITE:
  - <field này chỉ agent này được ghi>
ENRICH:
  - <field optional làm dày thêm>
FORBID:
  - <không được ghi/đọc gì>
EXIT-GATES:
  - <điều kiện xuất stage>
FAILURE:
  - <hành vi khi gate fail>
TOKEN-BUDGET: <ước lượng>
```

Tham khảo `claude/agents/tdoc-tkkt-writer.md` hoặc `cursor/agents/qa.md` làm template.

### 4. Sửa CLI (`ai-kit`)

Code: `bin/ai-kit.mjs` (Node.js + Ink). 1 file MVP — sẽ split khi vượt 1000 dòng.

```bash
# Test local
cd ~/dev/team-ai-config
node bin/ai-kit.mjs <command>
```

Nguyên tắc:
- Static UI (help/version/doctor) → Ink components + `renderStaticLater()`
- Side-effect commands (update/mcp/pack) → imperative `console.log` + `execaSync`
- Async UI (status với docker check) → `useState`/`useEffect` + `useApp().exit()`

### 5. Cập nhật MCP image

Code MCP: ở repo riêng `etc-platform`. Quy trình rollout:

1. Sửa code trong `etc-platform`
2. Test local: `docker compose up --build`
3. Tag version: `git tag v3.X.0`
4. Build + push: `./release-mcp.sh v3.X.0`
5. Bump tag trong `team-ai-config/mcp/etc-platform/.env`
6. PR `team-ai-config` → reviewer phê duyệt
7. Team chạy `ai-kit update` để nhận image mới

→ Chi tiết: maintainer.

---

## Quy ước code

### Commit message

Conventional Commits:

```
feat(skills): add /new-feature interactive interview
fix(ai-kit): handle Local changes in update command
docs: add decision-log + glossary
refactor(agents): consolidate Class A contract boxes
```

Loại: `feat | fix | docs | refactor | chore | test | build`.

### File encoding

- `.md`: UTF-8 không BOM, LF
- `.ps1`: UTF-8 **CÓ BOM** (PS 5.1 yêu cầu) — `.gitattributes` đã set `*.ps1 -text`
- `.cmd`: ASCII-only (cp437 codepage tương thích)
- `.mjs`, `.json`, `.yaml`: UTF-8 không BOM, LF

### Tiếng Việt vs English

Theo CD-9 (xem `~/.claude/CLAUDE.md`):

| Vị trí | Ngôn ngữ |
|---|---|
| Agent/skill body (system prompt) | **English** |
| Frontmatter `description` | English (Vietnamese cho user-facing skills OK) |
| Output content examples | Vietnamese |
| User-facing CLI strings | Vietnamese hoặc English |
| Doc files (`docs/**/*.md`) | **Vietnamese** |
| Code comments | English |

### Tên thuật ngữ

Đọc glossary trước. Đồng nhất thuật ngữ giúp grep dễ.

---

## PR checklist

- [ ] Branch tên có prefix: `feat/`, `fix/`, `docs/`, `refactor/`
- [ ] Commit message theo Conventional Commits
- [ ] Test local: `node bin/ai-kit.mjs help` chạy không lỗi
- [ ] Nếu sửa agent/skill: kèm LIFECYCLE contract đầy đủ
- [ ] Nếu sửa docs: link không gãy (`ai-kit doc <topic>` mở được)
- [ ] Reviewer xác nhận

---

## Maintainer-only

Một số việc chỉ maintainer làm (do quyền push tag, Docker Hub):

- Build + push MCP image lên Docker Hub
- Bump version `package.json`
- Release notes + git tag

Quy trình: xem maintainer.

---

## Liên hệ

- Issue: GitHub repo
- Câu hỏi nhanh: kênh team

> Cảm ơn bạn đóng góp. Hãy nhớ: **giảm rào cản — tăng nhất quán — bảo vệ context của LLM**.
