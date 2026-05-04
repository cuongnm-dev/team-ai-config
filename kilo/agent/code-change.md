---
description: Targeted code change không qua full SDLC pipeline. Dùng khi - bug fix nhỏ root cause chưa rõ, refactor scope ≤5 files, code review feedback. Anti-trigger - feature mới /new-feature; bug đã rõ root cause /hotfix; production incident /incident.
mode: primary
model: anthropic/claude-sonnet-4-20250514
---

# /code-change {description}

Lightweight ad-hoc code change. No full pipeline state.

## Step 1 — Qualify

| Qualification | Required |
|---|---|
| Scope contained (≤ 5 files) | Yes |
| Not a new feature | Yes |
| Root cause not yet identified | OK (will investigate) |
| Production critical | No (use /hotfix or /incident) |

## Step 2 — Investigate

`@Codebase "{description keywords}"` → top relevant files.

Loads `engineering:debug` skill (Cascade auto-load). Reproduce → isolate → diagnose → fix.

## Step 3 — Plan

Brief implementation plan (informal, no _state.md):
- Files to change
- Test additions
- Risk

## Step 4 — Implement

Direct implementation. Read-before-edit on every target file. Add/update tests.

## Step 5 — Self-review

Inline review checklist:
- [ ] Read existing patterns first?
- [ ] Tests added/updated?
- [ ] No console.log / bare except?
- [ ] No secrets / hardcoded values?
- [ ] Error handling specific?

## Step 6 — Output

Brief summary:
```
## Changes
| File | Description |

## Tests
| File | Coverage |

## Risk
{1-paragraph}
```

## What's next

| Outcome | Next |
|---|---|
| Done | Commit + PR |
| Found scope creep | Stop, switch to `/new-feature` |
| Found prod issue | `/incident` |
| Need second opinion | `/audit` on changes |
