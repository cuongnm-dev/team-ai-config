---
title: etc-platform MCP — Reference
order: 24
---

# etc-platform MCP Server

Container chạy localhost:8001 — render Office docs (DOCX/XLSX) qua MCP `/jobs` API.

## Image

- Public: [`o0mrblack0o/etc-platform:v3.0.0`](https://hub.docker.com/r/o0mrblack0o/etc-platform)
- Multi-arch: `linux/amd64` + `linux/arm64` (Mac M1/M2 + Intel Mac + Linux x86)
- Source: [`github.com/cuongnm-dev/etc-docgen`](https://github.com/cuongnm-dev/etc-docgen)

## Compose config

`mcp/etc-platform/docker-compose.yml`:

```yaml
services:
  etc-platform:
    image: ${ETC_PLATFORM_IMAGE:-o0mrblack0o/etc-platform:latest}
    ports:
      - "${ETC_PLATFORM_PORT:-8001}:8000"
    volumes:
      - ./data:/data           # bind mount (Docker Desktop handles permissions)
    healthcheck:
      test: curl -sf http://localhost:8000/healthz
```

## Endpoints

| Path | Method | Mục đích |
|---|---|---|
| `/healthz` | GET | Health check |
| `/readyz` | GET | Readiness probe |
| `/uploads` | POST | Multipart upload `content_data.json` |
| `/jobs` | POST | Create render job `{type: tkct\|tkcs\|tkkt\|hdsd\|xlsx, upload_id}` |
| `/jobs/{id}` | GET | Poll status |
| `/jobs/{id}/files/{name}` | GET | Download rendered file |
| `/mcp` | (SSE) | MCP streamable-http transport |
| `/sse` | (SSE) | MCP SSE transport (legacy) |

## Quản lý qua ai-kit

```bash
ai-kit mcp status          # docker compose ps
ai-kit mcp logs            # tail -f
ai-kit mcp restart         # restart container
ai-kit mcp pull            # force pull new image + restart
ai-kit mcp stop / start    # down / up
```

## Pin version trong team

`mcp/etc-platform/.env.example`:
```
ETC_PLATFORM_IMAGE=o0mrblack0o/etc-platform:v3.0.0
```

Mỗi `ai-kit update` sẽ pull đúng version này (nếu khác local).

## Build + push image (maintainer only)

```powershell
cd "D:/MCP Server/etc-platform"
.\release-mcp.ps1 v3.1.0 -BumpTeam -Yes
```

Script tự:
1. `docker buildx build --platform linux/amd64,linux/arm64 --push`
2. Bump `team-ai-config/mcp/etc-platform/.env.example`
3. `git add/commit/push` team-ai-config

Team chạy `ai-kit update` là có image mới.

## Storage volume

Bind mount `./data:/data`:
- Vị trí: `~/.ai-kit/team-ai-config/mcp/etc-platform/data/`
- Subdirs:
  - `_jobs/uploads/{id}/` — temporary uploads (TTL 30m)
  - `_jobs/jobs/{id}/` — render outputs awaiting download (TTL 1h)
  - Project data theo project-slug

Restart container → data persist (bind mount).
Reset hoàn toàn:
```bash
ai-kit mcp stop
rm -rf ~/.ai-kit/team-ai-config/mcp/etc-platform/data
ai-kit mcp start
```

## Troubleshooting

### Container restart loop
```
docker logs etc-platform
```
Common causes:
- `Permission denied: /data/_jobs` → bind mount permission. Mac/Win Docker Desktop handles automatically. Linux: `chmod 777 ~/.ai-kit/team-ai-config/mcp/etc-platform/data`.
- Port 8001 conflict → đổi `.env`: `ETC_PLATFORM_PORT=8002`, update `~/.cursor/mcp.json` URL.

### healthz fails
```bash
curl -sv http://localhost:8001/healthz
```
- Container chưa start xong: `start_period: 30s`. Đợi 30s sau pull.
- Image mismatch: `ai-kit mcp pull` to force latest.

### "no matching manifest for linux/arm64"
Image cũ chỉ có `amd64`. Maintainer rebuild:
```powershell
.\release-mcp.ps1 v3.x.y -BumpTeam -Yes
```
Team `ai-kit update`.

### Logs không thấy traceback rõ
```bash
ai-kit mcp logs | grep -i error
docker logs etc-platform --tail 100
```

## CD-8 (canonical rule)

> All Office rendering goes through etc-platform MCP `/jobs` API. Render engines bundled inside MCP image. Templates trong image. **Cấm Python subprocess** từ Claude/Cursor side.

Forbidden patterns:
- ❌ `python render_docx.py`
- ❌ `python fill_xlsx_engine.py`
- ❌ Local templates/*.docx reads

→ MCP down → BLOCK. Skill phải instruct user `ai-kit mcp start` rồi retry.

## Liên quan

- [maintainer-publish workflow](../workflows/maintainer-publish.md)
- [ai-kit reference](ai-kit.md)
- [troubleshooting](../troubleshooting.md)
