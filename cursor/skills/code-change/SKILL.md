---
name: code-change
description: Sửa lỗi hoặc tái cấu trúc code một cách an toàn. Có 2 chế độ: fix (điều tra nguyên nhân → sửa lỗi → kiểm thử lại) và refactor (tái cấu trúc trong phạm vi hẹp, có kiểm chứng trước-sau).
---

# Code Change

Replaces: fix-bug, refactor-safe.
Modes: `fix` | `refactor`.
User-facing output: Vietnamese.

## Mode detection

| Signal | Mode |
|---|---|
| "bug", "error", "broken", "regression", stack trace | fix |
| "refactor", "clean up", "restructure", "rename" | refactor |

---

## Mode: fix

Investigate unknown root cause → diagnose → fix → verify.
Different from `/hotfix` — hotfix is for KNOWN root cause + clear scope.

steps:
1. **Reproduce**: collect error details, reproduction steps, affected version
2. **Investigate**: Task(dev) → search codebase for root cause
   - Read error logs, stack traces
   - Grep relevant code paths
   - Identify root cause file(s) + line(s)
3. **Triage**:
   - Scope > 3 files → suggest `/new-feature`
   - Root cause known + scope clear → suggest `/hotfix`
   - Otherwise → continue
4. **Fix**: Task(dev) → implement fix
5. **Verify**: run tests, confirm bug no longer reproducible

output: `{project-path}/docs/fixes/{slug}.md` — root cause analysis + fix summary

## Mode: refactor

Scoped refactor within defined boundaries. No behavior change.

steps:
1. **Scope**: what to refactor, why, boundaries
2. **Contract**: Task(tech-lead) → define behavior contracts:
   - Public APIs / exported functions that must not change
   - Test assertions that must pass
   - Affected modules + blast radius
3. **Refactor**: Task(dev) → refactor within boundaries
   - Run tests after each significant change
4. **Validate**: full test suite, all contracts hold

output: `{project-path}/docs/refactors/{slug}.md` — scope + validation results

---

## Guardrails

- Fix scope > 3 files → escalate to `/new-feature`
- Refactor touches public API → escalate to `/new-feature` with `/plan` first
- Always run tests before claiming done

## What's next

| Outcome | Next |
|---|---|
| Fix verified | `/quality review` |
| Refactor validated | `/quality review` |
| Scope too large | `/plan` then `/new-feature` |
