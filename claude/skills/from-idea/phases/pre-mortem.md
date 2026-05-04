# Phase 4.5 — Pre-mortem & Post-mortem

Mandatory critical-thinking pass between Spiral 4 (Story Map) and Phase 5 (Crystallize). Forces user to mentally project 1 year forward and reason backward — surfaces blind spots that linear forward thinking misses.

Output: `{features-root}/_idea/pre-mortem.md`

## Goal

Convert subconscious doubts and unspoken risks into:
1. **Risk register** — propagates to `feature-catalog.features[].risks[]`
2. **Success pathways** — strategic dependencies for win
3. **Refined assumptions** — augments `assumptions.md` from Spiral 1

This phase is mandatory and cannot be skipped. Cancel session is the only opt-out.

## Recap header

```
─── Phase 4.5 · Pre-mortem & Post-mortem ─────────────────
✓ Đã chốt:    Vision + win condition (PRFAQ)
              {N} actors + {M} deliverables (DEDUP-validated)
              {K} aggregates (event-storming)
              MVP slice = {P} must-have features ({SP} story-points)
              {A} critical assumptions
◐ Đang quyết: Top 3 failure modes, top 3 success pathways,
              risk register propagation
○ Để sau:     Crystallize (Phase 5), handoff (Phase 6)
```

## Step 4.5.1 — Pre-mortem (Failure projection)

**Question (mandatory):**

*"Tưởng tượng đã 1 năm sau khi launch MVP. Dự án đã FAIL — không đạt win condition `{success_metric}`, user không adopt, hoặc tệ hơn — sản phẩm gây harm.*

*Quay ngược về hiện tại, viết 'failure narrative': 3 lý do hàng đầu khiến nó fail là gì?"*

For each failure reason, force structured response:

```
F-1: {short failure narrative}
   Root cause category: 
     - PRODUCT (giải pháp không match nhu cầu)
     - MARKET (nhu cầu thật không tồn tại)
     - TEAM (capability/capacity sai)
     - EXECUTION (sai timing, sai go-to-market)
     - EXTERNAL (regulation, competitor, black swan)
   Probability (gut feel): low | medium | high
   Severity if happens: low | medium | high
   Linked feature(s) at most risk: [F-001, F-003, ...]
   Mitigation idea (1 line): {action that would prevent or reduce}
```

→ Apply **B1 Echo + paraphrase**: re-state user's failure narrative back; user confirms.
→ Apply **B6 Confidence calibration**: *"Bạn confident bao % rằng F-1 sẽ KHÔNG xảy ra (i.e. mitigation đủ mạnh)?"*

After 3 failure reasons captured, ask:

*"Còn lý do thứ 4-5 nào khác không, hay 3 cái này là chính?"* — proceed if user says enough.

**Cross-check vs Spiral 1 FAQ:**

PRFAQ Q1.3.4 already asked "What could fail?" but lighter. Compare answers:
- Same 3 reasons → user is consistent, confidence high
- Different reasons → context evolved (Spiral 2-4 surfaced new info), GOOD — capture both layers
- Less specific now → user fatigue, push for at least same level of detail
- More specific now → user thought deeper, GREAT, propagate refined version

Log delta in `_idea/coherence-log.md` if PRFAQ answer differs significantly.

## Step 4.5.2 — Post-mortem inverted (Success projection)

**Question (mandatory):**

*"Bây giờ tưởng tượng ngược lại — 1 năm sau, dự án THÀNH CÔNG vang dội. Win condition đạt 150% target. User mê. Team được khen.*

*Viết 'success narrative': 3 yếu tố quyết định khiến nó thành công?"*

For each success factor:

```
S-1: {short success narrative}
   Pathway category:
     - PRODUCT-FIT (giải pháp đúng quá)
     - DISTRIBUTION (cách reach user thắng)
     - TIMING (vào thị trường đúng lúc)
     - DIFFERENTIATION (khác biệt với competitor)
     - EXECUTION (team/process tốt)
     - LUCK (factor ngoài kiểm soát đã thuận)
   Required preconditions (assumptions that MUST hold):
     - {precondition 1}
     - {precondition 2}
   Linked feature(s) carrying this pathway: [F-001, F-005, ...]
   Effort to enable: low | medium | high
```

→ Apply **B5 Quantitative scaffolding**: *"Pathway này đo bằng metric gì? Threshold để biết 'enabled' chứ chưa cần succeeded?"*

## Step 4.5.3 — Symmetry check (post-mortem ↔ pre-mortem)

For each failure reason F-i, ask: *"Có success factor nào nếu đạt được sẽ neutralize F-i không?"*

Build mapping:

| Failure mode | Mitigated by success pathway | Mitigation strength |
|---|---|---|
| F-1 | S-2 | strong |
| F-2 | (none) | UNMITIGATED — flag |
| F-3 | S-1 + S-3 (combined) | medium |

**Unmitigated failure modes** (no success pathway covers them) become CRITICAL items in risk register — flag for `_state.md` Active Blockers section + `feature-catalog.features[].risks[]` with `severity: high`.

## Step 4.5.4 — Risk register propagation

For each failure mode F-i:
- For each "linked feature(s) at most risk" → append to `feature-catalog.features[].risks[]`:
  ```json
  {
    "id": "R-F-NNN-{seq}",
    "narrative": "{F-i narrative}",
    "category": "{category}",
    "probability": "low|medium|high",
    "severity": "low|medium|high",
    "mitigated_by": "S-{j}|null",
    "from": "phase-4.5/pre-mortem"
  }
  ```
- For unmitigated risks with severity high → also append to `_state.md` body section `## Active Blockers`

For each success factor S-j:
- For each "linked feature(s) carrying pathway" → append to `feature-catalog.features[].success_pathways[]`:
  ```json
  {
    "id": "P-F-NNN-{seq}",
    "narrative": "{S-j narrative}",
    "category": "{category}",
    "preconditions": ["...", "..."],
    "from": "phase-4.5/pre-mortem"
  }
  ```

## Step 4.5.5 — Assumption refinement

Compare PRFAQ assumptions (Spiral 1) vs new preconditions surfaced in S-1..3:

```
PRFAQ A-1: {original assumption}
S-2 precondition: {surfaced precondition}
Delta: same | refinement of A-1 | NEW assumption
```

If NEW assumption → append to `assumptions.md` and `feature-catalog.features[].assumptions[]`.

If refinement → update PRFAQ A-i in place, log change in `decisions[]` with `superseded_by`.

## Synthesis — write `pre-mortem.md`

Template:

```markdown
---
type: pre-mortem
phase: 4.5
created: {ISO}
producer: from-idea
linked-to: idea-brief.md, story-map.md
---

# Pre-mortem & Post-mortem: {Project Name}

## Section 1: Failure Modes (Pre-mortem)

### F-1: {short title}
- **Narrative:** {full narrative}
- **Root cause:** {category}
- **Probability:** {low|medium|high}
- **Severity:** {low|medium|high}
- **Most-at-risk features:** [F-001, ...]
- **Mitigation idea:** {action}
- **User's confidence in mitigation:** {pct}%

### F-2: ...

### F-3: ...

## Section 2: Success Pathways (Inverted Post-mortem)

### S-1: {short title}
- **Narrative:** {full narrative}
- **Pathway category:** {category}
- **Preconditions:** [{p1}, {p2}]
- **Carrying features:** [F-005, ...]
- **Effort to enable:** {low|medium|high}

### S-2: ...

### S-3: ...

## Section 3: Symmetry Check (F × S Mapping)

| Failure | Mitigated by | Strength |
|---|---|---|
| F-1 | S-2 | strong |
| F-2 | (none) | ⚠️ UNMITIGATED |
| F-3 | S-1 + S-3 | medium |

## Section 4: Critical (Unmitigated) Risks

{list F-i where mitigated_by = null with severity ≥ medium}

These propagate to:
- `feature-catalog.features[].risks[]` with severity=high tag
- `_state.md § Active Blockers` for affected features

## Section 5: Refined / New Assumptions

| Source | Assumption | Status | Verified by |
|---|---|---|---|
| PRFAQ A-1 (refined) | {updated text} | active | {method} |
| New (from S-2 preconditions) | {new text} | active | {method} |

## Section 6: Cross-link to Spiral 1 PRFAQ

PRFAQ Q1.3.4 (lighter pre-mortem):
- {original 3 fail reasons}

Phase 4.5 (deeper):
- F-1, F-2, F-3 (above)

Delta analysis: {summary of differences — note new failure modes surfaced after Spirals 2-4 enriched context}
```

## Gate G4.5 — Exit criteria

ALL must hold:

- [ ] 3 failure modes captured, each with category + probability + severity + mitigation idea
- [ ] 3 success pathways captured, each with category + preconditions + effort
- [ ] Symmetry mapping done (F × S)
- [ ] Unmitigated critical risks (severity ≥ medium with no S coverage) listed
- [ ] Risk register propagated to `feature-catalog.features[].risks[]`
- [ ] Success pathways propagated to `feature-catalog.features[].success_pathways[]`
- [ ] New/refined assumptions appended to `assumptions.md`
- [ ] Cross-link to PRFAQ Q1.3.4 with delta analysis
- [ ] User confirms: *"Risk register này phản ánh worst-case bạn cảm nhận chứ? Sang Phase 5 (Crystallize)?"*

If unmitigated severity-high count > 50% of total failure modes → STOP, present warning:

*"⚠️ Phần lớn failure modes bạn nêu KHÔNG có mitigation đủ mạnh. Trước khi crystallize, cân nhắc:*
*(a) Quay lại Spiral 4 để điều chỉnh MVP cut (giảm exposure)*
*(b) Quay lại Spiral 2 để rethink deliverables*
*(c) Tiếp tục crystallize nhưng flag rõ trong feature-catalog (high-risk profile)"*

## Mode B doctrine touchpoints

| Doctrine | Trigger in Phase 4.5 |
|---|---|
| B1 Echo + paraphrase | After each F-i + S-j narrative |
| B2 Generative alternatives | At mitigation idea: "Có cách mitigate khác không?" |
| B3 Multi-perspective stress | (already done in Spiral 4 G4) |
| B4 Assumption surfacing | Step 4.5.5 (mandatory) |
| B5 Quantitative scaffolding | Pathway metric, mitigation strength |
| B6 Confidence calibration | "Confidence trong mitigation %" |

## Stop conditions

- User answers vague (< 30 chars) on F-i or S-j → push for specificity once, then accept with `[CẦN BỔ SUNG]`
- Iteration > 1 → no second iteration on this phase; force decision (it's a 1-shot pass)
- Time > 30 min → fatigue gate; can split into 2 sessions (resume preserves state)

## Idea-graveyard hooks

When user surfaces a failure mode tied to a feature → may decide to demote/drop that feature:

```markdown
## G-NNN — {feature name}
- Spiral: 4.5
- Captured at: {ISO}
- Demotion/drop: {must-have → should-have | dropped}
- Reason: failure mode F-i shows feature high-risk
- Resurrect-trigger: if mitigation matures or risk profile changes
```

## Note on "skip pre-mortem"

Phase 4.5 is **mandatory by skill design**. User CANNOT skip. Reasoning: brainstorm-only workflows are most prone to optimism bias; pre-mortem is the cheapest critical-thinking pass that breaks the bias.

The only opt-out is `--skip-premortem` flag (recorded in `_pipeline-state.json#steps.4.5.status: "skipped-by-flag"`) — which:
- Logs to audit trail
- Sets all features `feature-catalog.features[].risks: [{narrative: "[CẦN BỔ SUNG: pre-mortem skipped at user request]", severity: "unknown"}]`
- Sets `feature-catalog._meta.warnings += ["pre-mortem-skipped"]`
- Surfaced in Phase 6 handoff summary

Default behavior: NEVER skip. Skill enforces.
