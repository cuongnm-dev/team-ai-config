# Spiral 4 — User Story Mapping + TC seeds

Workshop pattern: **Jeff Patton User Story Mapping** — backbone (user journey) → walking skeleton (MVP) → release slices.

Output: `{features-root}/_idea/story-map.md` + `test-evidence/{feature-id}.json` (seeds, per must-have feature)

## Goal

Translate the impact map deliverables + event storming aggregates into:
1. A user-journey backbone (left-to-right activities)
2. A walking skeleton — the minimum end-to-end path that delivers value (MVP cut)
3. Priority assignment per feature: must-have / should-have / nice-to-have
4. TC seeds (proposed test cases) for every must-have feature, per CD-10 #14-15

## Recap header

```
─── Spiral 4 · Story Mapping ──────────────────────────────
✓ Đã chốt:    Vision + win condition (PRFAQ)
              {N} actors, {M} deliverables (DEDUP-validated)
              Domain events + aggregates (Spiral 3 {mode})
◐ Đang quyết: Backbone, MVP cut, priorities, story points, TC seeds
○ Để sau:     Pre-mortem (Phase 4.5), crystallize (Phase 5),
              SDLC handoff (Phase 6)
```

## Interview structure

### Step 4.1 — Backbone (user journey, top row)

*"Vẽ user journey end-to-end của persona chính. Backbone là chuỗi các 'activity' (verb-phrase) user thực hiện theo thứ tự. Format: 5-9 activities cao tầng."*

Examples (cho idea "AI code reviewer"):
```
[Đăng ký tài khoản] → [Connect repo] → [Cấu hình rules] →
[Submit PR] → [Xem AI review] → [Apply suggestions] → [Track metrics]
```

→ Apply **Echo + paraphrase**: render backbone as ASCII timeline, user confirms.
→ Apply **Multi-perspective stress test** (light): *"Persona phụ (e.g. team lead) cũng đi qua backbone này, hay journey khác?"* — if khác, draw 2-row backbone.

### Step 4.2 — Stories per activity (under each backbone column)

For each backbone activity, ask:

*"Để user thực hiện được '{activity}', họ cần làm/thấy/có những stories cụ thể nào?"*

Format:
```
[Activity: Submit PR]
├── Story: User push branch lên repo
├── Story: AI auto-detect change scope
├── Story: User chọn reviewers (optional)
└── Story: User submit PR với template
```

Stories at this level become **candidate features** for feature-catalog. Map back to Spiral 2 deliverables — most stories should match deliverables (1:1 or 1:N split).

→ If story does NOT map to any deliverable from Spiral 2 → flag conflict → coherence menu (see `notepads/coherence-protocol.md`).

### Step 4.3 — Walking skeleton (MVP cut, horizontal slice)

*"MVP là minimum end-to-end path mà user có thể chạy được TỪ ĐẦU ĐẾN CUỐI để hưởng giá trị cốt lõi. Cắt 1 horizontal slice qua story map: lấy stories nào tối thiểu để journey 'work'?"*

Visualization:
```
[Activity 1] [Activity 2] [Activity 3] [Activity 4] [Activity 5]
   │             │            │             │            │
   ▼             ▼            ▼             ▼            ▼
 Story-A      Story-D      Story-G       Story-J      Story-M     ← MVP slice
 Story-B      Story-E      Story-H       Story-K      Story-N     ← Slice 2
 Story-C      Story-F      Story-I       Story-L      Story-O     ← Slice 3
```

User picks 1 story per activity for MVP slice. Constraints:
- MVP slice MUST cover backbone end-to-end (no gap)
- MVP slice MUST deliver win condition partially (some metric movement)
- MVP slice usually targets must-have features only

→ Apply **B5 Quantitative scaffolding**: *"MVP slice có bao nhiêu stories? Estimate effort (S/M/L) per story → tổng người-tuần?"*

### Step 4.4 — Priority assignment

For every story:

```
Priority: must-have | should-have | nice-to-have
Story points: S (≤ 3 pd) | M (3-10 pd) | L (> 10 pd)
Linked deliverable: D-{Tier4-id} from impact-map
Linked aggregate: from event-storming
```

Rules:
- All MVP-slice stories → must-have
- Slice 2 stories → should-have (next release)
- Slice 3+ stories → nice-to-have (backlog)

→ Apply **B6 Confidence calibration** at scope creep gate: *"Số features MUST-HAVE: M. PRFAQ win conditions: K. Tỉ lệ M/K = X. Nếu X > 3 → cảnh báo scope creep."* See `notepads/stop-conditions.md` § scope creep.

### Step 4.5 — Multi-perspective stress test (Gate G4 mandatory)

*"Bạn vẫn còn rõ về MVP slice này? Mình hỏi 3 góc nhìn:* 

*(a) **Engineer phải build:** Trong M must-have stories với story-points {tổng SP}, có gì lo về dependency / spike / unknown?*

*(b) **End user dùng MVP:** Slice này có deliver được giá trị tối thiểu không? Hay vẫn còn cảm giác 'half-baked'?*

*(c) **CFO duyệt ngân sách:** Effort {tổng SP × S/M/L conversion} so với expected revenue/value — ROI ổn không?"*

→ Logged answers in `decisions[]` with `topic: "perspective-engineer/user/cfo"`.

### Step 4.6 — TC seed synthesis (mandatory per CD-10 #14-15)

For each MUST-HAVE feature, compute `min_tc` and synthesize:

```python
min_tc = max(5, len(AC) * 2 
                + len(roles) * 2 
                + len(dialogs) * 2 
                + len(error_cases)
                + 3)  # 3 baseline edge cases
```

Generation algorithm (deterministic, NO hallucination):

1. **Happy path × visible role** (1 per role × 1 happy path): priority "Rất cao", labels: smoke + happy-path, source: `from-idea/synthesized`
2. **Forbidden access × invisible role** (1 per non-visible role): priority "Rất cao", labels: rbac + security + access-denied
3. **AC negative × 1 per AC**: invert acceptance criterion to negative test, priority "Cao", labels: validation + negative
4. **Dialog × 3 per dialog**: confirm + cancel + validation, priority "Cao", labels: dialog (only if user described dialogs in flow)
5. **Error case × 1 per error_case**: priority "Cao", labels: error-handling
6. **VN-gov dimensions** (3 baseline per feature): audit_log, vn_diacritics, concurrent_edit, priority "Trung bình"|"Thấp"

ALL TC seeds tagged:
- `source: "from-idea/synthesized"`
- `execution.status: "not-executed"`
- `status: "proposed"`

NEVER mark TC `passed`. QA stage in Cursor SDLC executes + sets `passed/failed`.

If user did NOT describe dialogs/error_cases for a feature → ask quick supplemental:

*"Feature {name} có dialog confirmation/error nào không? Nếu có, list 1-3 dialogs để mình synthesize TC."*

Stored to `feature-catalog.features[].dialogs[]` and `.error_cases[]` (string arrays — sa elaborates UI later).

## Synthesis — write `story-map.md`

Template:

```markdown
---
type: story-map
spiral: 4
created: {ISO}
producer: from-idea
---

# Story Map: {Project Name}

## Backbone (User Journey)

```
[A1: {activity 1}] → [A2: {activity 2}] → [A3: ...] → [A4: ...] → [A5: ...]
```

## Story Map (ASCII)

| Activity | A1: {name} | A2: {name} | A3: {name} | A4: {name} | A5: {name} |
|---|---|---|---|---|---|
| **MVP slice** (must-have) | S-1 {story} [S/M/L] | S-4 [M] | S-7 [S] | S-10 [L] | S-13 [M] |
| Slice 2 (should-have) | S-2 [M] | S-5 [S] | S-8 [M] |  | S-14 [S] |
| Slice 3 (nice-to-have) | S-3 [L] | S-6 [L] | S-9 [S] | S-11 [M] | S-15 [L] |

## Stories — Detailed

### S-1: {story title}
- **Activity:** A1 {name}
- **Priority:** must-have
- **Story points:** S (≤ 3 person-days)
- **Linked deliverable:** D-1.1.a (impact-map.md)
- **Linked aggregate:** {aggregate name from event-storming}
- **Description:** ...
- **Acceptance criteria:**
  1. ...
  2. ...
  3. ...
- **Roles (visible-to):** [role-1, role-2]
- **Dialogs:** [confirmation, error]
- **Error cases:** [validation_invalid_email, network_timeout]

### S-2: ...

## MVP Slice Summary

- **Total must-have features:** {M}
- **Estimated effort:** {sum of S/M/L → person-weeks: e.g. 8 weeks}
- **End-to-end coverage:** ✓ (every backbone activity has 1 must-have story)
- **Win condition coverage:** {pct} of PRFAQ success metric expected by MVP

## Multi-Perspective Stress Test (Step 4.5)

- (a) Engineer view: {user's response}
- (b) End user view: {user's response}
- (c) CFO view: {user's response}

## Scope Creep Check

- Must-have count (M): {M}
- PRFAQ win conditions (K): {K}
- Ratio M/K: {ratio}
- {if > 3}: ⚠️ Scope creep warning — consider deferring some must-have to should-have

## North-Star Alignment Check (Gate G4)

{coherence check entries — see notepads/coherence-protocol.md}
```

## ASCII story-map auto-render

For visualization aid (always render alongside table format):

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│  A1: {name}     │  A2: {name}     │  A3: {name}     │  A4: {name}     │  ← Backbone
├═════════════════┼═════════════════┼═════════════════┼═════════════════┤
│  ▣ S-1 [S]      │  ▣ S-4 [M]      │  ▣ S-7 [S]      │  ▣ S-10 [L]     │  ← MVP (▣)
│   {title 30c}   │   {title}       │   {title}       │   {title}       │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│  ▢ S-2 [M]      │  ▢ S-5 [S]      │  ▢ S-8 [M]      │                 │  ← Slice 2 (▢)
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│  ◇ S-3 [L]      │  ◇ S-6 [L]      │  ◇ S-9 [S]      │  ◇ S-11 [M]     │  ← Slice 3+ (◇)
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
Legend: ▣ MVP must-have | ▢ should-have | ◇ nice-to-have
        [S] ≤3pd | [M] 3-10pd | [L] >10pd
```

## Gate G4 — Exit criteria + coherence + scope creep

ALL must hold before advancing to Phase 4.5 (pre-mortem):

- [ ] Backbone has 5-9 activities, end-to-end
- [ ] Every activity has ≥ 1 story
- [ ] MVP slice covers backbone end-to-end (no gap activities)
- [ ] Every story has: priority, story-points, linked deliverable, linked aggregate
- [ ] Every must-have story has ≥ 3 acceptance criteria
- [ ] Every must-have feature has `test-evidence/{id}.json` with ≥ `min_tc` synthesized seeds
- [ ] Multi-perspective stress test answered (3 angles)
- [ ] Scope creep ratio ≤ 3 (or user explicitly accepts > 3 with rationale logged)
- [ ] Coherence check (see `notepads/coherence-protocol.md`):
  - Every story maps to a Spiral 2 deliverable (no orphan story)
  - Every must-have feature uses an aggregate from Spiral 3 (no orphan aggregate)
  - PRFAQ.target_users ⊆ story map roles (persona consistency)
- [ ] User confirms: *"Story map + MVP cut này solid? Sang Phase 4.5 (pre-mortem)?"*

## Mode B doctrine touchpoints

| Doctrine | Trigger in Spiral 4 |
|---|---|
| B1 Echo + paraphrase | After backbone (4.1), each story (4.2) |
| B2 Generative alternatives | At MVP cut (4.3): "Cách cắt khác để cùng deliver value?" |
| B3 Multi-perspective stress | Step 4.5 (mandatory, 3 perspectives) |
| B4 Assumption surfacing | Implicit in story AC writing |
| B5 Quantitative scaffolding | MVP effort estimate (4.3), priority count vs win conditions (scope creep check) |
| B6 Confidence calibration | Per story: "Confidence into priority assignment %?" |

## Stop conditions

- Backbone > 9 activities → STOP, suggest scope-reduce or split into 2 sub-projects
- Must-have count > 3 × win conditions → mandatory scope creep dialogue (see `notepads/stop-conditions.md`)
- 3 consecutive "không/ko biết" on AC of a feature → defer with `[CẦN BỔ SUNG]`, mark feature `[NEEDS-VALIDATION]`
- Iteration > 2 → force G4 decision menu
- Time on spiral > 60 min → fatigue gate

## Idea-graveyard hooks

When user demotes a feature from must-have to nice-to-have, OR cuts entirely:

```markdown
## G-NNN — {feature name}
- Spiral: 4
- Captured at: {ISO}
- Demotion: must-have → {nice-to-have | dropped}
- Reason: {scope creep / dependency unclear / ROI uncertain / ...}
- Resurrect-trigger: post-MVP success → backlog elevation
```

## Output for Phase 4.5

Phase 4.5 (pre-mortem) reads:
- MVP slice features → focuses risks on these
- Multi-perspective stress test answers → seeds risk register
- Scope creep flag → if active, becomes top risk

## Output for Phase 5

Phase 5 (crystallize) reads:
- All stories → become `feature-catalog.features[]` entries (must-have first)
- Acceptance criteria → `features[].acceptance_criteria[]` (≥ 3 per feature mandatory)
- Linked aggregates → `features[].entities[]` (string list)
- Linked deliverables → `features[].source_evidence` (cross-ref to impact-map.md)
- TC seeds → `test-evidence/{id}.json`
- Story points → `features[].story_points` ("S"|"M"|"L")
- Priority → `features[].priority`
