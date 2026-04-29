# PM Exception & Invocation Reference

> **Load on demand only** — when: agent returns `Blocked`/`Changes requested`, conflict spans ≥3 agents, mid-pipeline discovery invalidates TL plan, or `reviewer`/`qa` triggers rework. Do NOT read at pipeline start.

---

## Exception Decision Table

| Trigger | Protocol | PM Action | Escalation to PO? |
|---|---|---|---|
| `dev`/`qa` finds problem rooted in `sa` architecture | EP1 — Backward escalation | Re-invoke `sa` with specific finding → re-invoke `tech-lead` to replan | Only if discovery reveals a business decision (scope/budget/compliance threshold) |
| `dev`/`qa` finds problem rooted in `ba` artifact | EP1 — Backward escalation | Re-invoke `ba` with specific gap → re-invoke `sa` + `tech-lead` if architecture affected | Same as above |
| `dev`/`qa` finds missing domain concept | EP1 — Backward escalation | Re-invoke `domain-analyst` with gap → then `sa` and `tech-lead` | Same as above |
| Compliance/security issue discovered during implementation | EP1 — Backward escalation | Invoke `security`/`data-governance` immediately. Block QA until resolved | Same as above |
| Conflict spans ≥3 agents OR 2 adjacent agents exceed 2-loop limit, no single agent has clear domain authority | EP2 — Convergence session | (1) Identify the blocking decision in one sentence. (2) Re-invoke each conflicted agent sequentially with: conflict statement + other agent's last output + instruction to respond only to this conflict. (3) Apply Domain Authority table (AGENTS.md) — clear authority wins; no authority → PM decides. (4) Record decision in `_state.md` | If one convergence session fails to resolve → escalate with: conflict statement, both positions, PM's attempted resolution, specific business decision needed |
| `dev` blocked: "approved architecture does not support requirement"; or `qa` Fail with ≥3 defects sharing same root cause; or `risk_score` escalates to 5 on new finding; or conditional agent returns `Changes required` requiring structural code changes | EP3 — Mid-pipeline replan | (1) Stop current wave. (2) Identify scope: architecture-level → re-invoke `sa` then `tech-lead`; execution-level only → re-invoke `tech-lead` only. (3) Re-invoked agents update only what changed. (4) Update `_state.md`, notify user. (5) Resume from revised TL plan | Only if replan changes business scope |

**State tracking (all EPs):** Record every backward escalation or replan in `_state.md` — root cause, affected stages, resolution plan.

---

## Rework Loop Protocol

When `reviewer` returns `Changes requested` OR `qa` returns `Fail`:

- **Step 1 — Extract:** From the report, pull must-fix items only. For each: AC ID violated, file(s) affected, expected fix behavior.
- **Step 2 — Build rework bundle for `dev`:** Pass loop number (`Loop N/2`), must-fix table (finding / AC / file / expected fix), and pointers to: reviewer report, original AC, original implementation. Include `Scope Guard`: fix only listed items, do not refactor or expand scope.
- **Step 3 — Route after rework:** Send `dev` output to `qa` (or `reviewer` if QA already passed). Instruct `qa`: "verify only previously failed items". Instruct `reviewer`: "all must-fix items resolved — see updated implementation summary". Do NOT re-run BA/SA/TL unless must-fix requires architectural change.
- **Step 4 — Loop limit (>2 loops):** Set status `Blocked`. Escalate to PO with: unresolved must-fix items + reason loops failed.

---

## Invocation Patterns

See `./templates/task-invocation-pattern.md` for the generic Task() invocation template (structure, placeholders, context size rules).

### Parallel invocation — when to use

- **BA + Designer simultaneously:** both need only the PO request as input and have no dependency on each other → safe to parallelize; wait for both before routing to `domain-analyst`
- **DevOps + QA simultaneously:** both need dev output; however, `devops` must reach `Deployment ready` before QA begins testing — dispatch together but gate QA on devops verdict
- **FE dev + Backend dev in same wave:** safe when TL plan assigns non-overlapping file ownership; NEVER assign overlapping files or shared contracts to parallel dev agents
- **Multiple dev agents in same wave:** each agent gets a distinct task section from the TL plan and a distinct `artifact-file` name; same file-ownership constraint applies
