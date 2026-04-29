# Intel Layer Integration — `from-doc`

This skill is the doc-side producer for the shared Intel Layer (CLAUDE.md rule **CD-10**). The `doc-intel` agent writes canonical artifacts at `{workspace}/docs/intel/` validated by `~/.claude/schemas/intel/`.

## Producer changes

### Step 3 — `doc-intel` agent now writes schema-conformant artifacts

Previously `doc-intel` wrote loose JSON + Markdown prose. New requirement:

1. **`actor-registry.json`** — full schema conformance (`~/.claude/schemas/intel/actor-registry.schema.json`)
   - `evidence[].kind = "doc"` for image/page references
   - `confidence` per role based on number of evidence items
   - `source_producers: ["doc-intel"]`

2. **`permission-matrix.json`** — NEW output, replaces inline prose in `doc-brief.md §3` and `§7.6`
   - Extract Permission tables from doc into structured rows
   - For each row: identify `role` (slug from actor-registry), `resource.id` (feature/route), `actions[]`
   - When doc text is ambiguous → write to `uncovered_resources[]` with `reason: "deferred_to_business"`
   - `confidence: "medium"` (single-source, doc-derived)

3. **`sitemap.json`** — schema conformance (existing path; `~/.claude/schemas/intel/sitemap.schema.json`)
   - `roles[].menu_tree[]` from doc §7.5
   - `feature_overrides[].workflow_variants{}` from §7.6
   - `routes[]` populated only if doc explicitly lists URLs (otherwise leave for from-code to fill)
   - `routes[].playwright_hints` left empty (from-code will populate)

4. **`feature-catalog.json`** — schema conformance
   - `role_visibility[]` derived from §7 "Visible to roles" column
   - `evidence[].kind = "doc"` per feature

5. **`doc-brief.md`** — kept for human review BUT no longer source of truth for permissions
   - §3 Actors becomes a rendered VIEW of actor-registry.json (regenerated, not authored)
   - §7.6 Workflow Variants becomes a rendered VIEW of sitemap.feature_overrides

6. **`test-evidence/{feature-id}.json`** — NEW output (CD-10 Quy tắc 14, Gate 1: TC seed synthesis)
   - For EVERY feature extracted from doc → produce a test-evidence file with synthesized TC seeds
   - Source synthesis from `acceptance_criteria[]` + `roles[]` + `dialogs[]` + `error_cases[]` (whichever doc surfaces)
   - Schema:
     ```json
     {
       "schema_version": "1.0",
       "feature_id": "<id>",
       "feature_name": "<name>",
       "module": "<module>",
       "test_cases": [
         {
           "id": "TC-{module}-{role_slug}-HAPPY-001",
           "name": "<VN human-readable, derived from feature.name + AC>",
           "role_slug": "<slug>",
           "priority": "Rất cao | Cao | Trung bình | Thấp",
           "preconditions": "<auth + data state>",
           "steps": [{"no": 1, "action": "<verb-first VN>", "expected": "<observable>"}],
           "expected_result": "<final outcome>",
           "labels": ["smoke", "role-{slug}"],
           "design_technique": "ep | bva | dt | st | eg | domain",
           "source": "from-doc/synthesized",
           "execution": {"status": "not-executed"}
         }
       ]
     }
     ```
   - Min count per feature (CD-10 Quy tắc 15):
     `min_tc = max(5, len(AC)*2 + len(roles)*2 + len(dialogs)*2 + len(error_cases) + 3)`
   - Generation algorithm (deterministic, no hallucination):
     1. **Happy path × visible role**: 1 TC per role × 1 (priority "Rất cao", labels: smoke + happy-path)
     2. **Forbidden access × invisible role**: 1 TC per non-visible role (priority "Rất cao", labels: rbac + security + access-denied)
     3. **AC negative × 1**: 1 TC per AC inverted (priority "Cao", labels: validation + negative)
     4. **Dialog × 3**: confirm + cancel + validation per dialog (priority "Cao", labels: dialog)
     5. **Error case × 1**: 1 TC per error_case (priority "Cao", labels: error-handling)
     6. **VN-gov dimensions** (3 baseline per feature): audit_log, vn_diacritics, concurrent_edit (priority "Trung bình"|"Thấp")
   - All synthesized TCs MUST have `source: "from-doc/synthesized"` and `execution.status: "not-executed"` — these are PROPOSED, awaiting Cursor SDLC implementation + QA execution.
   - `feature-catalog.features[].test_evidence_ref` MUST be set to `"docs/intel/test-evidence/{feature-id}.json"` after writing.
   - `feature-catalog.features[].qa_status` initialized to `"pending"` (will become `"passed"` after Cursor close-feature).

### Required producer calls

After every artifact write:

```bash
python ~/.claude/scripts/intel/meta_helper.py update docs/intel/ <artifact> \
  --producer doc-intel \
  --ttl <90 for actor, 60 for permission, 30 for sitemap/feature-catalog> \
  --sources docs/source/<doc files used>
```

If artifact already exists with different `producer` in `_meta.merged_from[]`:
1. Write to `<artifact>.new.json` instead
2. Invoke `intel-merger` (Bash: `python ~/.claude/scripts/intel/merger.py docs/intel/ <artifact> --new docs/intel/<artifact>.new.json --producer doc-intel`)

### Validation gate

Before `doc-intel` declares Phase 1.5 complete:

```bash
# Invoke intel-validator subagent in --quick mode
# If errors → halt, return validator report
# If warnings only → log + continue
```

## Path convention (unchanged)

`from-doc` already uses `{workspace}/docs/intel/` — no path migration needed. Only schema conformance + meta-update calls are new.

## Cross-skill reuse

When `from-code` already populated `actor-registry.json` (e.g. user ran from-code first):
- `doc-intel` reads existing → produces `<file>.new.json` → calls `intel-merger`
- Result: doc-intel contributes display names + descriptions; tdoc-researcher's URLs/auth survive

## Anti-patterns (forbidden)

- Writing permission data as Markdown prose in `doc-brief.md` without also producing `permission-matrix.json`
- Skipping `meta_helper.py update` after artifact write
- Inferring routes from doc when from-code's routes are present and fresher
- Inlining credentials into `actor-registry.auth.credentials_ref` (must be reference)
- Skipping test-evidence synthesis (Gate 1) — every feature MUST have `test-evidence/{id}.json` with ≥ `min_tc(feature)` synthesized TC seeds before `doc-intel` Phase 1.5 completes
- Setting `execution.status: "passed"` on synthesized TCs (only Cursor QA agent can mark passed; from-doc seeds always `"not-executed"`)
- Tagging seeds with anything other than `source: "from-doc/synthesized"`

## Backward compatibility

`doc-brief.md` and `tech-brief.md` remain. Their content is now derived from intel artifacts (regenerated whenever intel changes), not authored as primary source. Phase 3 cleanup will add explicit "regenerate from intel" command.
