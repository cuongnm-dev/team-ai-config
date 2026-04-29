# Stage 5c — Self-Critique (Optional, invoke `/strategic-critique` skill)

**ROLE**: Auto-invoke `strategic-critique` skill on generated content-data + docx, iterate to address findings.

**TRIGGER**:
- Auto: Stage 5b quality score 60–79 (WARN)
- Manual: `/generate-docs --multi-pass` flag
- Skip: score ≥ 80 OR `--no-multi-pass`

**RUNTIME**: +2–3 min per pass. Max 2 passes.

---

## Why exist

Stage 5b catches **structural** issues (placeholders, banned phrases, word count). Phase 5 catches **substantive** issues (missing DEDUP, invalid legal refs, incoherent cross-section logic, feasibility problems).

---

## Strategic-critique 7 rubrics applied

1. Formal check (NĐ 30/2020)
2. Substantive (vague language)
3. Coherence (cross-section)
4. Alignment (QĐ 749 / CT 34)
5. DEDUP (NDXP / LGSP / CSDLQG)
6. Feasibility (timeline + budget)
7. Legal ref validity

---

## Protocol

### Pass 1 — Critique content-data

```
/strategic-critique {DOCS_PATH}/output/content-data.json --severity blocker,major
```

Output: `{DOCS_PATH}/output/critique-findings.yaml`

### Pass 2 — Classify findings

```python
findings_by_action = {
    "auto_fix": [],           # Text replace (e.g. NĐ 73/2019 → NĐ 45/2026)
    "regenerate_section": [], # Section rewrite needed
    "user_decision": []        # Ambiguous (e.g. DEDUP trade-off)
}

for f in findings:
    if f.check == "legal" and f.severity == "blocker":
        findings_by_action["auto_fix"].append(f)
    elif f.check == "vague" and f.severity in ("major", "blocker"):
        findings_by_action["regenerate_section"].append(f)
    elif f.check == "dedup":
        findings_by_action["user_decision"].append(f)
```

### Pass 3 — Auto-fix loop

For each auto-fix finding:
```
content[f.section] = content[f.section].replace(f.excerpt, f.fix_suggested)
```

Commit via `mcp__etc-platform__merge_content`.

### Pass 4 — Regenerate weak sections

For regenerate findings → Phase 3 partial re-run for affected sections:

Context for re-run:
- Original intel (doc-intel, code-facts)
- PLUS critique findings (vague phrases detected, specificity requirements)
- Instruction: "Use ONLY specific numbers/dates/named entities per rubric 02-substantive."

### Pass 5 — User decisions

Display ambiguous findings:

```
⚠ F-002 DEDUP miss:
Section 5.3 proposes building auth service.
NDXP already provides VNeID + auth service.

Options:
  A) Apply dedup redirect (replace with "integrate NDXP auth") — RECOMMENDED
  B) Justify custom build (add rationale to section 5.3)
  C) Ignore (document why, accept thẩm định risk)

Your choice: _
```

User picks A/B/C → skill acts.

### Pass 6 — Final validate

Re-run strategic-critique → ensure score improved. Max 2 iterations total.

---

## Output

```jsonc
{
  "meta": {
    "iterations_run": 2,
    "findings_addressed": 24,
    "final_quality_score": 87
  },
  "iteration_1": {
    "findings_found": 34,
    "auto_fixed": 8,
    "section_regenerated": 3,
    "user_decisions": 4,
    "remaining_after": 19
  },
  "iteration_2": {
    "findings_found": 19,
    "remaining_after": 16,
    "remaining_breakdown": {"minor": 14, "info": 2},
    "verdict": "acceptable — only minor/info remaining"
  }
}
```

---

## Trigger matrix

| Condition | Phase 5 runs? |
|---|---|
| Stage 5b score ≥ 80 | Skip |
| Stage 5b score 60–79 | Auto-run (1 pass) |
| Stage 5b score < 60 | Block, user redo Stage 5a |
| `--multi-pass` flag | Force run |
| `--no-multi-pass` | Skip always |

---

## Expected quality lift

| Starting score | After 1 pass | After 2 passes |
|---|---|---|
| 60 | 72 | 80 |
| 70 | 82 | 87 |
| 80 | 88 | 91 |

Diminishing returns after pass 2. Convergence ~85–92.

---

## Integration

Phase 5 invokes `strategic-critique` skill as sub-skill. Both skills must be installed:
- `~/.cursor/skills/generate-docs/` (this skill)
- `~/.cursor/skills/strategic-critique/` (sibling, rubrics/*.md reused)

No rubric duplication.

---

## Limitations

1. Auto-fix limited to simple replace. Vague language needs Phase 3 partial rerun (costly).
2. User decisions block full automation when DEDUP trade-offs present.
3. strategic-critique has false positives — treat as checklist, not verdict.
4. Max 2 passes (cost control). After that → user manual review required.
5. +30K tokens per pass (not cheap).

Disable: `--no-multi-pass`.
