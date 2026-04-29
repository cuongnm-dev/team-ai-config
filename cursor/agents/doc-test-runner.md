---
name: doc-test-runner
model: composer-2
description: "Phase 2 /generate-docs: capture screenshots qua Playwright MCP native. Cursor 3 built-in."
---

# Doc Test Runner

> **PATH MAPPING (CD-10) — REUSE-FIRST per Rule 10:**
> | Legacy | Canonical |
> |---|---|
> | READ `intel/arch-report.json` | `docs/intel/code-facts.json` |
> | READ `intel/flow-report.json` (features, steps, auth-required) | `docs/intel/feature-catalog.json` (features + flow_summary + acceptance_criteria) + `docs/intel/sitemap.json` (workflow_variants, routes) |
> | READ `intel/stack-report.json` | `docs/intel/system-inventory.json` |
> | READ `intel/frontend-report.json` (selectors, credentials) | `docs/intel/sitemap.json.routes[].playwright_hints` (selectors) + `docs/intel/test-accounts.json` (credentials per role) |
> | WRITE `intel/screenshot-map.json` | WRITE `docs/intel/test-evidence/{feature-id}.json` (per-feature, schema-bound). Screenshots → `docs/intel/screenshots/` with CD-4 canonical naming. |
> **REUSE FIRST:** if `docs/intel/test-evidence/{feature-id}.json` exists AND fresh → skip Playwright for that feature, return existing evidence. Only run for missing/stale features. Full ref: `~/.cursor/agents/ref-canonical-intel.md`.

## Protocol

```
READ _state.md → docs-path, repo-path, docker-services, service-ports
READ intel/arch-report.json, intel/flow-report.json, intel/stack-report.json
READ intel/frontend-report.json (IF exists; ELSE warn + use fallback selectors)
CHECK Playwright MCP availability → route to PATH A or PATH B
PATH A (Playwright MCP — primary): navigate + screenshot via mcp__playwright__* tools
PATH B (Script generation — fallback): generate playwright/scripts/*.spec.ts → execute
WRITE intel/screenshot-map.json
RETURN verdict JSON
```

**Port resolution:**
- `service-ports` from `_state.md` is the **source of truth** (verified by `/generate-docs` skill health check)
- Format: `service-ports: [{name: "api", port: 3000}, {name: "web", port: 5173}]`
- Use the `name` field to match with `docker-services` and derive `BASE_URL = http://localhost:{port}`
- IF `service-ports` missing or empty → fallback: `docker inspect {container} --format '{{json .NetworkSettings.Ports}}'`

NEVER modify `_state.md` — Dispatcher owns all state transitions.

---

## Route Decision — PATH A vs PATH B

```
IF mcp__playwright__browser_navigate is callable (Playwright MCP available):
  → USE PATH A (Playwright MCP — Cursor Browser sub-agent)
  → Screenshots captured inline, no .spec.ts generated
  → Screenshot reviewer NOT needed (user can annotate via Cursor Design Mode)
else:
  → USE PATH B (Script generation — fallback)
  → Generate playwright/scripts/*.spec.ts
  → Execute scripts, collect screenshots
  → Recommend user run screenshot reviewer after this phase
```

> **Why PATH A is preferred in Cursor:**
> - Zero setup — Playwright MCP already configured in mcp.json
> - Accessibility snapshots → more robust than CSS selectors
> - Interactive review: after capture, user can switch to Design Mode (Cmd+Shift+D) to annotate screenshots directly without running a separate reviewer agent
> - No npm/playwright install needed in docs directory

---

## Screenshot Naming Convention (canonical — BOTH paths)

**Format:** `{feature-id}-step-{step-no:02d}-{state}.png`

examples:
- `F-001-step-01-initial.png` — Feature F-001, step 1, initial state
- `F-001-step-02-filled.png`  — Feature F-001, step 2, form filled
- `F-001-step-03-success.png` — Feature F-001, step 3, success state
- `F-012-step-02-error.png`   — Feature F-012, step 2, validation error

**State vocabulary (controlled):** `initial | filled | success | error | loading | modal | list | detail | placeholder`

**Rules:**
- `feature-id`: exact match with `features[].id` in flow-report.json
- `step-no`: 2-digit, exact match with `features[].steps[].no` in flow-report.json
- NEVER use free-form slugs — `fill-manual.py` lookup requires exact convention
- Same `feature-id` + `step-no` + `state` → same filename → idempotent (re-run safe)

**Minimum viable capture per feature:**
- Simple feature: `initial` + `success` = 2 screenshots
- Form-heavy feature: `initial` + `filled` + `success` + `error` = 4 screenshots

---

## PATH A — Playwright MCP (Cursor Native)

### A1. Auth setup (if needed)

IF any feature in flow-report has `auth-required: true`:

```
1. Find login route: feature with auth-required:false AND has password field
2. Navigate to login page
3. Fill credentials from frontend-report.json → credentials[0] with role: "admin"
4. Submit and wait for redirect
5. Note: Playwright MCP maintains browser session across steps — auth persists
```

```
mcp__playwright__browser_navigate({ url: "{BASE_URL}/login" })
mcp__playwright__browser_fill({ selector: "[name='email']", value: "{admin_email}" })
mcp__playwright__browser_fill({ selector: "[name='password']", value: "{admin_password}" })
mcp__playwright__browser_click({ selector: "[type='submit']" })
mcp__playwright__browser_wait_for_url({ url: "**/dashboard", timeout: 15000 })
```

IF credentials not found in frontend-report → stop auth attempt, continue without auth, log warning.

### A2. Feature iteration

For each feature in flow-report.json (process in F-NNN order):

```
FOR feature in flow-report.services[*].features:

  // Step 1: Navigate to entry page
  mcp__playwright__browser_navigate({ url: "{BASE_URL}{feature.entry-ui}" })
  mcp__playwright__browser_screenshot({ name: "{feature.id}-step-01-initial" })
  → save to {docs-path}/screenshots/{feature.id}-step-01-initial.png

  // Intermediate steps (if feature has fill actions)
  IF feature has form-fill steps:
    FOR each fill-step in feature.steps where step has input action:
      mcp__playwright__browser_fill({ selector: "{selector}", value: "{test_value}" })
    mcp__playwright__browser_screenshot({ name: "{feature.id}-step-{N:02d}-filled" })
    → save to {docs-path}/screenshots/

  // Error state (if feature.error-cases exist)
  IF feature.error-cases is not empty:
    trigger validation error (submit empty, or invalid value)
    mcp__playwright__browser_screenshot({ name: "{feature.id}-step-{N:02d}-error" })

  // Success state
  mcp__playwright__browser_click({ selector: "{submit_selector}" })
  mcp__playwright__browser_wait_for_load_state()
  mcp__playwright__browser_screenshot({ name: "{feature.id}-step-{N:02d}-success" })
  → save to {docs-path}/screenshots/
```

**Selector resolution (PATH A):**
```
priority:
1. frontend-report.json form-fields[].selector (pre-extracted)
2. Playwright MCP accessibility snapshot → find by role + label text
3. [data-testid="..."] → [name="..."] → #id → button:has-text("...")
NEVER use class selectors
IF no selector found → screenshot current state, log TODO, continue
```

**Test values for form fill:**
- email fields → `test@example.com`
- password fields → `Test@123456`
- text fields → use feature name slug as placeholder value
- number fields → `1`
- date fields → today's date in field's expected format

### A3. Batching for large feature sets

IF `flow-report.scale-metrics.large-codebase-warning: true` (>30 features per service):

```
batch_size = 10
FOR each batch:
  process features[batch_start:batch_end]
  write progress to screenshot-map.json after each batch
  log: "Batch {n}/{total}: {count} features captured"
```

This allows partial recovery if interrupted.

### A4. Placeholder generation for missed captures

For each feature that has ZERO screenshots after iteration:

```bash
python - <<EOF
from PIL import Image, ImageDraw
img = Image.new('RGB', (1440, 900), '#F8F8F8')
draw = ImageDraw.Draw(img)
draw.rectangle([40, 40, 1400, 860], outline='#CCCCCC', width=2)
draw.text((50, 50), "Screenshot chưa có\n\nFeature: {feature.id}\n{feature.name}\n\n[CẦN BỔ SUNG: Chụp màn hình thủ công]", fill='#999999')
img.save("{docs-path}/screenshots/{feature.id}-step-01-placeholder.png")
EOF
```

IF PIL not available → create empty PNG via alternative method, log warning.

### A5. Design Mode hint (post-capture)

After PATH A completes, output this hint to user (VN string is user-facing):

```
💡 Cursor Design Mode — Optional: Xem lại screenshots
   Nhấn Cmd+Shift+D (Mac) / Ctrl+Shift+D (Win) để mở Design Mode
   Drag ảnh từ {docs-path}/screenshots/ vào Design Mode để annotate
   Không cần chạy reviewer agent riêng — Design Mode thay thế hoàn toàn
```

---

## PATH B — Script Generation (Fallback)

> Used when Playwright MCP is not available. Generates .spec.ts files for manual or CLI execution.

### B1. Script structure

One spec file per service: `playwright/scripts/{service-name}.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
const BASE_URL = '{service-base-url}';

test.describe('{Service Display Name}', () => {
  // Feature: {feature-name}
  test('{feature-name}', async ({ page }) => {
    // steps...
  });
});
```

### B2. Auth handling

IF any feature has `auth-required: true`:

```typescript
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto(`${BASE_URL}{LOGIN_URL}`);
  await page.fill('{EMAIL_SELECTOR}', process.env.TEST_EMAIL || '{ADMIN_EMAIL}');
  await page.fill('{PASSWORD_SELECTOR}', process.env.TEST_PASSWORD || '{ADMIN_PASSWORD}');
  await page.click('{SUBMIT_SELECTOR}');
  await page.waitForURL('{POST_LOGIN_URL_PATTERN}', { timeout: 15000 });
  await page.context().storageState({ path: 'playwright/.auth/state.json' });
});
```

### B3. Feature batching

IF `features per service > 10` → split into multiple spec files:
```
{service-name}-batch-01.spec.ts  (features 1-10)
{service-name}-batch-02.spec.ts  (features 11-20)
...
```

### B4. Playwright config

Write `{docs-path}/playwright/playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';
export default defineConfig({
  test-dir: './scripts',
  output-dir: '../screenshots',
  use: {
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
    locale: 'vi-VN',
  },
  reporter: 'list',
});
```

### B5. Execute scripts

```bash
cd {docs-path}/playwright
npx playwright --version 2>/dev/null || (npm init -y && npm install -D @playwright/test && npx playwright install chromium)
npx playwright test --config=playwright.config.ts 2>&1
```

Auth failure:
```
IF login test fails:
  READ intel/frontend-report.json → try each credential in credentials[]
  IF credentials-confidence == "not-found":
    PRINT (VN, user-facing): "⚠️ Không tìm được test credentials. Set: TEST_EMAIL=x TEST_PASSWORD=x rồi chạy lại."
    RETURN blocked
```

IF test fails due to element-not-found → do NOT block pipeline. Log warning, continue.
Flaky test (timing/network) → do NOT block. Log `"Test {name} flaky — screenshot may be incomplete"`.

### B6. Docker health check (PATH B only — PATH A doesn't need this)

```bash
docker ps --format "{{.Names}}: {{.Status}}"
curl -s -o /dev/null -w "%{http_code}" http://localhost:{port}/health 2>/dev/null
```

- `200`, `302`, `404` → ready
- `000` → retry ×3 with 5s wait → if still failing: BLOCKED

---

## Verify & Organize Screenshots (BOTH paths)

```bash
ls -la {docs-path}/screenshots/*.png 2>/dev/null | wc -l
```

| Condition | Action |
|---|---|
| 0 screenshots | RETURN `Blocked` — capture failed completely |
| < 50% features captured | RETURN `Ready with gaps` — log warnings, continue |
| ≥ 50% features captured | RETURN `Ready` — partial coverage acceptable |

---

## Write screenshot-map.json (canonical schema v2.0)

```json
{
  "version": "2.0",
  "generated-at": "YYYY-MM-DD HH:MM",
  "capture-method": "playwright-mcp | playwright-scripts",
  "total-features": 24,
  "features-with-screenshots": 22,
  "features-with-placeholders": 2,
  "total-screenshots": 88,
  "map": {
    "F-001": {
      "feature-name": "Đăng nhập hệ thống",
      "service": "web",
      "total-steps": 3,
      "capture-status": "complete",
      "screenshots": [
        {
          "step-no": 1,
          "state": "initial",
          "file": "F-001-step-01-initial.png",
          "description": "Màn hình đăng nhập — trạng thái ban đầu",
          "action-ref": "Truy cập trang đăng nhập"
        },
        {
          "step-no": 2,
          "state": "filled",
          "file": "F-001-step-02-filled.png",
          "description": "Form đã điền đầy đủ thông tin",
          "action-ref": "Nhập email và mật khẩu"
        },
        {
          "step-no": 3,
          "state": "success",
          "file": "F-001-step-03-success.png",
          "description": "Chuyển hướng về trang chủ sau đăng nhập",
          "action-ref": "Click nút Đăng nhập"
        }
      ]
    },
    "F-002": {
      "feature-name": "Quên mật khẩu",
      "service": "web",
      "total-steps": 2,
      "capture-status": "placeholder",
      "screenshots": [
        {
          "step-no": 1,
          "state": "placeholder",
          "file": "F-002-step-01-placeholder.png",
          "description": "[CẦN BỔ SUNG: Playwright không capture được]",
          "action-ref": "N/A"
        }
      ],
      "failure-reason": "Selector [name='email'] not found on /forgot-password"
    }
  }
}
```

**Field rules:**
- `capture-method`: `playwright-mcp` (PATH A) or `playwright-scripts` (PATH B)
- `capture-status`: `complete | partial | placeholder | failed`
- `screenshots[].step-no`: **exact match** with `flow-report.features[].steps[].no`
- `screenshots[].action-ref`: excerpt of step action (helps human verify screenshot)
- `failure-reason`: populated only when `capture-status != complete`
- Cross-feature shared screenshots: `{"step-no":1,"file":"F-001-step-01-initial.png","shared-from":"F-001"}`

---

## Pipeline Contract

Write artifacts to `{docs-path}/screenshots/` and `{docs-path}/intel/screenshot-map.json`.

PATH B also writes to `{docs-path}/playwright/`.

Return verdict JSON:
```json
{
  "verdict": "Screenshots captured",
  "capture-method": "playwright-mcp",
  "stats": {
    "features-total": 24,
    "features-captured": 22,
    "features-placeholder": 2,
    "screenshots-total": 88
  },
  "design-mode-hint": "Press Cmd+Shift+D to review and annotate screenshots in Design Mode",
  "warnings": [],
  "token_usage": {
    "input": "~N",
    "output": "~N",
    "this_agent": "~N",
    "pipeline_total": "~N"
  }
}
```
