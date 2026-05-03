# Dispatcher Loop — new-feature variant (DEPRECATED REFERENCE — content inlined into SKILL.md 2026-05-04)

> **⚠️ DEPRECATED 2026-05-04**: The critical loop logic has been INLINED into `new-feature/SKILL.md` Step 5 because Cursor sometimes fails to load this notepad relative-path (cf. F-007 spike). Inline = robust against load failure.
>
> **Authoritative loop is now in `SKILL.md` Step 5.** This file is kept for reference and historical context (Active Context Bundle revert, cache discipline notes).

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

Cache discipline mirrors `resume-feature/notepads/dispatcher-loop.md` — STATIC `FROZEN_HEADER` computed once, DYNAMIC suffix rebuilt per iter. Kept minimal because new-feature typically runs 1–2 iters before handing off to `/resume-feature`.

```
# Computed ONCE before loop — STATIC bytes only; never mutate, never inject iter-specific values.
FROZEN_HEADER = "## Feature Context\nfeature-id: {feature-id}\ndocs-path: {docs-path}\nrepo-path: {repo-path}\noutput-mode: {output-mode}\nintel-path: {intel-path}".rstrip("\n")

loop:
  DYNAMIC_SUFFIX = "## Inputs\n(dispatcher reads current-stage from _state.md)"
  result = Task(
    subagent_type="dispatcher",
    prompt = FROZEN_HEADER + "\n\n" + DYNAMIC_SUFFIX
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
