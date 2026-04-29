---
title: Workflow — /resume-feature (chạy SDLC pipeline cho 1 feature)
order: 11
---

# Workflow — /resume-feature

Skill **Cursor**. Chạy pipeline SDLC theo `stages-queue` trong `_state.md`. Mỗi lần invoke = chạy 1 stage rồi dừng → user check rồi gọi lại.

## Khi nào dùng

- Đã có `_state.md` (do `/new-feature`, `/from-doc`, hoặc `/from-code` tạo)
- Muốn chạy pipeline tiếp tục từ stage hiện tại
- Tiếp tục feature đang dở (sau khi đóng session, mất context)

## Quy trình

```
/resume-feature F-042
```

Skill thực hiện:
1. **Resolve _state.md** — fuzzy match qua `feature-map.yaml` hoặc glob `docs/features/F-042/`
2. **Validate** — frontmatter (pipeline-type, status, current-stage, repo-path, ...)
3. **Reconcile** với `feature-map.yaml` nếu mismatch
4. **Dependency check** — nếu `depends-on: [F-005]` mà F-005 chưa done → ask wait/override
5. **Display status** — current stage + tasks remaining
6. **Dispatcher loop** — invoke agent của current-stage:
   - `ba` → AC + business rules
   - `sa` → routes + entities + permissions
   - `tech-lead` → wave plan
   - `dev/fe-dev` → implement code
   - `qa` → test cases + Playwright + screenshots
   - `reviewer` → quality gate
7. Mỗi stage có verdict (Pass / Fail / pm-required) → loop tiếp hoặc escalate PM

## Resume khác Loop

`/resume-feature` chạy **TỪNG stage một lần** — sau verdict Pass, dispatcher advance current-stage và quay lại loop.

Mỗi loop iteration tốn ~30K tokens (FROZEN_HEADER cached). Pipeline đầy đủ (path M) ~7 stages → ~200K tokens.

## Stages-queue theo Path

| Path | Khi nào | Stages |
|---|---|---|
| **S** (Simple) | risk 1-2, self-contained | `tech-lead` → `dev-wave-1` → `reviewer` |
| **M** (Medium) | risk 3 (default) | `sa` → `tech-lead` → `dev-wave-1` → `qa-wave-1` → `reviewer` |
| **L** (Large) | risk 4-5, auth/PII/payment | `sa` → `security-design` → `tech-lead` → `dev-wave-1` → `qa-wave-1` → `security-review` → `reviewer` |

`/new-feature` chọn path qua `risk_score`.

## Conditional stages (auto-add)

- UI screens detected → thêm `designer` + `fe-dev-wave-1`
- PII/auth flagged → thêm `security-review`
- External integrations → bắt buộc `sa`

## Khi pipeline dừng giữa chừng

3 trường hợp:

| Status | Nghĩa | Action |
|---|---|---|
| `done` | Pipeline hoàn tất | `/close-feature F-042` |
| `blocked` | Có blocker (intel-missing, dependency...) | Resolve blocker, `/resume-feature` lại |
| `pm-required` | Cần PM judgment (path change, exception) | Skill auto-invoke `pm` agent → ghi clarification → resume |

## Ví dụ

```
/resume-feature F-042
[ba] ✓ description + AC + business_rules done. status: in_design
↓
/resume-feature F-042
[sa] ✓ routes + entities + permission concrete. status: in_development
↓
/resume-feature F-042
[tech-lead] ✓ 2 waves, 5 tasks. plan saved
↓
/resume-feature F-042
[dev-wave-1] ✓ task T1.1, T1.2 done. continue?
↓
... (tiếp tục cho đến reviewer)
↓
/close-feature F-042
```

## Tự động hoá (loop)

```
/loop 5m /resume-feature F-042
```

→ skill `/loop` chạy `/resume-feature` mỗi 5 phút (anh đi pha cà phê, pipeline tự advance).

## Liên quan

- [new-feature](new-feature.md) — Tạo feature trước khi resume
- [close-feature](close-feature.md) — Đóng feature sau reviewer Pass
- [agents](../reference/agents.md) — Chi tiết các stage agents
- [troubleshooting](../troubleshooting.md)
