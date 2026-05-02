# Update Flow — completed feature change

Loaded on demand by `new-feature/SKILL.md` when `_state.md` found with `status: done`.

---

## Step 5U — Update a completed feature

Triggered when `_state.md` found with `status: done`.

1. **Read existing artifacts**: `ba/00-lean-spec.md`, `sa/00-lean-architecture.md`, `04-tech-lead-plan.md`
2. **Collect change request**: what changed, why, constraints
3. **Triage starting stage**:

| Change type | Start from |
|---|---|
| New business rules, user stories, changed ACs | `ba` |
| Changed data model, new integration, boundary changes | `sa` |
| Changed implementation approach, different waves | `tech-lead` |
| Trivial code-only change ≤ 1 file | → use `/hotfix` instead |

4. **Reset `_state.md`**:
```yaml
status: in-progress
current-stage: {starting-stage from triage}
last-updated: {YYYY-MM-DD}
stages-queue: [{stages after starting-stage through reviewer}]
```

5. **Update `feature-map.yaml`**: status → in-progress, current-stage → {starting-stage}
6. → Proceed to dispatcher loop (see `notepads/dispatcher-loop.md`)

guardrails: same feature-id (no new ID), agents overwrite artifacts in place, do not skip stages in re-run path.
