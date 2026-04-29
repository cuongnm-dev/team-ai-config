# Stage 3b — Screenshot Validation (Cursor Edition)

**Stage**: 3 CAPTURE, sub-step 3b — Design Mode visual review (FREE, no vision tokens)

**ROLE**: Verify every `feature.steps[].screenshot` referenced in intel exists on disk + not blank/broken.

**TRIGGER**: After Phase 2 capture, before Phase 3 data-writer.

**OUTPUT**: `{DOCS_PATH}/intel/screenshot-validation.json`

**GATE**: Coverage ≥ 95% to advance. Below 95% → retry, below 80% → block.

---

## Protocol

### Step 1 — Build expected manifest

Read `intel/feature-catalog.json` (canonical for both Paths after Stage 2.2).

```python
expected = []
for service in intel["services"]:
    for feature in service["features"]:
        expected.append(f"{feature.id}-step-01-initial.png")  # mandatory
        for step in feature.steps:
            state = step.get("state", "default")
            expected.append(f"{feature.id}-step-{step.no:02d}-{state}.png")
        for i, ec in enumerate(feature.error_cases, 1):
            expected.append(f"{feature.id}-error-{i:02d}.png")
```

target: ≥ 4 screenshots per feature (initial, filled/interaction, success, error).

### Step 2 — Verify filesystem

Run bundled script:

```bash
python "$ENGINE/tools/verify_screenshots.py" \
  --intel-dir "{DOCS_PATH}/intel" \
  --screenshots-dir "{DOCS_PATH}/screenshots" \
  --output "{DOCS_PATH}/intel/screenshot-validation.json" \
  --threshold 95
```

Script checks per file:
- Exists on disk
- Size > 2000 bytes (not empty/partial)
- Not blank (PIL stddev > 3)

### Step 3 — Retry unrecoverable via Playwright MCP

For each missing filename:
```
feature = parse_feature_id(filename)
state = parse_state(filename)

retries = 0
while retries < 3:
    mcp__playwright__browser_navigate(BASE_URL + feature.entry_ui)
    mcp__playwright__browser_wait_for(state="networkidle")
    navigate_to_state(feature, state)
    result = mcp__playwright__browser_take_screenshot(filename=expected)
    if result.success: break
    retries += 1
    wait(2 ** retries)

if retries == 3:
    mark_unrecoverable(feature.id, state, last_error)
```

### Step 4 — Gate decision

```
coverage = found_valid / expected_total

if coverage >= 0.95: ADVANCE
elif coverage >= 0.80: WARN user, ask continue
else: BLOCK with fix guidance
```

---

## Output schema

```jsonc
{
  "meta": {
    "total_expected": 120,
    "found_valid": 108,
    "retried_success": 8,
    "unrecoverable": 4,
    "coverage_percent": 93.3,
    "threshold_percent": 95,
    "passed": false
  },
  "missing_unrecoverable": [
    {
      "filename": "F-015-step-01-initial.png",
      "feature_id": "F-015",
      "expected_state": "initial",
      "retry_attempts": 3,
      "last_error": "Navigation failed: ERR_NAME_NOT_RESOLVED",
      "resolution_hint": "Feature F-015 route may have been removed. Exclude feature or fix route."
    }
  ],
  "blank_detected": [],
  "wrong_size": [],
  "by_feature": {
    "F-001": {"expected": 4, "found": 4, "status": "complete"},
    "F-002": {"expected": 4, "found": 3, "missing": ["..."], "status": "partial"},
    "F-015": {"expected": 5, "found": 0, "status": "failed"}
  }
}
```

---

## Auto-remediation patterns

| Situation | Auto-fix |
|---|---|
| File < 2KB | Re-capture (size-fix retry) |
| Blank (stddev < 3) | Wait +3s, re-capture |
| Filename pattern mismatch | Rename if match canonical pattern |
| Route 404 | Mark unrecoverable, remove feature from intel |
| Auth session expired | Re-auth + retry all remaining |
| Element not found | Try designer_spec fallback selector |

---

## Integration with Phase 3 HDSD writer

Stage 4e HDSD specialist reads `screenshot-validation.json`:

```python
validation = load("intel/screenshot-validation.json")
for feature in features:
    feat_status = validation["by_feature"].get(feature.id, {})
    if feat_status.get("status") == "failed":
        # Exclude feature from HDSD (or placeholder steps)
        feature.steps = [{"no": 1, "action": "[CẦN BỔ SUNG: BA fill steps]", "screenshot": null}]
    elif feat_status.get("status") == "partial":
        # Keep only steps with valid screenshots
        valid_files = set(feat_status["found_files"])
        feature.steps = [s for s in feature.steps if s.screenshot in valid_files]
```

---

## Skip conditions

Skip entire phase when:
- `hdsd` not in `export_targets`
- Phase 2 skipped
- User flag `--skip-screenshot-validation` (not recommended)
