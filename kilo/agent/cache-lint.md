---
description: Hard-enforce frozen-header invariants in skill/agent prompts. Run trước commit changes vào ~/.codeium/windsurf/skills hoặc workflows. Prevents cache-breaking edits (reordered fields, dynamic data in static block, whitespace drift).
mode: primary
model: anthropic/claude-sonnet-4-20250514
---

# /cache-lint {--strict?}

## Step 1 — Scan

Read all skill SKILL.md + workflow .md files. Look for:
- 4-block prompt template structures
- FROZEN_HEADER patterns
- Cache-relevant frontmatter

## Step 2 — Check invariants

| Invariant | Violation |
|---|---|
| 4-block order: Agent Brief → Project Conventions → Feature Context → Inputs | Reordered or missing block |
| STATIC fields above DYNAMIC | Variable data above `## Feature Context` |
| Append-only field additions | Field reordered (compare git diff) |
| Whitespace consistency | Trailing spaces, `\r\n`, irregular newlines |
| English-only prompt body (CD-9) | VN in non-content fields |
| No timestamps in system prompts | Date/time in static prefix |

## Step 3 — Report

```
## Cache Lint Results
{N} files scanned
{M} violations found

### Violations
| File | Line | Invariant | Severity | Fix |

### Warnings (informational)
{...}

### Cache impact estimate
{Estimate of cache invalidation if violations applied}
```

## Step 4 — Fix mode (--fix)

Auto-fix safe violations:
- Trailing whitespace
- `\r\n` → `\n`
- Reorder Append-only violations (manual confirm)

## Strict mode (--strict)

Exit 1 if any violation found. Use in pre-commit hook.

## What's next

| Outcome | Next |
|---|---|
| Clean | Safe to commit |
| Violations | Fix per Severity, re-run |
| Cache impact high | Consider revert + redesign |
