---
title: /update-module — Update module hoặc feature trong module
order: 51
---

# `/update-module` — Update module (kèm sub-flow change-feature)

Cập nhật module SDLC đã tồn tại. Hỗ trợ 2 chế độ:
- **Module-only**: thay đổi business goal / scope / dependencies cấp module
- **Feature-change**: cập nhật 1 feature trong module qua flag `--change-feature F-NNN` (post-ADR-003 — feature nested không có pipeline riêng nên thay đổi feature chạy ở cấp module)

## Khi nào dùng

| ✅ Trigger | ❌ Anti-trigger |
|---|---|
| Module có sẵn cần thay đổi requirement / arch / scope | Module chưa tồn tại → `/new-module` |
| F-NNN nested cần update (auto-redirect tới đây từ `/update-feature`) | Module đang chạy dở → `/resume-module` |
| Module sealed cần mở lại để fix | Thay đổi nhỏ ≤1 file code-only → `/hotfix` |

## Lệnh

```bash
/update-module M-NNN                              # update cấp module
/update-module M-NNN --change-feature F-NNN       # update 1 feature trong module
```

## Quy trình tóm tắt

1. **Validate** + resolve M-NNN qua `ai-kit sdlc resolve`
2. **Cổng tiền kiểm**:
   - Module sealed (status=done) → hỏi mở lại
   - Có feature đang in-progress trong module → cảnh báo conflict, hỏi wait/override
   - Lock conflict → wait/force-takeover
3. **Phỏng vấn change request** (5 câu qua shared notepad `_shared/update-flow.md`):
   - Loại thay đổi (a-f: business rule / arch / impl / scope-expand / scope-shrink / dependency)
   - Mô tả ≥ 80 ký tự
   - Acceptance criteria mới hoặc thay đổi
   - Constraints
   - Risk delta (+0/+1/+2/-1)
4. **Active CR check**: nếu module đã có CR đang mở → gộp hoặc tạo mới
5. **Triage starting stage** (theo loại thay đổi):
   - `a` Business rule → `ba`
   - `b` Architecture → `sa`
   - `c` Implementation → `tech-lead`
   - `d` Scope expansion → `ba`
   - `e` Scope shrink → `tech-lead`
   - `f` Dependency → `sa`
6. **Risk re-evaluation**: nếu nhảy ≥ 2 cấp → hỏi extended roles cần thêm
7. **Ripple analysis**:
   - Phụ thuộc cross-module (consumed_by_modules)
   - Downstream features có depends_on
   - Heuristic auth model / data migration
   - Lưu `change-impact-report.md`
8. **Backup + atomic state reset**:
   - `_state.md.bak.{ISO}`
   - Status → in-progress
   - Current-stage → triaged_stage
   - Stages-queue → reset theo path
   - Active-change-requests[] → append CR mới
9. **Post-reset review** prompt
10. **Gợi ý** `/resume-module M-NNN`

## Khác biệt với /resume-module

- **resume-module**: tiếp tục pipeline đang chạy theo state hiện có (không thay đổi requirement)
- **update-module**: reset state + thêm CR mới, sau đó user chạy `/resume-module` để PM dispatch lại từ stage triage

## Sub-flow `--change-feature F-NNN`

Khi chỉ thay đổi 1 feature, dùng flag `--change-feature`:
- Pre-flight: validate F-NNN.module_id == M-NNN
- Interview tương tự nhưng focus vào feature đó
- CR linked với F-NNN trong active-change-requests[]
- PM dispatch sẽ cluster CR vào tech-lead plan, dev wave focus feature

`/update-feature F-NNN` post-ADR-003 sẽ TỰ ĐỘNG redirect sang `/update-module {parent_M} --change-feature F-NNN`.

## Tham khảo chéo

- FAQ: `ai-kit doc faq` § 11.5
- Skill source: `~/.cursor/skills/update-module/SKILL.md`
- Shared notepad: `~/.cursor/skills/_shared/update-flow.md`
- Memory: feature-catalog.json `consumed_by_modules` (CD-24)
