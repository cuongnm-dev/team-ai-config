# Stage 1 — DISCOVERY (Cursor Edition)

**Predecessor**: Stage 0 — Preflight
**Successor**: Stage 2 — Analysis
**Goal**: Establish WHO/WHAT/WHY at high level. Build `actor-registry.json` EARLY so Stage 2 extraction is role-aware.
**Cursor pattern**: Switch Custom Mode "Discovery Researcher" → use `@Codebase` semantic + `@Folders` smart loading → Composer Gate 1 for user confirmation.

---

## Why this stage exists

Per **Zachman Framework "Who" column**: roles are first-class concern, not a footnote. Per **TOGAF ADM**: Discovery (Architecture Vision) precedes Analysis (Business/Information). Per **SAP Activate**: role catalog finalized in Prepare phase.

Practical benefit: Stage 2 outputs (features, sitemap, selectors) all reference `actor-registry.json`. NO re-detection in Stage 2 = no duplicate work, no inconsistency.

---

## Switch to Custom Mode "Discovery Researcher"

Cursor → bottom-right Mode selector → "Discovery Researcher".

**Mode scope** (defined in `modes/doc-writer-modes.json`):
- System prompt: "You are doing high-level discovery — actor catalog + module skeleton. NO deep extraction yet. Output structured JSON only."
- Allowed @-mentions: `@Codebase`, `@Folders`, `@Files`
- Allowed tools: bash (read-only), `mcp__etc-platform__merge_content` for JSON write

---

## 1.1 — System Inventory

**Goal**: Stack/services/databases inventory.

```
@Files package.json pnpm-workspace.yaml turbo.json pyproject.toml go.mod Cargo.toml docker-compose.yml docker-compose.*.yml
```

Build inventory directly from these files (no @Codebase needed — pure config inspection).

**Composer propose** → `intel/system-inventory.json`:

```json
{
  "primary_language": "typescript",
  "stacks": [{"role": "backend", "framework": "NestJS", "version": "10.4.0", "path": "apps/api"}],
  "services": [{"name": "api", "port": 3000}],
  "databases": [{"name": "main", "type": "PostgreSQL"}],
  "is_microservices": false
}
```

User accepts → continue.

---

## 1.2 — Actor Enumeration ★ ROLE-FIRST

**Goal**: Build authoritative `actor-registry.json` BEFORE deep extraction. All Stage 2 sub-steps consume this file.

### 1.2.1 Detect RBAC mode (priority order, all via @Codebase semantic)

```
@Codebase "Roles decorator @PreAuthorize @Roles RolesGuard"
@Codebase "ProtectedRoute RequireRole canActivate role guard"
@Codebase "user role enum constant"
@Codebase "INSERT INTO roles seed migration"
```

Cursor `@Codebase` semantic understands Vietnamese — works better than `grep` for projects with VN comments/docstrings.

Map to RBAC mode:

| Strongest signal hits | Mode |
|---|---|
| `@Roles` / `@PreAuthorize` decorators | `decorator-based` |
| Middleware `RolesGuard` / `requireRole` | `middleware-based` |
| Frontend `<ProtectedRoute>` only | `enum-only` (frontend-driven) |
| `INSERT INTO roles` only | `data-driven` |
| None | `implicit` or `single-role` |

### 1.2.2 Enumerate roles + lookup VN names

For each role found:

```
@Files README.md docs/glossary.md docs/roles.md
```

Search for "Roles" / "Vai trò" section. Use VN names from there. Fallback to default mapping table:

| Technical | Vietnamese |
|---|---|
| `admin`, `administrator` | Quản trị hệ thống |
| `manager`, `lead` | Trưởng phòng / Lãnh đạo |
| `staff`, `user`, `cb` | Cán bộ nhân viên |
| `customer`, `kh` | Khách hàng |
| `auditor` | Kiểm toán viên |
| `guest` | Khách (chưa đăng nhập) |

**NEVER** use raw technical names trong `display`.

### 1.2.3 Determine multi-role flag

```
multi-role = true  IF (≥ 2 roles AND any controller/route has different @Roles guards on different methods of same entity)
multi-role = false IF (1 role OR all roles share identical access)
```

Use `@Codebase "controller method same entity different roles"` to verify.

### 1.2.4 Composer propose `intel/actor-registry.json`

Reference: `@Notepads sitemap-schema` for canonical Role object schema.

```json
{
  "multi-role": true,
  "rbac-mode": "decorator-based",
  "roles": [
    {
      "slug": "admin",
      "display": "Quản trị hệ thống",
      "credentials_ref": null,
      "login_url": null,
      "post_login_redirect": null,
      "source": "src/auth/role.enum.ts:5 + @Roles decorator usage 47x"
    }
  ],
  "evidence": [
    {"file": "src/decorators/roles.ts", "pattern": "@Roles", "count": 70}
  ]
}
```

Composer review — user verifies role catalog correct.

---

## 1.3 — Domain Skeleton

**Goal**: High-level module + feature inventory. NO deep extraction (descriptions/steps/actors per feature come in Stage 2.2).

```
@Folders src/    (or apps/api/src for monorepo)
@Codebase "Controller folder structure"
```

For each module:

```python
module = {
  "id": f"M{NN:02d}",
  "name": vietnamese_name(folder_name),  # e.g., "users" → "Quản lý người dùng"
  "service": detect_service(),
  "feature_count_estimate": rough_method_count // 2
}
```

Feature names list (lightweight — verb + entity, no deep extraction):

```python
verb_map = {
  "findAll": "Danh sách", "findOne": "Chi tiết",
  "create": "Tạo mới", "update": "Cập nhật", "delete": "Xóa",
  "search": "Tìm kiếm", "export": "Xuất báo cáo", "approve": "Duyệt"
}
```

Composer propose `intel/domain-skeleton.json`:

```json
{
  "modules": [
    {"id": "M01", "name": "Quản lý người dùng",  "service": "api", "feature_count_estimate": 8},
    {"id": "M02", "name": "Quản lý đề xuất",      "service": "api", "feature_count_estimate": 12}
  ],
  "feature_names_estimate": ["Đăng nhập", "Tạo người dùng", "Sửa người dùng", "..."],
  "scale_warning": false,
  "complexity": "M",
  "estimated_total_features": 25
}
```

---

## Composer Gate 1 (★ MANDATORY pause)

Composer presents 3 files in unified diff:
- `intel/system-inventory.json`
- `intel/actor-registry.json`
- `intel/domain-skeleton.json`

User reviews:
- ✅ Roles enumerated correctly?
- ✅ Multi-role flag accurate?
- ✅ Modules cover system scope?
- ✅ Estimated total features matches user expectation?

User has 4 options:
1. **Accept all** → advance Stage 2
2. **Edit inline** → user modifies values directly in Composer, then accepts
3. **Re-run Stage 1** → Composer reject, agent re-extracts
4. **Cancel pipeline**

**No silent advance.** Composer is the gate.

---

## Path-specific dispatch

### Path A (doc-driven, score ≥ 4/5)

Switch Mode "Doc Harvester" instead of "Discovery Researcher":

```
@Files docs/source/*.{pdf,docx,md}
@Folders docs/source/screens/   (wireframe images)
```

Doc Harvester reads BA documents, extracts §3 Actors → actor-registry.json, §7.5 Sitemap → defer to Stage 2.3.

### Path B (code-driven, score ≤ 1/5)

Use Mode "Discovery Researcher" as described above.

### Path AB (hybrid, score 2-3/5)

Sequential (Cursor không có true parallel):
1. First switch "Doc Harvester" → discover from docs
2. Then switch "Discovery Researcher" → discover from code
3. Composer merge: doc-intel.actor-registry wins for `display` text; tdoc-researcher.actor-registry wins for `slug`/`evidence`/`source`

---

## Anti-patterns (Cursor-specific)

- ❌ Skip Stage 1 → Stage 2 directly. Roles MUST be in actor-registry.json before Stage 2.
- ❌ Use `grep` instead of `@Codebase` for VN role names — semantic understands VN better.
- ❌ Build complete feature list in 1.3 with descriptions — that's Stage 2.2 territory.
- ❌ Skip Composer Gate 1 → silent advance. Cursor's strength is Composer review; use it.
- ❌ Treat single-role as failure. Many systems are single-role; that's a valid branch.
- ❌ Hardcode role display names — lookup README/glossary first.
