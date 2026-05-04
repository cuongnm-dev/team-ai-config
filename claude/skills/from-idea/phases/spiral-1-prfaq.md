# Spiral 1 — PRFAQ (Press Release + FAQ)

Workshop pattern: **Amazon "Working Backwards"** — define the win condition before designing the solution.

Output: `{features-root}/_idea/idea-brief.md`

## Goal

Define vision + win condition + target user persona explicitly enough that all subsequent spirals (Impact Map / Event Storming / Story Map) can soundboard against it as "north star".

## Recap header (always render at entry)

```
─── Spiral 1 · PRFAQ ───────────────────────────────────────
✓ Đã chốt:    {decisions[].status="active" — empty for first iteration}
◐ Đang quyết: vision, win condition, target user, value proposition
○ Để sau:     actor list (Spiral 2), feature breakdown (Spiral 4),
              technical architecture (sa stage)
```

## Interview structure

### Step 1.1 — Press Release draft (3 fields)

Ask ONE question at a time. Apply Mode B doctrines (see `notepads/cognitive-aids.md`).

**Q1.1.1 — Headline (1 sentence, ≤ 80 chars):**
*"Nếu sản phẩm/dự án của bạn được công bố trên báo, headline 1 câu là gì? Hãy viết như Apple/Amazon — short, punchy, customer-centric."*

→ Apply **Echo + paraphrase**: *"Tôi nghe headline là `{X}`. Có nghĩa là {Y diễn giải}. Đúng intent của bạn không?"*

**Q1.1.2 — Sub-headline (problem + customer):**
*"Trong 2-3 câu: vấn đề bạn đang giải quyết là gì? Cho ai? Tại sao họ care?"*

→ Apply **Quantitative scaffolding**: *"Bạn ước lượng có bao nhiêu người gặp vấn đề này? Số sơ cấp (Fermi): nhỏ (< 10K) / vừa (10K-1M) / lớn (> 1M)?"*

**Q1.1.3 — Solution paragraph (HOW):**
*"Sản phẩm giải quyết vấn đề này thế nào? Mô tả 3-4 câu (KHÔNG quá technical)."*

→ Apply **Generative alternatives**: *"Cách tiếp cận này là 1 trong nhiều. Có 2 hướng khác bạn đã cân nhắc:* 
   *(a) Hướng đối nghịch: [tự nghĩ ra alternative đối ngược]*
   *(b) Pattern phổ biến: [reference từ KB hoặc industry pattern nếu biết]*
*Vì sao bạn chọn hướng hiện tại thay vì (a) hoặc (b)?"*
→ Log alternatives + reasoning to `decisions[]` with `topic: "solution-approach"`.

### Step 1.2 — Customer Quote (target user voice)

**Q1.2.1 — Persona definition:**
*"Mô tả 1 user điển hình: nghề nghiệp, độ tuổi, context dùng sản phẩm, frequency, pain hiện tại."*

→ Apply **Echo + paraphrase**: restate persona; user confirms.

**Q1.2.2 — Customer quote (1-2 sentences as if from real user):**
*"Viết 1-2 câu trích lời persona đó nói về sản phẩm SAU KHI dùng. Phải cảm xúc, cụ thể."*

Example (skill provides): *"Trước đây tôi mất 2 tiếng review code mỗi buổi sáng — giờ Sentinel báo lỗi pattern + suggest fix trong 5 phút, tôi quay lại làm việc thực sự."*

### Step 1.3 — FAQ (5 mandatory questions)

For each Q, force concrete answer (no hand-waving):

**Q1.3.1 — Why now?**
*"Tại sao bây giờ là thời điểm đúng? (market trend / tech maturity / regulation / user behavior shift)"*

**Q1.3.2 — Why us?**
*"Tại sao team/bạn là người làm được? (unique insight / capability / network / past success)"*

**Q1.3.3 — Why this approach?**
*"Tại sao hướng này — không phải hướng X hay Y?"* (link back to alternatives logged in 1.1.3)

**Q1.3.4 — What could fail?**
*"3 lý do có thể khiến dự án fail là gì?"* (sneak preview of Phase 4.5 pre-mortem; lighter version here)

**Q1.3.5 — Success metric:**
*"Sau 1 năm, bạn đo thành công bằng metric gì? Ngưỡng cụ thể là bao nhiêu?"*

→ Apply **Quantitative scaffolding** (mandatory): *"Cho tôi 1 con số. Nếu khó định lượng, ít nhất là baseline + target."*

→ Apply **Confidence calibration** (mandatory): *"Bạn confident bao % đạt được metric này trong 1 năm? Nếu < 50%, đây là `[NEEDS-VALIDATION]`."*

## Step 1.4 — Assumption surfacing (mandatory exit gate)

Before Gate G1, force user list 3 big assumptions:

*"Mọi sản phẩm dựa trên giả định ngầm. Nếu giả định sai → sản phẩm sụp. Hãy list 3 giả định LỚN nhất bạn đang đặt:"*

```
A1: {assumption text}
    Nếu sai → hậu quả: {what breaks}
    Đã verify chưa? Y/N
    Nếu N → cách verify: {test/data/research needed}

A2: ...
A3: ...
```

→ Append to `decisions[]` with `topic: "assumption"`. Cross-link in `assumptions.md`.

## Synthesis — write `idea-brief.md`

Template:

```markdown
---
type: idea-brief
spiral: 1
created: {ISO}
last-updated: {ISO}
producer: from-idea
---

# {Project Name} — Idea Brief

## 1. Press Release (Working Backwards)

### Headline
{Q1.1.1}

### Sub-headline
{Q1.1.2}

### Problem
{paraphrased from Q1.1.2 problem half}

### Customer
{paraphrased from Q1.1.2 customer half}

### Solution
{Q1.1.3}

### Customer Quote
> "{Q1.2.2}"
> — {persona name from Q1.2.1}

### Leadership Quote (placeholder — fill at launch)
> "[CẦN BỔ SUNG: 1 câu từ founder/CEO khi launch]"

## 2. Persona

**Name (synthetic):** {persona-name}
**Role/Job:** {Q1.2.1.role}
**Age range:** {Q1.2.1.age}
**Context:** {Q1.2.1.context}
**Current pain:** {Q1.2.1.pain}
**Frequency of use:** {Q1.2.1.frequency}

## 3. Why Now / Why Us / Why This Way

### Why Now
{Q1.3.1}

### Why Us
{Q1.3.2}

### Why This Approach
{Q1.3.3}

**Considered alternatives:**
- (a) {alternative-a from Q1.1.3 echo} — không chọn vì: {reason}
- (b) {alternative-b} — không chọn vì: {reason}

## 4. Success Metric

**Metric:** {Q1.3.5.metric-name}
**Baseline:** {Q1.3.5.baseline}
**Target (1 year):** {Q1.3.5.target}
**Confidence:** {Q1.3.5.confidence_pct}%
{if < 50%}: ⚠️ [NEEDS-VALIDATION]

## 5. Top 3 Failure Modes (preview — full pre-mortem at Phase 4.5)

1. {Q1.3.4.fail-1}
2. {Q1.3.4.fail-2}
3. {Q1.3.4.fail-3}

## 6. Critical Assumptions

| ID | Assumption | If false → | Verified? | Verify-by |
|---|---|---|---|---|
| A1 | {Q1.4.A1.text} | {consequence} | Y/N | {method} |
| A2 | {Q1.4.A2.text} | {consequence} | Y/N | {method} |
| A3 | {Q1.4.A3.text} | {consequence} | Y/N | {method} |

## 7. Visual Primer References (if Phase 0.5 used)

{list of files in _idea/visual-primer.md if any}

## 8. North-Star Affirmation

This document is the immutable anchor for Spirals 2-4. Subsequent spirals MUST align with:
- **Vision:** {Headline}
- **Target user:** {persona role}
- **Win condition:** {success metric}
- **Critical assumptions:** A1, A2, A3
```

## Gate G1 — Exit criteria

ALL must hold before advancing to Spiral 2:

- [ ] Headline ≤ 80 chars, customer-centric
- [ ] Solution paragraph 3-4 sentences
- [ ] Customer quote present, sounds like real user voice
- [ ] All 5 FAQ questions answered (no `[CẦN BỔ SUNG]` for these 5)
- [ ] Success metric has baseline + target + confidence%
- [ ] ≥ 3 critical assumptions logged with consequence + verification plan
- [ ] User confirms: *"Vision này là north star cho 3 spiral còn lại. Bạn solid với nó chứ?"*

If any not met after iteration 2 → force decision (Confirm with `[CẦN BỔ SUNG]` markers / Cancel session / Continue iteration despite warning).

## Mode B doctrine touchpoints (summary)

| Doctrine | Trigger in Spiral 1 |
|---|---|
| B1 Echo + paraphrase | After Q1.1.1 (headline), Q1.2.1 (persona) |
| B2 Generative alternatives | After Q1.1.3 (solution approach) |
| B3 Multi-perspective stress | (deferred to G2) |
| B4 Assumption surfacing | Step 1.4 (mandatory) |
| B5 Quantitative scaffolding | Q1.1.2 (user count), Q1.3.5 (metric) |
| B6 Confidence calibration | Q1.3.5 (success metric confidence) |

## Stop conditions

- User answers "không biết / không có / chưa nghĩ tới" 3 consecutive questions → defer those fields with `[CẦN BỔ SUNG]`, do not push further. Spiral 1 quality degrades but doesn't halt.
- Iteration count > 2 → force G1 decision menu (Confirm-with-gaps / Cancel)
- Time on spiral > 30 min → trigger fatigue gate (suggest break, save state)

## Idea-graveyard hooks

If user volunteers an idea but immediately rejects it ("hmm, không phải, bỏ"), CAPTURE to `idea-graveyard.md` before moving on:

```markdown
## G-001 — {idea title}
- Spiral: 1
- Captured at: {ISO}
- Reason for rejection: {user-supplied or "user discarded mid-thought"}
- Resurrect-trigger: {what context shift would make this relevant again}
```
