---
title: Privacy — Telemetry policy
order: 92
---

# Privacy & Telemetry

ai-kit thu thập **thống kê ẩn danh** về cách team dùng skills/agents/tools để maintainer tối ưu công cụ. KHÔNG có nội dung dự án, KHÔNG có đường dẫn file, KHÔNG có content prompt rời máy bạn.

## Mặc định

Telemetry mặc định **BẬT** cho thành viên team (cuongnm-dev/team-ai-config). Bạn có thể tắt bất cứ lúc nào:

```bash
ai-kit telemetry disable     # tắt
ai-kit telemetry enable      # bật lại
ai-kit telemetry status      # xem trạng thái
ai-kit telemetry view        # xem nội dung file share gần nhất
ai-kit telemetry export      # tạo share JSON ngay (không tự upload)
```

## Dữ liệu CÓ thu thập (anonymized)

| Trường | Ví dụ | Mục đích |
|---|---|---|
| `anon_member_id` | sha256 hash 16 hex (random per machine) | Phân biệt máy, không liên kết identity |
| `since` / `generated` | ISO timestamp | Khoảng thời gian thu thập |
| `sessions` / `requests` | counts | Tần suất sử dụng |
| `total_tokens` / `total_cost_api_equivalent` | aggregate sums | Cost monitoring (estimate) |
| `cache_hit_rate` | tỉ lệ % | Cache effectiveness |
| `tokens_p50` / `tokens_p95` | percentiles | Distribution |
| `errors_total` / `errors_real` | counts | Error rate |
| `error_categories` | category names (e.g. `auth`, `network`) | Error pattern (KHÔNG có message body) |
| `by_model` | `{ "claude-sonnet-4-6": 145, "qwen3.5-35b": 23 }` | Model usage |
| `by_skill` | `{ "from-doc": 12, "resume-module": 78 }` | Skill popularity |
| `by_agent` | `{ "ba": {dispatches: 45}, "sa": {...} }` | Agent dispatch frequency |
| `by_tool` | `{ "Read": 8234, "Bash": 5621 }` | Tool usage heatmap |
| `by_day` / `by_hour` / `by_weekday` | counts | Time distribution |

## Dữ liệu KHÔNG bao giờ gửi

- Tên dự án, đường dẫn workspace, repository URL
- Nội dung file, code snippet, prompt, output của agent
- Module / feature ID hoặc tên cụ thể
- Stack trace (chỉ giữ category, không giữ file path / line number)
- Token (LLM API token), credential, secret
- Câu trả lời interview của user
- Bất kỳ Vietnamese tax / PII / business data nào

Code nguồn anonymizer ở [`bin/ai-kit.mjs`](https://github.com/cuongnm-dev/ai-kit/blob/master/bin/ai-kit.mjs) hàm `cmdStatistics --member-share`. Comment trực tiếp trong source:
```js
// NOTE: by_project intentionally omitted (could leak project names)
// NOTE: error_messages intentionally omitted (could leak file paths)
```

## Cách dữ liệu di chuyển

### Phase 1 (hiện tại) — manual transfer

1. ai-kit tự động export share JSON vào `~/.ai-kit/.telemetry-shares/` mỗi **7 ngày** sau `ai-kit update`
2. Maintainer định kỳ (1-2 tuần/lần) gửi tin trong Discord/Slack: "gửi giúp file share gần nhất"
3. Bạn copy file `~/.ai-kit/.telemetry-shares/ai-kit-share-<hash>-<date>.json` qua chat
4. Maintainer chạy `ai-kit statistics --merge file1.json file2.json ...` → aggregate dashboard

### Phase 2 (đang phát triển) — auto-sync

Sau Phase 2, bạn sẽ chạy `ai-kit telemetry sync` (1 lệnh) để upload share JSON vào GitHub Gist private. GitHub Actions cron tự gộp các gist và publish dashboard công khai trên ai-kit repo. Lúc đó bạn vẫn có quyền xem/disable.

## Quyền của bạn

- **Xem trước khi gửi**: `ai-kit telemetry view` show file share gần nhất (JSON nguyên văn)
- **Tắt bất cứ lúc nào**: `ai-kit telemetry disable` dừng auto-export ngay lập tức
- **Xoá lịch sử**: `rm -rf ~/.ai-kit/.telemetry-shares/` xoá tất cả share local
- **Audit**: file `~/.ai-kit/.telemetry-config.json` ghi nhận `last_export` / `last_sync` timestamp

## Tại sao maintainer cần dữ liệu này

| Mục tiêu | Cách dữ liệu hỗ trợ |
|---|---|
| Tối ưu skill nào hot, skill nào dead | `by_skill` → ưu tiên maintain skill dùng nhiều, deprecate skill 0 invocation/30d |
| Phát hiện regression sau release | `errors_total` spike → rollback hoặc patch nhanh |
| Cost monitoring | `total_cost_api_equivalent` → cảnh báo team nếu dùng Opus quá nhiều |
| Cache effectiveness | `cache_hit_rate` thấp → tune prompt cache |
| Tool optimization | `by_tool` heatmap → optimize Bash vs Grep usage |
| Phát hiện model nào value nhất | `by_model` cost vs success rate |

## Liên hệ

Câu hỏi về privacy: mở GitHub issue tại [cuongnm-dev/ai-kit](https://github.com/cuongnm-dev/ai-kit/issues) hoặc nhắn maintainer trong kênh team.

## Lịch sử

- **v0.37.0** (2026-05-07): Phase 1 — local export + manual transfer
- **v?.?.0** (Phase 2 — sắp tới): auto-sync via GitHub Gist + public dashboard
