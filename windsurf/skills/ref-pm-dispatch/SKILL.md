---
name: ref-pm-dispatch
description: Per-agent context bundle reference. When PM dispatches a role skill, what file paths to include. Auto-load to keep specialists' read context scoped.
---

# PM Dispatch Reference

> **STATUS**: Reference for PM when constructing per-stage context. Each role skill gets MINIMAL file paths in its 4-block prompt — agent reads files directly.

## Per-Agent Context Bundle

| Agent | Invoke when | Placement | Context bundle (paths to pass) |
|---|---|---|---|
| `ba` | Always first stage | Stage 1 | `feature-req` text only (from `_state.md`) |
| `sa` | After ba (when domain/architecture affected) | After ba | `ba/00`, `ba/02`, `ba/03`, `ba/04`, `ba/05` + (if domain ran) `domain-analyst/00`, `02`, `03`, `04` |
| `designer` | BA flagged UI/UX impact | Parallel with DA | `ba/00`, `ba/02`, `ba/03` |
| `tech-lead` | After SA (or BA triage skip) | After SA + designer | `ba/03`, `ba/05`, `ba/07`, full `domain-analyst/`, full `sa/`, `02-designer-report.md` |
| `dev` | After tech-lead — backend/fullstack | Per wave, per task | `04-tech-lead-plan.md` (task section), assigned AC rows, `sa/01`, `sa/03` |
| `fe-dev` | After tech-lead — frontend | Same wave as dev | `04-tech-lead-plan.md` (task section), assigned AC rows, `02-designer-report.md`, `sa/02` |
| `qa` | After each dev wave | After each wave | `ba/03`, `ba/07`, `04-tech-lead-plan.md`, current wave dev outputs |
| `reviewer` | After QA passes (Path M/L) OR after dev (Path S) | Final gate | **Path S:** `ba/03`, `04-tech-lead-plan.md`, all dev outputs + `inline_qa: true`. **Path M/L:** `ba/03`, `sa/00`, `sa/04`, `04-tech-lead-plan.md`, `07-qa-report.md`, all dev outputs |
| `devops` | Tech-lead flagged deployment_impact | After dev | `04-tech-lead-plan.md` § 4.7, `sa/05` |
| `release-manager` | risk_score ≥ 3 + DB migration or multi-service | After dev | `04-tech-lead-plan.md`, `sa/05`, `07-qa-report.md` |
| `security` | Auth/PII/payment/secrets changes | Alongside sa + reviewer | `sa/04`, `ba/03`, `sa/01` |
| `sre-observability` | SLO-sensitive paths or new external integrations | Alongside sa + qa | `sa/02`, `sa/06`, `ba/05` |
| `data-governance` | PII / compliance / cross-system data | Alongside ba + sa | `ba/03`, `ba/04`, `sa/03`, `domain-analyst/06` |

## Why minimal paths

- Each role skill reads files directly via Cascade — passing PATHS instead of CONTENT keeps prompt small + cache stable
- Agent decides what to read deeply vs skim
- F-005 spike showed bundle-inlining (Active Context Bundle) BREAKS cache (rejected 2026-05-01)

## Anti-patterns

- ❌ Passing full file content in prompt (cache bust + token waste)
- ❌ Passing all `docs-path/*` paths (over-scope causes agent to over-Read)
- ❌ Skipping context bundle (agent needs minimum paths to start)
