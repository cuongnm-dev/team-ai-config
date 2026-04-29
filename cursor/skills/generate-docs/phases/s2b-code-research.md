# Stage 2b — Code Research (Path B — Cursor Edition)

**Stage**: 2 ANALYSIS, sub-step 2b — Custom Mode "Code Researcher"
**Predecessor**: Stage 1 Discovery (actor-registry.json exists)
**Successor**: Stage 2.4 (code-facts) parallel + Stage 3 if HDSD

**ROLE**: Code archaeologist. Scan codebase via Cursor semantic for 4 intel reports.

**TRIGGER**: `DOCS_ROUTE=B` (coverage < 2/5). Path A (`s2a-doc-harvester.md`) preferred when docs available.

**OUTPUT** (CD-10 canonical names):
- `{DOCS_PATH}/intel/system-inventory.json` (legacy: stack-report)
- `{DOCS_PATH}/intel/code-facts.json` (legacy: arch-report — routes, entities, validation rules)
- `{DOCS_PATH}/intel/feature-catalog.json` (legacy: flow-report — features role-tagged, ENRICHED schema)
- `{DOCS_PATH}/intel/sitemap.json` (legacy: frontend-report — routes + selectors + workflow_variants)
- `{DOCS_PATH}/intel/test-accounts.json` (credentials — replaces frontend-report credentials block)
- `{DOCS_PATH}/intel/code-brief.md` + `arch-brief.md` (digests)

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

## Extraction rules (CD-10 canonical)

- `system-inventory.stacks[].version`: exact from `package.json.dependencies` (no guess patch). [Legacy: stack-report]
- `code-facts.routes[]`: every route has `file:line` from Cursor citation. [Legacy: arch-report.routes]
- `code-facts.entities[]`: parsed from schema files only, never invented. [Legacy: arch-report.entities]
- `feature-catalog.features[].routes[]`: each feature links to ≥ 1 route in `sitemap.routes[].path`. [Legacy: flow-report.features]
- `sitemap.routes[]`: only routes actually in frontend code. [Legacy: frontend-report.routes]
- `feature-catalog.features[]` MUST satisfy enriched schema: `description ≥ 200 chars`, `business_intent ≥ 100`, `flow_summary ≥ 150`, `acceptance_criteria ≥ 3 items × 30 chars`. Producer hard-fails on thin output (Fix 2b).
- Missing data → warn in verdict, NEVER fabricate. Use `[CẦN BỔ SUNG: <field>]` pattern + escalate to user via PM.
- Validate writes against `~/.claude/schemas/intel/*.schema.json`; update `_meta.json` per artifact (CD-10 §1).

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

Output `intel/feature-catalog.json`:
```json
{
  "services": [{
    "name": "<service-slug>",
    "display_name": "Phân hệ <vn-name>",
    "features": [{
      "id": "F-001",
      "name": "<vn-business-name>",
      "description": "<vn>",
      "actors": ["<vn-role>"],
      "entry_ui": "/path",
      "api_refs": ["POST /api/v1/..."],
      "steps": [...],
      "error_cases": [...]
    }]
  }],
  "roles_mapping": {"admin": "Quản trị viên"}
}
```

### FE — Frontend selectors + credentials

```
@Codebase "login form email password submit button"
@Files .env.example .env.test
```

Output `intel/sitemap.json` (selectors absorbed into `routes[].playwright_hints` per CD-10) + `intel/test-accounts.json` (credentials):
```json
{
  "base_url": "http://localhost:<port>",
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
