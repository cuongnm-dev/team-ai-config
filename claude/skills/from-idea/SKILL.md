---
name: from-idea
description: Brainstorm cùng user từ ý tưởng thuần túy (không có code, không có tài liệu) qua 4 spirals (PRFAQ → Impact Mapping → Event Storming → Story Mapping) để kết tinh thành bộ intel + per-feature `_state.md` cho Cursor SDLC consume. Dùng khi chưa có gì ngoài ý tưởng trong đầu. Skill đóng vai thinking partner (không phải voice recorder) — echo + paraphrase, gợi alternatives, lộ assumption, calibrate confidence, pre-mortem; preserves idea-graveyard và resume liền mạch giữa session. Output - docs/intel/{actor-registry, permission-matrix, sitemap, feature-catalog, test-evidence/F-NNN}.json + 1 _state.md + feature-brief.md mỗi feature (status proposed, source idea-brainstormed). Anti-trigger - đã có doc thì /from-doc; đã có code thì /from-code; thêm 1 feature vào dự án có sẵn thì /new-feature. Example - "/from-idea" rồi trả lời phỏng vấn 4 vòng.
---

# From Idea to Features + Intel — Claude Code Pipeline

User-facing messages: Vietnamese. All instructions: English.

## Purpose

Convert a pure idea (no code, no documents) into the same intake-stage intel artifacts that `from-doc` and `from-code` produce, so Cursor SDLC (`resume-feature` → `ba` → `sa` → `dev` → `qa` → `reviewer`) can consume them identically.

This is the third entry point alongside `from-doc` and `from-code`. The skill itself does NOT design routes, entities, or implementation — it captures vision, actors, features, acceptance criteria, and proposed permissions through structured interview spirals; downstream SDLC stages refine.

Target user: founder/PM with an idea but no SRS/BRD/code yet, who wants to hand off a clean, schema-conformant intake to engineering.

## Role: Thinking Partner (not Voice Recorder)

This skill is designed to PARTNER with the user, not just transcribe their words. Six prompting doctrines (Mode B) are mandatory in every spiral:

1. **Echo + paraphrase** — after every substantive answer, restate user's intent: "I hear X, which I interpret as Y. Correct?"
2. **Generative alternatives** — before locking any direction, propose 2 alternatives (1 contrarian, 1 from KB pattern if available); ask why user picks current one
3. **Multi-perspective stress test** — at G2 and G4 gates, ask one perspective shift (engineer / end-user / CFO)
4. **Assumption surfacing** — at end of Spiral 1 + Spiral 2, force user to list 3 big assumptions; if any breaks, does the idea collapse?
5. **Quantitative scaffolding** — Spiral 1 forces user-base size + KPI threshold; Spiral 4 forces story-point sizing
6. **Confidence calibration** — for every major decision, ask "% confident this assumption is true?" — < 50% triggers `[NEEDS-VALIDATION]` flag

See `notepads/cognitive-aids.md` for full doctrine templates + when to apply each.

## When to use

- Greenfield project where the only input is the user's mental model
- Concept exploration that needs to mature into shippable backlog
- Internal tool ideation where no business analyst is available
- Bridge to `resume-feature` for SDLC execution after idea is captured

## When NOT to use

- A document (SRS/BRD/spec/wireframe) exists → use `/from-doc`
- A codebase exists, even partial → use `/from-code`
- Adding a single feature to an existing project → use `/new-feature` (Cursor)
- Strategy-level digital transformation plan (Đề án CĐS) → use `/new-strategic-document`

---

## Continuity & Coherence Mechanisms

Brainstorm is rarely linear. Users pause mid-session, return days later with shifted thinking, or discover Spiral N feature conflicts with Spiral M decision. The skill MUST handle this gracefully without losing context or letting the user drift unaware of incoherence.

### Continuity (across sessions)

| Mechanism | Where |
|---|---|
| **Phase 0.0 Resume Detection** — detect existing state, present 4 options (Resume / Restart / Rewind to Spiral X / View digest) | `phases/resume.md` |
| **`_pipeline-state.json` extended schema** — `decisions[]` immutable log, `recap_ledger[]` snapshots, `last_active_at`, `spiral_start_at` | this file § State File |
| **Time-aware recap** — < 24h: light recap; 24h–7d: full recap; > 7d: vision check + reconfirm PRFAQ | `phases/resume.md` |
| **Cascade refresh on rewind** — rewind to Spiral N marks N+1..4 as `rerun-needed`; preserves originals for compare | `notepads/refinement-loop.md` |

### Coherence (between spirals)

| Mechanism | Where |
|---|---|
| **PRFAQ as north star** — Spiral 1 output is anchor; every Gate G2/G3/G4 ends with "still aligns with PRFAQ vision + win condition?" | `notepads/coherence-protocol.md` |
| **Inter-spiral coherence check** — at G3 + G4, semantic compare vs `decisions[]` (persona ↔ actors, win-condition ↔ deliverables, MVP cut ↔ must-have impacts) | `notepads/coherence-protocol.md` |
| **Conflict resolution UI** — when conflict detected, present 3 paths: (1) edit prior decision, (2) edit new claim, (3) accept with caveat in `_idea/coherence-log.md` | `notepads/coherence-protocol.md` |
| **Phase 5 semantic audit** — beyond FK, runs 5 semantic rules (e.g. PRFAQ.target_users ⊆ actor-registry.roles) | `phases/crystallize.md` |

### Clarity (decision fatigue mitigation)

| Mechanism | Where |
|---|---|
| **Recap header at every spiral entry** — 3-bullet: Đã chốt / Đang quyết / Để sau | `notepads/cognitive-aids.md` |
| **Sanity check at iteration 2** — "Feature X you proposed earlier — still MUST-HAVE, or scope creep / fatigue?" | `notepads/cognitive-aids.md` |
| **Fatigue gate** — 2 backs + > 30 min on spiral → suggest break; auto-saves state | `notepads/stop-conditions.md` |
| **Scope creep detector** — at G4: `len(features) > 3 × len(PRFAQ.win_conditions)` triggers warning | `notepads/stop-conditions.md` |
| **Stop conditions per spiral** — diminishing-return detection (3 consecutive "không/ko biết" answers → defer) | `notepads/stop-conditions.md` |

### Loss-less ideas (idea graveyard)

| Mechanism | Where |
|---|---|
| **Idea graveyard register** — file `_idea/idea-graveyard.md` persists every idea rejected, with reason + spiral + timestamp | `notepads/idea-graveyard.md` |
| **Resurrect protocol** — at any spiral, user can `/from-idea --resurrect <graveyard-id>` to bring back; skill confirms context changed and integrates | `notepads/idea-graveyard.md` |

### Reasoning preservation (decision rationale)

Every entry in `decisions[]` carries 4 enriched fields beyond what + when:
- `why` (1-2 sentences — why chose this)
- `considered_alternatives[]` (what else was on the table)
- `confidence_pct` (0-100 — user's stated confidence)
- `assumptions[]` (preconditions that, if false, invalidate the decision)

This enables future re-evaluation: when context shifts (new evidence, market change, team capacity), user can revisit decisions with full rationale instead of "we decided X but I forget why".

---

## Intel Layer Integration (CLAUDE.md CD-10)

This skill is the idea-side producer for the shared Intel Layer at `{workspace}/docs/intel/`. See `INTEL_INTEGRATION.md` (sibling file) for the full contract. Summary:

- **Producer tag:** `manual-interview` (existing enum value in `_meta.schema.json#producer`)
- **`produced_by_skill`:** `from-idea` (informational, distinguishes from intel-fill)
- **Schemas:** writes only `actor-registry.json`, `permission-matrix.json`, `sitemap.json`, `feature-catalog.json`, `test-evidence/{feature-id}.json` per `~/.claude/schemas/intel/`
- **Confidence policy:** roles + features default `manual` (interview-validated); permissions + sitemap routes default `low` (proposed, awaiting `sa` enrichment)
- **REQUIRED producer calls:** `python ~/.claude/scripts/intel/meta_helper.py update ...` after every artifact write
- **Cross-skill merge:** never overwrites silently — at Phase 5 crystallize, ASK USER per artifact (Replace with `.bak` backup / Append via intel-merger). See `phases/crystallize.md`.
- **Validation gate:** `intel-validator --quick` before Phase 5 exits
- **Snapshot regen:** mandatory post-write per Cursor Rule 24

## Intel cache warm-start (Phase 0 — AGI #2 / CLAUDE.md MCP-2)

Before Spiral 1, query `etc-platform` MCP for similar prior projects:

```
sig = build_signature_from_user_input(idea)
  → {stacks: [], role_count_bucket: ?, domain_hint: <from one-line vision>, feature_count_bucket: ?}

mcp__etc-platform__intel_cache_lookup(
  project_signature=sig,
  kinds=["actor-pattern", "feature-archetype"]
)
  → exact_matches[] + similar_projects[]
```

Use cases:
- `actor-pattern` exact match → seed Spiral 2 (Impact Map → Actors layer) hypothesis space, validate against user answers
- `feature-archetype` similar → narrow Spiral 4 (Story Map → Backbone) hypothesis space
- Confidence boost: prior pattern + user confirmation → upgrade `manual` → `medium`

**Contribute** (after Phase 6 confirmed, with `contributor_consent=True`):
```
mcp__etc-platform__intel_cache_contribute(...)
```

Server rejects payloads containing customer names (Bộ/Tỉnh/Sở), PII (email/phone/CCCD). Default-deny — caller must pre-redact.

If MCP down: skip warm-start gracefully, log `kb-cache-unavailable` in `_pipeline-state.json`, continue with cold-start interview.

---

## State Machine

```
PHASE 0.0: RESUME DETECTION (gate before any new work)
┌──────────────────────────────────────────────────────────────────────┐
│ if exists docs/intel/_pipeline-state.json with skill="from-idea"    │
│   → present 4 options:                                              │
│     [Resume from Spiral N] [Restart fresh] [Rewind to Spiral X]     │
│     [View digest]                                                   │
│   → time-aware recap by gap (<24h light / 24-7d full / >7d vision)  │
│ else → proceed to Phase 0                                           │
└──────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
PHASE 0: BOOTSTRAP                  PHASE 0.5: VISUAL PRIMER (optional)
┌──────────────┐                    ┌─────────────────────────────────┐
│ workspace +  │                    │ User shares mockup / sketch /    │
│ intel init + │ ─→ MC-0 ─→         │ short text snippet (≤ 1500 chars,│
│ MCP warmstart│                    │ ≤ 3 imgs); main thread reads     │
└──────────────┘                    │ multimodal → idea-brief.md prime │
                                    │ Threshold breach → suggest /from-doc │
                                    └─────────────────────────────────┘
                            │
                            ▼
PHASE 1-4: SPIRALS (mandatory; Mode B doctrines applied throughout)
┌──────────────┐  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐
│ Spiral 1      │→ │ Spiral 2        │→ │ Spiral 3        │→ │ Spiral 4      │
│ PRFAQ         │  │ Impact Map      │  │ Event Storm     │  │ Story Map     │
│ + assumptions │  │ +DEDUP +Mermaid │  │ (adaptive depth)│  │ +TC seeds     │
│ + quant scaff │  │ +alternatives   │  │ +alternatives   │  │ +ASCII viz    │
└──────────────┘  └────────────────┘  └────────────────┘  └──────────────┘
       ↓ G1               ↓ G2                ↓ G3              ↓ G4
   (refine?)       (refine? +north star)  (refine? +coherence) (refine? +scope)
   max 2 backs       max 2 backs            max 2 backs         max 2 backs
                            │
                            ▼
PHASE 4.5: PRE-MORTEM + POST-MORTEM (mandatory critical pass)
┌──────────────────────────────────────────────────────────────────────┐
│ Q1: "1 năm sau dự án FAIL — 3 lý do hàng đầu?"                       │
│ Q2: "1 năm sau dự án THÀNH CÔNG — bằng cách nào?"                    │
│ → output _idea/pre-mortem.md, propagate risks to feature-catalog     │
│   features[].risks[] + assumptions[]                                 │
└──────────────────────────────────────────────────────────────────────┘
                            │  G4.5 (user confirms risk register)
                            ▼
PHASE 5: CRYSTALLIZE                                  PHASE 6: HANDOFF
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ FK validate  │→ │ Semantic     │→ │ Per-artifact │→ │ Summary +    │
│ + DEDUP      │  │ audit (5     │  │ ask user:    │  │ next-step    │
│ closure      │  │ rules)       │  │ Replace/     │  │ (resume-     │
│              │  │              │  │ Append       │  │ feature)     │
│              │  │              │  │ Then write 4 │  │              │
│              │  │              │  │ intel + TC   │  │              │
│              │  │              │  │ seeds +      │  │              │
│              │  │              │  │ _state.md +  │  │              │
│              │  │              │  │ snapshot     │  │              │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
                            │  MC-5 (validator PASS, snapshot fresh)
                            ▼
                      Cursor SDLC takes over
```

Per-spiral micro-loop:
1. **Recap** — render 3-bullet header (Đã chốt / Đang quyết / Để sau) from `decisions[]`
2. **Interview** — structured questions per spiral pattern; apply Mode B doctrines (echo, alternatives, perspectives, assumptions, quant, confidence)
3. **Synthesize** — render workshop artifact (`idea-brief.md` / `impact-map.md` / `event-storming.md` / `story-map.md`)
4. **Snapshot intel-delta** — show user the incremental changes that would land in intel
5. **Coherence check** — compare new artifact vs `decisions[]` (G3, G4 only); flag conflicts
6. **User review** — confirm OR request refinement OR resurrect from idea-graveyard
7. **Refine** — apply edits, re-render; max 2 backs per spiral; force decision after limit
8. **Commit decisions** — append to `decisions[]` with `why`, `considered_alternatives`, `confidence_pct`, `assumptions`

## State File: `{workspace}/docs/intel/_pipeline-state.json`

```json
{
  "version": 2,
  "skill": "from-idea",
  "created": "{ISO-8601}",
  "last_active_at": "{ISO-8601, updated every action}",
  "workspace_path": "{abs-path}",
  "current_step": "0",
  "spiral_start_at": null,
  "steps": {
    "0.0":  { "status": "pending|skipped", "completed_at": null,
              "resume_choice": null, "recap_mode": null },
    "0":    { "status": "pending", "completed_at": null,
              "mcp_warmstart": null },
    "0.5":  { "status": "pending|skipped", "completed_at": null,
              "primer_files": [], "primer_chars": 0 },
    "s1":   { "status": "pending", "completed_at": null, "iterations": 0,
              "iteration_metrics": [] },
    "s2":   { "status": "pending", "completed_at": null, "iterations": 0,
              "dedup_pass_count": 0, "policy_researcher_invoked": false,
              "iteration_metrics": [] },
    "s3":   { "status": "pending", "completed_at": null, "iterations": 0,
              "depth_mode": null, "iteration_metrics": [] },
    "s4":   { "status": "pending", "completed_at": null, "iterations": 0,
              "iteration_metrics": [] },
    "4.5":  { "status": "pending", "completed_at": null,
              "risks_count": 0, "success_paths_count": 0 },
    "5":    { "status": "pending", "completed_at": null,
              "merge_decisions": {},
              "validator_verdict": null, "snapshot_regenerated": false,
              "semantic_audit_verdict": null },
    "6":    { "status": "pending", "completed_at": null,
              "mcp_contribute": null }
  },
  "config": {
    "repo_type": null,
    "dev_unit": null,
    "features_root": null,
    "intel_path": "docs/intel"
  },
  "decisions": [
    {
      "id": "D-NNN",
      "spiral": "s1|s2|s3|s4|4.5",
      "iteration": 1,
      "topic": "vision|actor|deliverable|event|aggregate|priority|risk|assumption",
      "value": "{decision text}",
      "why": "{1-2 sentence rationale}",
      "considered_alternatives": ["{alt 1}", "{alt 2}"],
      "confidence_pct": 75,
      "assumptions": ["{precondition 1}", "{precondition 2}"],
      "status": "active|superseded|rolled-back",
      "superseded_by": null,
      "timestamp": "{ISO}"
    }
  ],
  "recap_ledger": [
    {
      "at_spiral": "s2",
      "captured_at": "{ISO}",
      "snapshot": "{prose summary of decisions[] active at this point}"
    }
  ],
  "intel_cache_hits": [],
  "idea_graveyard_count": 0,
  "coherence_flags": []
}
```

---

## Phase 0.0 — Resume Detection

See `phases/resume.md`. Triggered when `_pipeline-state.json` with `skill: "from-idea"` exists and `steps[6].status != "completed"`. Presents 4 options + time-aware recap before any new action.

## Phase 0 — Bootstrap

**Goal:** Detect workspace, init intel layer, optional MCP warm-start.

Steps:
1. Locate workspace root (current working dir or user-supplied path).
2. Detect `repo_type`: read `AGENTS.md` if present (`mono | mini`); else default `mini` and ask user to confirm.
3. Create `docs/intel/` if missing; init `_meta.json` via `meta_helper.py init`.
4. Init `_pipeline-state.json` (template above), `current_step: "0"` → `"0.5"`.
5. Optional MCP warm-start: build `project_signature` from one-line user vision (if user provides early), call `intel_cache_lookup`. Cache result in `intel_cache_hits[]`.
6. Print MC-0 to user: "Workspace ready. Bạn có visual primer (mockup/sketch/text snippet) không, hay vào thẳng Spiral 1?"

**Forbidden in Phase 0:**
- Glob/Grep on `/src` or any code directory (CD-21 anti-fishing)
- WebSearch user-supplied URLs
- Read full doc files (PDF/Word/SRS/BRD) — route to `/from-doc` instead

## Phase 0.5 — Optional Visual Primer

**Goal:** Accept lightweight reference inputs (mockup, sketch, screenshot, short text) without crossing into "documented requirements" territory.

Behavior:
1. Ask user: *"Bạn có hình ảnh tham khảo (mockup, sketch, wireframe, screenshot sản phẩm tương tự) hoặc đoạn mô tả ngắn (≤ 1000 chars) muốn share không? KHÔNG phải tài liệu đầy đủ — đó là việc của /from-doc."*
2. If user provides:
   - **Image:** main thread reads multimodal → extracts UI patterns, layout, character roles, hint flows → writes summary to `{features-root}/_idea/visual-primer.md` (cite filename only)
   - **Text snippet:** copy verbatim + paraphrase into `visual-primer.md`
3. Threshold guards (any one breach → suggest `/from-doc`):
   - Total text input > 1500 chars
   - Image count > 3
   - Image contains dense slide/table content (heuristic: text-heavy OCR)
4. References from primer cite as `evidence.kind: "interview"` with `reference_to: "_idea/visual-primer.md"` in subsequent intel artifacts.

If user has no primer → skip directly to Spiral 1.

## Phase 1 — Spiral 1: PRFAQ

Workshop: Amazon "Working Backwards" — define vision + win condition before solution.

See `phases/spiral-1-prfaq.md` for interview prompts, Mode B doctrine application points (especially echo + paraphrase + quantitative scaffolding + assumption surfacing), Gate G1 criteria.

Output artifact: `{features-root}/_idea/idea-brief.md`
Mandatory exit: at least 3 assumptions logged in `decisions[]` with `topic: "assumption"`.

## Phase 2 — Spiral 2: Impact Mapping

Workshop: Gojko Adzic 4-tier mind-map — Goal → Actors → Impacts → Deliverables.

DEDUP gate: every deliverable runs through KB ecosystem check (CT 34 Nguyên tắc 6) before being committed to feature-catalog seed. Skill ASKS user upfront: *"Đây có phải dự án cho cơ quan nhà nước (Bộ/Tỉnh/Sở/Cục) không?"* — if yes, dispatch `policy-researcher` agent for VN gov platform research; otherwise standard MCP DEDUP only.

See `phases/spiral-2-impact-map.md` for interview prompts, DEDUP integration, Mermaid mind-map auto-render, Gate G2 criteria (PRFAQ north-star check + DEDUP closure).

Output artifact: `{features-root}/_idea/impact-map.md` (text tree + Mermaid mind-map) + `{features-root}/_idea/dedup-report.md`
Mandatory exit: every deliverable has DEDUP verdict (UNIQUE / ADOPT / EXTEND / INTEG / REJECT).

## Phase 3 — Spiral 3: Event Storming (adaptive depth)

Workshop: Brandolini DDD light — domain events on a timeline → commands → aggregates → bounded contexts.

**Depth heuristic** (computed from Spiral 2 output, persisted to `steps.s3.depth_mode`):
- **Heavy mode** (full timeline + aggregates + bounded contexts) when ≥ 2 of:
  - distinct actors > 3
  - features > 8
  - `repo_type == mono`
  - domain keywords detected in vision/impacts (`workflow`, `approval`, `lifecycle`, `state`, `transition`, `audit`, `multi-step`)
- **Light mode** (5 events ≤ 3 aggregates, no bounded contexts) when 0–1 signals
- **Ambiguous (1 borderline signal)**: ask user — *"Domain của bạn có nhiều quy trình nhiều bước / chuyển trạng thái / phê duyệt nhiều cấp không?"* — then route accordingly

See `phases/spiral-3-event-storming.md` for both heavy + light variants + Gate G3 criteria (coherence check vs Spiral 1+2 decisions).

Output artifact: `{features-root}/_idea/event-storming.md`
Skill does NOT write `data-model.json` or concrete `routes` to `sitemap.json` — those are `sa` stage outputs. Spiral 3 only seeds entity names + relationships into feature-catalog.features[].entities[] (string list) for `sa` to elaborate.

## Phase 4 — Spiral 4: User Story Mapping + TC seeds

Workshop: Jeff Patton — user journey backbone → walking skeleton (MVP) → release slices → priority per feature.

Synthesis includes test-evidence seed generation per CD-10 #14-15:
- Synthesize `test_cases[]` per feature using formula `min_tc = max(5, AC×2 + roles×2 + dialogs×2 + errors + 3)`
- All seeds: `source: "from-idea/synthesized"`, `execution.status: "not-executed"`, `status: "proposed"`

See `phases/spiral-4-story-mapping.md` for interview prompts, TC synthesis algorithm, ASCII story-map render, Gate G4 criteria (coherence + scope-creep check).

Output artifact: `{features-root}/_idea/story-map.md`
Mandatory exit: every must-have feature has ≥`min_tc` synthesized seeds + a story-point estimate (S/M/L).

## Phase 4.5 — Pre-mortem & Post-mortem

See `phases/pre-mortem.md`. Two mandatory questions:
1. *"Tưởng tượng 1 năm sau dự án FAIL — 3 lý do hàng đầu?"*
2. *"Tưởng tượng 1 năm sau dự án THÀNH CÔNG — bằng cách nào?"*

Output: `{features-root}/_idea/pre-mortem.md` with risks register + success pathways. Risks propagate to `feature-catalog.features[].risks[]` + `feature-catalog.features[].assumptions[]`.

## Phase 5 — Crystallize

See `phases/crystallize.md`. Summary:

1. Validate FK integrity (permission.role ∈ actor-registry.roles[].slug; sitemap.routes ↔ feature-catalog.features[].id)
2. Run final DEDUP closure pass + run 5-rule semantic audit
3. Issue canonical IDs (F-NNN for mini-repo, {service}-F-NNN for mono) — duplicate check against `feature-map.yaml` + `feature-catalog.json` + glob `{features-root}/F-*/`
4. **Per-artifact merge decision** (Option 3): for each of 4 intel artifacts, if existing file detected → ASK user *"actor-registry.json đã có (producer=X, last-updated=Y). Append (merge) hay Replace (backup .bak + overwrite)?"*; record choice in `steps.5.merge_decisions{}`
5. Emit 4 intel artifacts (`actor-registry`, `permission-matrix`, `sitemap`, `feature-catalog`) per merge decision; if Append → write `.new.json` then dispatch `intel-merger`
6. Emit `test-evidence/{feature-id}.json` for each must-have feature
7. Emit per-feature `_state.md` (CD-20 unified, 21 frontmatter fields + 6 body sections, `source-type: idea-brainstormed`, `current-stage: ba`, `status: in-progress`)
8. Emit `feature-brief.md` for each feature (primary `feature-req` file consumed by `resume-feature` Step 3.0)
9. Update `feature-map.yaml`
10. Run `intel-validator --quick` — block if ERROR; warnings logged
11. Run snapshot regen (`python ~/.cursor/skills/intel-snapshot/generate.py --intel-path docs/intel`) — Cursor Rule 24

## Phase 6 — Handoff

See `phases/handoff.md`. Summary:

- Print user-facing summary in Vietnamese: feature count, role count, total proposed TCs, idea-graveyard count, any `[CẦN BỔ SUNG]` open items, any `[NEEDS-VALIDATION]` (confidence < 50%) items
- Print next-step pointer: `/resume-feature {first-must-have-id}` for the first feature, list remaining
- Optional: contribute back to MCP `intel_cache_contribute` with consent
- Mark Phase 6 complete in `_pipeline-state.json`

---

## Lifecycle Contract Box (CLAUDE.md CD-21 — Class C orchestrator variant)

```
┌─ /from-idea ─────────────────────────────────────────────────────────┐
│ ROLE        : Capture pure idea via 4 mandatory brainstorm spirals  │
│               (PRFAQ → Impact Map → Event Storm → Story Map) +      │
│               pre-mortem; act as thinking partner (Mode B doctrines)│
│               not voice recorder; preserve continuity, coherence,   │
│               clarity across sessions; crystallize into intake-     │
│               stage intel artifacts + per-feature _state.md for     │
│               Cursor SDLC consumption.                              │
│                                                                      │
│ READ-GATES  :                                                        │
│   ✓ AGENTS.md (repo-type, dev-unit if exists)                       │
│   ✓ docs/intel/_pipeline-state.json (resume detection — Phase 0.0)  │
│   ✓ docs/intel/_meta.json (freshness; STOP if stale on artifacts    │
│      this skill will write)                                         │
│   ✓ docs/intel/feature-catalog.json (existing IDs — collision check)│
│   ✓ docs/intel/feature-map.yaml (ID sequence allocation)            │
│   ✗ docs/intel/actor-registry.json (lazy — only at Phase 5 for      │
│      append-merge decision if exists)                               │
│                                                                      │
│ OWN-WRITE   :                                                        │
│   - {features-root}/_idea/idea-brief.md                             │
│   - {features-root}/_idea/visual-primer.md (if Phase 0.5 used)      │
│   - {features-root}/_idea/impact-map.md                             │
│   - {features-root}/_idea/event-storming.md                         │
│   - {features-root}/_idea/story-map.md                              │
│   - {features-root}/_idea/pre-mortem.md                             │
│   - {features-root}/_idea/dedup-report.md                           │
│   - {features-root}/_idea/idea-graveyard.md                         │
│   - {features-root}/_idea/coherence-log.md                          │
│   - {features-root}/_idea/assumptions.md                            │
│   - {features-root}/{feature-id}/_state.md                          │
│   - {features-root}/{feature-id}/feature-brief.md                   │
│   - docs/intel/_pipeline-state.json (this skill's state)            │
│   - docs/feature-map.yaml entries (append)                          │
│                                                                      │
│ ENRICH      :                                                        │
│   - actor-registry.json: append roles with evidence.kind=interview, │
│     confidence=manual, source_producers includes "manual-interview" │
│   - feature-catalog.json: append features with description≥200,    │
│     business_intent≥100, flow_summary≥150, AC≥3×≥30,                │
│     plus risks[] + assumptions[] from Phase 4.5                     │
│   - permission-matrix.json: append proposed rows (status=proposed,  │
│     confidence=low) — sa enriches later                             │
│   - sitemap.json: append placeholder routes (path="TBD",            │
│     confidence=low) — sa designs concrete paths                     │
│   - test-evidence/{id}.json: synthesize seeds per CD-10 #14-15      │
│   - _meta.json: register producer="manual-interview" +              │
│     produced_by_skill="from-idea" for 5 files                       │
│                                                                      │
│ FORBID      :                                                        │
│   - Glob/Grep on /src or any code directory (P7 anti-fishing)       │
│   - WebSearch (skill is interview-only; no external research        │
│     EXCEPT policy-researcher for VN gov DEDUP after user opt-in)    │
│   - Reading user-supplied full doc files (route to /from-doc)       │
│   - Writing data-model.json or integrations.json (sa stage owns)    │
│   - Writing test-accounts.json (from-code or manual)                │
│   - Writing concrete sitemap.routes[].path (sa stage owns)          │
│   - Writing implementation_evidence or test_evidence_ref.passed     │
│     (close-feature owns)                                            │
│   - Setting feature.status beyond "proposed" or "planned"           │
│   - Inline secrets in any artifact                                  │
│   - Overwriting locked_fields per _meta.locked_fields[]             │
│   - Skipping any of 4 spirals (all mandatory by user mandate)       │
│   - Skipping Phase 4.5 pre-mortem                                   │
│   - Silent overwrite at Phase 5 — must ask user per artifact        │
│   - "Yes-and" responses without applying Mode B doctrines           │
│                                                                      │
│ EXIT-GATES  :                                                        │
│   - All 4 spirals + Phase 4.5 confirmed by user (or force-decision  │
│     after iteration limit)                                          │
│   - DEDUP closure: every feature has verdict in dedup-report.md     │
│   - feature-catalog: each feature has description≥200, AC≥3×≥30,   │
│     business_intent≥100, flow_summary≥150, confidence=manual,       │
│     priority set, assumptions[] populated, risks[] populated        │
│   - actor-registry: ≥1 role, all confidence≥manual                  │
│   - permission-matrix: ≥1 proposed row per role × resource pair    │
│     identified in interview                                         │
│   - test-evidence/{id}.json: each must-have feature has ≥min_tc     │
│     synthesized seeds                                               │
│   - _state.md per feature: 21 frontmatter fields + 6 body sections  │
│     (CD-20 unified), source-type=idea-brainstormed                  │
│   - feature-brief.md per feature: scoped digest with frontmatter    │
│   - decisions[] populated with 4-field rationale schema             │
│     (why + considered_alternatives + confidence_pct + assumptions)  │
│   - PRFAQ north-star alignment check passed at G2/G3/G4             │
│   - Phase 5 semantic audit (5 rules) PASS                           │
│   - intel-validator --quick PASS                                    │
│   - snapshot regen [OK]                                             │
│   - resume-feature {first-must-have-id} would pass Step 3.0 parser  │
│                                                                      │
│ FAILURE     :                                                        │
│   - _meta has READ-GATES artifact stale → STOP, run /intel-refresh  │
│   - Feature-id collision detected → STOP, propose alternative or    │
│     /resume-feature for existing                                    │
│   - User answers blocking questions with "[CẦN BỔ SUNG]" > 30% of   │
│     fields → escalate, recommend offline clarification              │
│   - Spiral iteration limit (2 backs) reached without confirmation   │
│     → force decision (Confirm | Cancel)                             │
│   - intel-validator returns ERROR → STOP, surface diagnostics       │
│   - DEDUP gate: REJECT verdict on >50% features → STOP, recommend   │
│     scope reduction                                                 │
│   - Semantic audit fails any of 5 rules → STOP, surface specific    │
│     conflict + reconciliation menu                                  │
│   - User triggers fatigue gate (2 backs + 30 min) → checkpoint     │
│     state, suggest break, do not force completion                   │
│                                                                      │
│ TOKEN-BUDGET: ~60K input (4 workshop rounds + intel reads +         │
│               coherence checks + Mode B doctrines),                 │
│               ~30K output (4 workshop docs + per-feature artifacts +│
│               pre-mortem + idea-graveyard)                          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Cache discipline notes (CLAUDE.md root § Cache Discipline)

This skill's prompt body is English-only (CD-9). User-facing strings + frontmatter description + output content templates use Vietnamese (per skill convention for VN gov audience).

State machine block + contract box are STATIC; per-feature values + interview transcripts are DYNAMIC and live in `_pipeline-state.json` / phase artifacts, NOT in this skill's system prompt.

When dispatching to sub-agents (`intel-validator`, `intel-merger`, optional `policy-researcher`), pass refs not inline content (CACHE_OPTIMIZATION.md § load-on-demand).

## Anti-patterns (forbidden — see contract box FORBID)

- "Yes-and" responses — every commit point applies Mode B doctrines (no exception)
- Inferring routes from user vague answers without explicit confirmation → leave for `sa`
- Generating test_cases beyond formula `min_tc` (over-synthesis pollutes `qa` queue)
- Skipping DEDUP because "user said it's unique" — DEDUP is mandatory per ST-2
- Silently merging or silently overwriting at Phase 5 — always ASK per artifact
- Storing user's company/department name in MCP cache contribute payload — pre-redact
- Using `medium` or `high` confidence for any field in first iteration — start `manual` (interview only) / `low` (proposed); upgrade only via DEDUP-match or user override
- Discarding ideas without writing to `idea-graveyard.md`
- Committing decisions without 4-field rationale (why + alternatives + confidence + assumptions)

## Versioning

- v1 (2026-05-04): initial release. 4-spiral mandatory pipeline + Phase 0.0 resume + Phase 0.5 visual primer + Phase 4.5 pre-mortem. Mode B 6 doctrines. Idea graveyard. Decision rationale schema. Class C orchestrator contract.
- Schema baseline: `~/.claude/schemas/intel/` v1.0; CD-10 quy tắc 1-21; CD-20 with `idea-brainstormed` source-type added.
