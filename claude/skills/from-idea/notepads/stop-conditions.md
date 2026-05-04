# Stop Conditions — Per-spiral and Cross-cutting

Rules that govern when to stop pushing for more depth in a spiral, when to force decision, when to suggest break, when to abort. Prevents the skill from becoming an infinite question generator and respects user's cognitive bandwidth.

## Three classes of stop conditions

| Class | Trigger | Action |
|---|---|---|
| **Soft stop** | Diminishing return signal | Accept current state with `[CẦN BỔ SUNG]`, suggest defer, continue spiral |
| **Force decision** | Iteration limit reached without convergence | Present 3-option menu: Confirm-with-gaps / Cancel / Continue-iterate (with warning) |
| **Hard abort** | Critical fail mode | Stop pipeline, surface error, recommend rewind or abort |

## Soft stop — Diminishing return detection

Trigger when ANY of:
- User answers "không biết / không có / chưa nghĩ tới / không chắc" 3 consecutive questions in same step
- User answer length drops > 70% from prior answers (e.g. 200-char answer → 30-char answer for 2 consecutive questions)
- User asks "có cần thiết không?" or expresses doubt about question relevance ≥ 2 times in 1 step

Action:
- Accept current field as-is OR mark `[CẦN BỔ SUNG]`
- Move to next step (do not push deeper on current step)
- Log soft-stop event to `_pipeline-state.json#steps.s{N}.soft_stops[]`

NOT a failure — just respects user's bandwidth signal. Continue spiral with what's known.

## Force decision — Iteration limit

Each spiral has max iterations:
- Spiral 1, 2, 3, 4: max **2 backs** (= 3 total iterations: initial + 2 refinements)
- Phase 4.5: max **1 iteration** (single pass)
- Phase 5: no iteration concept (linear)

When `_pipeline-state.json#steps.s{N}.iterations >= 2` (or `>= 1` for Phase 4.5) AND user requests another refinement:

```
⚠️ Spiral {N} đã iterate {N} lần mà chưa hội tụ. Mình đề xuất 1 trong 3:

(a) Confirm hiện trạng — chấp nhận output spiral này with `[CẦN BỔ SUNG]` markers
    cho fields chưa rõ. SDLC sau có thể fill thêm via /intel-fill.

(b) Cancel session — pause toàn bộ. State đã save, có thể resume sau khi nghĩ thêm.
    Recommend nếu bạn cảm thấy stuck hoặc thiếu thông tin nền.

(c) Continue iterate (vòng {N+1}) — mình sẽ tiếp tục, NHƯNG cảnh báo:
    iteration kéo dài thường là dấu hiệu (1) câu hỏi sai, (2) thiếu evidence,
    (3) decision fatigue. Cân nhắc (a) hoặc (b) trước.
```

User picks one. Skill respects choice — does NOT auto-continue beyond limit.

Persist: `_pipeline-state.json#steps.s{N}.force_decision_outcome: "confirm-with-gaps|cancel|continue-with-warning"`.

## Hard abort — Critical fail modes

Skill MUST stop pipeline (cannot continue) when:

| Condition | Detected at | Recovery |
|---|---|---|
| `_meta.json` shows artifact stale that this skill needs to write | Phase 0 Bootstrap | Run `/intel-refresh` first, then re-invoke from-idea |
| Feature-id collision (same ID exists in feature-map.yaml from prior project) | Phase 5 Step 5.3 | Investigate: was prior `from-idea` or `from-doc` run on this workspace? Recommend `/resume-feature` for existing OR rename workspace |
| `intel-validator --quick` returns ERROR | Phase 5 Step 5.8 | Surface validator diagnostics, user fixes manually (likely workshop file edit) and retries |
| User answers blocking questions with `[CẦN BỔ SUNG]` > 30% of total fields | Any spiral | Recommend offline clarification (talk to stakeholders, gather data) before resume |
| MCP `etc-platform` UP but `intel_cache_lookup` returns malformed/error response repeatedly | Phase 0 Bootstrap | Continue with cold-start (skip warm-start) — non-blocking after retry |
| DEDUP gate: REJECT verdict on > 50% of deliverables | Spiral 2 G2 | Recommend scope reduction (most of the proposed scope overlaps shared platforms) |
| Phase 5 semantic audit fails ANY of 5 rules | Phase 5 Step 5.2 | Surface specific failure, present reconciliation menu, do not auto-resolve |
| Pre-mortem: > 50% failure modes are unmitigated severity ≥ medium | Phase 4.5 Gate G4.5 | Surface warning, recommend either rewind to Spiral 4 (reduce scope) or accept high-risk profile (logged) |

Hard abort always:
- Saves state (skill is resumable)
- Logs the failure mode to `_pipeline-state.json#steps.s{N}.hard_abort_reason`
- Provides specific next-action user can take

## Fatigue gate (per spiral time-budget)

Track `spiral_start_at` timestamp per spiral. When elapsed time exceeds threshold:

| Spiral | Soft warning | Hard suggestion (mandatory pause) |
|---|---|---|
| Spiral 1 PRFAQ | 25 min | 40 min |
| Spiral 2 Impact Map | 35 min | 50 min |
| Spiral 3 Light | 20 min | 30 min |
| Spiral 3 Heavy | 45 min | 60 min |
| Spiral 4 Story Map | 45 min | 60 min |
| Phase 4.5 Pre-mortem | 20 min | 30 min |

At soft warning, surface:

*"⏱️ Đã `{elapsed}` phút trên Spiral {N}. Bạn có muốn tiếp tục, hay nghỉ giải lao 5-10 phút trước khi đi sâu hơn? State đã save tự động."*

At hard suggestion (if user chose to continue past soft warning):

*"⏱️ Đã `{elapsed}` phút — vượt threshold cho Spiral {N}. Mạnh mẽ đề xuất nghỉ. Continue-after-warning sẽ ghi `fatigue-override: true` vào audit trail để sau audit truy được."*

User can override with explicit confirm. Persist `fatigue_overrides[]` for retrospective review.

## Scope creep detection (Spiral 4 only)

Compute at Spiral 4 G4 entry:

```python
must_have_count = len([s for s in stories if s.priority == "must-have"])
win_conditions = len(prfaq.success_metrics)
ratio = must_have_count / win_conditions
```

| Ratio | Action |
|---|---|
| ≤ 2 | OK, proceed |
| 2 < ratio ≤ 3 | Soft warning at G4: "MVP có vẻ rộng — confirm chứ?" |
| 3 < ratio ≤ 5 | Hard warning + force decision: "Scope creep nghiêm trọng. Cắt bớt hay accept với explicit rationale?" |
| > 5 | Hard abort: "MVP scope quá rộng. Recommend rewind to Spiral 2 để re-prioritize deliverables." |

Persist `_pipeline-state.json#steps.s4.scope_creep_ratio`.

## Universal anti-loop (cross-cutting)

Per-spiral hard cap on total questions asked: **30 questions**. Beyond this, skill refuses additional iteration regardless of user input — forces decision.

Reasoning: brainstorm with > 30 questions per spiral is almost certainly stuck on details that should be deferred to SDLC stages (ba/sa). Spiral is for high-level capture, not exhaustive design.

## Stop condition logging

Every stop event logged to `_pipeline-state.json#steps.s{N}.stop_events[]`:

```json
{
  "type": "soft|force-decision|hard-abort|fatigue-warning|fatigue-hard|scope-creep",
  "triggered_at": "{ISO}",
  "context": "{step or field where triggered}",
  "user_action": "confirm-with-gaps|cancel|continue|defer|override",
  "outcome": "{description}"
}
```

Visible in Phase 6 handoff summary as `Brainstorm session quality metrics`:

```
📊 Session quality:
  • Soft stops: {N} (lower = stronger conviction)
  • Force decisions: {N}
  • Fatigue overrides: {N} (each = potential decision-fatigue artifact, review during SDLC)
  • Scope creep ratio: {ratio} ({verdict})
  • Total questions answered: {N}
  • Iterations per spiral: [{s1}, {s2}, {s3}, {s4}]
```

## Anti-patterns

- Pushing past soft-stop signal — disrespects user bandwidth, produces low-quality answers
- Auto-continuing past iteration limit — turns force-decision into pseudo-infinite loop
- Skipping fatigue gate — leads to decision-fatigue artifacts in feature-catalog
- Treating hard abort as recoverable in-skill — some failures need external context (talk to stakeholder, gather data, deprecate platform check)
- Logging stop events but not surfacing in Phase 6 — user can't learn from session quality without visibility
