# Coherence Protocol — Inter-spiral Consistency

Enforces consistency between spiral outputs by detecting conflicts and providing structured reconciliation paths. Prevents user from drifting unaware across long brainstorm sessions.

## Triggers

| Trigger | When | Where executed |
|---|---|---|
| **PRFAQ north-star check** | End of Gate G2, G3, G4 | Inline in spiral phase notepad |
| **Inter-spiral semantic compare** | Start of Gate G3, G4 | Inline in spiral phase notepad |
| **Phase 5 semantic audit** | Step 5.2 | `phases/crystallize.md` Step 5.2 |
| **Resume coherence flags** | Phase 0.0 recap rendering | `phases/resume.md` |

## PRFAQ north-star check (end-of-gate)

After Spiral 2/3/4 synthesis but before user confirms gate, ask:

```
North-star alignment check:
  Vision (PRFAQ): "{prfaq.headline}"
  Win condition: "{prfaq.success_metric}"
  Critical assumptions: A1, A2, A3

Current spiral output: {summary}

Question: Does this output still serve the vision + win condition?
  (a) YES — proceed to gate
  (b) PARTIAL — flag drift, log to coherence-log.md, continue with caveat
  (c) NO — drift detected. Choose:
      (c1) Edit current spiral output to re-align
      (c2) Edit PRFAQ (rare — PRFAQ is "supposed to be" north star)
      (c3) Accept with caveat (logged) — strategy may have evolved
```

User-facing prompt:

*"Output Spiral {N} này còn align với vision PRFAQ + win condition + 3 critical assumptions không?"*

Log answer to `_idea/coherence-log.md`:

```markdown
## C-G{N} — Gate G{N} north-star check ({ISO})
- Vision: "{prfaq.headline}"
- Win condition: "{success_metric}"
- Spiral output summary: {summary}
- User answer: {YES | PARTIAL | NO}
- Action: {none | drift-logged | re-aligned | accepted-with-caveat}
- Caveat (if any): {text}
```

## Inter-spiral semantic compare

Run at start of Gate G3 (after Spiral 3 synthesis) and Gate G4 (after Spiral 4 synthesis). Compare current artifact against `decisions[]` with `status="active"` from prior spirals.

### Gate G3 compare rules

| # | Rule | Source A (prior) | Source B (current) | On mismatch |
|---|---|---|---|---|
| G3-R1 | Every actor in event-storming MUST be in actor-registry seed (Spiral 2) | `actor-registry.roles[].slug` | `event-storming.events[].actor` | Flag conflict, present reconciliation |
| G3-R2 | Every aggregate name SHOULD appear in ≥1 deliverable from Spiral 2 | `impact-map.deliverables[].entities` | `event-storming.aggregates[]` | Flag orphan aggregate, ask user to drop OR add deliverable |
| G3-R3 | PRFAQ critical assumptions MUST not be contradicted by event sequences | `decisions[].topic="assumption" status="active"` | `event-storming.events[]` | Flag contradiction, present 3 reconciliation paths |

### Gate G4 compare rules

| # | Rule | Source A (prior) | Source B (current) | On mismatch |
|---|---|---|---|---|
| G4-R1 | Every story maps to a Spiral 2 deliverable | `impact-map.deliverables[].id` | `story-map.stories[].linked_deliverable` | Flag orphan story, ask user link or drop |
| G4-R2 | Every must-have feature uses an aggregate from Spiral 3 | `event-storming.aggregates[]` | `story-map.stories[priority=must-have].linked_aggregate` | Flag orphan must-have, ask user link or drop |
| G4-R3 | PRFAQ.target_users MUST be subset of story-map roles | `idea-brief.persona.role` | `story-map.stories[].roles[]` | Flag persona consistency, ask user reconcile |

## Reconciliation menu (3 paths)

When any rule mismatches, present user 3 paths:

```
⚠️ Coherence flag detected: {rule-id}
Source A ({prior-spiral}): "{value-A}"
Source B (current): "{value-B}"
Conflict: {description}

Choose reconciliation:
  (a) Edit Source A (rewind to prior spiral, fix there)
      → Will trigger cascade refresh of subsequent spirals (per refinement-loop.md)
  (b) Edit Source B (current spiral, align with prior)
      → No cascade; only this spiral changes
  (c) Accept conflict with explicit caveat
      → Both A and B remain; caveat logged in coherence-log.md
      → Caveat propagates to feature-catalog.features[].coherence_notes[]
```

User picks one path. Log to `coherence-log.md`:

```markdown
## C-{rule-id} — Conflict reconciled ({ISO})
- Rule: {rule-id} {rule-description}
- Source A: {value-A} (from {prior-spiral})
- Source B: {value-B} (current spiral)
- Reconciliation: {path-a/b/c}
- Action taken: {description}
- Caveat (if path c): {text}
```

## Phase 5 semantic audit (5 rules)

Detailed rules in `phases/crystallize.md` Step 5.2. Summary table for cross-reference:

| # | Rule | Failure mode | Fix |
|---|---|---|---|
| 1 | Every role appears in permission-matrix | Orphan role | Add proposed permission entry OR drop role |
| 2 | Every feature has ≥1 visible role | Orphan feature | Add role_visibility OR drop feature |
| 3 | PRFAQ.target_users ⊆ actor-registry slugs | Persona inconsistency | Add persona as role OR re-align persona |
| 4 | Every must-have feature in impact-map.deliverables | Orphan must-have | Trace OR demote to should-have |
| 5 | Every aggregate referenced by ≥1 feature.entities[] | Orphan aggregate | Drop aggregate OR add feature using it |

## Reconciliation matrix (when feature conflicts feature)

When 2 features have conflicting acceptance criteria (e.g. Feature X requires user authenticates with SSO; Feature Y requires user logs in with email/password):

```
Reconciliation Matrix:
                   | F-X (claims A) | F-Y (claims B) |
-------------------|----------------|----------------|
User value        | high           | medium         |
Implementation    | medium         | low            |
Risk if both ship | medium         | -              |
Dependency        | none           | F-X-blocking   |
Priority (initial)| must-have      | should-have    |

Recommended: Resolve by ... (skill provides 3 options based on matrix scores)
  (a) Drop F-Y (lower value, blocked by F-X anyway)
  (b) Modify F-Y to coexist (e.g. SSO + email fallback, both supported)
  (c) Defer F-Y to v2 (after F-X validates SSO assumption)
```

User picks one. Log to coherence-log.md.

## Resume coherence flags (Phase 0.0 surfacing)

When user resumes, render any unresolved coherence flags from `_pipeline-state.json#coherence_flags[]`:

```
⚠️ {N} coherence flag(s) chưa giải quyết từ session trước:
  - C-G3-R2: aggregate "Đơn đăng ký" không có deliverable nào tham chiếu
  - C-G4-R1: story S-7 không link được tới deliverable D-...

Resume with these unresolved? (Y → can address mid-flow / N → return to relevant spiral first)
```

## Coherence-log.md format

```markdown
---
type: coherence-log
created: {ISO}
producer: from-idea
---

# Coherence Log: {Project Name}

Append-only log of all coherence checks, reconciliations, and accepted caveats.

## C-G2 — Gate G2 north-star check ({ISO})
{...}

## C-G3-R2 — Conflict reconciled ({ISO})
{...}

## C-S5 — Phase 5 semantic audit ({ISO})
- Rule 1: PASS
- Rule 2: PASS
- Rule 3: PASS
- Rule 4: PASS
- Rule 5: PASS
- Verdict: PASS

## Caveats accepted (path-c reconciliations)

| Caveat ID | Source | Description | Propagated to |
|---|---|---|---|
| CV-001 | C-G3-R3 | Assumption A2 partially contradicted by event E-5 (user logs in twice) | features[F-003].coherence_notes |
```

## Anti-patterns

- Skipping coherence check at G3/G4 because "I think it's fine" — checks are mandatory
- Treating PRFAQ north-star check as "always YES" rubber-stamp — push for honest answer
- Auto-resolving conflicts without user choice — always present reconciliation menu
- Forgetting to propagate caveats to feature-catalog.features[].coherence_notes — caveats must travel
- Running Phase 5 semantic audit silently — must surface all 5 rule outcomes to user
