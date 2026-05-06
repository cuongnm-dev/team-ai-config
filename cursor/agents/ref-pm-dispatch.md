---
name: ref-pm-dispatch
model: default
description: Agent Dispatch Reference — when to invoke each agent, placement in pipeline, and context bundle to pass.
---

# Agent Dispatch Reference

When invoking each agent via `Task` tool, pass **only** the files listed in its Context Bundle (see `AGENTS.md` — Context Bundle Standard). Do not pass full artifact folders unless specified.

| Agent               | Invoke when                                                 | Placement               | Context bundle (pass these paths)                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ba`                | Always first stage — runs BA then domain modeling if needed | First stage             | Feature request text only (`feature-req` from `_state.md`)                                                                                                                             |
| `sa`                | After ba (triage: domain affected or architecture affected) | After ba                | `ba/00`,`ba/02`,`ba/03`,`ba/04`,`ba/05` + `domain-analyst/00`,`02`,`03`,`04` (if domain analysis ran)                                                                                  |
| `designer`          | BA flags UI/UX impact                                       | Parallel with DA        | `ba/00`, `ba/02`, `ba/03` from `_state.md`                                                                                                                                             |
| `tech-lead`         | After SA (or BA triage skip)                                | After SA + designer     | `ba/03`, `ba/05`, `ba/07`, full `domain-analyst/`, full `sa/`, `02-designer-report.md`                                                                                                 |
| `dev`               | After tech-lead — backend/fullstack                         | Per wave, per task      | `04-tech-lead-plan.md` (task section), assigned AC rows, `sa/01`, `sa/03`                                                                                                              |
| `fe-dev`            | After tech-lead — frontend                                  | Same wave as dev        | `04-tech-lead-plan.md` (task section), assigned AC rows, `02-designer-report.md`, `sa/02` from `_state.md`                                                                             |
| `qa`                | After each dev wave completes                               | After each wave         | `ba/03`, `ba/07`, `04-tech-lead-plan.md`, current wave dev outputs                                                                                                                     |
| `reviewer`          | After QA passes (Path M/L) OR after dev (Path S)            | Final gate              | **Path S:** `ba/03`, `04-tech-lead-plan.md`, all dev outputs + `inline_qa: true`. **Path M/L:** `ba/03`, `sa/00`, `sa/04`, `04-tech-lead-plan.md`, `07-qa-report.md`, all dev outputs. |
| `devops`            | Tech-lead flags deployment/runtime impact                   | After dev               | `04-tech-lead-plan.md` (section 4.7), `sa/05`                                                                                                                                          |
| `release-manager`   | risk_score ≥ 3 + DB migration or multi-service              | After dev               | `04-tech-lead-plan.md`, `sa/05`, `07-qa-report.md`                                                                                                                                     |
| `security`          | Auth/PII/payment/secrets changes                            | Alongside sa + reviewer | `sa/04`, `ba/03`, `sa/01`                                                                                                                                                              |
| `sre-observability` | SLO-sensitive paths or new external integrations            | Alongside sa + qa       | `sa/02`, `sa/06`, `ba/05`                                                                                                                                                              |
| `data-governance`   | PII/compliance/cross-system data                            | Alongside ba + sa       | `ba/03`, `ba/04`, `sa/03`, `domain-analyst/06`                                                                                                                                         |

Each agent knows its own output format. PM's job is knowing WHEN to invoke each and WHAT context to pass — not reproducing their output specs.
