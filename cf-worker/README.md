# ai-kit telemetry — Cloudflare Worker

HTTP endpoint nhận share JSON từ member machines (anonymized), tổng hợp cho dashboard.

## Endpoints

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/health` | Liveness check (no auth) |
| `POST` | `/ingest` | Member machine POST share JSON (anon, no auth) |
| `GET` | `/aggregate` | GHA cron pulls để build dashboard data.json |

## Deploy

**Lần đầu** (maintainer làm 1 lần):

```bash
node scripts/deploy-cf-worker.mjs
```

Script tự lo: cài wrangler nếu chưa có, OAuth login, tạo KV namespace, patch wrangler.toml, deploy, hardcode URL vào bin/ai-kit.mjs.

**Sau khi sửa worker.mjs**:

```bash
cd cf-worker
wrangler deploy
```

## Storage layout (KV)

| Key pattern | Value | TTL |
|---|---|---|
| `share:<anon_member_id>:<YYYY-MM-DD>` | full share JSON augmented with `received_at` + `cf_country` | 60 days |

**Aggregation = scan tất cả `share:*` keys** → merge counters → return single JSON.

## Privacy

Worker không bao giờ:
- Log raw IP (chỉ giữ `cf_country` ISO code 2 ký tự)
- Lưu request body raw vào logs
- Forward data ra ngoài (KV chỉ ở account của maintainer)

Validation server-side:
- `anon_member_id` PHẢI là sha256-16hex (chống spam fake)
- Payload max 64 KiB
- Field whitelist — extra fields ignored

## Cost estimate

Free tier Cloudflare Workers:
- 100k requests/day = đủ cho team ~50 member sync mỗi 2h (50 × 12 = 600 req/day)
- KV: 100k reads + 1k writes/day free, 1 GB storage free
- Bandwidth unlimited

→ Trong giới hạn free dài lâu cho team <100.

## Troubleshooting

```bash
# Xem logs realtime
wrangler tail

# List KV keys
wrangler kv:key list --binding AI_KIT_TELEMETRY

# Xem 1 share cụ thể
wrangler kv:key get --binding AI_KIT_TELEMETRY 'share:abc123:2026-05-07'

# Xoá toàn bộ KV (reset)
wrangler kv:key list --binding AI_KIT_TELEMETRY | jq -r '.[].name' | \
  xargs -I {} wrangler kv:key delete --binding AI_KIT_TELEMETRY {}
```
