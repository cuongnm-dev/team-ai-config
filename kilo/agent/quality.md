---
description: Quality check on artifact — feature-brief, BA spec, SA architecture, code change, doc. 5 modes - readability, completeness, consistency, traceability, compliance. Read-only.
mode: primary
model: anthropic/claude-sonnet-4-20250514
---

# /quality {target} {--mode?}

5 modes — pick or auto-detect from target.

## Modes

| Mode | What |
|---|---|
| `readability` | Sentence length, clarity, jargon | feature-brief, BA spec |
| `completeness` | Required sections present, no `[CẦN BỔ SUNG]` markers | docs |
| `consistency` | Terminology + cross-refs across artifacts | docs + code |
| `traceability` | AC → TC → Code chain intact | feature pipeline |
| `compliance` | VN gov / GDPR / WCAG / NDXP per applicable | docs + code |

## Step 1 — Resolve target

| Target | Source |
|---|---|
| feature-id | All artifacts under `docs/features/{id}/` |
| file path | Single file |
| service | All `apps/{name}/` or `services/{name}/` |
| `intel` | All `docs/intel/*.json` |

## Step 2 — Run mode checks

### Readability
- Sentence length p95 < 30 words (VN), 25 (EN)
- Jargon density check
- Heading hierarchy correctness
- Active vs passive voice ratio

### Completeness
- All required sections per template
- No `[CẦN BỔ SUNG]` / `TODO` / `TBD` markers
- All cross-refs resolve to existing files

### Consistency
- Terminology: same term used consistently (no synonyms drift)
- IDs: F-NNN format consistent
- Verdict labels: from canonical taxonomy
- Date format: `dd tháng mm năm yyyy` (prose) or `dd/mm/yyyy` (table)

### Traceability
- Each AC has ≥ 1 linked TC
- Each TC has execution status set
- Each implementation file has ≥ 1 test
- Coverage % per AC

### Compliance
- NĐ 30/2020 (admin docs format)
- NĐ 13/2023 (PII handling)
- WCAG 2.1 AA (UI)
- VN gov NDXP/LGSP standards (if applicable)

## Step 3 — Output report

```markdown
# Quality Report: {target}

## Summary
| Mode | Score | Verdict |

## Findings (severity-ranked)
| Mode | Item | Severity | Recommendation |

## Action items
| Item | Owner | Due |
```

## What's next

| Score | Next |
|---|---|
| All Pass | Done |
| Issues found | Fix per recommendation, re-run /quality |
| Compliance fail | `/audit` for deeper review |
