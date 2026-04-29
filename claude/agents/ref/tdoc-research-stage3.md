# tdoc-researcher — Stage 2.3 + 2.4 (UX Architecture + Sitemap)

> Loaded on-demand by `tdoc-researcher` agent when `scope ∈ {stage2, full}`. Do NOT load eagerly.
> Prerequisite: `intel/feature-catalog.json` from Stage 2.2 MUST exist.
> Stage 2.3: routes + form selectors + login analysis + auth metadata.
> Stage 2.4: workspace + menu tree + workflow variants (multi-role only).
> Outputs: `intel/sitemap.json` (absorbs frontend-report per CD-10), `intel/test-accounts.json`.
> Schemas: `~/.claude/schemas/intel/{sitemap,test-accounts}.schema.json`.

## Stage 2.3 — UX Architecture (Sitemap + Selectors + Workflow Variants)

**Output**: `{docs-path}/intel/sitemap.json` + `{docs-path}/intel/frontend-report.json`

### 2.3.1 Extract frontend routes + cross-reference existing BA docs (DEPTH)

**CRITICAL for avoiding sparse output — cross-reference existing SDLC artifacts:**

```bash
# Scan for Cursor SDLC pipeline output if exists in project
find {repo-path}/docs/features -name "03-acceptance-criteria.md" 2>/dev/null
find {repo-path}/docs/features -name "00-lean-spec.md" 2>/dev/null
find {repo-path}/docs/features -name "02-designer-report.md" 2>/dev/null
find {repo-path}/docs/features -name "04-tech-lead-plan.md" 2>/dev/null

# Also scan docs/intel if populated by prior /from-doc runs
find {repo-path}/docs/intel -name "*.json" -o -name "*.md" 2>/dev/null
```

If existing BA/Designer/TL artifacts found:
1. Read each `03-acceptance-criteria.md` — extract AC-NNN with trigger, outcome, edge cases
2. Read each `02-designer-report.md` — extract screen inventory, dialog list, interaction notes
3. Map existing feature names to new flow-report feature IDs (via name similarity)
4. Write `{docs-path}/intel/existing-docs-summary.json` for downstream writers:

```json
{
  "source-type": "cursor-sdlc" | "from-doc-intel" | "none",
  "feature-enrichments": [
    {
      "flow-feature-id": "F-001",
      "matched-to": "docs/features/auth-login/ba/",
      "acceptance-criteria": [
        {"id": "AC-001", "trigger": "...", "expected": "...", "edge-cases": [...]}
      ],
      "designer-notes": {
        "screens": [...],
        "dialogs": [...],
        "ux-states": [...]
      }
    }
  ],
  "unmatched-flow-features": ["F-023", "F-024"],
  "enrichment-coverage-percent": 78
}
```

**Impact:** Downstream writers (especially `tdoc-testcase-writer` + `tdoc-manual-writer`) read this summary → enrich output với detailed AC + UX states từ existing docs.

### 2.3.2 Extract form selectors per route

Priority: `data-testid` > `name` > `id` > `button:has-text(...)`. Never use class selectors.

IF dynamic selector → `"selector": null, "selector-note": "Dynamic — manual inspect required"`. NEVER guess.

### 2.3.3 — Extract UI artifacts (CRITICAL — avoid missing dialogs)

**Beyond form fields, scan for ALL UI elements per route:**

```bash
# Per component file of each route:
# 1. Find Dialog/Modal usage
grep -rE "Dialog|Modal|Drawer|Popover|Sheet" {route-component-file}

# 2. Find confirm boxes
grep -rE "confirm\(|ConfirmDialog|AlertDialog" {route-component-file}

# 3. Find Toast/Notification usage
grep -rE "toast\.|notify\.|useToast|useNotification" {route-component-file}

# 4. Find data tables with actions
grep -rE "<Table|<DataTable|<Grid.*columns" {route-component-file}

# 5. Find dropdown menus
grep -rE "<DropdownMenu|<Menu|<Select" {route-component-file}
```

**Classify each artifact:**

| Artifact type | Signal | Document entry |
|---|---|---|
| `dialog` | `<Dialog>`, `<Modal>`, `useDisclosure` | name + trigger button + content fields + confirm/cancel buttons |
| `confirm-box` | `ConfirmDialog`, `window.confirm` | name + trigger + message + OK/Cancel |
| `toast` | `toast.success/error` | type + message text + duration |
| `data-table` | `<Table>` with columns array | columns + row actions + pagination + filters |
| `dropdown-menu` | `<Menu>` with items | trigger + items + divider positions |
| `tooltip` | `<Tooltip>` | anchor + content |
| `tabs` | `<Tabs>` with panels | tab labels + tab content summary |
| `accordion` | `<Accordion>` | sections |
| `stepper` | `<Stepper>` | step labels |

**Add to frontend-report.json (new field `ui-artifacts` per route):**

```json
{
  "path": "/users/:id/edit",
  "form-fields": [...],
  "ui-artifacts": [
    {"type": "dialog", "name": "Xác nhận lưu", "trigger": "[data-testid='submit-btn']",
     "content": "Xác nhận lưu thông tin người dùng?", "buttons": ["Lưu", "Hủy"]},
    {"type": "toast", "variant": "success", "message": "Cập nhật thành công"},
    {"type": "toast", "variant": "error", "message": "Có lỗi xảy ra, vui lòng thử lại"},
    {"type": "dropdown-menu", "trigger": "[aria-label='Hành động']",
     "items": ["Xóa người dùng", "Đặt lại mật khẩu", "Vô hiệu hóa"]}
  ]
}
```

### 2.3.4 Discover test credentials (priority order — Issue #11 fix)

**Priority changed:** README first (most authoritative — human-written), seed last (may have randomized data):

```
1. README.md / CONTRIBUTING.md → grep "demo credentials", "test account", "admin login"
   (human-documented credentials > generated)
2. .env.example / .env.test / .env.ci → TEST_EMAIL, ADMIN_EMAIL, TEST_PASSWORD
   (dev-team conventions)
3. Test files: **/*.spec.ts, **/e2e/*.ts → login() calls with hardcoded credentials
4. Seed/fixtures: **/seed*.ts, **/prisma/seed.ts → admin user
   (LAST — may have randomized email like `user_${uuid}@test.com`)
```

**Rule:** IF README has credentials → use those, ignore seed file. Seed credentials may be intentionally random for security.

IF none of 4 sources found → `"credentials": [], "credentials-confidence": "not-found"`. NEVER hardcode `admin@localhost`.

### 2.3.5 — Login page analysis + auth-verification metadata (CRITICAL for Playwright)

**Purpose:** Give tdoc-test-runner actual login selectors and auth metadata instead of hardcoded guesses.

#### Step 1: Identify login page component

```
1. From arch-report routes → find POST route matching "auth|login|signin|token"
   → record as api-login-endpoint (used by AUTH.2 fallback)
2. From frontend routes → find path matching "/login", "/auth/login", "/signin", "/auth"
   → record as login-url
3. IF login route found → Read the component file
   IF NOT found → set login-url: null, auto-login-supported: false, SKIP rest of D3.5
```

#### Step 2: Extract login form selectors from component source code

```bash
# In the login component file, grep for input elements
grep -nE '<(Input|TextField|input)' {login-component-file}
grep -nE 'name=|id=|data-testid=|placeholder=' {login-component-file}
grep -nE '<(Button|button).*type.*submit|onClick.*login|handleSubmit' {login-component-file}
```

**Build selector-hints from ACTUAL source code — NOT guessing:**

| Element | Look for in source | Extract selector |
|---|---|---|
| email field | `name="email"`, `name="username"`, `id="email"`, `data-testid="..."` | Exact attribute found |
| password field | `name="password"`, `type="password"`, `data-testid="..."` | Exact attribute found |
| submit button | `type="submit"`, `data-testid="..."`, button text content | Exact attribute or `:has-text(...)` |

**Rule:** Extract from source code. If ambiguous (multiple inputs), use field order (first input = email/username, second = password). NEVER guess — if can't determine, set `"selector-confidence": "low"`.

#### Step 3: Detect auth blockers

```bash
# In login component + auth module:
grep -riE "captcha|recaptcha|hcaptcha|turnstile" {login-component-file} {auth-module-dir}
grep -riE "oauth|google.*sign|facebook.*login|saml|sso" {login-component-file}
grep -riE "otp|2fa|two.?factor|mfa|authenticator" {login-component-file} {auth-module-dir}
```

| Signal | Set |
|---|---|
| CAPTCHA library import/usage | `captcha-detected: true, auto-login-supported: false` |
| OAuth-only (no email/password form) | `oauth-only: true, auto-login-supported: false` |
| MFA/2FA after password | `mfa-detected: true, auto-login-supported: false` |
| None of above | `auto-login-supported: true` |

#### Step 4: Detect session storage strategy

```bash
# In auth/login handler or response interceptor:
grep -riE "localStorage\.(set|get)Item.*token|localStorage\.(set|get)Item.*auth" {src-dir}
grep -riE "sessionStorage\.(set|get)Item.*token" {src-dir}
grep -riE "document\.cookie.*token|setCookie.*auth|httpOnly" {src-dir}
# Check for auth library patterns:
grep -riE "next-auth|@auth/|passport|jsonwebtoken|jose" {package-json-or-deps}
```

Map findings:

| Signal | session-storage | token-key |
|---|---|---|
| `localStorage.setItem('access_token', ...)` | `"localStorage"` | `"access_token"` |
| `localStorage.setItem('token', ...)` | `"localStorage"` | `"token"` |
| `sessionStorage.setItem(...)` | `"sessionStorage"` | extracted key |
| `httpOnly cookie` / `setCookie` | `"cookie"` | `null` (not readable by JS) |
| `next-auth` | `"cookie"` | `null` |
| Can't determine | `"unknown"` | `null` |

#### Step 5: Detect post-login redirect

```bash
# In login handler/component:
grep -riE "router\.(push|replace)|navigate\(|redirect|window\.location" {login-component-file}
# Extract target path: "/dashboard", "/home", "/app", "/"
```

Default fallback: `"post-login-redirect": "/"` if not determinable.

#### Output — add to frontend-report.json:

```json
"auth-verification": {
  "login-url": "/login",
  "post-login-redirect": "/dashboard",
  "auto-login-supported": true,
  "mfa-detected": false,
  "captcha-detected": false,
  "oauth-only": false,
  "session-storage": "localStorage",
  "token-key": "access_token",
  "api-login-endpoint": "POST /api/auth/login",
  "selector-hints": {
    "email": "[name='email']",
    "password": "[name='password']",
    "submit": "button[type='submit']"
  },
  "selector-confidence": "high"
}
```

**Confidence rules:**
- `high`: All 3 selectors extracted from source code with certainty
- `medium`: 2/3 extracted, 1 inferred from field order or common patterns
- `low`: Only inferred from common patterns, no source code confirmation
- If `auto-login-supported: false` → confidence is irrelevant (selectors won't be used)

### 2.3.6 Write `intel/frontend-report.json` (selectors + auth metadata)

```json
{
  "framework": "Next.js App Router",
  "routes": [{
    "path":"/login","component":"LoginPage","auth-required":false,
    "form-fields":[
      {"label":"Email","selector":"[name=\"email\"]","type":"input","input-type":"email"},
      {"label":"Mật khẩu","selector":"[name=\"password\"]","type":"input","input-type":"password"}
    ]
  }],
  "credentials":[
    {"role":"admin","slug":"admin","email":"admin@example.com","password":"Admin@123","source":"prisma/seed.ts"},
    {"role":"staff","slug":"staff","email":"staff@example.com","password":"Staff@123","source":".env.test"}
  ],
  "credentials-confidence":"high",
  "auth-verification": {
    "login-url": "/login",
    "post-login-redirect": "/dashboard",
    "auto-login-supported": true,
    "mfa-detected": false,
    "captcha-detected": false,
    "oauth-only": false,
    "session-storage": "localStorage",
    "token-key": "access_token",
    "api-login-endpoint": "POST /api/auth/login",
    "selector-hints": {
      "email": "[name=\"email\"]",
      "password": "[name=\"password\"]",
      "submit": "button[type=\"submit\"]"
    },
    "selector-confidence": "high"
  },
  "selector-coverage":{"total-routes":12,"routes-with-selectors":10,"coverage-percent":83}
}
```

---

## Stage 2.4 — Sitemap Extraction (Workspace + Menu Tree + Workflow Variants)

**Trigger**: `flow-report.multi-role == true` → BẮT BUỘC chạy phase này.
**Skip**: single-role projects → ghi `intel/sitemap.json` empty stub với `multi-role: false` rồi exit.

**Output**: `{docs-path}/intel/sitemap.json` theo schema canonical: `~/.claude/skills/generate-docs/notepads/sitemap-schema.md`

### 2.4.1 Detect menu config source (priority order)

```bash
# (1) Explicit menu config files — highest confidence
find {repo-path} -type f \( \
  -name "menu.config.*" -o -name "menu.json" -o -name "sidebar.json" -o \
  -name "navigation.config.*" -o -name "routes.config.*" \
\) 2>/dev/null

# (2) Sidebar / Navbar component files
grep -rE "<Sidebar|<Navbar|<MainMenu|<NavigationMenu" --include="*.tsx" --include="*.vue" --include="*.html" {repo-path}/src

# (3) Route metadata with role guards (Angular/NestJS pattern)
grep -rE "RouterModule\.forRoot|RouterModule\.forChild" --include="*.ts" {repo-path}/src
grep -rE "@UseGuards.*RolesGuard|@Roles\(" --include="*.ts" {repo-path}/src

# (4) Permission/RBAC matrix files
find {repo-path} -type f \( -name "permissions.*" -o -name "rbac.*" -o -name "roles.*" \) 2>/dev/null
```

**Confidence ladder**:
- (1) found → `confidence: high`
- (2) only → `confidence: medium`
- (3) + (4) only → `confidence: medium`
- None of above → `confidence: low`, emit warning, populate empty workspace stubs

### 2.4.2 Extract menu tree per role

For each role identified in Stage 1.2 (read intel/actor-registry.json):

```python
menu_tree = []

if explicit_menu_config:
  # Parse JSON/TS config — usually has {role|permission, items[]} structure
  # Map to canonical MenuGroup schema
  menu_tree = parse_explicit_config(menu_config_file, filter_by_role=role.slug)

elif sidebar_component:
  # Read component source — look for:
  #   conditional renders: {role === 'admin' && <MenuItem>}
  #   permission checks: {hasPermission('users.list') && <MenuItem to="/admin/users">}
  #   menu arrays: const menuItems = [{label, url, roles: ['admin']}]
  menu_tree = parse_sidebar_component(component_file, filter_by_role=role.slug)

elif route_guards:
  # Build menu from routes that role can access
  # Group by route data.menuGroup or path prefix
  routes_for_role = filter_routes_by_guards(all_routes, role.slug)
  menu_tree = group_routes_into_menu(routes_for_role)
  warnings.append(f"Menu for {role.slug} inferred from route guards — verify with UX team")

else:
  menu_tree = []
  warnings.append(f"No menu source for role {role.slug}")
```

**Stack-specific patterns**:

| Stack | Look for |
|---|---|
| Angular | `app-routing.module.ts` with `data: {roles: [...]}`, `canActivate: [RoleGuard]` |
| NestJS + React | `@Roles()` decorator on backend + `<ProtectedRoute roles={...}>` on frontend |
| Next.js | `middleware.ts` role checks, `app/(admin)/` route groups |
| Vue + Pinia | `router.beforeEach` guards checking `useAuthStore().role` |
| Laravel + Inertia | `routes/web.php` middleware('role:admin'), `<Link>` in layouts |

### 2.4.3 Extract dashboard widgets per role

```bash
# Find dashboard route component per role
grep -rE "/dashboard|/admin/dashboard|/staff/home" --include="*.tsx" {repo-path}

# In each dashboard component, find widget components
grep -rE "<StatsCard|<ChartWidget|<ActivityFeed|<DashboardWidget" {dashboard-component-file}
```

For each widget found, extract:
- `name`: from prop `title=` or `label=`
- `type`: classify by component name pattern (StatsCard → stats, LineChart → chart, ActivityList → activity-feed)
- `description`: from prop `description=` or component docstring

If no dashboard component found → set `dashboard.widgets: []` + warning.

### 2.4.4 Extract workflow variants per role

**Trigger**: Entities with state-machine pattern AND state transitions guarded by role.

```bash
# Find state machine definitions
grep -rE "enum.*Status|enum.*State|type.*State.*=" --include="*.ts" {repo-path}

# Find state transition logic with role guards
grep -rE "@Roles.*\".*approve|@Roles.*\".*submit|canTransition.*role" --include="*.ts" {repo-path}
```

For each entity with state-machine:

```python
workflow_variants = {}
for role in roles:
  states_visible    = []  # states this role can SEE in queries
  states_actionable = []  # states this role can MODIFY
  available_actions = []  # specific from→to transitions

  # Scan service methods that mutate state
  for method in entity_service_methods:
    if method.has_role_guard(role.slug):
      from_state, to_state = extract_transition(method)
      action_label_vn = vn_label_from_method_name(method.name)
      available_actions.append({"action": action_label_vn, "from_state": from_state, "to_state": to_state})

  # Scan queries that filter by state
  for query in entity_repository_queries:
    if query.has_role_filter(role.slug):
      states_visible.extend(extract_state_filter(query))

  workflow_variants[role.slug] = {
    "states_visible": states_visible,
    "states_actionable": list({a["from_state"] for a in available_actions if a["from_state"]}),
    "available_actions": available_actions
  }
```

Skip workflow_variants when:
- Entity is simple CRUD (no state machine in §6 entities)
- All roles share identical actions (no role-specific guards on transitions)

### 2.4.5 Write `intel/sitemap.json`

```json
{
  "schema_version": "1.0",
  "multi_role": true,
  "roles": [<RoleNavigation objects per E2/E3>],
  "routes": [
    {
      "path": "/admin/users",
      "method": "GET",
      "component": "UserListPage",
      "feature_id": "F-007",
      "auth": {"required": true, "allowed_roles": ["admin"]},
      "playwright_hints": { "wait_for_selector": "table[data-testid=user-list]" },
      "evidence": [
        {"kind": "code", "file": "web/app/admin/users/page.tsx", "line": 1},
        {"kind": "code", "file": "src/users/users.controller.ts", "line": 45, "pattern": "@Get()"}
      ],
      "confidence": "high",
      "source_producers": ["tdoc-researcher"]
    }
  ],
  "feature_overrides": [<FeatureOverride per E4 + role-variants from flow-report>],
  "warnings": ["<any warnings collected>"]
}
```

**Confidence per route** (CD-10 §13):
- `high`: route exists in BOTH backend router AND frontend file (or matches a menu config entry) AND has ≥ 2 evidence
- `medium`: single side (FE-only or BE-only)
- `low`: inferred from component name pattern only (no router declaration found)
- `manual`: user-confirmed via interview

**Pre-write validation**:
- All `roles[].slug` exist in `actor-registry.roles[].slug`
- All `menu_tree[].items[].feature_id` exist in feature-catalog features (or null)
- All `feature_overrides[].feature_id` exist in feature-catalog features
- All `workflow_variants[role].available_actions[].from_state/to_state` are in canonical state vocab OR documented in entity state-machine
- Every `routes[]` entry has `confidence` + `evidence[]` (≥ 1 entry) — emit `low` rather than omit

If validation fails → return verdict `BlockedSitemapInvalid` with violation list.

---

