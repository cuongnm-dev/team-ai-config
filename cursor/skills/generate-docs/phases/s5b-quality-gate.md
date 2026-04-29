# Stage 5b — Quality Gate (6 passes — Cursor Edition)

**ROLE**: Final cross-block validation pass before Stage 6 delivery. Orchestrator role — not specialist role.

**TRIGGER**: After Stage 5a Depth Pass (all specialists already returned `dod_met:true`).

**Why validate() here**: Specialists used `merge_content()` to fix their own blocks.
Stage 5b runs `validate()` as a **cross-block regression check** — confirms no specialist's merge
broke another block, and checks cross-references (component counts, entity names, API path coverage,
feature↔TC linkage). This is the only correct place to call `validate()` directly.

**OUTPUT**: `{DOCS_PATH}/intel/quality-report.json` + pass/fail verdict.

---

## 6 passes

| Pass | Check | Penalty (score) |
|---|---|---|
| 1 | Placeholder budget per section | -5 per overshoot |
| 2 | Cross-reference content-data vs code-facts | -10 per fail |
| 3 | Prose specificity (numbers/entities/dates per 500 words) | -2 per weak section |
| 4 | Banned prose phrases | -5 per occurrence in strict sections |
| 5 | Section word count (hard floor) | -15 per blocker, -5 per major |
| 6 | TC count scaling (data-driven per feature) | -10 per blocker, -3 per major |

---

## Score threshold

| Score | Verdict | Action |
|---|---|---|
| ≥ 80 | PASS | Advance Phase 4 |
| 60–79 | WARN | Display report + prompt user continue |
| < 60 | BLOCK | Must fix, re-run Stage 5a Depth Pass |

Escape: `/generate-docs --skip-quality-gate` (ONLY for legacy/approved content re-export).

### Automated / unattended run behaviour (no user to prompt)

If running in CI, a batch pipeline, or any context where there is no interactive user:

```
WARN (60–79):
  → Write full quality-report.json
  → Log: "WARN score={score}. Advancing to Phase 4 (automated mode — no user prompt)."
  → Proceed to Phase 4 with score in export metadata

BLOCK (< 60):
  → Write full quality-report.json
  → EXIT with non-zero code (do NOT proceed to Phase 4)
  → Log: "BLOCK score={score}. Phase 4 skipped. Rerun /generate-docs phase3g to fix."
```

Detection: if no interactive shell detected (e.g., `$CI == "true"`, or running as sub-agent) → use automated behaviour automatically.

### Expansion gaps whitelist

Before running Pass 5 (word count), read `{DOCS_PATH}/intel/expansion-gaps.md` if it exists.
Extract listed section paths (`## <path>` headings) and skip Pass 5 penalty for those paths:

```python
expansion_gap_paths = parse_expansion_gaps("{DOCS_PATH}/intel/expansion-gaps.md")
# e.g. ["tkcs.pm_method", "architecture.interaction_description"]

for item in pass_5_results:
    if item["path"] in expansion_gap_paths:
        item["skipped"] = True  # do not add to score deductions
        item["reason"] = "expansion_gap — logged in intel/expansion-gaps.md"
```

Report these in `quality-report.json` under `pass_5_word_count[].skipped = true` so user sees them but they don't cause BLOCK.

---

## Invocation

### Step 1 — MCP validate (PRIMARY — cross-block check, orchestrator only)

```python
# This is the ONE place where validate() is called directly (not merge_content).
# Specialists do NOT call this — they get feedback from merge_content().
result = mcp__etc-platform__validate(content_data=current_state)
```

Runs all Phase 1+2+3 quality checks: diagram integrity, word counts, banned phrases,
ATTT groups, specificity density, legal refs, NFR measurable, TKCT module depth, TC quality.
Read `result.warnings[]` and `result.stats["quality_warnings_count"]`.

If `result.errors` non-empty → BLOCK immediately (Pydantic schema error — a specialist
introduced a regression; must fix before scoring).

### Step 2 — quality_score.py (SUPPLEMENTARY — cross-reference + TC scaling)

Provides 2 additional checks not in MCP validate:
- Pass 2: cross-reference content-data vs code-facts (version match, entity coverage, API coverage %)
- Pass 6: TC scaling (expected vs actual TC count per feature)

**Claude Code** (has Bash): run directly:
```bash
SKILL_DIR="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"
python "$SKILL_DIR/../engine/tools/quality_score.py" \
  --content-data "{DOCS_PATH}/output/content-data.json" \
  --code-facts   "{DOCS_PATH}/intel/code-facts.json" \
  --output       "{DOCS_PATH}/intel/quality-report.json"
```

**Cursor** (no Bash tool): skip quality_score.py; rely on MCP validate result only.

### Scoring

MCP validate provides authoritative `errors` + `warnings` list.
quality_score.py adds a numeric score (0-100) for reporting. Use this table:

| MCP validate result | quality_score verdict | Action |
|---|---|---|
| errors=[] AND warnings=[] | PASS | Advance Phase 4 |
| errors=[] AND warnings=whitelisted only | PASS (whitelist) | Advance Phase 4 |
| errors=[] AND score ≥ 80 | PASS | Advance Phase 4 |
| errors=[] AND score 60–79 | WARN | Display report + prompt user continue |
| errors present OR score < 60 | BLOCK | Must fix, re-run Stage 5a |

Escape: `/generate-docs --skip-quality-gate` (ONLY for legacy/approved content re-export).

---

## Pass detail

### Pass 1 — Placeholder budget

Reference `PLACEHOLDER_BUDGET` in `tools/quality_score.py`:

| Section | Budget |
|---|---|
| overview | 2 |
| architecture | 3 |
| tkcs | 15 |
| tkct | 8 |
| services | 0 (exclude features instead of placeholder) |
| test_cases | 0 (skip TC or generate instead) |

Over budget → fix via Stage 5a deeper Bậc 1+2 scan.

### Pass 2 — Cross-reference

Checks:
- Tech stack versions match `code-facts.tech_stack`
- `len(architecture.components)` consistent with `code-facts.docker.services`
- Entities ⊇ `code-facts.entities`
- API coverage ≥ 80% of `code-facts.routes`

Fail → update content-data from code-facts (authoritative).

### Pass 3 — Specificity

Per prose section (≥ 200 words):
- ≥ 5 numbers per 500 words
- ≥ 3 named entities per 500 words
- ≥ 1 date/period marker

Below 70% of target → WARN "prose hời hợt".

### Pass 4 — Banned phrases

Detect in strict sections:
- `tkcs.current_state`, `tkcs.necessity`, `tkcs.technology_rationale`
- `tkcs.functional_design`
- `architecture.system_overview`, `architecture.security_description`, `architecture.logical_description`

Banned list in `tools/quality_score.py.BANNED_PHRASES_STRICT`.

### Pass 5 — Section word count (F1)

Enforce min words per section path. Reference `SECTION_MIN_WORDS` in `tools/quality_score.py`.

```
if actual < min × 0.5: blocker
elif actual < min × 0.7: major
elif actual < min: minor
```

Fix via Stage 5a Depth Pass — iterate specific section with more intel queries.

### Pass 6 — TC scaling (F2)

Per feature expected vs actual:

```
expected = 1 + len(actors) × 2 + validations × 3 + len(error_cases) + 3
actual = count_tcs(feature_id)

if actual < expected × 0.5: blocker
elif actual < expected × 0.7: major
elif actual < expected × 0.9: minor
```

Fix via Stage 5a expand TCs from validation constraints + `@Notepads edge-case-tc-templates`.

---

## Output schema

```jsonc
{
  "meta": {
    "evaluated_at": "<ISO>",
    "score": 78,
    "verdict": "warn",
    "threshold_pass": 80,
    "threshold_warn": 60
  },
  "pass_1_placeholders": {...},
  "pass_2_cross_reference": [...],
  "pass_3_specificity_weak": [...],
  "pass_4_banned_prose": [...],
  "pass_5_word_count": [...],
  "pass_6_tc_scaling": [...],
  "recommendations": [<actionable fix hints>]
}
```

---

## Quality score formula

```python
score = 100
score -= 5 * placeholder_overshoot
score -= 10 * cross_ref_fails
score -= 2 * specificity_warnings
score -= 5 * banned_phrase_occurrences
score -= 15 * word_count_blockers + 5 * word_count_majors
score -= 10 * tc_scaling_blockers + 3 * tc_scaling_majors
score = max(0, score)
```

---

## Integration

```
Stage 5a Depth Pass → content-data refined
Stage 5b Quality Gate (THIS) → verify
  PASS → Phase 4 Export
  WARN → user decides continue or redo 3g
  BLOCK → redo 3g OR abort
```
