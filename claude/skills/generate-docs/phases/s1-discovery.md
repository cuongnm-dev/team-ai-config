# Stage 1 — DISCOVERY

**Predecessor**: Stage 0 — Preflight
**Successor**: Stage 2 — Analysis
**Goal**: Understand WHO (actors), WHAT (system inventory), WHY (domain skeleton) at high level BEFORE deep extraction. This stage is the foundation for role-aware extraction in Stage 2.
**Gate 1**: User confirms (a) all roles enumerated, (b) all modules listed, (c) multi-role flag correct → advance Stage 2.

---

## Why this stage exists

Enterprise frameworks (TOGAF ADM, SAP Activate, Zachman) put role catalog and high-level scope discovery BEFORE deep analysis. Reasons:

1. **Role context propagates** — every subsequent extraction tags items with role-visibility from registry built here.
2. **Branch detection** — single-role vs multi-role decided here; downstream stages skip role logic when single-role.
3. **Scope confirmation** — user validates the system shape (3 modules, 30 features, 2 roles) before LLM burns tokens on details.
4. **No re-scanning** — Stage 2.3 (UX Architecture) consumes the actor-registry instead of re-detecting roles.

---

## Sub-steps

### 1.0 — Intel reuse gate (REUSE-FIRST mandate)

After Stage 0.0 confirmed canonical intel is FRESH, Stage 1 producers (`tdoc-researcher` Path B, `doc-intel` Path A) MUST NOT re-discover. They become **enrichers**, not producers.

```
For each Stage 1 artifact (system-inventory, actor-registry, domain-skeleton):
  IF docs/intel/<artifact>.json FRESH AND schema-valid:
    Print: "Stage 1.{n}: ♻ REUSED from intel ({summary}). Re-run with --rerun-stage 1 if needed."
    Skip producer; load into memory.
  ELSE IF FRESH but missing optional fields:
    Print: "Stage 1.{n}: ENRICH — adding missing {fields}"
    Run producer in enrich-only mode (write *.new.json + invoke intel-merger).
  ELSE (missing OR stale):
    Run producer fully (subject to CD-10 rules).
```

**User-visible print examples (REQUIRED — no silent skip):**
```
Stage 1.1 (System Inventory): ♻ REUSED — 1 service, NestJS+Next.js, PostgreSQL
Stage 1.2 (Actor Enumeration): ♻ REUSED — 4 roles (admin, hqdk, kiem-hoa, lanh-dao), RBAC
Stage 1.3 (Domain Skeleton):   ENRICH — adding 2 missing modules
```

Anti-pattern (FORBIDDEN): silent skip without print. User must see what was reused so they can override with `--rerun-stage 1` if intel is suspected stale.

### 1.1 — System Inventory

**Producer**: tdoc-researcher Stage 1.1 *(Path B)* OR doc-intel agent (internal phases mapped to Stages 1.1 + 1.2) *(Path A)*

**Output**: `$DOCS_PATH/intel/system-inventory.json`

```json
{
  "primary_language": "typescript",
  "stacks": [
    {"role": "backend", "framework": "NestJS", "version": "10.4.0", "path": "apps/api"},
    {"role": "frontend", "framework": "Next.js", "version": "14.2.0", "path": "apps/web"}
  ],
  "services": [{"name": "api", "port": 3000, "type": "backend"}],
  "databases": [{"name": "main", "type": "PostgreSQL", "schema-source": "prisma/schema.prisma"}],
  "is_microservices": false
}
```

### 1.2 — Actor Enumeration ★ ROLE-FIRST PRINCIPLE

**Producer**: tdoc-researcher Phase 1.2 *(Path B)* OR doc-intel §3 early pass *(Path A)*

**Tasks**:

| Task | Code-side detection | Doc-side detection |
|---|---|---|
| RBAC mode | `@Roles`, `@PreAuthorize`, `RoleGuard`, `ProtectedRoute`, middleware role check | "Roles" / "Vai trò" section in README, glossary, role table in BA spec |
| Role enumeration | role enum/constant files, role table seed | actor table in §3, role badges in wireframes |
| Login URL per role | post-login redirect logic, route layouts (`(admin)/`, `(staff)/`) | login screen wireframe, "Sau khi đăng nhập…" prose |
| Multi-role flag | ≥ 2 roles with DIFFERENT route access on same entity | ≥ 2 actors with different permissions in §3 |

**Output**: `$DOCS_PATH/intel/actor-registry.json`

```json
{
  "multi-role": true,
  "rbac-mode": "decorator-based | middleware-based | enum-only | implicit",
  "roles": [
    {
      "slug": "admin",
      "display": "Quản trị hệ thống",
      "credentials_ref": 0,
      "login_url": "/login",
      "post_login_redirect": "/admin/dashboard",
      "source": "src/auth/role.enum.ts:5 + @Roles decorator usage 47x"
    },
    {
      "slug": "staff",
      "display": "Cán bộ nhân viên",
      "credentials_ref": 1,
      "login_url": "/login",
      "post_login_redirect": "/dashboard",
      "source": "src/auth/role.enum.ts:6 + @Roles decorator usage 23x"
    }
  ],
  "evidence": [
    {"file": "src/decorators/roles.ts", "pattern": "@Roles", "count": 70},
    {"file": "src/auth/role.enum.ts", "pattern": "enum UserRole", "count": 1}
  ]
}
```

**Reference**: full schema in `notepads/sitemap-schema.md` (Role object).

### 1.3 — Domain Skeleton

**Producer**: tdoc-researcher Phase 1.3 *(Path B)* OR doc-intel §4 quick pass *(Path A)*

**Output**: `$DOCS_PATH/intel/domain-skeleton.json`

```json
{
  "modules": [
    {"id": "M01", "name": "Quản lý người dùng",  "service": "api", "feature_count_estimate": 8},
    {"id": "M02", "name": "Quản lý đề xuất",      "service": "api", "feature_count_estimate": 12},
    {"id": "M03", "name": "Báo cáo + Thống kê",   "service": "api", "feature_count_estimate": 5}
  ],
  "feature_names_estimate": [
    "Đăng nhập", "Quên mật khẩu", "Tạo người dùng", "Sửa người dùng", "..."
  ],
  "scale_warning": false,
  "complexity": "M",
  "estimated_total_features": 25
}
```

NO deep extraction yet — feature names only, no `description`, `steps`, `actors[]` per feature. Those come in Stage 2.2.

---

## Path-specific dispatch

### Path A (doc-driven) — score ≥ 4/5

```
Agent(subagent_type=doc-intel,
      prompt=|
        ## Agent Brief
        role: doc-intel
        stage: 1 (Discovery — quick scan only, NOT full extraction)
        
        ## Inputs
        input-files: [paths from docs/source/]
        output-mode: discovery-only
        early-artifacts:
          - intel/system-inventory.json (from Stage 1.1 system inventory)
          - intel/actor-registry.json   (from §3 quick pass)
          - intel/domain-skeleton.json  (from §4 quick pass, no deep details))
```

Then dispatched again in Stage 2 with `output-mode: full` for deep extraction.

### Path B (code-driven) — score ≤ 1/5

```
Agent(subagent_type=tdoc-researcher,
      prompt=|
        ## Agent Brief
        role: tdoc-researcher
        stage: 1 (Discovery — Phases 1.1, 1.2, 1.3 only)
        
        ## Inputs
        repo-path: {abs path to repo}
        skip-phases-after: 1.3  (do not run Stage 2 yet — caller will re-invoke))
```

### Path AB (hybrid) — score 2-3/5

Run BOTH agents in parallel. Merge outputs at Gate 1:
- doc-intel.actor-registry wins for `display` text (BA spec authoritative)
- tdoc-researcher.actor-registry wins for `slug`, `evidence`, `source` (code authoritative)

---

## Gate 1 checklist

```
- [ ] system-inventory.json: stacks + services + databases populated
- [ ] actor-registry.json: roles[] non-empty, all slugs ASCII kebab-case, all displays in Vietnamese
- [ ] domain-skeleton.json: modules[] non-empty, complexity classified
- [ ] Cross-check: number of roles in actor-registry matches actors mentioned in domain-skeleton
- [ ] User confirms scope (display summary card with N modules, M roles, ~K features estimated)
```

If `multi-role: true` → MUST proceed with sitemap-aware Stage 2.
If `multi-role: false` → Stage 2 skips role-tagging logic; sitemap.json optional.

---

## Anti-patterns

- ❌ Skip Stage 1 → run Stage 2 directly (causes role-detection to happen mid-extraction = AP-1 from analysis)
- ❌ Re-scan codebase in Stage 2 to find roles (use actor-registry.json from 1.2)
- ❌ Build complete feature list in 1.3 with descriptions (that's Stage 2.2 — keep 1.3 lightweight)
- ❌ Ask user to manually enumerate roles (auto-detect first, confirm at Gate 1)
- ❌ Treat single-role detection as failure (it's a valid branch — many systems are single-role)
