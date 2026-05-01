---
parent: _state.md
phase: 1B
applied-at: 2026-05-01
status: applied — awaiting measurement
---

# Phase 1B — Skills `disable-model-invocation: true` Applied

## Changes

13 optional skills now have `disable-model-invocation: true` in frontmatter:

```
adr               arch-review    audit            cache-lint
hotfix            incident       intel-snapshot   release
runbook           strategic-critique  ui-catalog   zip-disk
generate-docs     (đã chuyển sang Claude)
```

## Effect (theo Cursor docs + B3 research)

- Skills vẫn **available** qua slash command (`/adr`, `/audit`, ...)
- Cursor model **CANNOT auto-invoke** these skills
- Description vẫn registered ở startup (small ~200B/skill)
- Body chỉ load khi user explicit invoke

## Why

- Tránh model "helpful" auto-route to optional skill khi user ý định khác
- Reduce decision-tree noise trong harness
- Giữ skill available cho user nhưng pin xuống "manual only"

## SDLC essential skills GIỮ auto-invocation

```
new-feature, resume-feature, close-feature, feature-status,
from-doc, implement, plan, spike, code-change, quality,
new-workspace, new-project, configure-workspace
```

(13 skills — same count as disabled, by coincidence)

## Reversibility

100% — remove the `disable-model-invocation: true` line:
```bash
for f in adr arch-review audit cache-lint hotfix incident intel-snapshot release runbook strategic-critique ui-catalog zip-disk generate-docs; do
  sed -i '/^disable-model-invocation: true$/d' ~/.cursor/skills/$f/SKILL.md
done
```

## Expected impact

Theo B3 research: skills ALREADY load lazy by default (chỉ name+description). `disable-model-invocation: true` thêm bảo vệ nhưng KHÔNG giảm registry footprint.

→ **Phase 1B saving rất nhỏ** (gần như zero token reduction). Lý do làm phase này:
- Giảm rủi ro model nhầm route Skill auto vào tasks không cần
- Defensive measure, no regression risk
- Reversible

**Real saving sẽ đến từ Phase 2** (force composer-2).

## Measurement Phase 1B

Phase 1B effect quá nhỏ để đo riêng. Skip dedicated measurement.

→ **Đi tiếp Phase 2 ngay**, sau Phase 2 chạy probe F-005 đo combined Phase 1A+1B+2.
