# tdoc-researcher — Stage 1 (Discovery)

> Loaded on-demand by `tdoc-researcher` agent when `scope ∈ {stage1, full}`. Do NOT load eagerly.
> Outputs: `intel/system-inventory.json`, `intel/actor-registry.json`, `intel/domain-skeleton.json`.
> Schemas: `~/.claude/schemas/intel/{system-inventory,actor-registry,domain-skeleton}.schema.json`.

## Stage 1.1 — System Inventory (Stack Detection)

**Output**: `{docs-path}/intel/system-inventory.json`

### 1.1.1 Glob signal files from `{repo-path}` (exclude: node_modules/, vendor/, .git/, dist/, build/)

```
**/package.json | **/go.mod | **/pom.xml | **/build.gradle
**/requirements.txt | **/Pipfile | **/composer.json
**/docker-compose*.yml | **/prisma/schema.prisma
**/.env.example | **/migrations/*.sql
```

**MCP preference:** If `mcp__NX__get_project_graph` available → call first, skip manual Glob.

### 1.1.2 Stack detection table + confidence score (Issue #10 fix)

**Compute confidence per detected stack:**

| Score | When |
|---|---|
| `high` | Multiple signals match (package.json + config file + entry pattern) |
| `medium` | Single strong signal (e.g., package.json has framework dep) |
| `low` | Weak signal (framework name mentioned in README only, no actual code) |
| `unknown` | No signals match — stack cannot be identified |

Write `"framework-detection-confidence": "high|medium|low|unknown"` to stack-report.json per stack.

**Rule:** If confidence < medium → emit warning + ask user to confirm stack before proceeding with Stage 2. Non-standard stacks (Rust, Elixir, Zig, Haskell) trigger `unknown` → writers will use generic templates + note in docs.


|---|---|---|
| package.json has `"next"` | Next.js | scan `app/` or `pages/` |
| package.json has `"@nestjs/core"` | NestJS | scan `src/**/*.controller.ts` |
| package.json has `"express"` | Express.js | scan `routes/`, `app.js` |
| package.json has `"vue"` or `"nuxt"` | Vue/Nuxt | scan `pages/`, `views/` |
| composer.json has `"laravel"` | Laravel | scan `routes/`, `app/Http/Controllers/` |
| pom.xml has `spring-boot` | Spring Boot | scan `**/*Controller.java` |
| go.mod has `gin-gonic`/`fiber`/`echo` | Go | scan `main.go`, `router*.go` |
| requirements.txt has `fastapi`/`django` | Python | scan `routers/`, `urls.py` |

### 1.1.3 Parse docker-compose.yml → services, images, ports, env keys, depends_on

### 1.1.4 Write `intel/system-inventory.json`

```json
{
  "scan-date": "YYYY-MM-DD",
  "repo-path": "...",
  "stacks": [{"name":"frontend","framework":"Next.js","path":"apps/web","entry-points":["app/"]}],
  "services": [{"name":"api","image":"node:20","ports":["3000:3000"],"type":"backend","base-url":"http://localhost:3000"}],
  "databases": [{"name":"postgres","type":"PostgreSQL","schema-source":"prisma/schema.prisma"}],
  "service-count": 3,
  "is-microservices": true
}
```

---

## Stage 1.2 — Actor Enumeration ★ ROLE-FIRST PRINCIPLE

**Output**: `{docs-path}/intel/actor-registry.json` (★ NEW canonical artifact — used by ALL Stage 2 sub-steps)

### 1.2.1 Detect RBAC mode (priority order)

```bash
# (1) Decorator-based — NestJS, Spring, FastAPI
grep -rE "@Roles\(|@PreAuthorize\(|@HasRole\(|@RequiredRole\(|@RolesAllowed\(" \
  --include="*.ts" --include="*.java" --include="*.py" {repo-path}/src

# (2) Middleware-based — Express, Fastify, Laravel
grep -rE "RolesGuard|requireRole|authorize\([\"']role" --include="*.ts" --include="*.js" --include="*.php" {repo-path}/src

# (3) Frontend route guards
grep -rE "<ProtectedRoute|<RequireRole|canActivate.*Role|<Authorize" --include="*.tsx" --include="*.html" {repo-path}/src

# (4) Enum/constant files
find {repo-path} -type f \( -name "role.enum.*" -o -name "roles.constant.*" -o -name "user-role.*" \) 2>/dev/null

# (5) DB seed/migration with roles table
grep -rE "INSERT INTO.*roles|create_roles\(\)|seedRoles" --include="*.sql" --include="*.ts" --include="*.py" {repo-path}
```

Map to RBAC mode classification:

| Signal hits | Mode |
|---|---|
| (1) found | `decorator-based` |
| (2) only | `middleware-based` |
| (3) + (4) only | `enum-only` (frontend-driven) |
| (5) only | `data-driven` (roles in DB) |
| None of above | `implicit` or `single-role` |

### 1.2.2 Enumerate roles (canonical list)

For each role found, extract:

```python
role = {
  "slug":               <ascii kebab-case from enum/constant>,
  "display":            <Vietnamese name from C3.5 mapping table OR README "Vai trò" section>,
  "credentials_ref":    null,  # populated in Stage 2.3 when test creds discovered
  "login_url":          null,  # populated in Stage 2.3 when login flow extracted
  "post_login_redirect": null, # populated in Stage 2.3 from router config
  "source":             f"{file}:{line} + @Roles usage {N}x"
}
```

**Default Vietnamese mapping** (lookup priority: README → docs/glossary.md → comments → fallback table):

| Technical | Vietnamese |
|---|---|
| `admin`, `administrator`, `super_admin` | Quản trị hệ thống |
| `manager`, `lead`, `supervisor` | Trưởng phòng / Lãnh đạo |
| `staff`, `employee`, `user`, `cb` | Cán bộ nhân viên |
| `customer`, `client`, `kh` | Khách hàng |
| `operator`, `vh` | Người vận hành |
| `auditor`, `kt` | Kiểm toán viên |
| `guest`, `anonymous` | Khách (chưa đăng nhập) |

**NEVER** use raw technical names in `display` field.

### 1.2.3 Determine multi-role flag

```
multi-role = true  IF (≥ 2 roles AND any controller/route has different @Roles guards
                       on different methods of same entity)
multi-role = false IF (1 role OR all roles share identical access)
```

### 1.2.4 Write `intel/actor-registry.json`

```json
{
  "schema_version": "1.0",
  "multi_role": true,
  "rbac_mode": "decorator-based",
  "roles": [
    {
      "slug": "admin",
      "display": "Quản trị hệ thống",
      "type": "internal",
      "auth": {"login_url": null, "post_login_redirect": null, "credentials_ref": null, "session_strategy": "jwt"},
      "evidence": [
        {"kind": "code", "file": "src/auth/role.enum.ts", "line": 5, "pattern": "ADMIN", "count": 1},
        {"kind": "code", "file": "src/decorators/roles.ts", "pattern": "@Roles(ADMIN)", "count": 47}
      ],
      "confidence": "high",
      "source_producers": ["tdoc-actor-enum"]
    },
    {
      "slug": "staff",
      "display": "Cán bộ nhân viên",
      "type": "internal",
      "auth": {"login_url": null, "post_login_redirect": null, "credentials_ref": null, "session_strategy": "jwt"},
      "evidence": [
        {"kind": "code", "file": "src/auth/role.enum.ts", "line": 6, "pattern": "STAFF", "count": 1},
        {"kind": "code", "file": "src/decorators/roles.ts", "pattern": "@Roles(STAFF)", "count": 23}
      ],
      "confidence": "high",
      "source_producers": ["tdoc-actor-enum"]
    }
  ]
}
```

**Confidence tier rules per role** (CD-10 §13):
- `high`: ≥ 2 evidence entries from same producer (e.g. enum decl + ≥ 1 decorator usage), OR multi-producer agreement (code + doc both find role)
- `medium`: single evidence entry (e.g. enum decl only, no usage found)
- `low`: inferred from name patterns (e.g. "AdminController" but no enum/decorator)
- `manual`: user confirmed via interview question
- OMIT field if producer cannot determine — validator will warn

**Pre-write validation**:
- All `slug` values are ASCII kebab-case, unique
- All `display` values in Vietnamese, no raw technical names
- `multi_role` boolean computed correctly
- Every role has `confidence` + non-empty `evidence[]` (or document why omitted)

---

## Stage 1.3 — Domain Skeleton

**Output**: `{docs-path}/intel/domain-skeleton.json`
**Goal**: High-level module + feature inventory. NO deep extraction — feature names only, no descriptions/steps/actors per feature.

### 1.3.1 Module detection

Group route files by directory + URL prefix:

```python
modules = []
for controller_file in controllers:
  module_path = controller_file.parent  # e.g., src/users/users.controller.ts → src/users
  module_id = f"M{NN:02d}"
  modules.append({
    "id": module_id,
    "name": vietnamese_name(module_path.name),  # "users" → "Quản lý người dùng"
    "service": detect_service(module_path),
    "controller_count": count_controllers(module_path),
    "feature_count_estimate": estimate_features(module_path)  # rough: methods/2
  })
```

### 1.3.2 Feature name list (lightweight)

Just list feature NAMES — no description, no steps. Enough for Gate 1 user confirmation.

```python
feature_names = []
for module in modules:
  for controller in module.controllers:
    for method in controller.methods:
      # CRUD detection from method name
      verb_map = {"findAll": "Danh sách", "findOne": "Chi tiết",
                  "create": "Tạo mới", "update": "Cập nhật", "delete": "Xóa",
                  "search": "Tìm kiếm", "export": "Xuất báo cáo"}
      verb = verb_map.get(method.name) or "Khác"
      entity_vn = vietnamese_name(module.name)
      feature_names.append(f"{verb} {entity_vn}")
```

### 1.3.3 Scale + complexity classification

```
S (Small)  IF total_features ≤ 15 AND modules ≤ 3
M (Medium) IF total_features ≤ 50 AND modules ≤ 8
L (Large)  IF total_features > 50 OR modules > 8
```

### 1.3.4 Write `intel/domain-skeleton.json`

```json
{
  "modules": [
    {"id": "M01", "name": "Quản lý người dùng",  "service": "api", "controller_count": 2, "feature_count_estimate": 8},
    {"id": "M02", "name": "Quản lý đề xuất",      "service": "api", "controller_count": 3, "feature_count_estimate": 12},
    {"id": "M03", "name": "Báo cáo + Thống kê",   "service": "api", "controller_count": 1, "feature_count_estimate": 5}
  ],
  "feature_names_estimate": [
    "Đăng nhập", "Quên mật khẩu", "Danh sách người dùng", "Tạo người dùng",
    "Cập nhật người dùng", "Xóa người dùng", "..."
  ],
  "scale_warning": false,
  "complexity": "M",
  "estimated_total_features": 25
}
```

If `complexity == L` → emit warning to verdict: pipeline may need chunking.

---

# Stage 2 — ANALYSIS (Deep extraction, role-aware)

**Pre-condition**: Stage 1 outputs exist on disk (system-inventory, actor-registry, domain-skeleton).
**Principle**: Every extraction in Stage 2 references `actor-registry.json` for role-visibility tagging — NO re-detection of roles.

