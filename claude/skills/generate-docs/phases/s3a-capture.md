# Stage 3a — Capture (Playwright MCP native)

**Stage**: 3 CAPTURE, sub-step 3a
**Predecessor**: Stage 2 (sitemap.json + actor-registry.json available)
**Successor**: Stage 3b validation
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

**Principle:** `resume-feature` QA stage already runs Playwright + captures screenshots per feature. `generate-docs` is an ASSEMBLY skill — it gathers existing evidence, runs Playwright ONLY for features lacking evidence.

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

### Step A — Auth bootstrap (multi-role aware)

Read `intel/feature-catalog.json` → check `multi-role` flag and `roles[]`.

**Single-role** (multi-role: false or absent):
```bash
python "$ENGINE/auth_runner.py" verify \
  --state-file "{DOCS_PATH}/playwright/.auth/state.json" \
  --base-url "$BASE_URL"

python "$ENGINE/auth_runner.py" login \
  --input "{DOCS_PATH}/auth.json" \
  --state-out "{DOCS_PATH}/playwright/.auth/state.json"

# If auto fails → recording mode
python "$ENGINE/auth_runner.py" record \
  --input "{DOCS_PATH}/auth.json" \
  --state-out "{DOCS_PATH}/playwright/.auth/state.json" \
  --timeout-minutes 5
```

**Multi-role** (multi-role: true) — bootstrap ONE state file per role:
```bash
# auth.json must have credentials[] array (one entry per role)
# Loop through each role and create separate state file
for role_slug in $(jq -r '.credentials[].slug' "{DOCS_PATH}/auth.json"); do
  STATE="{DOCS_PATH}/playwright/.auth/${role_slug}.json"

  python "$ENGINE/auth_runner.py" verify \
    --state-file "$STATE" --base-url "$BASE_URL" 2>/dev/null || \
  python "$ENGINE/auth_runner.py" login \
    --input "{DOCS_PATH}/auth.json" \
    --role "$role_slug" \
    --state-out "$STATE" || \
  python "$ENGINE/auth_runner.py" record \
    --input "{DOCS_PATH}/auth.json" \
    --role "$role_slug" \
    --state-out "$STATE" \
    --timeout-minutes 5

  [ -f "$STATE" ] || echo "WARN: auth failed for role $role_slug — features for this role will be skipped"
done
```

**auth.json format (multi-role)**:
```json
{
  "base_url": "http://localhost:3000",
  "credentials": [
    {"role": "Quản trị hệ thống", "slug": "admin", "email": "admin@example.com", "password": "Admin@123"},
    {"role": "Cán bộ nhân viên",  "slug": "staff", "email": "staff@example.com",  "password": "Staff@123"}
  ]
}
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

### Step B.5 — Workspace capture (multi-role only, BEFORE feature loop)

**Trigger**: `intel/sitemap.json` exists AND `multi-role: true`.
**Goal**: Capture workspace overview screenshots per role (dashboard + menu) — needed by HDSD writer for role chapter intros.

For each role in `sitemap.roles[]`:

```python
restart_browser_context(state_file=f".auth/{role.slug}.json")

# 1. Dashboard screenshot
mcp__playwright__browser_navigate(url=role.workspace.entry_url)
prepare_for_capture()  # animation kill + networkidle
mcp__playwright__browser_take_screenshot(
    filename=f"_workspace--{role.slug}-dashboard.png"
)

# 2. Menu overview — full sidebar/topbar visible, no feature opened
mcp__playwright__browser_take_screenshot(
    filename=f"_workspace--{role.slug}-menu.png",
    clip={menu_region}  # if known from sitemap.layout
)

# 3. Per menu group expanded (if collapsible) — optional but recommended
for grp in role.workspace.menu_tree:
  if grp has submenu items:
    mcp__playwright__browser_click(selector=menu_group_selector(grp.label))
    prepare_for_capture()
    mcp__playwright__browser_take_screenshot(
      filename=f"_workspace--{role.slug}-menu-{grp.id}.png"
    )
```

**Filename convention** (workspace screenshots use `_workspace` prefix to avoid feature ID collision):
- `_workspace--{role-slug}-dashboard.png`
- `_workspace--{role-slug}-menu.png`
- `_workspace--{role-slug}-menu-{group-id}.png` (per expanded group)

### Step C — Feature-aware capture loop (multi-role)

**Filename convention**:
- Single-role: `{feature-id}-step-{NN}-{state}.png`
- Multi-role:  `{feature-id}--{role-slug}-step-{NN}-{state}.png` (double dash before role)
- Workspace:   `_workspace--{role-slug}-{dashboard|menu|menu-{group-id}}.png`

### Step C.5 — Navigate via menu click (UX-true, multi-role)

**Default**: Navigate to features by **clicking through menu** rather than direct URL — captures real UX path.

**Source**: `sitemap.json.feature_overrides[].navigation_paths[role.slug]` OR `sitemap.json.roles[].workspace.menu_tree` (find item with matching `feature_id`).

```python
def click_navigate(page, role, feature_id):
    nav_path = resolve_navigation_path(sitemap, role.slug, feature_id)
    # nav_path = ["Quản trị", "Người dùng", "Danh sách"]

    if not nav_path:
      # fallback: direct URL navigation
      page.navigate(url=feature.entry_ui)
      log_warning(f"No menu path for {feature_id} in role {role.slug} — used direct URL")
      return

    # Always start from role's entry URL to ensure menu visible
    page.navigate(url=role.workspace.entry_url)
    prepare_for_capture()

    # Click through menu hierarchy
    for label in nav_path:
      selector = find_menu_selector(label)  # by-text match in menu region
      try:
        page.click(selector, timeout=5000)
        prepare_for_capture()
      except TimeoutError:
        log_error(f"Menu click failed: {label} not found for role {role.slug}")
        # This is a CRITICAL signal — menu hidden when shouldn't be, or label changed
        capture_diagnostic_screenshot(f"_diag--{role.slug}--{feature_id}-menu-missing.png")
        # Fallback: direct URL
        page.navigate(url=feature.entry_ui)
        return

    # After clicking through, current page should be feature's entry UI
    # Verify URL matches expected
    if page.url != role.workspace.entry_url + feature.entry_ui:
      log_warning(f"Menu click landed on unexpected URL: {page.url}")
```

**Why click-navigate (not URL)**:
1. Catches menu visibility bugs (menu item should hide for staff but URL still works = security gap)
2. Captures real UX context (breadcrumb, active menu state, loaded sidebar)
3. Tests menu label correctness (user-facing label must match HDSD documentation)
4. Validates `navigation_paths` in sitemap.json — if click fails, sitemap is wrong

**When direct URL is acceptable** (fallback):
- `sitemap.json.confidence == "low"` (no reliable menu data) → all features use direct URL
- Specific feature has `nav_path: null` in sitemap → direct URL with warning logged
- Menu click fails 2× → fallback URL + log diagnostic screenshot

**Multi-role loop logic** — for each feature, check `role-visibility[]`:
```python
is_multi_role = flow_report.get("multi-role", False)

for feature in features:
  roles_to_capture = flow_report["roles"] if is_multi_role else [None]
  visible_roles    = set(feature.get("role-visibility", [r["slug"] for r in roles_to_capture]))

  for role in roles_to_capture:
    if role and role["slug"] not in visible_roles:
      continue  # skip — this role cannot access this feature

    role_slug   = role["slug"] if role else None
    state_file  = f"{DOCS_PATH}/playwright/.auth/{role_slug}.json" if role_slug \
                  else f"{DOCS_PATH}/playwright/.auth/state.json"

    if not os.path.exists(state_file):
      log_skipped(feature.id, role_slug, "auth-failed")
      continue

    # restore session for this role
    mcp__playwright__browser_navigate(url="about:blank")  # reset
    # load storageState inline via evaluate (storageState can't be changed mid-session)
    # → restart browser context per role group (see Step A batching below)

    for state in feature.required_states:
      filename = f"{feature.id}--{role_slug}-step-{state_no:02d}-{state}.png" \
                 if role_slug else \
                 f"{feature.id}-step-{state_no:02d}-{state}.png"
      capture(filename)
```

**Role batching** — to avoid frequent browser context restarts, group features by role:
```python
# Process all features for role=admin first, then role=staff, etc.
for role in roles_to_capture:
  setup_browser_context(state_file=f".auth/{role['slug']}.json")
  for feature in [f for f in features if role["slug"] in f.get("role-visibility", [])]:
    capture_all_states(feature, role)
```

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
        # Stage 3b validation will catch this
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

### Step G — Screenshot validation (handoff to Stage 3b s3b-validation)

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

**Single-role** — schema unchanged (backward compatible):
```json
{
  "version": "2.1",
  "capture-profile": "desktop",
  "multi-role": false,
  "auth": {"status": "success", "method": "cached-state"},
  "total-features": 30,
  "total-screenshots": 120,
  "map": {
    "F-001": {
      "capture-status": "complete",
      "screenshots": [
        {"step-no": 1, "state": "initial", "file": "F-001-step-01-initial.png"},
        {"step-no": 2, "state": "filled",  "file": "F-001-step-02-filled.png"},
        {"step-no": 3, "state": "success", "file": "F-001-step-03-success.png"}
      ]
    }
  }
}
```

**Multi-role** — `screenshots` = primary role captures; `by-role` = per-role breakdown; thêm `workspace_screenshots` per role:
```json
{
  "version": "2.2",
  "capture-profile": "desktop",
  "multi-role": true,
  "roles-captured": ["admin", "staff"],
  "navigation-mode": "menu-click | direct-url | hybrid",
  "auth": {
    "by-role": {
      "admin": {"status": "success", "method": "auto-login", "state-file": "playwright/.auth/admin.json"},
      "staff": {"status": "success", "method": "auto-login", "state-file": "playwright/.auth/staff.json"}
    }
  },
  "workspace_screenshots": {
    "admin": {
      "dashboard": "_workspace--admin-dashboard.png",
      "menu": "_workspace--admin-menu.png",
      "menu_groups": {
        "admin-mgmt": "_workspace--admin-menu-admin-mgmt.png",
        "system-config": "_workspace--admin-menu-system-config.png"
      }
    },
    "staff": {
      "dashboard": "_workspace--staff-dashboard.png",
      "menu": "_workspace--staff-menu.png",
      "menu_groups": {}
    }
  },
  "navigation_diagnostics": {
    "menu-click-failures": [
      {"role": "staff", "feature_id": "F-007", "expected_label": "Người dùng", "fallback": "direct-url"}
    ]
  },
  "total-features": 30,
  "total-screenshots": 210,
  "map": {
    "F-001": {
      "capture-status": "complete",
      "role-visibility": ["admin", "staff"],
      "screenshots": [
        {"step-no": 1, "state": "initial", "role": "admin", "file": "F-001--admin-step-01-initial.png"},
        {"step-no": 2, "state": "filled",  "role": "admin", "file": "F-001--admin-step-02-filled.png"},
        {"step-no": 3, "state": "success", "role": "admin", "file": "F-001--admin-step-03-success.png"}
      ],
      "by-role": {
        "admin": [
          {"step-no": 1, "state": "initial", "file": "F-001--admin-step-01-initial.png"},
          {"step-no": 2, "state": "filled",  "file": "F-001--admin-step-02-filled.png"},
          {"step-no": 3, "state": "success", "file": "F-001--admin-step-03-success.png"}
        ],
        "staff": [
          {"step-no": 1, "state": "initial", "file": "F-001--staff-step-01-initial.png"},
          {"step-no": 2, "state": "filled",  "file": "F-001--staff-step-02-filled.png"},
          {"step-no": 3, "state": "success", "file": "F-001--staff-step-03-success.png"}
        ]
      }
    },
    "F-007": {
      "capture-status": "complete",
      "role-visibility": ["admin"],
      "screenshots": [
        {"step-no": 1, "state": "initial", "role": "admin", "file": "F-007--admin-step-01-initial.png"}
      ],
      "by-role": {
        "admin": [{"step-no": 1, "state": "initial", "file": "F-007--admin-step-01-initial.png"}],
        "staff": null
      }
    }
  }
}
```

`screenshots[]` = primary role array (first role in `role-visibility`) — used by HDSD writer as default.
`by-role` = full breakdown per role — used when HDSD generates role-specific chapters.
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
