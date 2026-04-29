---
name: ref-pm-proactive
description: PM proactive situation recognition tables — auto-trigger, post-close suggestions, smart routing for unstructured requests.
---

# PM Proactive Situation Recognition

PM applies this decision table continuously throughout orchestration. When a condition is met, run the corresponding action WITHOUT asking the user.

### Adaptive escalation (telemetry-driven)

PM reads `.cursor/telemetry/{feature-id}.jsonl` (last 50 lines) BEFORE making escalation decision. Use real signals — not hard-coded thresholds.

| Telemetry signal | Adaptive action |
|---|---|
| Cache hit ratio < 0.4 over last 10 iterations | Append note: "FROZEN_HEADER may have drifted — run /cache-lint before next stage" |
| Same stage retried ≥ 3× with rising token cost | Force PM EP3 (replan) instead of EP2 (convergence) |
| Median stage duration trending up 2× over baseline | Suggest `--output-mode lean` for next stage |
| 0 telemetry events captured | Telemetry agent broken — log warning but DO NOT block pipeline |

This replaces the static `risk_score >= 4 → PM every stage` rule with risk-adaptive routing: PM frequency now scales with observed instability, not just intake estimate.

### During pipeline execution — auto-trigger

| If PM observes... | Action |
|---|---|
| Reviewer returns `Approved` or `Approved with follow-ups` | Auto-run retrospective (Stage 9). After retrospective saved, suggest `/close-feature` |
| `dev` or `qa` flags a new dependency vulnerability or outdated package | Append note to `_state.md` blockers. After pipeline closes, suggest `/dependency-audit` |
| `sa` or `tech-lead` makes a significant architectural decision not yet recorded | After the stage completes, suggest `/adr` with the decision context pre-filled |
| Any agent returns `Blocked` twice in a row on the same issue | Stop pipeline. Surface the blocker to the user with a concrete resolution path |
| `security` or `reviewer` flags a compliance issue (GDPR/PCI/PII) | Append to `_state.md` as a must-fix blocker. Do NOT proceed to next stage until resolved |
| `tech-lead` wave plan has >20 ACs | Stop and escalate to user: the feature should be split before proceeding |
| `devops` flags DB migration with no rollback plan | Block `qa` from starting. Require devops to add rollback plan first |
| **Current path is Path S AND `tech-lead` reports: DB migration, new env vars, cross-service change, or risk_score ≥ 3** | **Upgrade to Path M automatically.** Invoke `sa` with TL's finding as input. Record override in `_state.md`. Proceed to `dev` only after SA and TL replan. |
| After each dev wave completes (Path M/L) | Compose a 10-line **Change Digest** and write to `{docs-path}/05-change-digest-w{N}.md`. Format: `\| File \| Change summary \| AC refs \| Risk flag \|`. Pass this file to reviewer instead of raw dev outputs. |

### After pipeline closes — proactive suggestions

| If the closed pipeline had... | Suggest |
|---|---|
| `rework_count` > 3 in retrospective | "Consider `/tech-debt` on the affected module to address root causes" |
| A `hotfix` type | "Consider `/postmortem` if severity was Critical or High" |
| Any `security` findings in reviewer report | "Run `/security-scan` on the full module before next release" |
| First feature touching a new service/integration | "Create a `/runbook` for production operations" |

### When PM receives an unstructured request (no active pipeline) — smart routing

| If the user describes... | PM runs |
|---|---|
| Estimation need ("how long", "effort for", "can we do X by Y") | Full estimate workflow: BA scoping → tech-lead estimate → respond |
| Technical uncertainty ("not sure how to build X", "researching Y") | Spike workflow: SA + tech-lead investigation → recommendation |
| Production outage or degradation | Incident workflow: SRE + devops → immediate action plan |
| A significant architectural choice just made | ADR workflow: SA writes record → tech-lead validates → saved |
