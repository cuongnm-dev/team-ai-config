---
parent: _state.md
phase: 2-revised
applied-at: 2026-05-01
supersedes: phase-2-applied.md
status: applied — pure auto everywhere
---

# Phase 2 (Revised) — Pure Auto Everywhere (Option A)

## Decision

User chose Option A: pure auto, không force composer-2 ở Task() params. Floor control via Cursor Settings UI.

## Changes

### 1. All agent .md frontmatter → `model: auto`

23 files modified:
- 21 had explicit model (claude-sonnet-4-6, claude-opus-4-7, composer-2, default) → set to `auto`
- 2 had no model field → added `model: auto`
- 8 ref-* files no frontmatter → skipped

```bash
ls /c/Users/James/.cursor/agents/*.md | wc -l    # 31 (post Phase 1A)
grep -c "^model: auto" /c/Users/James/.cursor/agents/*.md | grep -v ":0" | wc -l   # 23
```

### 2. Reverted Task() model params

**`~/.cursor/skills/resume-feature/SKILL.md`**:
- `Task(dispatcher, prompt, model="composer-2")` → `Task(dispatcher, prompt)`
- `Task(pm, ..., model="composer-2")` → `Task(pm, ...)`

**`~/.cursor/agents/dispatcher.md`**:
- `Task(subagent_type=agent, model="composer-2")` → `Task(subagent_type=agent)`
- `Task(subagent_type=role + "-pro", model="composer-2")` → `Task(subagent_type=role + "-pro")`

## User MUST configure Cursor Settings UI

Vì Task() KHÔNG force model nữa, control duy nhất là Cursor Settings:

```
Settings → Models → Default model = composer-2
Settings → Models → Auto mode toggle (if exists)
```

→ Đảm bảo "auto" map về composer-2 thay vì sonnet-thinking.

## Trade-off vs Option B (force composer-2)

| | Option A (auto) | Option B (force composer-2) |
|---|---|---|
| Cost floor | Phụ thuộc Cursor Settings | Hard-coded composer-2 |
| Cursor 3 bug 151917 (model param ignored) | N/A — không dùng param | Có thể bypass force |
| Quality flexibility | Cursor có thể auto-escalate khi cần | Locked composer-2 mọi lúc |
| Risk: thinking auto-fire | YES nếu user không set Settings UI | NO |
| Simplicity | Pure — single source of truth | Defensive — multi-layer |

User chose A — đơn giản, single source of truth. Trade-off: cần kỷ luật Cursor Settings UI.

## Tier routing pattern (preserved)

Tier routing vẫn qua DUAL-AGENT FILE:
- `agents/dev.md` (base) vs `agents/dev-pro.md` (escalated)
- 2 file = 2 system prompt khác (more rigorous instructions)
- Cùng underlying model = whatever Cursor Settings default đang set

→ Pipeline tier escalation = AGENT FILE switch (different prompts), KHÔNG phải model switch.

## Reversibility

Revert tất cả về explicit models:
```bash
# Restore from git
git -C ~/.cursor checkout HEAD agents/*.md
git -C ~/.cursor checkout HEAD skills/resume-feature/SKILL.md
```

(Assumes ~/.cursor/ is git tracked — verify with `git -C ~/.cursor status`.)

## F-005 spike — pre-flight UPDATED

User MUST verify trước khi run:
- ✅ Cursor RESTART (skill + agent changes loaded)
- ✅ **Cursor Settings → Default model = `composer-2`** (CRITICAL — không có Task() force)
- ✅ Auto mode toggle = OFF nếu có (tránh thinking auto-fire)
- ✅ `~/.cursor/agents/` có 31 files (Phase 1A)
- ✅ 13 optional skills có `disable-model-invocation: true` (Phase 1B)

Nếu user quên set Settings → composer-2: Cursor sẽ auto-route → có thể fire thinking → cost shoot up. Test sẽ fail.

→ **Trước khi `/resume-feature RFID-F-005`, screenshot Cursor Settings xác nhận default = composer-2.**
