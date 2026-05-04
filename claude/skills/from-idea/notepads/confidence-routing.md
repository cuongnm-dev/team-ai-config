# Confidence Routing — Idea-only Default Confidence

Rules for assigning `confidence` field values to intel artifacts produced by `from-idea`. Aligns with CLAUDE.md CD-13 (confidence-aware extraction) and CD-10 baseline.

Idea-only producers carry inherent uncertainty: no code evidence, no doc evidence — only interview testimony. This skill defaults to conservative confidence values, with upgrade paths via DEDUP-match or explicit user override.

## Confidence vocabulary (CD-13 enum)

| Value | Meaning | Trigger |
|---|---|---|
| `manual` | Human-validated via interview, no automated evidence | Default for actor-registry roles, feature-catalog features (idea-only) |
| `low` | Proposed/inferred, awaiting validation by downstream stage | Default for permission-matrix entries, sitemap routes (proposed by skill) |
| `medium` | Multi-source agreement OR upgraded via DEDUP-match | Upgrade path when DEDUP confirms platform pattern OR user explicitly raises |
| `high` | Multi-source code+doc evidence | NOT achievable by from-idea alone (requires later from-code or from-doc enrichment) |

## Per-artifact baseline confidence

### `actor-registry.json#roles[].confidence`

**Baseline:** `manual`

Reason: roles are user-articulated through Spiral 2 interview. Evidence kind is `interview` only — no code routes, no doc page references. Confidence cannot exceed `manual` from this skill.

Upgrade rules (skill-internal):
- If role matches a `mcp__etc-platform__intel_cache_lookup` warm-start exact-match `actor-pattern` → upgrade to `medium`. Cite cache_hit_id.
- If user explicitly says "100% confident, this role is non-negotiable" → upgrade to `medium`. Log in `decisions[].confidence_pct = 100`.

Never `high` from from-idea alone.

### `feature-catalog.json#features[].confidence`

**Baseline:** `manual`

Reason: features synthesized from interview through Spiral 4. Same evidence basis as roles.

Upgrade rules:
- If feature matches `feature-archetype` warm-start hit → upgrade to `medium`.
- If user `confidence_pct ≥ 80` AND feature has ≥ 3 `acceptance_criteria` filled with concrete content (not `[CẦN BỔ SUNG]`) → eligible for `medium`. User opt-in only.

### `permission-matrix.json#permissions[].confidence`

**Baseline:** `low`

Reason: permission entries are PROPOSED by skill from interview Q&A about RBAC ("Who can do what?"). They are skeletons — `sa` stage refines against actual feature flow during architecture.

Upgrade rules:
- Skill cannot upgrade `permission-matrix` confidence above `low`. Reason: from-idea has no flow evidence to validate permission grant/deny.
- User can mark `confidence: medium` for specific entries via explicit override (logged in `decisions[].topic = "permission-confidence-override"`).

### `sitemap.json#routes[].confidence`

**Baseline:** `low`

Reason: routes are placeholder (`path: "TBD"`) at this stage. `sa` designs concrete paths.

Upgrade rules:
- Skill cannot upgrade `sitemap` confidence above `low`. Concrete path = sa's job.

### `test-evidence/{feature-id}.json` test cases

Test seeds do NOT carry `confidence` directly (per schema). However, test-evidence tracks:
- `source: "from-idea/synthesized"` — informational
- `execution.status: "not-executed"` — until QA executes

Downstream `qa` stage execution flips `execution.status` to `passed/failed`. Confidence is implicit in execution status: `passed` is high-confidence, `failed` triggers refinement.

## Decision-level confidence (separate from artifact-level)

Each entry in `decisions[]` carries:

```json
{
  "confidence_pct": <0-100>,
  "needs_validation": <true if pct < 50>
}
```

This is **user-stated confidence** in the decision (e.g. "I'm 70% confident this feature will be must-have"). Distinct from artifact `confidence` field which is producer-level.

When user states `confidence_pct < 50`:
- Skill flags `[NEEDS-VALIDATION]` in `decisions[]`
- Propagates to:
  - `feature-catalog.features[].validation_flags[]` if decision is feature-related
  - `actor-registry.roles[].validation_flags[]` if role-related
  - `_state.md` Active Blockers if affects must-have feature

`[NEEDS-VALIDATION]` items surface in Phase 6 handoff summary as "open validation work before SDLC".

## Confidence x evidence cross-product

Per CD-13, every entry-level intel field carries:

```json
{
  "confidence": "manual|low|medium|high",
  "evidence": [
    {
      "kind": "interview|code|doc|ui",
      "reference_to": "{file path or section}",
      "captured_at": "{ISO}"
    }
  ],
  "source_producers": ["manual-interview", ...]
}
```

For from-idea, evidence is ALWAYS:
- `kind: "interview"`
- `reference_to`: pointer to `_idea/{idea-brief|impact-map|event-storming|story-map|pre-mortem}.md` plus optional `_idea/visual-primer.md` if Phase 0.5 used

NEVER from-idea writes `kind: "code"` or `kind: "doc"` — those are owned by from-code and from-doc respectively.

## Conflict precedence (when from-idea writes alongside other producers)

Per `~/.claude/schemas/intel/README.md` § Conflict Resolution + CD-10 #4:

| Field type | Precedence | Notes |
|---|---|---|
| Display names (Vietnamese) | doc-intel > from-idea > code-harvester | doc-intel wins if conflict; from-idea used when greenfield |
| URLs / route paths | code-harvester > from-doc > from-idea (placeholder) | from-idea ALWAYS yields placeholders for paths |
| Business intent / vision / risks | **from-idea** > doc-intel > code-harvester | from-idea has interview authority for these |
| Roles slug | first-writer wins (immutable after first commit) | append display variants only |
| Permission entries | sa-validated > permission-matrix > from-idea (proposed) | from-idea entries flagged `proposed` for sa to validate |
| Test cases | qa-executed > generate-docs/synthesized > from-idea/synthesized > from-doc/synthesized | execution-evidence trumps synthesis |

When from-idea produces `<artifact>.new.json` for `intel-merger`, the merger respects this precedence.

## Upgrading confidence over project lifecycle

Confidence values evolve as project progresses:

```
T+0 (from-idea):
  actor-registry.roles[X].confidence = "manual"
  feature-catalog.features[F-001].confidence = "manual"
  permission-matrix.permissions[P-001].confidence = "low"

T+1 (from-doc fills if doc exists):
  actor-registry.roles[X].confidence = "manual" → "medium" (doc evidence added)
  feature-catalog.features[F-001].confidence = "manual" → "medium"
  permission-matrix.permissions[P-001].confidence = "low" → "medium"

T+2 (from-code fills after build):
  actor-registry.roles[X].confidence = "medium" → "high" (code evidence added)
  feature-catalog.features[F-001].confidence = "medium" → "high"
  permission-matrix.permissions[P-001].confidence = "medium" → "high" (sa-validated + code matches)
```

`from-idea` initializes the bottom rung. Subsequent producers raise confidence as evidence accumulates.

## Anti-patterns

- Setting any field `confidence: "high"` from from-idea (no code/doc evidence basis)
- Setting permission-matrix or sitemap routes above `confidence: "low"` (would falsely promise concrete-ness)
- Skipping `evidence[]` array (must always cite interview source `_idea/*.md`)
- Setting `confidence_pct` on user-asked questions and immediately marking as `manual` (decision-level confidence is user-stated, distinct)
- Ignoring `[NEEDS-VALIDATION]` flags during Phase 6 handoff (must surface to user)
- Letting actor-registry roles carry mixed confidence (e.g. half `manual`, half `medium`) without clear DEDUP-match basis for `medium` ones
