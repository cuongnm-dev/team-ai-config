---
description: Adversarial audit của 1 feature đã đóng hoặc 1 phần codebase. Tìm hidden risks, missing tests, drift between docs vs code, security gaps. Read-only, không modify.
---

# /audit {feature-id-or-scope}

Adversarial review. Output report + actionable findings. No state modification.

## Step 1 — Scope

| Scope | Source |
|---|---|
| feature-id | `docs/features/{id}/` + linked artifacts |
| service | `apps/{name}/` or `services/{name}/` |
| scope keyword | `@Codebase "{keyword}"` |

## Step 2 — Multi-dimensional analysis

Load these skills inline:
- `reviewer-pro` — quality gate dimensions
- `security` (review mode) — security checklist
- `sre-observability` — operational concerns
- `data-governance` — compliance check

## Step 3 — Cross-check

| Dimension | Check |
|---|---|
| Docs vs code | `08-review-report.md` says X done — verify in code |
| AC vs tests | Each AC has linked TC with executed status |
| Permissions | Code role checks match `permission-matrix.json` |
| Routes | Code routes match `sitemap.json` |
| Data model | DB migrations match `data-model.json` |
| Integrations | API calls match `integrations.json` |
| Test coverage | Coverage % vs claimed |
| Logs | Audit log fields per BA NFR present |

## Step 4 — Output

Save to `docs/audits/{date}-{scope}.md`:

```markdown
# Audit Report: {scope}

## Verdict: Pass | Pass with concerns | Fail | Critical findings

## Findings (severity-ranked)
| Item | Severity | Evidence | Fix recommendation |

## Drift
| Doc claim | Code reality | Action |

## Hidden risks
{narrative on risks not surfaced in regular review}

## Action items
| Item | Owner | Due |
```

## What's next

| Verdict | Next |
|---|---|
| Pass | Sealed, document for future audit |
| Pass with concerns | `/spike` or `/runbook` for follow-ups |
| Fail | `/code-change` to fix |
| Critical | `/incident` |
