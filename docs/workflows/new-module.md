---
title: /new-module — Khởi tạo module SDLC mới
order: 50
---

# `/new-module` — Khởi tạo module SDLC mới (interview-first)

Tạo module mới (M-NNN) qua phỏng vấn. Skill **không nhận tham số ID** — tự cấp ID + slug theo quy tắc canonical (ID = `max(catalog) + 1`, slug = chuyển thể tên Việt sang ASCII).

## Khi nào dùng

| ✅ Trigger | ❌ Anti-trigger |
|---|---|
| Thêm bounded context / domain mới vào project | Module đã tồn tại in-progress → dùng `/resume-module M-NNN` |
| "Tạo module mới cho nghiệp vụ X" | Module có sẵn cần mở rộng → dùng `/update-module M-NNN` |
| Chưa có module nào phù hợp với mô tả nghiệp vụ | Chỉ thêm 1 feature vào module có sẵn → `/new-feature` |

## Quy trình tóm tắt

1. **Bỏ qua tham số** (Q1=A): nếu user gõ `/new-module M-007` → ignore, vẫn auto-allocate
2. **Đọc intel + freshness gate**: stale-block per LIFECYCLE.md P5
3. **Phỏng vấn 5 câu** (qua shared notepad `_shared/preflight-interview.md`):
   - Vấn đề nghiệp vụ (problem)
   - Kết quả mong đợi (outcome)
   - Người dùng chính (actors)
   - Phạm vi (scope: 1 màn / đa luồng / cross-system)
   - Constraints (deadline / ngân sách / "none")
4. **Dedup check**:
   - ≥ 0.85 → **HARD-STOP**, gợi ý `/update-module {ID}` (Q3=A)
   - 0.60-0.85 → hiển thị top-3 candidates, user chọn `[u]/[n]/[a]`
   - < 0.60 → tiếp tục
5. **Dependency suggest**: NER trên description → match `data-model.entities` → đề xuất `depends_on`
6. **Risk path estimation**: heuristic → S/M/L (user xác nhận hoặc override)
7. **Auto-allocate**: ID = next M-NNN; slug = transliterate
8. **Confirm + scaffold**: hiển thị preview → user `[enter]`/`[b]`/`[a]` → `ai-kit sdlc scaffold module ...`
9. **Post-scaffold review**: "Còn bổ sung gì?" → `[enter]`/`[field]`/`[d]`(rollback)
10. **Final guidance**: gợi ý `/resume-module M-NNN` để bắt đầu pipeline

## Đặc điểm

- **Auto-allocate ID + slug**: không cho user override (tránh skip số thứ tự + đảm bảo nhất quán)
- **HARD-STOP ở dedup ≥ 0.85**: không cho duplicate module — phải dùng `/update-module` cho existing
- **Không tự gọi `/resume-module`**: skill end với suggestion, user tự gõ
- **Bản port cho Claude** (`~/.claude/skills/new-module/`): dùng Opus 4.7 cho phỏng vấn / dedup chất lượng cao
- **Bản Cursor** (`~/.cursor/skills/new-module/`): kế thừa model main agent

## Output (sau scaffold)

```
docs/modules/M-NNN-{slug}/
├── _state.md (current-stage: ba)
├── module-brief.md
├── implementations.yaml
├── ba/, tech-lead/, dev/, reviewer/             # luôn có (theo Path)
├── sa/, qa/                                     # nếu Path M / L
├── designer/                                    # nếu screen_count > 0
├── security/                                    # nếu Path L hoặc PII
└── _features/                                   # rỗng — fill bởi /new-feature
```

(Folder tạo theo `risk_path` + `agent_flags`, không tạo cứng 7 folder.)

## Tham khảo chéo

- FAQ: `ai-kit doc faq` § 11.4 + § 11.5
- Skill source: `~/.claude/skills/new-module/SKILL.md` + `~/.cursor/skills/new-module/SKILL.md`
- Shared notepad: `~/.cursor/skills/_shared/preflight-interview.md`
- ADR: ADR-003 D8 (module-driven architecture)
