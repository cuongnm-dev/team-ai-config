# Spiral 2 — Impact Mapping

Workshop pattern: **Gojko Adzic Impact Mapping** — 4-tier mind-map (Goal → Actors → Impacts → Deliverables) tied to PRFAQ vision.

Output: `{features-root}/_idea/impact-map.md` + `{features-root}/_idea/dedup-report.md`

## Goal

Translate Spiral 1 vision/win-condition into a structured deliverable plan that:
- Identifies WHO (actors) we need to influence
- Specifies HOW their behavior must change (impacts)
- Lists WHAT we deliver to drive impact
- Validates each deliverable against KB ecosystem (DEDUP) — never reinvent shared platforms

## Recap header

```
─── Spiral 2 · Impact Mapping ──────────────────────────────
✓ Đã chốt:    Vision: "{idea-brief.headline}"
              Persona: {idea-brief.persona.role}
              Win condition: {idea-brief.success_metric}
              {N} critical assumptions logged
◐ Đang quyết: Goal SMART, actors, impacts, deliverables, DEDUP verdicts
○ Để sau:     Domain events (Spiral 3), MVP cut + TC seeds (Spiral 4),
              technical routes (sa stage)
```

## VN Gov context check (dispatch decision)

**FIRST QUESTION** (before any other Spiral 2 work):

*"Đây có phải dự án cho cơ quan nhà nước Việt Nam (Bộ/Tỉnh/Sở/Cục/đơn vị sự nghiệp công) không? Nếu có, mình sẽ dispatch agent `policy-researcher` tra cứu nền tảng dùng chung quốc gia (NDXP/LGSP/CSDLQG/VNeID) trong DEDUP gate; nếu không, chỉ chạy MCP DEDUP standard."*

If YES → set `_pipeline-state.json#steps.s2.policy_researcher_invoked = true`. Will dispatch in DEDUP step.
If NO → standard MCP DEDUP only. Skip policy-researcher.

## Interview structure

### Step 2.1 — SMART Goal (1 sentence, derived from PRFAQ win condition)

*"PRFAQ win condition là `{success_metric}`. Chuyển thành SMART goal cho 1 năm tới: Specific, Measurable, Achievable, Relevant, Time-bound."*

→ Apply **Echo + paraphrase**.
→ Apply **Confidence calibration**: *"Ngưỡng achievable là %?"*

Goal anchors all 3 lower tiers.

### Step 2.2 — Actor enumeration (Tier 2)

*"Để đạt goal, ai sẽ giúp (helpers) hoặc cản (hinderers)?"*

Categories to probe:
- **Primary helpers**: end users — những người dùng product trực tiếp
- **Supporting helpers**: ops, support, content moderators, admins
- **Internal helpers**: dev team, PM, executives
- **External helpers**: integration partners, vendors, gov bodies (if applicable)
- **Hinderers**: competitors, regulators (negative), users who'd abuse, status quo defenders

For each actor:
```
Actor: {name}
Type: internal | external | system | service | adversary
Influence on goal: helper-strong | helper-weak | hinderer-strong | hinderer-weak
```

→ Apply **MCP warm-start hint** (if Phase 0 cached actor-pattern): *"Project tương tự thường có actors {prior list}. Bạn có agree thêm vào không?"*

→ Apply **Multi-perspective stress test** (light): *"Bạn có đang miss perspective nào không — ví dụ accessibility users, non-power users, mobile-only users?"*

Min 1 actor required to advance. Multi-role projects expect ≥ 3.

### Step 2.3 — Impacts per actor (Tier 3)

For each actor, ask:

*"Để goal đạt được, {actor} cần thay đổi behavior thế nào?"*

Behavior change taxonomy (force user pick at least 1):
- **Do MORE of**: hành vi đã có nhưng cần tăng tần suất
- **Do LESS of**: cắt giảm
- **START doing**: hành vi mới
- **STOP doing**: ngưng hẳn

Impact statement format: *"{Actor} should {do-more|do-less|start|stop} {specific behavior} so that {micro-outcome}."*

Examples:
- "Users SHOULD START reporting code issues via in-tool button instead of Slack DM, so that issues become trackable."
- "Senior reviewers SHOULD DO LESS line-by-line bug-hunting, so that they free up time for architectural review."

→ Apply **Echo + paraphrase** for each impact.
→ Apply **Generative alternatives**: *"Behavior change này là 1 cách. Cách khác để đạt cùng micro-outcome là gì? Vì sao chọn cách này?"*

### Step 2.4 — Deliverables per impact (Tier 4)

For each impact, ask:

*"Chúng ta build/làm gì để khiến {actor} {impact} thực sự xảy ra?"*

Format:
```
Deliverable: {short name}
Target impact: {impact id}
Description: 1-2 sentences
Effort estimate (gut feel): S (≤ 1 sprint) | M (1-3 sprints) | L (> 3 sprints)
```

Each deliverable will become a **candidate feature** in feature-catalog.

→ Apply **Generative alternatives** (mandatory): *"Deliverable này là approach 1. 2 alternatives:*
*(a) [contrarian — vd: nudge thay vì build full feature]*
*(b) [adopt-existing — leverage shared platform thay vì build]*
*Vì sao chọn deliverable này thay vì (a)/(b)?"*
→ Log alternatives + reasoning in `decisions[]` with `topic: "deliverable"`.

### Step 2.5 — DEDUP gate (mandatory per CLAUDE.md ST-2)

For EVERY deliverable, run DEDUP per `notepads/dedup-protocol.md`. Algorithm summary:

```
1. Cache ecosystem context (read once):
   - MCP: mcp__etc-platform__kb_query(domain="ecosystem", max_age_days=90)
   - If MCP down → fallback Read ecosystem/{national-platforms,shared-services,ministry-systems}.md
   
2. For each deliverable:
   - Run 7-question checklist (see dedup-protocol.md)
   - If VN gov context (policy_researcher_invoked=true): dispatch agent policy-researcher
     for concrete NDXP/LGSP/CSDLQG/VNeID lookup
   - MCP: mcp__etc-platform__dedup_check(proposal={problem, solution_summary})
   - Assign verdict: UNIQUE | ADOPT | EXTEND | INTEG | REJECT

3. For non-UNIQUE deliverables:
   - Rewrite as integration/extension proposal
   - Update effort estimate (usually decreases)
   - Log original vs rewritten in dedup-report.md

4. Aggregate: append to dedup-report.md
   - MCP: mcp__etc-platform__dedup_register(proposal, verdict, rationale, ecosystem_ref) for each
```

→ Apply **Confidence calibration**: each deliverable's verdict carries confidence. *"Confidence vào verdict này: high (KB exact match) / medium (similar but not identical) / low (best guess)?"*

## Synthesis — write `impact-map.md`

Template:

```markdown
---
type: impact-map
spiral: 2
created: {ISO}
last-updated: {ISO}
producer: from-idea
linked-to: idea-brief.md, dedup-report.md
---

# Impact Map: {Project Name}

## Goal (SMART, derived from PRFAQ)

**Goal:** {Step 2.1 text}
**Confidence in achievability:** {pct}%
**Source:** idea-brief.md § Success Metric

## Tier 2: Actors

| ID | Actor | Type | Influence | Notes |
|---|---|---|---|---|
| AC-1 | {name} | internal | helper-strong | {1-line context} |
| AC-2 | ... | ... | ... | ... |

## Tier 3: Impacts (per actor)

### AC-1: {actor name}
- **I-1.1:** {actor} SHOULD {do-more/...} {behavior} so that {outcome}
- **I-1.2:** ...

### AC-2: {actor name}
- **I-2.1:** ...

## Tier 4: Deliverables (per impact)

### I-1.1: {impact text}
- **D-1.1.a:** {deliverable name} (effort: M) — DEDUP verdict: UNIQUE
  - Description: ...
  - Considered alternatives: (a) {alt} → rejected because {reason}; (b) {alt}
- **D-1.1.b:** {deliverable name} (effort: S) — DEDUP verdict: ADOPT (NDXP module X)
  - Original: "Xây hệ thống nội bộ"
  - Rewritten: "Tích hợp NDXP module X qua LGSP, không xây mới"
  - Cost impact: -60%

### I-1.2: ...

## Tier 1-4 Mind-Map (Mermaid)

```mermaid
mindmap
  root((Goal: {Goal text concise}))
    AC-1: {actor 1}
      I-1.1: {impact concise}
        D-1.1.a: {deliverable}
        D-1.1.b: {deliverable}
      I-1.2: ...
    AC-2: {actor 2}
      I-2.1: ...
```

## DEDUP Summary

- Total deliverables: {N}
- Verdict distribution: UNIQUE: X, ADOPT: Y, EXTEND: Z, INTEG: W, REJECT: V
- Reuse ratio (Y+Z+W)/N: {pct}%
- Full report: `dedup-report.md`

## North-Star Alignment Check (Gate G2)

- [ ] Each Goal directly serves PRFAQ win condition: ✓/✗ {note}
- [ ] Persona in PRFAQ matches Tier 2 primary actor: ✓/✗
- [ ] No deliverable contradicts PRFAQ "Why this approach": ✓/✗
- [ ] All 3 PRFAQ critical assumptions still hold: ✓/✗
```

## Visualization (Mermaid mind-map)

After Step 2.4, render Mermaid block in `impact-map.md` as shown in template. User can render in Cursor/VS Code or pasted to https://mermaid.live for visual review.

ASCII fallback (always render alongside Mermaid):

```
GOAL: {goal text — wrap at 60 chars}
├── ACTOR-1: {name}
│   ├── IMPACT I-1.1: {impact}
│   │   ├── D-1.1.a: {deliverable} [UNIQUE / S]
│   │   └── D-1.1.b: {deliverable} [ADOPT-NDXP / S]
│   └── IMPACT I-1.2: ...
└── ACTOR-2: {name}
    └── ...
```

## Gate G2 — Exit criteria

ALL must hold before advancing to Spiral 3:

- [ ] SMART Goal articulated with measurable target
- [ ] ≥ 1 actor (≥ 3 for multi-role projects); each tagged with type + influence
- [ ] Each actor has ≥ 1 impact
- [ ] Each impact has ≥ 1 deliverable
- [ ] EVERY deliverable has DEDUP verdict + rationale
- [ ] If verdict = REJECT → deliverable removed from impact map (or escalated to user for reframe)
- [ ] If verdict in {ADOPT, EXTEND, INTEG} → original vs rewritten both logged
- [ ] North-star alignment check passes (4 sub-checks above)
- [ ] **Multi-perspective stress test:** ask user one perspective shift before exit:
  *"Cùng impact map này, nhìn từ góc nhìn (a) Engineer phải build, (b) End user nhận giá trị, (c) CFO duyệt ngân sách — có deliverable nào nên cắt / thêm / sắp xếp lại priority không?"*
  → log feedback + revise if user changes mind
- [ ] User confirms: *"Impact map này solid chưa? Sang Spiral 3 (Event Storming)?"*

If any not met after iteration 2 → force decision menu.

## Mode B doctrine touchpoints

| Doctrine | Trigger in Spiral 2 |
|---|---|
| B1 Echo + paraphrase | After actor name (2.2), each impact (2.3) |
| B2 Generative alternatives | After each impact (2.3) and deliverable (2.4) |
| B3 Multi-perspective stress | At G2 exit gate (mandatory) |
| B4 Assumption surfacing | (touched lightly via DEDUP confidence) |
| B5 Quantitative scaffolding | Goal threshold (2.1), effort estimates (2.4) |
| B6 Confidence calibration | Goal achievability (2.1), DEDUP verdict (2.5) |

## Stop conditions

- User answers "không biết" 3 consecutive times on impacts/deliverables → defer that branch with `[CẦN BỔ SUNG]`
- DEDUP gate: REJECT verdict on > 50% deliverables → STOP, surface "scope is too overlapping with shared platforms; recommend rewrite or scale back" → user decides Restart vs Continue with smaller scope
- Iteration > 2 → force G2 decision menu
- Time on spiral > 45 min → fatigue gate

## Idea-graveyard hooks

When DEDUP verdict = REJECT and user agrees to drop deliverable:

```markdown
## G-NNN — {deliverable name}
- Spiral: 2
- Captured at: {ISO}
- Reason for rejection: DEDUP REJECT — {ecosystem_ref overlap}
- Resurrect-trigger: if shared platform deprecated OR if new differentiator emerges
```

When user changes mind on a deliverable mid-iteration:

```markdown
## G-NNN — {deliverable name}
- Spiral: 2
- Captured at: {ISO}
- Reason for rejection: user changed mind, prefers alternative D-X.X.x
- Resurrect-trigger: if D-X.X.x fails / if scope expands
```

## Coherence-log entry

After Gate G2 passes, append to `_idea/coherence-log.md`:

```
## C-S2 — Spiral 2 closure ({ISO})
- Goal: {goal}
- Actors finalized: {N}
- Deliverables finalized: {N} (UNIQUE: X, ADOPT/EXTEND/INTEG: Y, REJECT: 0)
- Multi-perspective check: {summary of user's response}
- Alignment with PRFAQ: confirmed by user
```
