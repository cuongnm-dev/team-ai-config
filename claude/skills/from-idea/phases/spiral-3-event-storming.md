# Spiral 3 — Event Storming (adaptive depth)

Workshop pattern: **Alberto Brandolini Event Storming (light)** — domain events on a chronological timeline → commands → aggregates → bounded contexts (only in heavy mode).

Output: `{features-root}/_idea/event-storming.md`

## Goal

Surface the domain logic implicit in the impact map: WHAT happens in what order, WHO triggers it, WHAT clusters of state are owned together. Result feeds Spiral 4 (helps disambiguate feature boundaries) and `sa` stage (provides domain skeleton — though entities are still names, not schemas).

## Adaptive depth — heuristic computed from Spiral 2 output

Skill computes signals at entry:

| Signal | Threshold | Source |
|---|---|---|
| Distinct actors | > 3 | impact-map.md Tier 2 count |
| Features (from deliverables) | > 8 | impact-map.md Tier 4 count |
| Repo type | == `mono` | _pipeline-state.json#config.repo_type |
| Domain keywords | ≥ 1 in vision/impacts | grep `workflow\|approval\|lifecycle\|state\|transition\|audit\|multi-step` in idea-brief + impact-map |

**Routing:**
- ≥ 2 signals true → **HEAVY mode** (full timeline + commands + aggregates + bounded contexts)
- 0–1 signals true → **LIGHT mode** (5 events ≤ 3 aggregates, no bounded contexts)
- Exactly 1 signal true AND borderline (e.g. 4 features only, or 1 keyword only with vague semantics) → **AMBIGUOUS** → ask user 1 question:

  *"Domain của bạn có nhiều quy trình nhiều bước / chuyển trạng thái rõ ràng / phê duyệt nhiều cấp không? (a) Có rõ — workshop kỹ; (b) Phần lớn CRUD đơn giản — workshop nhẹ; (c) Không chắc — hỏi tôi 1 ví dụ."*

Persist decision to `_pipeline-state.json#steps.s3.depth_mode`.

## Recap header

```
─── Spiral 3 · Event Storming ({mode}) ────────────────────
✓ Đã chốt:    Vision: "{headline}"
              Goal SMART
              {N} actors, {M} deliverables (DEDUP-validated)
              Top 3 PRFAQ assumptions
◐ Đang quyết: Domain events, commands, aggregates {, bounded contexts}
○ Để sau:     MVP cut + TC seeds (Spiral 4),
              data schema (sa), routes (sa)
```

## LIGHT mode workflow (5 events ≤ 3 aggregates)

### Step 3L.1 — Event timeline (chronological)

*"List 5-10 sự kiện quan trọng nhất xảy ra trong domain, theo thứ tự thời gian. Format: 'Một X đã được Y' (past tense, business-meaningful)."*

Examples:
- "Đơn đăng ký đã được nộp"
- "Hồ sơ đã được duyệt"
- "Email xác nhận đã được gửi"

Anti-pattern: technical events ("API call returned 200", "Cache invalidated") — STOP user, refocus on business events.

→ Apply **Echo + paraphrase**: re-phrase event in user's domain vocab.

### Step 3L.2 — Commands per event (1 line each)

For each event: *"Command nào trigger event này? Format: 'verb + object' (imperative)."*

Examples:
- Event: "Đơn đã được nộp" → Command: "Nộp đơn"
- Event: "Hồ sơ đã được duyệt" → Command: "Duyệt hồ sơ"

### Step 3L.3 — Aggregates (group events by ownership)

*"Cluster events by 'thing-that-owns-the-state'. Aggregate là noun chứa state, có lifecycle riêng."*

Light mode max: 3 aggregates. If user generates more → push to merge or escalate to HEAVY mode.

Examples:
- Aggregate "Đơn đăng ký" owns: nộp, duyệt, từ chối
- Aggregate "Người dùng" owns: đăng ký tài khoản, xác thực

### Step 3L.4 — Sketch entity names

For each aggregate, list entity names that will appear in feature-catalog.features[].entities[] (string list, NOT schema).

Examples: `[Đơn, NgườiNộp, Quyết định duyệt]`

→ NOTE: Spiral 3 (any mode) does NOT design schemas. `data-model.json` is `sa` stage's job. Entity name list only.

## HEAVY mode workflow (full)

### Step 3H.1 — Wide event sweep (10-25 events)

*"Brain-dump events trong domain — thoải mái, không cần thứ tự lúc đầu. Sau đó mình cùng sắp lại."*

Skill records all in raw list. Apply **B1 Echo** to ambiguous ones.

### Step 3H.2 — Sequence on timeline

Order events chronologically. Use markdown timeline:
```
TIME ➜
[Event 1] → [Event 2] → [Event 3] → ...
       ↘ [Event 4 — branch path]
```

### Step 3H.3 — Commands

Same as Light Step 3L.2 but exhaustive.

### Step 3H.4 — Policies / Business rules

*"Có rule nào tự động trigger 1 command từ 1 event không? Format: WHEN {event} THEN {command}."*

Examples:
- WHEN "Đơn đã nộp" + "đủ điều kiện" THEN "Tự động chuyển sang xét duyệt"

Policies become candidate `business_rules[]` for ba stage to formalize.

### Step 3H.5 — Aggregates + invariants

For each aggregate:
- Name (noun)
- Owned events
- Invariants: rules that MUST hold (e.g. "Tổng tiền đơn ≥ 0 luôn")
- Boundary: what's IN vs OUT of this aggregate

### Step 3H.6 — Bounded Contexts (only HEAVY + monorepo)

Cluster aggregates into BCs:
- "Đơn đăng ký" + "Tài liệu đính kèm" + "Quyết định duyệt" → BC `application-management`
- "Người dùng" + "Phân quyền" → BC `identity`
- "Thông báo email/SMS" → BC `notification`

BCs map 1:1 to monorepo services in feature-catalog.features[].service.

→ Apply **Generative alternatives** (mandatory at BC step): *"Cách phân BC này là 1 trong nhiều. Alternative grouping: (a) [grouping khác]. Vì sao chọn hiện tại?"*

### Step 3H.7 — Cross-BC events (integration points)

*"Event nào của BC A trigger command vào BC B?"* — list as `integration_points[]` (informational, sa stage formalizes API contracts).

## Synthesis — write `event-storming.md`

### LIGHT template

```markdown
---
type: event-storming
spiral: 3
mode: light
created: {ISO}
producer: from-idea
---

# Event Storming (Light): {Project Name}

## Timeline (5-10 events)

```
[Event 1] ─→ [Event 2] ─→ [Event 3] ─→ [Event 4] ─→ [Event 5]
```

| # | Event | Command (trigger) | Actor | Aggregate |
|---|---|---|---|---|
| 1 | Đơn đã được nộp | Nộp đơn | Người dùng | Đơn đăng ký |
| 2 | ... | ... | ... | ... |

## Aggregates (max 3)

### Đơn đăng ký
- Events: nộp, duyệt, từ chối
- Entities: Đơn, NgườiNộp, QuyếtĐịnh

### {Aggregate 2}
...

## Notes for `sa` stage
- Entity names listed; schema design owned by sa
- No service split (mini-repo); all aggregates in single service
```

### HEAVY template

```markdown
---
type: event-storming
spiral: 3
mode: heavy
created: {ISO}
producer: from-idea
---

# Event Storming (Heavy): {Project Name}

## Section 1: Event Timeline

{ASCII timeline with 10-25 events, branches noted}

## Section 2: Events × Commands × Actors

| # | Event | Command | Actor | Aggregate | Triggered policies |
|---|---|---|---|---|---|
| 1 | ... | ... | ... | ... | P-1 |

## Section 3: Policies / Business Rules

| Policy | Trigger | Effect |
|---|---|---|
| P-1 | WHEN "Đơn đã nộp" + đủ điều kiện | THEN "Tự động chuyển xét duyệt" |
| ... | ... | ... |

## Section 4: Aggregates

### Aggregate: Đơn đăng ký
- **Owned events:** ...
- **Invariants:** ...
- **Boundary:** Đơn + tài liệu đính kèm; KHÔNG bao gồm thông báo email
- **Entities:** Đơn, NgườiNộp, TàiLiệu, QuyếtĐịnh

### Aggregate: ...

## Section 5: Bounded Contexts (monorepo only)

### BC: application-management
- Aggregates: Đơn đăng ký, Tài liệu đính kèm, Quyết định duyệt
- Maps to service: `services/application/`

### BC: identity
- Aggregates: Người dùng, Phân quyền
- Maps to service: `services/identity/`

### BC: notification
...

## Section 6: Cross-BC Integration Points

| Source BC | Source Event | Target BC | Target Command | Notes for sa |
|---|---|---|---|---|
| application-management | "Đơn đã được duyệt" | notification | "Gửi email xác nhận" | async, idempotent |

## North-Star Alignment Check (Gate G3)
{coherence check entries — see notepads/coherence-protocol.md}
```

## Gate G3 — Exit criteria + coherence check

Light mode:
- [ ] 5-10 events listed in chronological order
- [ ] Each event has command + actor + aggregate
- [ ] ≤ 3 aggregates with entity names
- [ ] No technical-only events (CRUD-on-table noise)

Heavy mode:
- [ ] 10+ events on timeline
- [ ] Aggregates with invariants + boundaries
- [ ] BCs mapped to services (if mono)
- [ ] Cross-BC events listed

**Coherence check (mandatory both modes — see `notepads/coherence-protocol.md`):**

1. Every actor in event-storming.md MUST be in actor-registry seed (Spiral 2 Tier 2). New actor surfaced → flag conflict, ask user reconcile.
2. Every aggregate name SHOULD appear in ≥ 1 deliverable from Spiral 2. Orphan aggregate (no deliverable touches it) → flag.
3. PRFAQ critical assumptions (idea-brief.md) — does any event sequence contradict an assumption? E.g. assumption "user authenticates with SSO" + event "user creates local account" → conflict.

If coherence flag triggered → present **Reconciliation menu** (3 paths) before user can advance:
- (a) Edit Spiral 1 or 2 to incorporate new info
- (b) Edit Spiral 3 to align with prior decisions
- (c) Accept conflict with explicit caveat in `_idea/coherence-log.md`

## Mode B doctrine touchpoints

| Doctrine | Trigger in Spiral 3 |
|---|---|
| B1 Echo + paraphrase | After ambiguous event names; after aggregate naming |
| B2 Generative alternatives | At BC grouping (Heavy 3H.6) |
| B3 Multi-perspective stress | (deferred to G4) |
| B4 Assumption surfacing | (touched via coherence check rule 3) |
| B5 Quantitative scaffolding | Light: 5-10 events; Heavy: 10-25 events. Force user count |
| B6 Confidence calibration | At BC mapping (Heavy): "Confidence into this BC split %?" |

## Stop conditions

- User dumps > 25 events in Heavy mode → STOP, suggest scope-reduce or split into 2 sub-projects
- Light mode but user keeps adding aggregates beyond 3 → escalate: *"Light mode max 3 aggregates. Bạn muốn (a) merge bớt, (b) chuyển sang Heavy mode?"*
- 3 consecutive "không có / không cần" answers on policies (Heavy) → skip Step 3H.4
- Iteration > 2 → force G3 decision menu
- Time on spiral > 60 min (Heavy) / 30 min (Light) → fatigue gate

## Idea-graveyard hooks

When user removes events / aggregates mid-iteration:

```markdown
## G-NNN — Aggregate {name}
- Spiral: 3
- Captured at: {ISO}
- Reason for rejection: {merged into other aggregate / out of scope / "không cần thiết"}
- Resurrect-trigger: if domain expansion brings back this state cluster
```

## Output for Spiral 4

Spiral 4 reads:
- Aggregates list → seeds feature.entities[]
- Events → seeds AC negative cases ("nếu event không xảy ra...")
- BCs (if mono) → seeds feature.service[]
