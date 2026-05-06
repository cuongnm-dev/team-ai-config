---
title: /update-feature — Update 1 feature (variant-aware)
order: 52
---

# `/update-feature` — Update 1 feature đã tồn tại (tự nhận diện variant)

Cập nhật feature. Skill thin — phát hiện variant (post-ADR-003 vs legacy) rồi route đúng đường.

## Khi nào dùng

| ✅ Trigger | ❌ Anti-trigger |
|---|---|
| Feature có sẵn cần thay đổi requirement / scope / impl | Feature chưa tồn tại → `/new-feature` |
| Change request 1 feature cụ thể | Module-level change đụng nhiều feature → `/update-module` |

## Lệnh

```bash
/update-feature F-NNN
```

## Hành vi (variant-aware)

Skill đọc `_feature.md` (post-ADR-003) hoặc `_state.md` (legacy) để phát hiện variant:

### Variant A — post-ADR-003 nested (`docs/modules/M-NNN/_features/F-NNN/`)

Feature nested KHÔNG có state machine riêng — pipeline drive ở cấp module. Skill **redirect**:

```
$ /update-feature F-001-citizen-account-pin-link

ℹ F-001-citizen-account-pin-link là feature post-ADR-003 nested trong M-001-iam.
  Pipeline drive ở cấp module — change request feature sẽ được xử lý qua /update-module
  với mode --change-feature.

  → Đang redirect sang: /update-module M-001 --change-feature F-001-citizen-account-pin-link

  Vui lòng gõ lệnh sau để tiếp tục:
      /update-module M-001 --change-feature F-001-citizen-account-pin-link

EXIT (không tạo lock, không thay đổi state)
```

### Variant B — legacy (`docs/features/F-NNN/_state.md`)

Feature legacy có state machine riêng. Skill chạy update flow tại chỗ:

1. **Cổng tiền kiểm** (sealed re-open / lock check)
2. **Phỏng vấn change request** (5 câu — qua shared notepad `_shared/update-flow.md`)
3. **Active CR check** (gộp hoặc tạo mới)
4. **Triage starting stage** (theo loại thay đổi → ba/sa/tech-lead)
5. **Risk re-evaluation**
6. **Ripple analysis** (depends_on F-NNN scope)
7. **Backup + atomic state reset**
8. **Post-reset review** prompt
9. **Gợi ý** `/resume-feature F-NNN`

### Variant C — phát hiện không rõ

Path không khớp pattern post-ADR-003 hay legacy → STOP với "Path resolved but variant unclear", yêu cầu manual investigate.

## Pattern phát hiện variant

Skill dùng `ai-kit sdlc resolve --kind feature --id F-NNN --include-metadata` lấy path, rồi:

```
IF resolved_path khớp `docs/modules/M-NNN-*/_features/F-NNN-*/` AND có `_feature.md` AND KHÔNG có `_state.md`:
  variant = "post-ADR-003-nested" → redirect /update-module --change-feature
ELIF resolved_path khớp `docs/features/F-NNN-*/` AND có `_state.md`:
  variant = "legacy" → update-flow.md tại chỗ
ELSE:
  STOP "variant unclear"
```

## Lý do tách thành skill riêng

Trước refactor v0.32.0: UPDATE flow gắn vào `/new-feature` (tên skill misleading khi user thực sự muốn update). Refactor: tách 2 skill — `/new-feature` cho greenfield, `/update-feature` cho cập nhật.

Variant-aware redirect đảm bảo user gọi `/update-feature` luôn được dẫn về đúng pipeline driver:
- Post-ADR-003 → `/update-module --change-feature` (vì module driver)
- Legacy → in-place update (vì feature có pipeline riêng)

## Tham khảo chéo

- FAQ: `ai-kit doc faq` § 11.5
- Skill source: `~/.cursor/skills/update-feature/SKILL.md`
- Shared notepad: `~/.cursor/skills/_shared/update-flow.md`
- ADR: ADR-003 D8 (variant routing rationale)
