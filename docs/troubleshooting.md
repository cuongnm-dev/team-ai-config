---
title: Troubleshooting
order: 99
---

# Troubleshooting

## Bootstrap / Install

### `ai-kit: command not found`
PATH chưa load. Mở terminal MỚI hoặc:
```bash
# Mac/Linux
export PATH="$HOME/.ai-kit/bin:$PATH"
```
```powershell
# Windows — đóng và mở PowerShell mới
```

### `Docker daemon not running`
Mở Docker Desktop, đợi whale icon steady, retry.

### Windows: "running scripts is disabled"
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```
Hoặc bootstrap qua `.cmd` shim đã handle (`-ExecutionPolicy Bypass`).

### Mac: `xcrun: error: invalid active developer path`
```bash
xcode-select --install
```

### Permission denied trên `bootstrap.sh`
```bash
chmod +x bootstrap.sh
./bootstrap.sh
```

## ai-kit update

### `Local changes detected. Refusing to auto-merge`
Anh đã sửa file trong `~/.ai-kit/team-ai-config/` — mất khi `git pull`. Options:

```bash
# A) Discard hoàn toàn:
$env:AI_KIT_FORCE_CLEAN='1'   # Windows
export AI_KIT_FORCE_CLEAN=1   # Mac/Linux
ai-kit update

# B) Stash giữ lại sau:
cd ~/.ai-kit/team-ai-config
git stash push -u
ai-kit update
git stash pop      # nếu muốn restore

# C) Upstream changes nếu hữu ích cho team:
ai-kit publish "describe what you changed"
```

### `Docker pull` rate limit
Anonymous pull bị limit 100/6h. Login Docker Hub:
```bash
docker login
```

## MCP

### Container restart loop
```bash
ai-kit mcp logs | tail -50
```
Phổ biến:
- `Permission denied: /data` → Mac/Win Docker Desktop OK; Linux: `chmod 777 ~/.ai-kit/team-ai-config/mcp/etc-platform/data`
- Port 8001 đang dùng → sửa `.env`: `ETC_PLATFORM_PORT=8002`

### `no matching manifest for linux/arm64`
Image cũ chưa multi-arch. Maintainer rebuild với `release-mcp.ps1` (đã default buildx multi-arch). Tạm thời force amd64:
```bash
docker pull --platform linux/amd64 o0mrblack0o/etc-platform:v3.0.0
```
(Sẽ chậm trên Mac M1/M2 do Rosetta emulation.)

### healthz fail nhưng container "Up"
Đợi 30s (start_period). Hoặc check port:
```bash
curl -v http://localhost:8001/healthz
docker port etc-platform
```

## Cursor / Claude Code

### Skill không trigger
- Restart Cursor/Claude Code sau `ai-kit update`
- Verify deployed: `ai-kit status` → claude/cursor agents count
- Check `~/.cursor/mcp.json` có etc-platform URL

### Agent không thấy intel
- Verify `docs/intel/` ở project root
- Check `_meta.json.artifacts[file].stale` — nếu stale → `/intel-refresh`
- Verify path: agent đọc `docs/intel/` relative to project, không phải `~/.claude/`

### `intel-missing: <file>` STOP
Cursor agent từ chối chạy vì thiếu artifact. Run upstream:
- Missing `actor-registry.json` / `permission-matrix.json` / `sitemap.json` / `feature-catalog.json` → `/from-code` hoặc `/from-doc`
- Missing `test-accounts.json` → manual create

## Maintainer

### `ai-kit publish` báo "no machine-specific paths" nhưng vẫn lo
Verify thủ công:
```bash
ai-kit pack
grep -rE "C:/Users/[^/]+|D:/MCP Server" ~/.ai-kit/team-ai-config/{claude,cursor}
```

### release-mcp.ps1 fail "buildx not enabled"
```bash
docker buildx create --use
docker buildx inspect --bootstrap
```

### Push tag latest fail "insufficient_scope"
Token Docker Hub thiếu Delete scope. Tạo lại với `Read, Write, Delete`. Login:
```bash
docker login
```

## Backup / Rollback

### Khôi phục từ backup
```bash
ai-kit list-backups
ai-kit rollback         # newest
ai-kit rollback 3       # backup #3
```

### Restore manual
```bash
rm -rf ~/.claude ~/.cursor
cp -R ~/ai-config-backup-<timestamp>/.claude ~/.claude
cp -R ~/ai-config-backup-<timestamp>/.cursor ~/.cursor
```

### Disk đầy do quá nhiều backups
```bash
ai-kit clean --keep 1   # giữ 1 backup gần nhất + docker prune
```

## Workflow errors thường gặp

### `<tool_use_error>File has not been read yet. Read it first before writing to it.`
**Nguyên nhân**: Agent gọi Edit/Write nhưng chưa Read file mục tiêu trước. Chiếm ~10% workflow errors theo `ai-kit statistics`.

**Fix (từ 2026-05-02 — P3 Read-before-Edit rule)**:
- Rule mới đã inject vào `~/.cursor/rules/00-agent-behavior.mdc` § Execution Principles + `~/.claude/CLAUDE.md` § Tool Usage Discipline
- Nếu vẫn gặp: agent đang chạy với cache cũ → restart Cursor / Claude Code session
- Manual workaround: bảo agent "Read file trước khi Edit"

### `<tool_use_error>String to replace not found in file.`
**Nguyên nhân**: Edit `old_string` không match (có thể do whitespace, line endings, hoặc file đã đổi).

**Fix**:
- Read lại file để lấy bytes chính xác
- Dùng Grep tìm anchor unique hơn (≥ 3 dòng context)
- Nếu file > 2K dòng: dùng Grep + offset Read thay vì Read full

### Cost cao đột biến — `general-purpose` agent dispatch nhiều lần
**Nguyên nhân**: Claude Code main thread fallback `general-purpose` thay vì specialist (Explore/Plan/doc-writer/policy-researcher).

**Fix (từ 2026-05-02 — P4.1 Specialist-first dispatch)**:
- `~/.claude/CLAUDE.md` § Tool Usage Discipline đã có rule "Specialist-first dispatch"
- Trước khi gọi `Agent`, check xem có specialist phù hợp không
- `Explore` cho code lookup; `Plan` cho design; `doc-writer/doc-reviewer` cho admin docs; `tdoc-*` cho technical docs

---

## Dọn dẹp hoàn toàn

```bash
ai-kit uninstall          # remove ~/.ai-kit + stop MCP
rm -rf ~/.claude ~/.cursor   # cleanup deployed configs (CAREFUL!)
docker system prune -a    # remove all docker images/containers
```

Re-install: chạy lại bootstrap one-liner.

## Liên quan

- ai-kit reference
- mcp-server reference
- README
