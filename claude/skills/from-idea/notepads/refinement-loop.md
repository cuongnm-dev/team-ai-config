# Refinement Loop — Spiral-back + Cascade Refresh

Rules governing how user refines a spiral output, including rewinds to prior spirals (cascade refresh) and per-spiral iteration limits.

## Refinement vs Spiral-back

| Pattern | Scope | When |
|---|---|---|
| **In-spiral refinement** | Edit current spiral output, no impact on prior spirals | User says "let me revise this Impact Map" while in Spiral 2 |
| **Spiral-back (rewind)** | Return to prior spiral N (N < current), cascade refresh subsequent | User says "I need to fix PRFAQ" while in Spiral 3 |

## In-spiral refinement (max 2 backs per spiral)

Per spiral, user may iterate output up to 2 additional times (3 total: initial + 2 refinements). Beyond limit, force-decision menu kicks in (see `notepads/stop-conditions.md`).

Iteration counter: `_pipeline-state.json#steps.s{N}.iterations` (0-indexed for initial, 1 for first refinement, 2 for second).

Each iteration tracks:

```json
{
  "iteration": {N},
  "started_at": "{ISO}",
  "completed_at": "{ISO|null}",
  "trigger": "user-initiated | gate-failure | coherence-flag | sanity-check",
  "changes_summary": "{1-line description of what user changed}",
  "metrics_delta": {
    "deliverables_added": 0,
    "deliverables_removed": 0,
    "deliverables_modified": 0,
    "decisions_added": 0,
    "decisions_superseded": 0,
    "graveyard_added": 0
  }
}
```

Persist to `_pipeline-state.json#steps.s{N}.iteration_metrics[]`.

If `metrics_delta` shows degradation (e.g. `deliverables_removed > deliverables_added` AND quality scoring lower) for 2 consecutive iterations → suggest user "rollback to iteration {N-1} or full restart of spiral".

## Spiral-back (rewind)

Triggers:
- User explicitly requests "rewind to Spiral M" (M < current)
- Phase 0.0 Resume Detection — user picks "Rewind to Spiral X"
- Coherence check fails at G3/G4 with reconciliation path-a (edit Source A) chosen
- Phase 5 semantic audit fails a rule that traces back to a specific spiral

Behavior:

```
1. Confirm rewind:
   "Rewind sẽ đánh dấu Spiral {M..N} cần rerun. Decisions sau Spiral {M-1} sẽ marked
    `rolled-back` (giữ trong audit log, không xóa). Workshop docs `_idea/{spiral}.md`
    được preserve ở `_idea/.history/{spiral}-{ISO}.md`. Đồng ý?"
   
2. On user confirm:
   a. For each spiral i in {M..N} (current):
      - state["steps"][f"s{i}"]["status"] = "rerun-needed"
      - state["steps"][f"s{i}"]["iterations"] = 0
      - state["steps"][f"s{i}"]["iteration_metrics"] = []
   b. For each decision d in state["decisions"] where d.spiral in {M..N}:
      - d.status = "rolled-back"
      - (preserve d in array — append-only, never delete)
   c. Move workshop docs:
      - For each file in _idea/{spiral}.md where {spiral} ∈ {M..N}:
          mv to _idea/.history/{spiral}-{ISO}.md
   d. Clear recap_ledger[] entries with at_spiral >= M
   e. Append to decisions[]:
      {
        "id": "D-rewind-{ISO}",
        "spiral": "0.0|gate-G{N}|...",
        "topic": "rewind",
        "value": f"Rewound to Spiral {M} at {ISO}",
        "why": "{user-supplied reason}",
        "considered_alternatives": [],
        "confidence_pct": null,
        "assumptions": [],
        "status": "active",
        "timestamp": "{ISO}"
      }
   f. Append to coherence-log.md:
      "## C-rewind-{ISO} — Rewound to Spiral {M}
       - Reason: {reason}
       - Affected spirals: {M..N}
       - Decisions rolled back: {count}"

3. Continue execution from Spiral M (re-enter with `iterations=0`).
```

## Cascade refresh policy

When user rewinds to Spiral M:
- Subsequent spirals (M+1..current) MUST be re-derived from new Spiral M output
- This is HARD policy: cannot copy old M+1..N output; must re-run interview to produce new ones
- Reasoning: Spiral M output changed, dependent decisions are no longer trustworthy

User cannot say "rewind PRFAQ but keep my Impact Map and Story Map as-is". Skill enforces re-interview.

EXCEPTION: idea-graveyard entries are NOT touched by rewind. They remain accessible for resurrect, regardless of cascade refresh state.

## Compare-mode after cascade rerun

After rewind to Spiral M and re-running M..N, skill offers compare:

```
✅ Cascade refresh complete. Spirals {M..N} re-derived.

Compare with prior version (preserved in _idea/.history/)?
  (a) Yes — render side-by-side diff: 
       new {spiral}.md  ↔  .history/{spiral}-{ISO_prior}.md
       Highlights changes (decisions added/removed/modified, deliverables shifted, ...)
  (b) No — proceed forward, prior versions remain in .history/
```

Compare mode helps user notice unintended drift from prior version (e.g. accidentally lost a deliverable they wanted to keep).

## Coherence flag triggering rewind

When coherence check at G3/G4 fails with path-a reconciliation:

```
User: "I'll edit Source A (Spiral M)" → triggers rewind protocol
```

Auto-determine M from rule failure:
- G3-R1 (actor mismatch) → rewind to S2 (actor-registry seed)
- G3-R2 (orphan aggregate) → rewind to S2 OR S3 (user's choice — depends on which is "wrong")
- G3-R3 (assumption contradiction) → rewind to S1 (PRFAQ)
- G4-R1 (orphan story) → rewind to S2 (deliverable list incomplete)
- G4-R2 (orphan must-have) → rewind to S2 OR S3
- G4-R3 (persona inconsistency) → rewind to S1 (PRFAQ persona) OR S4 (story roles)

Skill suggests M based on rule but lets user override.

## Phase 5 semantic audit triggering rewind

If Phase 5 Step 5.2 fails any of 5 rules, present rewind option:

```
⚠️ Semantic audit failed Rule {N}: {rule description}.

Choose:
  (a) Rewind to Spiral {suggested-M} to fix at source
      → cascade refresh policy applies
  (b) Manual fix in current workshop file (_idea/{spiral}.md)
      → re-run audit after edit
  (c) Cancel session — fix offline, resume later
```

Path (b) is allowed but tracks `manual_fix_applied: true` for audit. Path (a) is cleaner.

## Refinement metrics (quality signal)

Track per-iteration:

```python
quality_score(iteration) = (
    coverage(decisions[].value not null and not [CẦN BỔ SUNG]) * 0.4 +
    confidence_avg(decisions[].confidence_pct) * 0.3 +
    coherence(no flags raised in this iteration) * 0.2 +
    consistency(prior iteration alignment) * 0.1
)
```

If quality_score(N) < quality_score(N-1) − 0.1 (10% degradation) for 2 consecutive iterations → suggest rollback.

## Rollback within spiral

In addition to forward iteration, user can rollback to a prior iteration of same spiral:

```
User: "I think iteration 1 was better than iteration 2. Can we go back?"

Skill: confirms, then:
- Restore decisions[] entries created in iteration 2 → status="rolled-back"
- Restore workshop file from _idea/.history/{spiral}-iter-1-{ISO}.md (if preserved)
- Reset state["steps"]["s{N}"]["iterations"] = 1
- Continue from iteration 1 endpoint
```

Each iteration's workshop file IS preserved in `_idea/.history/{spiral}-iter-{i}-{ISO}.md` automatically.

## Anti-patterns

- Allowing cascade rerun to "skip" subsequent spirals — must re-interview, not copy
- Discarding history files on rewind — always preserve in `_idea/.history/`
- Treating in-spiral refinement same as rewind (in-spiral has NO cascade impact)
- Auto-suggesting rollback without user confirmation
- Resetting iteration counter without logging the rewind event in decisions[] (audit trail integrity)
- Accepting rewind beyond the actually-completed spirals (e.g. "rewind to Spiral 5 from Spiral 3" — reject, "rewind only allows going BACKWARD")
