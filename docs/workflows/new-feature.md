---
title: Workflow — Thêm feature mới qua SDLC
order: 10
---

# Workflow — Thêm feature mới qua SDLC pipeline

Pipeline: **interview → BA → SA → Tech-Lead → Dev/FE-Dev → QA → Reviewer → Close**.

## Khi nào dùng

- Có yêu cầu mới (từ stakeholder / SRS / chính team)
- Chưa có code, hoặc đang mở rộng feature
- Muốn chạy đầy đủ quy trình SDLC với handoff giữa BA/SA/Dev/QA

Khác với `/from-doc` (sinh feature hàng loạt từ tài liệu) — `/new-feature` là **interactive cho 1 feature**.

## Tiền điều kiện

- `/from-doc` hoặc `/from-code` đã chạy 1 lần để khởi tạo intel layer (`docs/intel/`).
- Nếu chưa có intel: skill sẽ cảnh báo và cho phép legacy mode (chỉ ghi vào `feature-map.yaml`).

## Quy trình

### 1. Khởi tạo (Cursor)

```
/new-feature
```

Skill sẽ hỏi:
- Feature name (ngắn, tiếng Việt)
- Business goal (≥100 chars)
- Scope in / scope out
- Flow summary (3-7 bước)
- Constraints, priority
- Module / domain (gợi ý từ sitemap)
- Role visibility (chọn từ actor-registry)
- Dependencies (feature-id liên quan)

Output:
- `docs/features/F-NNN/_state.md` (Cursor SDLC contract)
- `docs/features/F-NNN/feature-brief.md`
- `docs/feature-map.yaml` cập nhật
- `docs/intel/feature-catalog.json` thêm entry với `[CẦN BỔ SUNG]` placeholders

### 2. Resume pipeline (Cursor)

```
/resume-feature F-NNN
```

Dispatcher chạy lần lượt qua `stages-queue`:
- **ba** — Elaborate description, AC ≥3 items, business rules
- **sa** — Routes, entities, integrations, permission concrete
- **tech-lead** — Wave plan
- **dev / fe-dev** — Implement
- **qa** — Test cases + Playwright + screenshots (atomic triple)
- **reviewer** — Final gate

Mỗi stage tuân thủ contract trong LIFECYCLE.md.

### 3. Đóng feature

```
/close-feature F-NNN
```

- Seal `_state.md.status: done`
- Update `feature-catalog.status: implemented` + evidence
- Sync `feature-map.yaml`
- Trigger `intel-snapshot` regen

## Ví dụ thực tế

```
User: /new-feature
> Feature name: Tra cứu giao dịch vận tải
> Business goal: Cung cấp công cụ giám sát từng GD thu phí...
> Scope in: keyword filter, date range, station filter
> Scope out: real-time push notifications
> Module: transaction-monitoring
> Role visibility: hqdk:full, lanh-dao:readonly
> Priority: high

→ Tạo F-042

User: /resume-feature F-042
[ba] ✓ AC + business rules done
[sa] ✓ Routes + entities + permissions
[tech-lead] ✓ Wave plan
[dev-wave-1] ✓ Backend implementation
[fe-dev-wave-1] ✓ Frontend implementation
[qa-wave-1] ✓ 12 test cases passed, screenshots captured
[reviewer] ✓ Approved

User: /close-feature F-042
✓ Sealed
```

## Kiểm tra trạng thái

```bash
ai-kit status            # MCP + counts
# Trong Cursor:
/feature-status          # Xem trạng thái tất cả features
```

## Liên quan

- from-doc — Sinh nhiều features cùng lúc từ SRS
- from-code — Reverse-engineer từ code
- agents reference — Chi tiết các stage agents
- troubleshooting — Lỗi thường gặp khi dispatch
