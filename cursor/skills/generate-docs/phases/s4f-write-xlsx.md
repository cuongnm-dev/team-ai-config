# Stage 4f — xlsx Specialist (Custom Mode "xlsx Writer")

**ROLE**: QA engineer. Generate test cases data-driven from validation constraints + features + API endpoints.

**OWNED BLOCKS**: `test_cases.ui[]`, `test_cases.api[]`

**MODEL**: sonnet

**DISPATCH**: AFTER 03e-hdsd (needs services.features from HDSD output)

---

## System prompt

```
You are a QA engineer generating test cases data-driven.
Output language: Vietnamese for TC names/steps/expected. Structured JSON.
rules:
  - Every validation constraint → 3 boundary TCs (at-limit, below, above)
  - Every HDSD error_case → 1 TC
  - Every API endpoint → 5+ TCs (success, validation-err, auth-err, authz-err, boundary per param)
  - Per feature ≥ 15 TCs
  - Priority MUST be one of 4 VN strings: "Rất cao" | "Cao" | "Trung bình" | "Thấp" (strict enum)
```

---

## Step 0 — Test-evidence reuse gate (REUSE-FIRST)

**Principle:** test cases authored by `resume-feature` QA stage are AUTHORITATIVE. This stage primarily ASSEMBLES + AUGMENTS, not invents (CD-10 §10).

```
For each feature in feature-catalog.features[]:
  evidence_path = "docs/intel/test-evidence/{feature.id}.json"
  
  IF feature.test_evidence_ref AND exists(evidence_path):
    Load evidence.test_cases[]
    Convert to xlsx test_cases.ui[] / test_cases.api[] format (preserve VN strings, map type→sheet, priority enum):
      - evidence.test_cases[].id          → tc_id
      - evidence.test_cases[].title       → tc_name
      - evidence.test_cases[].steps[]     → steps (preserve order, action, expected)
      - evidence.test_cases[].expected_result → expected_overall
      - evidence.test_cases[].execution.status → execution_result (passed/failed/skipped)
      - evidence.test_cases[].priority    → map to "Rất cao"|"Cao"|"Trung bình"|"Thấp"
      - evidence.test_cases[].role_slug   → role column
    
    print: "Stage 4f [{feature.id}]: ♻ REUSED {N} test cases from QA stage (executed: {M passed/K total})"
    
    Then AUGMENT (do not duplicate):
      - Add boundary TCs from code-facts.validation_constraints[] not yet covered
      - Add API endpoint TCs from architecture.apis[] not yet covered
      - Add HDSD error_case TCs not yet covered
      - Tag augmented TCs with `source: "generate-docs/augment"` for traceability
    
    Skip "invent ≥15 TCs from scratch" rule for reused features.
  
  ELSE (no evidence — feature not yet QA'd or pre-MVP):
    Apply original generation rules (15+ TCs from validation/api/error_case)
    Tag all as `source: "generate-docs/synthesized"` — these are PROPOSED, not executed.
    Print warning: "Stage 4f [{feature.id}]: ⚠ NO test-evidence — synthesized TCs (NOT executed)"
```

**Anti-pattern (FORBIDDEN):** discarding evidence test cases and re-inventing. Cursor SDLC's QA agent already validated these against actual UI; re-invented TCs are speculation.

## Context load

```
@Files {DOCS_PATH}/output/content-data.json            # services.features (03e), architecture.apis (03b)
@Files docs/intel/feature-catalog.json                 # canonical features + test_evidence_ref
@Files docs/intel/test-evidence/*.json                 # PRIMARY source — reuse-first
@Files {DOCS_PATH}/intel/code-facts.json               # validation_constraints — used for AUGMENT only
@Files {DOCS_PATH}/intel/sitemap.json                  # multi-role only: menu_tree, workflow_variants
@Notepads priority-mapping
@Notepads edge-case-tc-templates
@Notepads sitemap-schema                               # canonical sitemap.json reference
```

**Auto-attach MDC**: `generate-docs-base`, `generate-docs-xlsx`

---

## TC count formula

```
# Per feature
tc_count(feature) = 1                               # happy path
                  + len(actors) × 2                 # permission matrix
                  + count_validations(feature) × 3  # boundary × 3
                  + len(error_cases)                # from HDSD
                  + len(dialogs) × 2                # dialog confirm+cancel (or 3 for form dialogs)
                  + 3                               # edge cases

# Per API endpoint
api_tc_count(ep) = 1                                # success 2xx
                 + 1                                # validation 400
                 + 1                                # auth 401
                 + 1                                # authz 403
                 + (1 if has_path_param else 0)     # 404
                 + count_params(ep) × 2             # boundary per param
```

Typical output: 500-1000 TCs for 30-feature + 45-endpoint project.

---

## TC schema

```json
{
  "tc_id": "TC-<feature-or-api>-<seq>",
  "name": "<concise tc description vn>",
  "steps": [
    {"no": 1, "action": "<action-vn>"}
  ],
  "expected": [
    {"no": 1, "expected": "<expected-vn>"}
  ],
  "priority": "Rất cao | Cao | Trung bình | Thấp",
  "preconditions": "<precondition vn>",
  "checklog": "<log check vn>",
  "redirect": "<path>",
  "notes": "<optional>",
  "feature_id": "F-<ID>",
  "labels": ["smoke", "auth", ...]
}
```

steps[] and expected[] must have matching `no` values 1:1.

**MINIMUM DEPTH REQUIREMENTS (enforced by quality_checks.py)**:
- UI TCs: **≥ 2 steps** per TC minimum (navigate to page → perform action → verify result = 3 steps typical)
- API TCs: **≥ 1 step** per TC (request details + expected HTTP code + response body)
- All TCs: `expected[]` must be **non-empty** — every step must have a documented expected outcome
- `preconditions`: must be non-empty for TCs with > 2 steps or involving auth/role
- `feature_id`: must be set for all UI TCs and all API TCs that map to a feature

**STEP QUALITY** — each step must be **specific**:
```
❌ BAD: {"no": 1, "action": "Nhấn nút Lưu"}  ← no context
✓ GOOD: {"no": 3, "action": "Nhấn nút 'Lưu hồ sơ' trên thanh công cụ", 
          "expected": "Hệ thống hiển thị toast 'Lưu thành công', URL chuyển về /ho-so/list"}
```

**ERROR CASE TCs** — must document `expected_http_code` or `expected_ui_state`:
```
step: {"action": "Nhập email không hợp lệ → Submit",
       "expected": "HTTP 422 Unprocessable Entity; body: {errors: [{field:'email', msg:'Invalid email format'}]}"}
```

---

## Generation rules

### Rule 1: Happy path (per feature)

1 TC priority "Rất cao", covers primary business flow.

### Rule 2: Permission matrix (per actor × 2)

For each actor: 1 TC allowed + 1 TC forbidden (testing role boundary).

### Rule 3: Validation boundary (per constraint × 3)

For each `code-facts.validation_constraints` entry linked to feature:

| Constraint | TC 1 | TC 2 | TC 3 |
|---|---|---|---|
| `@Length(1, 200)` | empty → 400 | 200 chars → success (at-limit) | 201 chars → 400 (above) |
| `@Min(0) @Max(100)` | -1 → 400 | 100 → success | 101 → 400 |
| `@IsEmail` | "invalid" → 400 | "valid@email" → success | (skip TC 3) |
| `@IsIn([a,b,c])` | "hacker" → 400 | each enum → success | (one per enum) |

### Rule 4: Error cases from HDSD

1 TC per `feature.error_cases[]` entry.

### Rule 5: Edge cases (per feature)

3 TCs from `@Notepads edge-case-tc-templates`. Select relevant: SQL injection, XSS, concurrent edit, Vietnamese diacritics, etc.

### Rule 6: API TCs

For each endpoint in `architecture.apis[]`:
- 1 success
- 1 validation error
- 1 auth 401
- 1 authz 403
- 1 per path param → 404 test
- boundary per param (×2)

### Rule 7: Dialog TCs (per `feature.dialogs[]`)

For EVERY dialog documented in HDSD, generate these TCs:

| Dialog type | Required TCs |
|---|---|
| `confirm` | TC1: click confirm button → action executes + success feedback; TC2: click cancel/close → action aborted, data unchanged |
| `form` | TC1: submit with all valid fields → success; TC2: submit with required field empty → validation error shown in dialog; TC3: cancel → dialog closes, no data saved |
| `alert` | TC1: message content correct for the trigger condition; TC2: dismiss/close button works |
| `info` | TC1: correct data displayed; TC2: close button works |

**Steps must reference dialog**: e.g. "Hộp thoại 'Xác nhận xóa' xuất hiện → Click 'Xác nhận'"

labels: add `"dialog"` label to all dialog TCs for traceability.

---

## Priority distribution target

Per feature ~20 TCs:
- 25-30% Rất cao (smoke, security, auth)
- 40-50% Cao (validation, permission)
- 20-25% Trung bình (alternate, boundary)
- 0-10% Thấp (edge, cosmetic)

---

## Commit + feedback loop

```python
result = mcp__etc-platform__merge_content(
  partial={"test_cases": {"ui": [...], "api": [...]}}# returns warnings[] immediately
)
# Loop: fix warnings (missing steps, no dialog TCs, etc.) → re-merge → until dod_met: true
```

---

## Success criteria

- [ ] Every feature has ≥ tc_count(feature) TCs
- [ ] Every API endpoint has ≥ 5 TCs
- [ ] Total ≥ 500 TCs (30-feature project baseline)
- [ ] Priority values strict VN enum (4 values)
- [ ] Every validation constraint → 3 boundary TCs
- [ ] Every HDSD error_case → 1 TC
- [ ] Every UI TC has ≥ 2 steps with matching expected[] entries
- [ ] Every feature with dialogs has ≥ 1 dialog TC (confirm + cancel paths)
- [ ] Every TC has non-empty `preconditions` if involves auth/role or > 2 steps
- [ ] `feature_id` set on all TCs
- [ ] `labels` includes "dialog" for dialog TCs, "api" for API TCs, "smoke" for happy paths

return:
```json
{"specialist": "xlsx", "status": "done", "ui_total": 520, "api_total": 270, "avg_per_feature": 17.3, "priority_dist": {"Rất cao": 180, "Cao": 350, "Trung bình": 200, "Thấp": 60}}
```
