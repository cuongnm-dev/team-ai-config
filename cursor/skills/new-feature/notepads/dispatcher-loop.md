# Dispatcher Loop — new-feature variant

Loaded on demand by `new-feature/SKILL.md` after a fresh pipeline is initialized OR an existing one is reset for update.

For full feature-id resume cases (status ≠ done), `new-feature` SKILL.md redirects to `/resume-feature` which uses its own (richer) dispatcher loop in `resume-feature/notepads/dispatcher-loop.md`.

---

## Pre-dispatch checklist

- [ ] `AGENTS.md` read, `repo-type` confirmed
- [ ] `docs-path` resolved correctly (not hardcoded `docs/features/`)
- [ ] `feature-id` format: `F-NNN` (mini) or `{service}-F-NNN` (mono)
- [ ] `_state.md` exists at `{docs-path}/_state.md`
- [ ] `stages-queue` set (new) or reconstructed (update)
- [ ] `feature-map.yaml` updated with new/resumed feature entry
- [ ] Update flow: do NOT re-run stages that already have a verdict

---

## Dispatcher loop (with PM escalation)

```
loop:
  # Cache-aware prompt: same prefix across every iteration of same feature
  # Static Feature Context section → cache hit across all dispatcher calls in this pipeline
  result = Task(
    subagent_type="dispatcher",
    prompt="
## Feature Context
feature-id: {feature-id}
docs-path: {docs-path}
repo-path: {repo-path}
output-mode: {output-mode}

## Inputs
(dispatcher reads current-stage from _state.md)
"
  )

  → status=continuing:
      print "[{stage}] ✓ {verdict}"
      loop

  → status=done:
      print "Pipeline hoàn tất. Reviewer: {verdict}"
      exit

  → status=blocked:
      surface blockers to user, stop

  → status=pm-required:
      print "[{stage}] → PM judgment needed: {pm-trigger}"
      pm_result = Task(
        subagent_type="pm",
        prompt="pm-trigger: {result.pm-trigger}\npm-context: {result.pm-context}\ndocs-path: {docs-path}\nfeature-id: {feature-id}"
      )
      if pm_result is not valid JSON or missing "resume" field:
        print "⚠️ PM returned invalid response. Pipeline paused."
        surface PM's raw output to user, stop
      if pm_result.resume = true:
        print "PM: {pm_result.judgment}"
        loop  ← dispatcher reads updated _state.md
      else:
        surface PM's message to user, stop

  → status is none of the above (unknown):
      print "⚠️ Dispatcher returned unknown status: {result.status}. Pipeline paused."
      surface result to user, stop
```

For long-running pipelines, prefer `/resume-feature {id}` after the first dispatcher pause — it has stricter cost-fix loop semantics.
