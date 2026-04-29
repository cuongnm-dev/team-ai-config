# Stage 3a — Capture (Cursor Edition)

**Stage**: 3 CAPTURE, sub-step 3a — Background Agent recommended for ≥20 features
**Trigger**: only when "hdsd" in export targets

**ROLE**: UI screenshot specialist. Capture feature-aware states via Playwright MCP.

**TRIGGER**: `hdsd` in `export_targets`. Otherwise skip entire phase.

**OUTPUT** (CD-10 canonical): `docs/intel/screenshots/{feature-id}-step-NN-{state}.png` (CD-4 naming) + `docs/intel/test-evidence/{feature-id}.json` (per-feature, schema-bound). Working copy `{DOCS_PATH}/screenshots/` may symlink/copy from canonical for embedding in content-data. Legacy `{DOCS_PATH}/intel/screenshot-map.json` superseded.

**MODEL**: Sonnet

---

## CORE RULES

1. Use `mcp__playwright__*` tools directly — NEVER generate `spec.ts` / `capture.py`.
2. Smart waits: `networkidle` + animation disable + spinner check. NEVER hardcoded sleep.
3. Retry policy: 3 attempts with exponential backoff (2s, 4s, 8s).
4. Session health check every 10 features.
5. Auto-skip this phase if `hdsd` not in targets.

---

## Protocol

### Step 0 — Test-evidence reuse gate (REUSE-FIRST, ASSEMBLY-NOT-TESTING)

**Principle:** `resume-feature` QA stage already runs Playwright + captures screenshots per feature. `generate-docs` is an ASSEMBLY skill — it gathers existing evidence, runs Playwright ONLY for features lacking evidence (CD-10 §10).

```
For each feature in feature-catalog.features[]:
  evidence_path = "docs/intel/test-evidence/{feature.id}.json"
  
  IF feature.test_evidence_ref AND exists(evidence_path):
    Load evidence, validate against test-evidence.schema.json
    Check freshness:
      - evidence.freshness.feature_catalog_hash_at_capture vs current feature hash
      - if mismatch → mark STALE
    
    IF FRESH:
      Reuse:
        - Copy/symlink screenshots from evidence.screenshots[].path → {DOCS_PATH}/screenshots/
        - Skip Playwright for this feature
        - Print: "Stage 3a [{feature.id}]: ♻ REUSED — {N} screenshots, {M} test cases from QA stage"
      continue
    ELSE (stale):
      Print: "Stage 3a [{feature.id}]: STALE evidence — re-capturing"
  
  ELSE:
    Print: "Stage 3a [{feature.id}]: NO evidence — capturing fresh"
  
  → Run Playwright capture protocol below (Step A onwards) for this feature only
  → After capture, write fresh evidence to docs/intel/test-evidence/{feature.id}.json
     so future generate-docs runs reuse it
```

**Anti-pattern (FORBIDDEN):** running Playwright for ALL features just because skill is invoked. That duplicates QA work + burns tokens + risks divergence between SDLC test runs and docs evidence. ALWAYS check evidence first.

**Bonus:** features with FRESH evidence skip auth bootstrap entirely if their evidence has all needed states.

### Step A — Auth bootstrap

```bash
python "$ENGINE/auth_runner.py" verify \
  --state-file "{DOCS_PATH}/playwright/.auth/state.json" \
  --base-url "$BASE_URL"

# If stale → auto-login
python "$ENGINE/auth_runner.py" login \
  --input "{DOCS_PATH}/auth.json" \
  --state-out "{DOCS_PATH}/playwright/.auth/state.json"

# If auto fails → recording mode (non-headless)
python "$ENGINE/auth_runner.py" record \
  --input "{DOCS_PATH}/auth.json" \
  --state-out "{DOCS_PATH}/playwright/.auth/state.json" \
  --timeout-minutes 5
```

### Step B — Load capture config

```python
# Inline logic (NOT a script to create)
import yaml
cfg = yaml.safe_load(open(f"{SKILL_DIR}/engine/schemas/capture-profiles.yaml"))
profile = cfg["profiles"][user_choice]       # desktop | mobile | tablet
wait_cfg = cfg["wait_strategy"]
anim_css = cfg["animation_disable_css"]
```

### Step C — Feature-aware capture loop

Determine states per feature from BA spec:

| State | Capture condition |
|---|---|
| `initial` | Always (entry page load) |
| `filled` | Feature has form fields |
| `modal` | Feature has confirm dialog |
| `success` | Action completion state |
| `error-required` | Required field validation |
| `error-format` | Format validation (email, etc.) |
| `list-empty` | List view no data |
| `list-populated` | List after data exists |
| `detail` | Detail view of item |

Per feature loop:

```
for state in feature.required_states:
    retries = 0
    while retries < 3:
        try:
            mcp__playwright__browser_navigate(url=BASE_URL + feature.entry_ui)
            # Wait smart
            mcp__playwright__browser_wait_for(state="networkidle")
            mcp__playwright__browser_evaluate(
                code=f"document.head.insertAdjacentHTML('beforeend', '<style>{anim_css}</style>')"
            )
            for sel in spinner_selectors:
                mcp__playwright__browser_wait_for(selector=sel, state="hidden", timeout=1500)
            mcp__playwright__browser_wait_for(time=0.25)  # settle

            # Navigate to state
            navigate_to_state(feature, state)

            # Capture
            result = mcp__playwright__browser_take_screenshot(
                filename=f"{feature.id}-step-{state_number:02d}-{state}.png",
                fullPage=false,
                animations="disabled"
            )
            if result.success and result.size > 2000:
                break
        except TimeoutError:
            retries += 1
            wait(2 ** retries)
        except ElementNotFoundError:
            # Try fallback selector from designer spec
            fallback = feature.designer_spec.get(f"{state}_selector_fallback")
            if fallback: continue
            retries += 1
            wait(2 ** retries)
    
    if retries == 3:
        log_unrecoverable(feature.id, state)
        # Stage 3b will catch this
```

### Step D — Navigation grouping (optimization)

Group features by `entry_ui` → navigate once, capture initial states for the group, then interact.

```
groups = {}
for f in features:
    groups.setdefault(f.entry_ui, []).append(f)
```

Reduces navigation time ~6× for 30 features with shared URLs.

### Step E — Session health check

Every 10 features:
```
mcp__playwright__browser_evaluate(code="() => document.cookie.includes('session')")
```

If false → re-auth via Step A (max 2 re-auths).

### Step F — Post-process

```bash
python "$ENGINE/process_screenshots.py" \
  --screenshots-dir "{DOCS_PATH}/screenshots" \
  --config "$ENGINE/schemas/capture-profiles.yaml" \
  --report "{DOCS_PATH}/intel/postprocess-report.json"
```

Resize ≥ 1400px → 1400px. PNG > 150KB → JPEG q=85. Detect blank (stddev < 2).

### Step G — Screenshot validation (Stage 3b)

```bash
python "$ENGINE/tools/verify_screenshots.py" \
  --intel-dir "{DOCS_PATH}/intel" \
  --screenshots-dir "{DOCS_PATH}/screenshots" \
  --output "{DOCS_PATH}/intel/screenshot-validation.json" \
  --threshold 95
```

Exit 0 → coverage ≥ 95%, advance. Exit 1 → retry missing (max 2 rounds), re-validate.

See `phases/s3b-validation.md`.

### Step H — Write screenshot-map.json

```json
{
  "version": "2.1",
  "capture-profile": "desktop",
  "auth": {"status": "success", "method": "cached-state"},
  "total-features": 30,
  "total-screenshots": 120,
  "map": {
    "F-001": {
      "capture-status": "complete",
      "screenshots": [
        {"step-no": 1, "state": "initial", "file": "F-001-step-01-initial.png"},
        {"step-no": 2, "state": "filled", "file": "F-001-step-02-filled.png"},
        {"step-no": 3, "state": "success", "file": "F-001-step-03-success.png"}
      ]
    }
  }
}
```

---

## YOLO mode (project ≥ 20 features)

Settings → Features → YOLO:
- Allow: `python {SKILL_DIR}/engine/*`, `mcp__playwright__*`
- Deny: `rm`, `shutdown`, `git push --force`

Agent runs 30 × 4-8 states = 120-240 MCP calls without user confirm per call.

---

## Design Mode review (AFTER phase)

User runs `Cmd+Shift+D` after pipeline complete:
1. Load `{DOCS_PATH}/screenshots/` in Design Mode
2. User navigates, checks state correctness
3. Note bad filenames → agent re-captures per feature

Agent does NOT vision-classify — Design Mode is faster/better UX.

---

## Error handling

| Situation | Action |
|---|---|
| Docker container down | `docker ps` check, block pipeline |
| Auth fails 2× | Fallback unauthenticated, flag auth-required features |
| Selector not found | Use `browser_snapshot()` → find by text match |
| Screenshot > 5MB raw | Post-process will resize; warn if > 10MB |
| Feature entry_ui returns 404 | Skip + mark failed in screenshot-map |
| Session expires mid-run | Step A re-auth (max 2) |

---

## Anti-patterns

- ❌ Generate `capture_script.py` / `playwright_runner.py`
- ❌ Hardcoded `sleep(2000)` — use smart waits
- ❌ Skip Step D grouping (6× slowdown)
- ❌ Skip Step G validation → HDSD export missing screenshots silently
- ❌ Vision-classify screenshots — user Design Mode does this better
