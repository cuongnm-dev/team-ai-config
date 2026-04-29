---
title: Workflow — Maintainer cập nhật team config + MCP
order: 13
---

# Workflow — Maintainer cập nhật team config + MCP

Khi anh (maintainer) sửa agents/skills/rules hoặc rebuild MCP image → release cho team.

## Trường hợp 1 — Update agents/skills/rules

```bash
# 1. Sửa file trong ~/.claude hoặc ~/.cursor
#    (mở Cursor/Claude, chỉnh agent prompt, test)

# 2. Pack + commit + push (1 lệnh)
ai-kit publish "Refine ba.md AC validation"

# 3. Team chạy update
#    (hoặc anh broadcast Slack)
```

Team:
```bash
ai-kit update
```

→ Tự pull team config + restart MCP nếu image đổi.

## Trường hợp 2 — Rebuild MCP image

Khi sửa code MCP (`D:/MCP Server/etc-platform/src/...`):

```powershell
cd "D:/MCP Server/etc-platform"

# Build + push multi-arch + bump team-ai-config (1 lệnh)
.\release-mcp.ps1 v3.1.0 -BumpTeam

# Hoặc non-interactive:
.\release-mcp.ps1 v3.1.0 -BumpTeam -Yes
```

Script tự động:
1. Validate version format
2. `docker buildx build --platform linux/amd64,linux/arm64 --push`
3. Push 2 tags (`v3.1.0` + `:latest`)
4. Sửa `team-ai-config/mcp/etc-platform/.env.example` → pin `v3.1.0`
5. `git add/commit/push` team-ai-config

Team:
```bash
ai-kit update     # Tự pull image mới + restart container
```

## Workflow gộp — 1 release

Sửa cả config + MCP cùng lúc:

```powershell
# 1. Sửa MCP code → publish image
cd "D:/MCP Server/etc-platform"
.\release-mcp.ps1 v3.1.0 -BumpTeam -Yes

# 2. Sửa agents/skills → publish config
ai-kit publish "Bump MCP to v3.1.0 + adjust ba prompt for new endpoint"
```

(Bước 1 đã commit `.env.example` thay đổi rồi — bước 2 chỉ thêm config changes của anh.)

## Quy tắc

### DO
- ✅ Test local trước khi push: `ai-kit pack` rồi `ai-kit diff` để review
- ✅ Pin MCP version (`v3.1.0`) thay vì `:latest` cho stability
- ✅ Commit message rõ ràng (theo format: type + scope)
- ✅ Notify team trên Slack sau khi push

### DON'T
- ❌ Edit thẳng file trong `~/.ai-kit/team-ai-config/` (sẽ bị `ai-kit update` ghi đè)
- ❌ Push image với tag conflict (vd: re-build `v3.1.0` đã release) — tăng version
- ❌ Force push `main` branch (sẽ phá team's git history)
- ❌ Quên `--bump-team` → image push xong nhưng team không được pull

## Rollback

Nếu release v3.1.0 hỏng:

```powershell
# Option A: revert team-ai-config bump
cd D:/Projects/team-ai-config
git revert HEAD     # hoặc set lại .env.example về v3.0.0
git push

# Option B: re-tag latest về v3.0.0
docker pull o0mrblack0o/etc-platform:v3.0.0
docker tag o0mrblack0o/etc-platform:v3.0.0 o0mrblack0o/etc-platform:latest
docker push o0mrblack0o/etc-platform:latest
```

Team:
```bash
ai-kit update
```

## Checklist trước khi release

- [ ] Local test: `ai-kit status` OK
- [ ] Diff review: `ai-kit diff` (xem những gì sẽ commit)
- [ ] No machine-specific paths (`pack.ps1` cảnh báo nếu có)
- [ ] Commit message rõ ràng
- [ ] Image build success trên `linux/amd64` + `linux/arm64`
- [ ] Sau push: 1 thành viên test thử trên máy khác (Mac và Win) — `ai-kit update` + `ai-kit doctor`

## Liên quan

- [ai-kit reference](../reference/ai-kit.md) — Chi tiết `pack`, `publish`, `diff`
- [mcp-server](../reference/mcp-server.md) — Build + run MCP
- [troubleshooting](../troubleshooting.md)
