# Stage 2b — Code Research (Path B, FALLBACK)

**Stage**: 2 ANALYSIS, sub-step 2b (when Path B code-driven)
**Predecessor**: Stage 1 (Discovery — actor-registry exists)
**Successor**: Stage 3 (if HDSD) or Stage 4 (synthesis)

**ROLE**: Code archaeologist. Scan codebase via Cursor semantic for 4 intel reports.

**TRIGGER**: `DOCS_ROUTE=B` (coverage < 2/5). Path A (`s2a-doc-harvester.md`) preferred when docs available.

**OUTPUT**: `{DOCS_PATH}/intel/{stack,arch,flow,frontend}-report.json` + `{DOCS_PATH}/intel/sitemap.json` (when `multi-role: true`)

**MODEL**: Sonnet (routine extract). Think mode for FLOW grouping.

---

## Cursor pattern

Use `@Codebase` semantic, NOT bash `find/grep`. Semantic understands code structure better than text grep.

| Task | Cursor pattern |
|---|---|
| Stack detect | `@Files package.json pyproject.toml go.mod Cargo.toml` |
| Find controllers | `@Codebase "Controller class HTTP decorator"` |
| Find routes | `@Codebase "POST GET PUT DELETE route path"` |
| Find entities | `@Codebase "Entity Prisma model SQLAlchemy"` |
| Find forms | `@Codebase "form onSubmit input email password"` |

---

## Extraction rules (CD-10 canonical names)

- `system-inventory.stacks[].version`: exact from `package.json.dependencies` (no guess patch). [Legacy name: stack-report]
- `code-facts.routes[]`: every route has `file:line` from Cursor citation. [Legacy: arch-report.routes]
- `code-facts.entities[]`: parsed from schema files only, never invented. [Legacy: arch-report.entities]
- `feature-catalog.features[].routes[]`: each feature links to ≥ 1 route in `sitemap.routes[].path`. [Legacy: flow-report.features]
- `sitemap.routes[]`: only routes actually in frontend code. [Legacy: frontend-report.routes]
- `feature-catalog.features[]` MUST satisfy enriched schema: `description ≥ 200 chars`, `business_intent ≥ 100`, `flow_summary ≥ 150`, `acceptance_criteria ≥ 3 items × 30 chars`. Producer hard-fails on thin output (Fix 2b).
- Missing data → warn in verdict, NEVER fabricate. Use `[CẦN BỔ SUNG: <field>]` pattern + escalate to user via PM.

---

## Protocol (4 sub-phases)

### SCAN — Stack detection

```
@Files package.json pnpm-workspace.yaml turbo.json pyproject.toml go.mod Cargo.toml docker-compose.yml
```

Output `intel/system-inventory.json`:
```json
{
  "primary_language": "<lang>",
  "stacks": [{"role": "backend|frontend|database", "framework": "<name>", "version": "<semver>"}],
  "docker_services": [<service names>],
  "testing_framework": "<jest|pytest|go test|...>"
}
```

### ARCH — Routes, APIs, DB schema

```
@Codebase "Controller decorator HTTP endpoint"
@Codebase "Entity model Prisma TypeORM"
@Files prisma/schema.prisma
@Files db/migrations
```

Output `intel/data-model.json`:
```json
{
  "services": [{
    "name": "<service>",
    "routes": [{"method": "POST", "path": "/api/v1/x", "controller": "X.method", "file": "x.ts:24"}],
    "entities": [{"name": "User", "fields": [...], "relations": [...]}]
  }]
}
```

### FLOW — Business features (Think mode)

Toggle Think mode. Task: group N controller routes → M business features.

VN actor mapping:
- `admin` → "Quản trị viên"
- `user` → "Cán bộ / Nhân viên"
- `manager` → "Trưởng phòng / Cấp trưởng"

**Multi-role detection**: If system has ≥ 2 distinct roles with different access, enumerate `roles[]`
and set `role-visibility[]` per feature. Single-role systems → `roles` has 1 entry, omit `role-visibility`.

Output `intel/feature-catalog.json`:
```json
{
  "roles": [
    {"slug": "admin",   "display": "Quản trị hệ thống",  "credentials-ref": 0},
    {"slug": "staff",   "display": "Cán bộ nhân viên",   "credentials-ref": 1}
  ],
  "services": [{
    "name": "<service-slug>",
    "display_name": "Phân hệ <vn-name>",
    "features": [{
      "id": "F-001",
      "name": "<vn-business-name>",
      "description": "<vn>",
      "actors": ["<vn-role>"],
      "role-visibility": ["admin", "staff"],
      "role-variants": null,
      "entry_ui": "/path",
      "api_refs": ["POST /api/v1/..."],
      "steps": [...],
      "error_cases": [...]
    }]
  }],
  "roles_mapping": {"admin": "Quản trị viên"},
  "multi-role": true
}
```

`role-visibility`: danh sách slug của roles có quyền truy cập feature này.
`role-variants`: `null` nếu UI giống nhau cho mọi role. Nếu khác → object mô tả sự khác biệt:
```json
"role-variants": {
  "admin": {"extra-actions": ["Xóa", "Duyệt"], "screenshot-note": "Hiển thị thêm nút Xóa"},
  "staff": {"extra-actions": [], "screenshot-note": "Chỉ xem, không có nút Xóa"}
}
```
```

### SITEMAP — Workspace + Menu + Workflow Variants per role (multi-role only)

**Trigger**: After FLOW completes, IF `feature-catalog.json.multi-role == true`.
**Skip**: single-role → write empty stub or omit file.

**Reference schema**: `~/.cursor/skills/generate-docs/notepads/sitemap-schema.md`

```
@Codebase "menu config sidebar navigation"
@Codebase "Roles guard canActivate"
@Codebase "dashboard widget statsCard chart"
@Files src/config/menu.* src/config/routes.* sidebar.tsx app-routing.module.ts
```

**Per role**, extract:

| Field | Source priority |
|---|---|
| `workspace.entry_url` | post-login redirect logic → role-specific layout route → fallback `/` |
| `workspace.dashboard.widgets[]` | dashboard component children → empty array if no dashboard |
| `workspace.menu_tree[]` | (1) explicit menu config → (2) sidebar component conditional renders → (3) inferred from route guards |

**Per feature with role differences**, extract:

| Field | Source |
|---|---|
| `navigation_paths[role]` | menu_tree path that contains feature's url |
| `ui_variants[role]` | conditional renders in feature component (e.g. `{role === 'admin' && <DeleteButton/>}`) |
| `workflow_variants[role]` | service methods with role guards on state transitions |

Output `intel/sitemap.json` (full schema in `notepads/sitemap-schema.md`).

### FE — Frontend selectors + credentials

```
@Codebase "login form email password submit button"
@Files .env.example .env.test
```

Output canonical (CD-10): `docs/intel/sitemap.json` (with `routes[].playwright_hints` absorbing selectors per CD-10) + `docs/intel/test-accounts.json` (credentials separated from selectors). Legacy `frontend-report.json` no longer produced. Schema example below shows merged structure:
```json
{
  "base_url": "http://localhost:<port>",
  "credentials": [
    {"role": "admin", "slug": "admin", "email": "admin@example.com", "password": "...", "source": "seed.ts"},
    {"role": "staff", "slug": "staff", "email": "staff@example.com", "password": "...", "source": ".env.test"}
  ],
  "auth-verification": {
    "login-url": "/login",
    "selector-hints": {
      "email": "[data-testid=login-email]",
      "password": "[data-testid=login-password]",
      "submit": "[data-testid=login-submit]"
    },
    "token-key": "access_token",
    "auto-login-supported": true,
    "credentials-confidence": "high|medium|low"
  }
}
```

---

## Composer pattern

4 intel JSON = 4 Composer proposes. User reviews each, catches extraction bugs early.

---

## Error handling

| Situation | Action |
|---|---|
| Cursor indexing stale | Re-index in Settings, retry |
| Cannot find controllers | Ask user for explicit folder path |
| No testid attributes | Degrade to type/name selector cascade |
| No login URL | Set `auto-login-supported: false`, Phase 2 manual recording mode |
| Think mode returns 0 features | Ask user for grouping hint |
