# Micro-Checkpoint Pattern

Reusable pattern invoked at the end of **every** phase. Replaces the old batched interview rounds (R1/R2/R3) + gates (Gate 0/A/B) with per-phase course-correction checkpoints.

## Rationale

- **Token efficiency**: user context is captured when LLM still has the phase in working memory, not batched at the end. Next phase's LLM prompt starts with user-confirmed facts, not reconfirmed old claims.
- **Early course-correction**: catching a wrong adapter / wrong cluster / wrong naming in Phase 1 costs one phase's tokens. Catching it after Phase 6 costs all six.
- **Lower interview burden**: typical path is 1 tap ("looks good, continue") per phase. Heavy context gathering only when user actively has something to add.
- **Forward-looking**: each checkpoint not only confirms current phase but also **collects context for the NEXT phase**, so the next phase starts with richer intent.

## Template

Every phase ends with this 4-step micro-checkpoint:

```
═══════════════════════════════════════════════════
 ✅ Phase {N} complete — {one-line summary}
═══════════════════════════════════════════════════

Key findings:
  - {3-5 bullet points, very short}

Before Phase {N+1} ({next-phase-name}), any of these to guide it?

AskUserQuestion (max 4 options, always include "Continue" as option 1):
  1. "▶️ Continue — output looks right"
  2. "{forward-looking option A}"
  3. "{forward-looking option B}"
  4. "✏️ Fix current phase output first"
```

## Forward-looking option library

Each phase has its own set of options. See per-phase playbooks. Common patterns:

| Phase boundary | Typical forward-looking options |
|---|---|
| After P0 (preflight) | Exclude folders? Focus services? Specific ignore patterns? |
| After P1 (harvest) | Domain vocabulary? Module boundary hint (DDD / by team / by feature)? Deprecated code to exclude? Stack context (legacy external systems)? |
| After P2 (feature synthesis) | Rename features? Override status for specific features? Add planned features? Flag "out of scope" modules? |
| After P3 (validation) | Auto-fix HIGH issues? Ignore specific checks? Strict mode? |
| After P4 (architecture diagrams) | Domain boundaries (core vs supporting vs generic)? Mark integrations as legacy/core/planned? Additional NFR constraints? |
| After P5 (architecture merge) | Review arch-brief sections? Add/remove ADR candidates? |
| After P6 (scaffold + brief) | Adjust feature IDs / PREFIX? Confirm stage routing per feature? Block specific features from `_state.md` emission? |

## Fix-current-phase handling

If user picks "✏️ Fix current phase output first":
1. Show a second AskUserQuestion with phase-specific edit options (max 4)
2. User picks edit → collect input → re-dispatch phase sub-step OR apply inline fix
3. Re-display phase summary
4. Return to micro-checkpoint (iteration counter in state)

Iteration bound: **2 per phase** (not 3 — faster). After cap → forced 2-option (proceed-with-known-gaps / cancel).

## Forward-context persistence

Every answer user gives feeds two places:
1. **Immediate**: `state.config.interview_context.{phase_key}` — consumed by next phase's LLM prompt in the `## Feature Context` block
2. **Long-term**: `docs/intel/interview-log.md` — human-readable journal for audit/debug

Both atomic-writes before next phase starts.

## State record per phase

```json
{
  "steps": {
    "N": {
      "status": "done",
      "completed_at": "ISO",
      "mini_gate": {
        "iterations": 0,
        "user_choice": "continue | fix | forward-context-A | ...",
        "forward_context_keys": ["domain_vocab", "ddd_boundary"]
      }
    }
  }
}
```

## Anti-patterns to avoid

- ❌ Multi-question checkpoints (> 3 questions). If you need more, split into two micro-checkpoints.
- ❌ Re-asking what was already answered in earlier phase. State stores answers; re-reference, don't re-ask.
- ❌ Blocking "Continue" option (always option 1). Friction should be opt-in.
- ❌ Checkpoint without visible phase output summary. User needs context to decide.
- ❌ Forward-looking options irrelevant to NEXT phase. Each option must influence next-phase work.

## Retrofitting old gates

The original skill design had Gate 0 (after P2) / Gate A (after P5) / Gate B (after P6b). With micro-checkpoints these are absorbed:

| Old | New location |
|---|---|
| Gate 0 (stack confirmation) | P1 micro-checkpoint (forward-looking: stack context) |
| Gate A (feature confirmation) | P2 micro-checkpoint (forward-looking: renaming, status override) |
| Gate B (architecture + NFR) | Split across P4 micro-checkpoint (domain boundaries) + P5 micro-checkpoint (NFR + ADR) |

The heavy interview content (stack-context.md, arch-context.md) still gets produced — just incrementally, via forward-looking context collection at each phase's end, rather than one batched session.
