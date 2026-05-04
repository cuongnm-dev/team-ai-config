# Cognitive Aids — Mode B Doctrines

Six prompting doctrines that turn `from-idea` from "voice recorder" into "thinking partner". Applied throughout all 4 spirals + Phase 4.5. Each doctrine has: when to apply, template prompt, output capture format.

## Doctrine B1 — Echo + Paraphrase

**Purpose:** force user to "hear themselves back" through a different lens, surface vague phrasing.

**When to apply:**
- After every substantive answer (≥ 30 chars)
- Especially after PRFAQ Q1.1.1 (headline), Q1.2.1 (persona), Spiral 2 actor + impact statements

**Template:**

*"Tôi nghe bạn nói: `{X — verbatim quote}`. Diễn giải lại: bạn muốn `{Y — paraphrase in different words}`. Đúng intent của bạn không?"*

**Capture format:**
- If user confirms: log original answer in `decisions[]` `value` field
- If user corrects: log original AS WELL AS corrected; flag the delta (indicates initial articulation was unclear — useful for confidence calibration)

**Anti-pattern:** repeating user's words verbatim without paraphrasing — that's transcription, not partnering.

---

## Doctrine B2 — Generative Alternatives

**Purpose:** prevent skill from "yes-and"-ing every user direction. Force articulation of why X is better than non-X.

**When to apply:**
- Before locking any major direction (vision approach, deliverable, MVP cut, BC grouping)
- Spiral 1 Q1.1.3 (solution paragraph) — propose 2 alternatives
- Spiral 2 Step 2.4 (deliverables) — mandatory per deliverable
- Spiral 3 Step 3H.6 (BC grouping) — mandatory if Heavy mode
- Spiral 4 Step 4.3 (MVP cut) — propose 1 alternative slice

**Template:**

*"Hướng `{X — current proposal}` là 1 trong nhiều approach. 2 alternatives:*
*(a) `{contrarian — opposite direction}` — pros: `{...}`, cons: `{...}`*
*(b) `{KB-pattern — from prior project / industry pattern if known}` — pros: `{...}`, cons: `{...}`*
*Vì sao bạn chọn `{X}` thay vì (a) hoặc (b)?"*

**Generation rules for alternatives:**
- (a) MUST be genuinely different (not a trivial variation). Test: would (a) lead to a different MVP cut?
- (b) SHOULD reference real pattern (warm-start cache, industry case, OSS project). If no reference available, skip (b) and just present (a).
- DO NOT propose strawman alternatives that are obviously inferior — user will dismiss without thinking.

**Capture format:**

```json
{
  "id": "D-NNN",
  "topic": "deliverable",
  "value": "{X — chosen}",
  "considered_alternatives": [
    {"option": "{a-text}", "pros": [...], "cons": [...], "rejection_reason": "{why}"},
    {"option": "{b-text}", "pros": [...], "cons": [...], "rejection_reason": "{why}"}
  ],
  "why": "{user's articulated reasoning}",
  "confidence_pct": {pct},
  ...
}
```

**Anti-pattern:** proposing only 1 alternative — too easy to dismiss. Always 2.

---

## Doctrine B3 — Multi-perspective Stress Test

**Purpose:** lose tradeoffs visible only from one angle. Force user to mentally "wear different hats".

**When to apply:**
- Spiral 2 Gate G2 (mandatory, light version)
- Spiral 4 Step 4.5 (mandatory, full 3-perspective version)

**Template (G2 light):**

*"Bạn có đang miss perspective nào không — ví dụ accessibility users, non-power users, mobile-only users, regulatory compliance?"*

**Template (G4 full):**

*"Cùng output {Spiral N artifact} này, nhìn từ 3 góc:*
*(a) **Engineer phải build:** Có gì lo về dependency / spike / unknown? Story-points tổng có realistic không?*
*(b) **End user dùng MVP:** Slice này deliver giá trị tối thiểu chứ? Hay vẫn 'half-baked'?*
*(c) **CFO duyệt ngân sách:** Effort {tổng SP × cost-per-SP} so với expected revenue/value — ROI ổn không?*
*Mỗi góc trả lời ngắn 1-2 câu."*

**Capture format:**

```json
{
  "id": "D-NNN",
  "topic": "perspective-{engineer|user|cfo|other}",
  "value": "{user's response}",
  "spiral": "s2|s4",
  ...
}
```

If any perspective answer surfaces meaningful change → trigger refinement loop (back to relevant step) before user advances.

**Anti-pattern:** accepting "all perspectives are fine" without specific concrete observations from each. Push for concrete.

---

## Doctrine B4 — Assumption Surfacing

**Purpose:** surface implicit assumptions before they break the project. Brainstorm-only workflows are most prone to optimism bias.

**When to apply:**
- Spiral 1 Step 1.4 (mandatory exit gate — 3 assumptions minimum)
- Phase 4.5 Step 4.5.5 (refinement of Spiral 1 assumptions + new ones from success pathways)
- Whenever user says "obviously X" / "everyone knows X" / "of course X" — push for verification status

**Template (Spiral 1 Step 1.4):**

*"Mọi sản phẩm dựa trên giả định ngầm. Nếu giả định sai → sản phẩm sụp. List 3 giả định LỚN nhất bạn đang đặt:*

```
A1: {assumption text}
    Nếu sai → hậu quả: {what breaks}
    Đã verify chưa? Y/N
    Nếu N → cách verify: {test/data/research needed}

A2: ...
A3: ...
```

*Giả định LỚN khác `chi tiết feature`. Ví dụ: 'User sẵn sàng trả $X/tháng' (lớn) vs 'Button màu xanh' (chi tiết)."*

**Capture format:**

```json
{
  "id": "D-NNN",
  "topic": "assumption",
  "value": "{assumption text}",
  "consequence_if_false": "{what breaks}",
  "verified": "yes|no",
  "verify_method": "{test/data/research}",
  "spiral": "s1|s4.5",
  ...
}
```

Append to `_idea/assumptions.md` and `feature-catalog.features[].assumptions[]` (when feature is identified at Spiral 4).

**Anti-pattern:** accepting generic assumptions ("we'll succeed", "users will love it") — push for falsifiable specifics.

---

## Doctrine B5 — Quantitative Scaffolding

**Purpose:** convert "vibes" into "evidence". Force quantification at decision points.

**When to apply:**
- Spiral 1 Q1.1.2 (user count Fermi estimate)
- Spiral 1 Q1.3.5 (success metric baseline + target)
- Spiral 2 Step 2.1 (Goal achievability threshold)
- Spiral 2 Step 2.4 (deliverable effort estimate S/M/L)
- Spiral 4 Step 4.3 (MVP effort total)
- Spiral 4 Step 4.4 (story points per story)
- Phase 4.5 Step 4.5.2 (success pathway metric)

**Template:**

*"Cho tôi 1 con số. Nếu khó định lượng chính xác, ít nhất là baseline + target hoặc Fermi estimate (top-down sanity check):*
*  - Range: nhỏ (< X) / vừa (X – Y) / lớn (> Y)*
*  - Hoặc: 'cùng order-of-magnitude với {known reference}'"*

**Fermi estimate guide (Spiral 1 user count):**
- nhỏ: < 10K (niche, specialist tool)
- vừa: 10K – 1M (mid-market SaaS, regional gov tool)
- lớn: > 1M (mass-consumer, national gov tool)

**S/M/L story-point reference:**
- S: ≤ 3 person-days (1 dev, < 1 sprint)
- M: 3-10 person-days (1 dev, 1-2 sprints)
- L: > 10 person-days (multi-dev OR multi-sprint)

**Capture format:**

```json
{
  "id": "D-NNN",
  "topic": "{user-count|success-metric|effort|...}",
  "value": "{number or range}",
  "estimation_method": "{exact|fermi|order-of-magnitude}",
  "reference_anchor": "{known reference if order-of-magnitude}",
  "confidence_pct": {pct},
  ...
}
```

**Anti-pattern:** accepting "không biết, sẽ research sau" — push for at least Fermi range. If user truly cannot estimate, mark `[NEEDS-VALIDATION]` and surface as risk.

---

## Doctrine B6 — Confidence Calibration

**Purpose:** honest reckoning with uncertainty. Triggers `[NEEDS-VALIDATION]` flags that propagate to feature-catalog.

**When to apply:**
- After every quantitative answer (B5) — calibrate the number
- After every solution approach commitment (B2) — calibrate the choice
- Spiral 2 DEDUP verdict — calibrate the platform match
- Phase 4.5 mitigation idea — calibrate "will this actually mitigate?"

**Template:**

*"Bạn confident bao % rằng `{statement}` đúng / sẽ work?"*

**Threshold actions:**
- ≥ 80%: log as-is, no flag
- 50-80%: log, suggest "consider verification step in Phase 4.5 risk register"
- < 50%: MANDATORY `[NEEDS-VALIDATION]` flag in `decisions[]` AND propagate to `feature-catalog.features[].validation_flags[]`

**Capture format:**

```json
{
  "id": "D-NNN",
  "topic": "{...}",
  "value": "{...}",
  "confidence_pct": {0-100},
  "needs_validation": {true if < 50},
  "validation_method": "{if needs_validation, how to test}",
  ...
}
```

In Phase 6 handoff summary, count `[NEEDS-VALIDATION]` items and surface to user as "open validation work" before SDLC starts.

**Anti-pattern:** treating confidence as binary (sure/unsure) — push for actual percentage. Pattern of always answering "100%" is itself a flag (overconfidence).

---

## Recap Header Template (rendered at every spiral entry)

```
─── Spiral {N} · {workshop name} ─────────────────────────
✓ Đã chốt:    {bulleted list of decisions[].status="active" from prior spirals}
◐ Đang quyết: {bulleted list of topics this spiral will produce}
○ Để sau:     {bulleted list of topics deferred to subsequent phases}
```

Compute live from `_pipeline-state.json#decisions[]` filtered by status. Render at:
- Spiral 1 entry (mostly empty `Đã chốt`)
- Spiral 2 entry (PRFAQ outputs)
- Spiral 3 entry (PRFAQ + Impact Map outputs)
- Spiral 4 entry (PRFAQ + Impact Map + Event Storming outputs)
- Phase 4.5 entry (full PRFAQ + Spirals 2-4 outputs)
- Phase 5 entry (everything)

Recap header serves as cognitive anchor — user sees "where we are" before jumping in.

---

## Sanity check at iteration 2 (mid-spiral)

When `_pipeline-state.json#steps.s{N}.iterations >= 2` (user is in 3rd round of refinement):

Insert sanity check question:

*"Tạm dừng — chúng ta đang ở vòng {iteration} của Spiral {N}. Mình muốn check 1 phát:*
*Decision gần nhất là: `{last decision value}`.*
*Decision này có còn solid hay đây là dấu hiệu decision fatigue / scope creep / mất hướng?*
*(a) Vẫn solid, tiếp tục*
*(b) Mệt rồi, nghỉ — save state, quay lại sau*
*(c) Mất hướng, rewind to Spiral {M} (M < N)"*

Check applied automatically at iteration 2 entry, max once per spiral (don't nag).

---

## Cross-doctrine integration matrix

| Spiral | B1 echo | B2 alt | B3 perspective | B4 assumption | B5 quant | B6 confidence |
|---|---|---|---|---|---|---|
| 1 PRFAQ | ✓ Q1.1.1, Q1.2.1 | ✓ Q1.1.3 | (deferred to G2) | ✓ Step 1.4 mandatory | ✓ Q1.1.2, Q1.3.5 | ✓ Q1.3.5 |
| 2 Impact Map | ✓ actor names, impacts | ✓ deliverables (mandatory) | ✓ G2 light | (touched via DEDUP confidence) | ✓ Step 2.1, 2.4 | ✓ DEDUP verdict |
| 3 Event Storming | ✓ ambiguous events | ✓ BC grouping (Heavy) | (deferred to G4) | (via coherence rule G3-R3) | ✓ event count | ✓ BC mapping (Heavy) |
| 4 Story Map | ✓ backbone, stories | ✓ MVP cut alternative | ✓ Step 4.5 mandatory full | (implicit in AC) | ✓ MVP effort, story points | ✓ priority assignment |
| 4.5 Pre-mortem | ✓ failure narrative, success narrative | ✓ mitigation idea | (already done G4) | ✓ Step 4.5.5 mandatory | ✓ pathway metric | ✓ mitigation strength |

Total doctrine applications: ≥ 24 mandatory touchpoints across the pipeline.

---

## Anti-patterns (universal)

- **Yes-and** — accepting every user statement without applying B1/B2 is the cardinal sin of "voice recorder mode"
- **Question parade** — asking too many questions at once breaks user flow. Apply doctrines in micro-loops (1-2 questions, then synthesize)
- **Skip on-time-pressure** — never skip B3 G4 or B4 Step 1.4 to save time. They are highest-ROI critical-thinking pass
- **Symbol pollution** — Mode B output schema fields like `considered_alternatives[]`, `why`, `confidence_pct` are MANDATORY in `decisions[]` entries. Skill must populate them; partial entries flag in audit
