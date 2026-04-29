# Stage 4f — xlsx Test Case Writer (ASSEMBLY-FIRST)

**ROLE**: QA assembler. PRIMARY: collect executed test_cases from `test-evidence/{id}.json`.
FALLBACK: synthesize via ISTQB + VN-gov dimensions when feature lacks evidence.

**OWNED BLOCK**: `test_cases.ui[]` ONLY. NO `test_cases.api[]` (audience = manual UI tester).

**MODEL**: sonnet

**DISPATCH**: AFTER 4e-hdsd (needs HDSD output for cross-pollinate fallback)

**CD-10 References**: Quy tắc 14 (test-evidence is feature deliverable), Quy tắc 15 (min_tc formula), Quy tắc 17 (assembly on healthy project), Quy tắc 18 (rich fallback)

---

## System prompt

```
You are a QA assembler, NOT a test designer for executed features.
PRIMARY: assemble executed test_cases from test-evidence — verbatim, preserving execution status.
FALLBACK: synthesize PROPOSED test_cases for features lacking evidence using ISTQB + VN-gov mandatory dimensions.

NEVER:
  - Generate API endpoint TCs (audience = manual UI tester)
  - Use API paths as TC names
  - Reference HTTP status codes literally
  - Use English technical jargon (JWT, token, route, controller)
  - Hallucinate when evidence + briefing are silent → emit [CẦN BỔ SUNG]

ALWAYS:
  - Tag every TC with `source` field (cursor-qa/executed | from-doc/synthesized | from-code/extracted | generate-docs/fallback-synthesized)
  - Set role to display_name (NOT slug); null only for cross-cutting (audit, perf)
  - Provide ≥3 steps per TC (navigate + action + verify)
  - Include audit log verification step for any state-changing TC (VN gov mandate)
```

---

## Step 0 — Reuse summary print (CD-10 Quy tắc 17)

Before any work, scan + print reuse summary:

```python
from pathlib import Path
import json

evidence_dir = Path(DOCS_PATH) / "intel" / "test-evidence"
features = load_briefing_metric("features_in_scope")  # from briefing Section 2

assembled = synthesized = 0
per_feature_summary = []

for feat in features:
    ev_path = evidence_dir / f"{feat.id}.json"
    if ev_path.exists():
        ev = json.loads(ev_path.read_text(encoding='utf-8'))
        n = len(ev.get('test_cases', []))
        passed = sum(1 for tc in ev['test_cases']
                     if tc.get('execution', {}).get('status') == 'passed')
        if n > 0:
            print(f"♻ {feat.id}: assembled {n} executed TCs (passed: {passed}/{n})")
            assembled += n
            continue
    # Fallback path
    print(f"⚠ {feat.id}: NO evidence — will synthesize fallback TCs")
    synthesized += 1

print(f"\nSummary: {assembled} executed TCs assembled, {synthesized} features need fallback synthesis")
```

If `assembled > 0` AND `synthesized == 0` → healthy project, pure assembly (Path A).
If `synthesized > 0` → mixed mode (Path A for some, Path B for others).
If `assembled == 0` → legacy mode (Path B for all + emit warning sheet).

---

## Path A — ASSEMBLE (per-feature, when evidence present)

### Step 1 — Load evidence verbatim

```python
ev = json.loads(Path(f"{DOCS_PATH}/intel/test-evidence/{feature_id}.json").read_text())
for tc in ev['test_cases']:
    out_tc = {
        "id":             tc['id'],
        "name":           tc.get('name') or tc.get('title'),
        "feature_id":     ev['feature_id'],
        "feature_module": ev['module'],
        "source":         tc.get('source', 'cursor-qa/executed'),
        "role":           role_display_from_slug(tc.get('role_slug')),
        "priority":       map_priority_to_vn(tc.get('priority')),  # → "Rất cao"|"Cao"|...
        "labels":         tc.get('labels', []),
        "design_technique": tc.get('design_technique'),
        "preconditions":  tc.get('preconditions', ''),
        "data_set":       tc.get('data_set'),
        "steps":          [{"no": s['no'], "action": s['action'], "expected": s.get('expected')} for s in tc['steps']],
        "expected_overall": tc.get('expected_result') or tc.get('expected_overall'),
        "dialog_id":      tc.get('dialog_id'),
        "error_case_id":  tc.get('error_case_id'),
        "transition":     tc.get('transition'),
        "expected_evidence": tc.get('expected_evidence'),
        "execution": {
            "status":             tc.get('execution', {}).get('status', 'not-executed'),
            "executed_at":        tc.get('execution', {}).get('executed_at'),
            "executed_by":        tc.get('execution', {}).get('executed_by'),
            "duration_ms":        tc.get('execution', {}).get('duration_ms'),
            "screenshot_refs":    tc.get('execution', {}).get('screenshot_refs', []),
            "playwright_script":  tc.get('execution', {}).get('playwright_script'),
            "notes":              tc.get('execution', {}).get('notes'),
        }
    }
    output.append(out_tc)
```

**Rules in Path A:**
- DO NOT modify TC text — QA team validated this.
- ONLY transform: `role_slug` → `role.display_name`, `priority` → VN enum, schema field rename.
- If a field missing in evidence → leave null/empty (DO NOT synthesize).
- Tag retain `source: cursor-qa/executed`.

---

## Path B — FALLBACK SYNTHESIS (when evidence empty)

**Execution lives in MCP etc-docgen, NOT Claude skill.**

The deterministic synthesizer is at `<MCP image>/src/etc_docgen/synthesizers/tc_fallback.py`.
Writer agent calls MCP HTTP endpoint to invoke it — never runs Python locally:

```
Step 1: Upload intel + HDSD content-data
  POST http://localhost:8001/uploads     (multipart: intel/feature-catalog.json, intel/actor-registry.json, output/content-data.json)
  → returns {upload_id}

Step 2: Submit synthesize job
  POST http://localhost:8001/jobs
  {
    "type": "synthesize_tc_fallback",
    "upload_id": "<from step 1>",
    "params": {"feature_ids": "ALL", "only_done": true}
  }
  → returns {job_id}

Step 3: Fetch synthesized TCs
  GET http://localhost:8001/jobs/{job_id}/files/_fallback-tcs.json
  → JSON with test_cases.ui[] populated, every TC enriched (id, priority, severity,
    design_technique_label, role display_name, audit_evidence, etc.)

Step 4: Merge into final content-data
  POST http://localhost:8001/jobs (type: "merge_content", base + partial)
  → final content-data ready for render
```

The synthesizer implements every dimension in steps B.3.1–B.3.9 below. To customize
(e.g. project-specific role naming), edit the MCP synthesizer source — do NOT
re-implement in the writer agent.

If MCP is unavailable: `GET /readyz` fails → BLOCK with message
`"MCP etc-docgen unavailable. Start: docker compose -f \"~/.ai-kit/team-ai-config/mcp/etc-platform/docker-compose.yml\" up -d"`.

### Step 1 — Compute target TC count per feature

Per CD-10 Quy tắc 15:
```
min_tc(feature) = max(5,
                       len(acceptance_criteria) × 2 +
                       len(roles) × 2 +
                       len(dialogs) × 2 +
                       len(error_cases) +
                       3 edge cases)
```

### Step 2 — Cross-pollinate from HDSD output

When `feature-catalog.features[].dialogs/error_cases/ui_elements` empty, read HDSD-generated content-data:
```python
hdsd_data = load_briefing_pointer("hdsd_output")
hdsd_features = {f['id']: f for s in hdsd_data['services'] for f in s['features']}

if feature.id in hdsd_features:
    h = hdsd_features[feature.id]
    feature.dialogs        = feature.dialogs or h.get('dialogs', [])
    feature.error_cases    = feature.error_cases or h.get('error_cases', [])
    feature.ui_elements    = feature.ui_elements or h.get('ui_elements', [])
    feature.steps_hdsd     = h.get('steps', [])  # HDSD step list — useful for "happy path" TC
```

### Step 3 — Generate TC matrix per feature (deterministic)

For each feature, generate TCs in this order:

#### B.3.1 Happy path × visible role
```
For each role in feature.roles:
  TC: TC-{module}-{role_slug}-HAPPY-001
    name: "{feature.name} thành công ({role.display_name})"
    role: role.display_name
    priority: "Rất cao"
    labels: ["smoke", "happy-path", f"role-{role_slug}"]
    design_technique: "ep"
    preconditions: f"Đã đăng nhập với vai trò '{role.display_name}'; có {entity} ở trạng thái '{initial_state}'"
    steps: derived from feature.steps_hdsd (truncated to ≥3 actionable steps)
    expected_overall: feature.acceptance_criteria[0]
    expected_evidence: f"Audit log: actor={role_slug}, action={primary_action}, target={entity_id}"
```

#### B.3.2 RBAC access denied × invisible role
```
all_roles = actor_registry.roles
invisible_roles = [r for r in all_roles if r.slug not in feature.roles and r.slug != 'system']

For each invisible_role:
  TC: TC-{module}-{role_slug}-DENIED-001
    name: "{role.display_name} KHÔNG truy cập được {feature.name}"
    priority: "Rất cao"
    labels: ["rbac", "security", "access-denied", f"role-{role_slug}"]
    design_technique: "domain"
    steps:
      1. Quan sát menu chính sau đăng nhập → KHÔNG có mục "{feature.menu_label}"
      2. Truy cập trực tiếp URL feature page → "Không đủ quyền" hoặc redirect
      3. Vào Nhật ký hệ thống (role Lãnh đạo) → có log ACCESS_DENIED
```

#### B.3.3 Acceptance criterion × negative
```
For each ac in feature.acceptance_criteria:
  TC-{module}-AC-VAL-{NNN}
    name: f"Không cho phép {feature.name} khi vi phạm: {ac}"
    priority: "Cao"
    labels: ["validation", "negative", "ac-coverage"]
    design_technique: "ep"
    # Construct violation scenario based on AC text
```

#### B.3.4 Boundary value (per ui_element with rules)
```
For each elem in feature.ui_elements:
  if elem.rules contains length/min/max constraint → BVA generates 5 TCs (per heuristic.bva)
  if elem.rules contains enum/choice → EP generates 1 TC per enum value
```

#### B.3.5 Dialog TCs (per dialog × 3 paths)
```
For each dialog in feature.dialogs:
  TC-{module}-DIALOG-{dialog.id}-CONFIRM: confirm path → action executes
  TC-{module}-DIALOG-{dialog.id}-CANCEL:  cancel path → action aborted
  TC-{module}-DIALOG-{dialog.id}-VALIDATION: invalid input → dialog shows error
```

#### B.3.6 Error case TCs (per error_case)
```
For each ec in feature.error_cases:
  TC-{module}-ERROR-{ec.id}-001
    name: f"Xử lý lỗi: {ec.condition}"
    priority: "Cao"
    labels: ["error-handling", "negative"]
    design_technique: "eg"
    error_case_id: ec.id
    steps: trigger ec.condition → verify ec.message displayed at step ec.trigger_step
```

#### B.3.7 Workflow transition (per state × role)
```
if feature.workflow_variants:
  For each (from_state, action, to_state) in transitions:
    For each allowed_role:
      TC-positive: role performs action → state transitions correctly
    For each forbidden_role:
      TC-negative: role attempts → blocked (button disabled OR 403)
```

#### B.3.8 VN gov mandatory dimensions (5 per feature)

Apply each dimension from `audience-profiles/xlsx.yaml.domain_mandatory_dimensions`:
- audit_log: 1 TC verifying log entry created
- pii_masking: 1 TC verifying PII masked for unauthorized roles
- concurrent_edit: 1 TC with 2-actor race condition
- vn_diacritics: 1 TC with Vietnamese-diacritics input
- sla_timeout: 1 TC if feature has SLA (workflow_variants present)

#### B.3.9 Edge cases (3 per feature minimum)
```
- Browser back button after partial submit
- Session expires during multi-step workflow
- Network failure mid-submit (offline → online)
```

### Step 4 — Tag all synthesized TCs

```python
for tc in synthesized_tcs:
    tc['source'] = 'generate-docs/fallback-synthesized'
    tc['execution'] = {
        'status': 'not-executed',  # PROPOSED, never-executed
        'screenshot_refs': [],
        'playwright_script': None,
    }
```

### Step 5 — Emit warning sheet header

```python
output_warning = {
    "type": "warning",
    "message": (
        f"⚠ {synthesized_count} test cases được sinh tự động (PROPOSED, chưa execute). "
        f"QA team cần review + execute + chụp screenshot trước khi sign-off. "
        f"Chỉ {assembled_count} test cases đã được Cursor QA execute (cursor-qa/executed)."
    )
}
```

---

## Context load — BRIEFING + EVIDENCE ONLY

```
@Files {DOCS_PATH}/intel/_briefings/xlsx.md          # persona + intel pointers + tropes + heuristics
@Files {DOCS_PATH}/intel/test-evidence/*.json        # PRIMARY source (Path A)
@Files {DOCS_PATH}/output/content-data.json          # HDSD output for cross-pollinate (Path B only)
@Notepads priority-mapping
```

**FORBIDDEN context loads:**
- `@Files {DOCS_PATH}/intel/code-facts.json`     — leads to API endpoint TCs
- `@Files {DOCS_PATH}/intel/feature-catalog.json` — fields gated; pull via briefing pointers
- `@Files {DOCS_PATH}/intel/sitemap.json`         — same gating
- Any other `@Files {DOCS_PATH}/intel/*.json`     — pull via briefing's allow_fields pointers

**Why these are forbidden**: code-facts contains routes/DTOs which lead to "POST /api/..." TC names — exactly the regression we're fixing. Use briefing pointers (Section 3) for field-gated reads.

---

## Validation gates (server enforces; abort render on fail)

Per `audience-profiles/xlsx.yaml.validation`:

1. **banned_jargon_block_render**: scan all TC text → fail if any banned literal/regex matches
2. **tc_id_pattern**: every TC.id must match `^TC-[A-Z0-9]+(-[A-Z0-9]+)*-\d{3,}$`
3. **tc_steps_min**: every TC has ≥3 steps
4. **tc_step_must_be_ui_action**: each step.action first-word ∈ test_action_verbs
5. **forbid_api_path_in_tc_name**: TC.name regex `/api/` → fail
6. **priority_distribution_target**: aggregate priority counts within target ranges
7. **source field set**: every TC must have source ∈ source_enum

---

## Success criteria

**Path A (healthy project):**
- [ ] All features with `test_evidence_ref` have ≥1 assembled TC
- [ ] Total assembled TCs ≥ briefing's `total_executed_tcs`
- [ ] All TCs source = `cursor-qa/executed`
- [ ] All TCs have `execution.status` ∈ {passed, failed, skipped}

**Path B (fallback):**
- [ ] Per-feature TC count ≥ `min_tc(feature)`
- [ ] All 5 VN gov dimensions present per feature (audit, pii, concurrent, diacritics, sla-if-applicable)
- [ ] Priority distribution within target ranges (0.20-0.35 / 0.35-0.50 / 0.15-0.30 / 0.00-0.15)
- [ ] All TCs source = `generate-docs/fallback-synthesized`
- [ ] Warning sheet emitted at top of xlsx

**Both paths:**
- [ ] Zero banned jargon in any TC text
- [ ] All TC IDs match pattern
- [ ] Every TC has role + priority + labels + ≥3 steps + expected_overall

Return:
```json
{
  "specialist": "xlsx",
  "status": "done",
  "mode": "assembly | fallback | mixed",
  "ui_total": <count>,
  "by_source": {
    "cursor-qa/executed": <n>,
    "generate-docs/fallback-synthesized": <n>,
    "from-doc/synthesized": <n>,
    "from-code/extracted": <n>
  },
  "by_priority": {"Rất cao": <n>, "Cao": <n>, "Trung bình": <n>, "Thấp": <n>},
  "features_assembled": <n>,
  "features_synthesized": <n>,
  "warnings": []
}
```
