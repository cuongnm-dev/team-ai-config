---
description: Dispatcher reference playbook (NOT a callable agent). Routing table, Task Prompt Template, Artifact Validation, State Update Protocol, PM Escalation Triggers, Token Budget, Tiered Routing. PM skill auto-loads this for orchestration logic. Do NOT invoke directly.
mode: subagent
model: anthropic/claude-sonnet-4-20250514
---

# Dispatcher (Reference Playbook)

> **STATUS**: This skill is a **reference playbook** for the PM orchestrator. PM auto-loads this skill when needing routing/validation/state-update logic. NOT a callable agent — do not invoke directly.

## Routing Table

| current-stage | Skill to load | Parallel? | Notes |
|---|---|---|---|
| `ba` | `ba` (or `ba-pro` if escalation) | No | Pass `feature-req` from `_state.md` |
| `sa` | `sa` (or `sa-pro`) | No | After ba |
| `designer` | `designer` | No (parallel with sa) | When BA flagged designer_required |
| `tech-lead` | `tech-lead` | No | After SA + designer |
| `dev-wave-{N}` | `dev` (or `dev-pro`) | Yes | One per task in wave |
| `fe-dev-wave-{N}` | `fe-dev` | Yes | Same wave as dev |
| `devops` | `devops` | No | After dev |
| `security-design` | `security` (mode=design) | No | Alongside sa |
| `security-review` | `security` (mode=review) | No | Alongside reviewer |
| `sre` | `sre-observability` | No | Alongside sa + qa |
| `release-manager` | `release-manager` | No | After dev |
| `data-governance` | `data-governance` | No | Alongside ba + sa |
| `qa-wave-{N}` | `qa` (or `qa-pro`) | No | After dev wave |
| `reviewer` | `reviewer` (or `reviewer-pro`) | No | Final gate |

## 4-Block Task Prompt Template (Cache-Aware)

When PM auto-loads a role skill, structure context block in this STATIC → DYNAMIC order:

```
## Agent Brief
role: {role-name}
pipeline-path: {S|M|L}
output-mode: {lean|full}
stage: {current-stage}
artifact-file: {expected output path}

## Project Conventions
{≤5 items from rules/40-project-knowledge equivalent — omit section entirely if empty}

## Feature Context
feature-id: {_state.feature-id}
docs-path: {_state.docs-path}
repo-path: {worktree-path if worktree-mode, else _state.repo-path}
intel-path: {repo-path}/docs/intel/

## Inputs
pipeline-tokens-so-far: {_state.kpi.tokens-total}
{role-specific dynamic content}
```

**Rules:**
1. NEVER put variable data above `## Feature Context` — breaks static prefix cache
2. NEVER reorder blocks
3. ALWAYS include all 4 block headers (use `(none)` if empty)
4. For dev waves: include wave number in `## Agent Brief` (each wave = own cache entry)

## Tiered Routing

| Base | Escalation | Trigger |
|---|---|---|
| ba | ba-pro | risk_score ≥ 4 OR confidence=low |
| sa | sa-pro | adr_assigned OR risk ≥ 4 OR confidence=low |
| dev | dev-pro | test_failure_rate > 30% OR risk ≥ 4 OR confidence=low |
| qa | qa-pro | ac_coverage_pct < 80 OR risk ≥ 4 OR confidence=low |
| reviewer | reviewer-pro | risk ≥ 3 (force) OR confidence=low |
| tech-lead | (no pro variant) | escalate to sa-pro if architectural change needed |

Max 1 escalation per stage.

## Artifact Validation (Run Before State Update)

| Stage | Expected artifact | Action if missing |
|---|---|---|
| `ba` | `{docs-path}/ba/00-lean-spec.md` | Block ART-001 |
| `sa` | `{docs-path}/sa/00-lean-architecture.md` | Block ART-001 |
| `tech-lead` | `{docs-path}/04-tech-lead-plan.md` | Block ART-001 |
| `dev-wave-{N}` | At least one `{docs-path}/05-dev-w{N}-*.md` | Block ART-001 |
| `qa-wave-{N}` | `{docs-path}/07-qa-report.md` (or `-w{N}.md`) | Block ART-001 |
| `reviewer` | `{docs-path}/08-review-report.md` | Block ART-001 |

If artifact missing despite success verdict → return `status: blocked` with `ART-001` blocker. Do NOT advance stage.

## State Update Protocol

After receiving valid verdict + artifact validation passes:

```yaml
completed-stages:
  {current-stage}:
    verdict: "{verdict received}"
    completed-at: "{today YYYY-MM-DD}"

current-stage: {stages-queue.pop(0)}   # or "done" if queue empty
stages-queue: {remaining}

kpi:
  tokens-total: {pipeline_total from verdict}
  tokens-by-stage:
    {current-stage}: {this_agent total}
```

Echo 1-line report:
```
[{current-stage}] ✓ {verdict} | +{this_agent}K tokens (total: {tokens-total}K)
```

If `stages-queue` empty after stage → `status: done`.

## PM Escalation Triggers (Inline Judgment)

| Trigger | Condition | What PM decides |
|---|---|---|
| Post-BA path selection | Stage just completed = `ba` | Path S/M/L, populate `stages-queue` |
| Extended role flag | Verdict has `security_concern: true` / `pii_flag: true` / `deployment_impact: true` | Insert role(s) into `stages-queue` |
| QA Fail | Verdict = `Fail` AND risk ≥ 3 | Rework: dev-only OR backward escalation |
| Reviewer Changes Requested | Verdict = `Changes requested` AND risk ≥ 3 | Rework scope |
| Agent Blocked | Verdict = `Blocked` or `Need clarification` | Resolve OR escalate to user (set `clarification-notes`) |
| High-risk every-stage | risk ≥ 4 | PM checks every stage transition |

## Path S Simple Rework (PM handles without escalation)

When risk ≤ 2 AND verdict = Fail/Changes:
- Increment `rework-count.dev`, reset `current-stage` to last dev-wave
- Re-add wave to front of `stages-queue`. Max 2 reworks → if exceeded, escalate

## Token Budget Enforcement

| `tokens_total / token_budget` | Action |
|---|---|
| < 60% | Continue normally |
| 60-80% | Continue + warn `"⚠ Budget {pct}% used"` |
| 80-95% | Auto-swap to fast tier for next stage. Set `_state.budget_mode: fast` |
| ≥ 95% | Hard block BUDGET-001. User must update budget cap or `--ignore-budget` |

**Path-default budgets:** Path S=80K, Path M=200K, Path L=500K, doc-generation=1M

## Loop Safeguards

- **Escalation count cap:** same `pm-trigger` for same `current-stage` > 3 times → block LOOP-001
- **Backward escalation cap:** PM sets `current-stage` to already-completed stage; max 2 per pipeline → block LOOP-002
- **Rework cap:** Max 3 PM-driven reworks per pipeline → block

## Wave Batching (dev-wave-N + fe-dev-wave-N)

1. Read `04-tech-lead-plan.md` → extract task list for wave N → count = `total_tasks`
2. Glob `05-dev-w{N}-*.md` (or `05-fe-dev-w{N}-*.md`) → count = `done_tasks`
3. If `done = total` → wave complete, advance stage
4. Else: spawn `min(remaining, 4)` Task() in parallel. Re-glob after batch
5. If `done` increased → continue. If not increased → WAVE-001 blocker
