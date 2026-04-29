---
name: new-project
description: Thêm 1 app, service hoặc package mới vào workspace monorepo hiện tại. Đọc .cursor/AGENTS.md để xác nhận loại workspace, scaffold member mới, cập nhật cấu hình workspace và AGENTS.md. Chỉ dùng cho monorepo — muốn tạo workspace mới hoàn toàn thì dùng /new-workspace.
---

# Skill: New Project (Add to Monorepo)

**Standard: new app/service is runnable with `dev --filter {name}` in 30 seconds.**

## § Template Source — centralized MCP (default) with local fallback

**Default**: `mcp__etc-platform__template_registry_load(namespace="new-workspace", template_id="ref-X")` — same registry as `/new-workspace`.

**Fallback** when MCP unavailable / `--no-mcp`: `Read("../new-workspace/ref-X.md")`.

## § File Load Map — Read ONLY when reaching that step

| Step | Template id (MCP) | Local path (fallback) | Condition |
|---|---|---|---|
| Phase 3 | `ref-stack-{stack-id}` | `../new-workspace/ref-stack-{stack-id}.md` | always |
| Phase 3 | `ref-docker` | `../new-workspace/ref-docker.md` | always |
| Phase 3 | `ref-tooling` | `../new-workspace/ref-tooling.md` | only Node.js + biome/lint |

**Stack ID mapping:** same as `/new-workspace` — react-spa, nextjs, vue, nestjs, node-api, fastapi, go, rust, dotnet, react-native, flutter.

---

## § Phase 0 — Pre-flight (automatic)

**Intel detection (check FIRST):**

Check for `intel/tech-brief.md` in current directory or `docs/intel/tech-brief.md`:

If found → **Intel-driven mode**:

1. Read `intel/tech-brief.md` — extract full services list with stacks
2. Read `.cursor/AGENTS.md` (if exists) — extract already-scaffolded services from Active Apps/Services table
3. Compute **remaining services** = tech-brief services − already-scaffolded services
4. Show menu:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Intel-driven project setup
  Source: intel/tech-brief.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Already scaffolded:
    ✓ {service-name} ({stack})     ← from AGENTS.md
    ✓ {service-name-2} ({stack})

  Remaining (from intel):
    [ ] {service-name-3} — {type}: {stack} (port: {suggested})
    [ ] {service-name-4} — {type}: {stack} (port: {suggested})

  Recommended next: {first in scaffold-order not yet done}
  Reason: {rationale from tech-brief scaffold-order}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Which service to scaffold? (enter name or number, or 'all' to scaffold all remaining in order)
```

  - Single selection → scaffold that service, skip Phase 1 (pre-populated from tech-brief)
  - `all` → scaffold each remaining service in scaffold-order, confirm before each
  - User types different name → treat as manual override, proceed with Phase 1 normally

**If not found** → standard flow below.

---

**Read `.cursor/AGENTS.md` first. Hard stop if missing:**
```
No .cursor/AGENTS.md found. This workspace is not configured.
Run /configure-workspace first, then retry /new-project.
```

**Check repo-type:**
- If `repo-type: mini` → stop:
  ```
  This is a mini-repo workspace — it has one project by definition.
  To add a second stack, convert to monorepo first (ask or use /new-workspace).
  ```
- If `repo-type: mono` → continue.

**Detect workspace tooling** from root files:

| File | Tooling |
|---|---|
| `nx.json` | NX |
| `turbo.json` | Turborepo |
| `pnpm-workspace.yaml` | pnpm workspaces |
| `lerna.json` | Lerna |

**Detect package manager** from lockfile.

**Read existing `apps/` and `services/` dirs** — list current members for context.

---

## § Phase 1 — Collect inputs (3 questions max)

Ask all at once in one block:

```
## New Project Setup

1. Type:  app | service | package
   app = frontend deployable  |  service = backend deployable  |  package = shared lib

2. Name:  {name}
   Convention: kebab-case. Will be created at src/apps/{name}/ or src/services/{name}/ or packages/{name}/

3. Stack: (list only stacks compatible with workspace tooling)
   [ ] React SPA (Vite)    [ ] Next.js       [ ] Vue / Nuxt
   [ ] NestJS              [ ] Node.js API    [ ] Python FastAPI
   [ ] Go                  [ ] Rust (Axum)    [ ] .NET
   [ ] React Native        [ ] Flutter
```

Optional (ask only if type = app or service):
```
4. Add to CI?     yes | no  (default: yes if CI config exists at root)
```
Docker is always configured — Dockerfile will be created and root `docker-compose.yml` updated automatically.

---

## § Phase 2 — Confirm

Show one confirmation block before writing anything:

```
## Will create:

  {type}/{name}/            ← new {type}
    src/                    ← stack: {stack}
    docs/features/
    docs/intel/             ← CD-10 canonical intel layer skeleton (see below)
    package.json | tsconfig.json | .env.example
    Dockerfile

  Updates:
    docker-compose.yml      ← add {name} service (port: {next-available-port})
    .env                    ← add {NAME}_PORT + service-specific vars
    .env.example            ← same vars with placeholder values
    .cursor/AGENTS.md       ← add row to Active Apps/Services + Docs-Path Formula
    .gitignore              ← add docs/intel/test-accounts.json (when storage=inline)
    pnpm-workspace.yaml     ← already includes {type}s/* glob (verify)
    turbo.json              ← no change needed (pipeline tasks are generic)
    nx.json                 ← add project entry (NX only)

## Intel layer skeleton (CD-10) — created at workspace root only:
  docs/intel/_meta.json              ← provenance registry (initial empty)
  docs/intel/.gitkeep                ← ensure dir tracked
  
  Stub artifacts (created empty/minimal so consumer skills find them):
  docs/intel/actor-registry.json     ← { "schema_version": "1.0", "rbac_mode": "none", "roles": [] }
  docs/intel/feature-catalog.json    ← { "schema_version": "1.0", "multi_role": false, "roles": [], "features": [] }
  docs/intel/permission-matrix.json  ← { "schema_version": "1.0", "permissions": [] }
  docs/intel/sitemap.json            ← { "schema_version": "1.0", "routes": [], "modules": [] }
  
  Note: stubs are PLACEHOLDERS only. Run /from-doc (if customer docs available) or /from-code (after first scaffold) to populate. Until populated, /new-feature works in legacy mode (feature-map.yaml only).

Proceed? (yes / no)
```

---

## § Phase 3 — Scaffold

**Read `../new-workspace/ref-stack-{stack-id}.md` now.**

### 3.1 Create directory structure

From the ref file's Directory Tree section — adapted for the sub-path:
- App: `apps/{name}/src/...`
- Service: `services/{name}/src/...`
- Package: `packages/{name}/src/...`

### 3.2 `{path}/package.json`

```json
{
  "name": "@{workspace-name}/{name}",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev":       "{dev command for stack}",
    "build":     "{build command}",
    "test":      "{test command}",
    "lint":      "{lint command}",
    "typecheck": "{typecheck command}"
  }
}
```

Extract workspace name from root `package.json → name`.

### 3.3 Starter code

Copy starter code from ref file verbatim. Replace `{project-name}` with actual name.

### 3.4 `{path}/tsconfig.json` (Node.js stacks)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Adjust `../../` depth based on type (app/service → 2 levels up, package → 2 levels up).

### 3.5 `{path}/.env.example`

From ref file's `.env.example` section.

### 3.6 `{path}/docs/features/.gitkeep`

Create empty `.gitkeep` so the docs directory is tracked by git.

### 3.6.5 Initialize canonical intel layer (CD-10) — workspace root only

Run ONCE per workspace (skip if `docs/intel/_meta.json` already exists):

```
mkdir -p docs/intel/test-evidence docs/intel/screenshots docs/intel/screens docs/intel/modules
```

Write stub files (consumers tolerate empty arrays; producers from-doc/from-code/new-feature populate later):

**`docs/intel/_meta.json`**:
```json
{
  "schema_version": "1.0",
  "workspace_slug": "{slug from AGENTS.md or cwd basename}",
  "created_at": "{ISO8601}",
  "updated_at": "{ISO8601}",
  "artifacts": {},
  "reuse_policy": {
    "from_doc_to_generate_docs": "reuse_if_fresh",
    "from_code_to_generate_docs": "reuse_if_fresh",
    "generate_docs_to_from_doc": "reuse_with_verify",
    "generate_docs_to_from_code": "reuse_with_verify",
    "from_doc_from_code_merge": "merge"
  }
}
```

**`docs/intel/actor-registry.json`**:
```json
{ "schema_version": "1.0", "multi_role": false, "rbac_mode": "none", "roles": [] }
```

**`docs/intel/feature-catalog.json`**:
```json
{ "schema_version": "1.0", "multi_role": false, "roles": [], "features": [] }
```

**`docs/intel/permission-matrix.json`**:
```json
{ "schema_version": "1.0", "permissions": [] }
```

**`docs/intel/sitemap.json`**:
```json
{ "schema_version": "1.0", "routes": [], "modules": [], "navigation": [] }
```

**Update `.gitignore`** (workspace root):
```
# Canonical intel — keep
!docs/intel/

# Test credentials (when storage=inline) — never commit
docs/intel/test-accounts.json
```

> Note: `test-accounts.json` is .gitignored by default (assume `storage=inline`). If team uses `storage=env-ref`, remove the line manually — env-ref files are safe to commit.

### 3.7 `{path}/Dockerfile`

→ Read `../new-workspace/ref-docker.md` now.
Use the Dockerfile section matching the stack language. Place at `{path}/Dockerfile`.

### 3.8 Update root `docker-compose.yml`

Read existing `docker-compose.yml` at workspace root. Append new service block from `ref-docker.md` — "Monorepo" section:

```yaml
  {name}:
    build:
      context: .
      dockerfile: {services|apps}/{name}/Dockerfile
    ports: ["{next-available-port}:{port}"]
    env_file: .env
    restart: unless-stopped
    depends_on:               # only if db/cache already exist in compose
      db: { condition: service_healthy }
    develop:
      watch:
        - { action: sync, path: ./{path}/src, target: /app/src }
```

**Port selection:** scan existing `ports:` entries in the file → assign next available (increment +1 from highest used port of same type).

### 3.9 Update root `.env`

Append new vars for the added service. Use `.env` template from `ref-docker.md` for the chosen stack. Prefix per-service vars with `{NAME}_` to avoid collision:

```bash
# {name} — {stack}
{NAME}_PORT={assigned-port}
# DATABASE_URL is shared — already set at root level
# Add any service-specific vars here:
```

If this is the first service in the monorepo, also set the shared `DATABASE_URL` if not already present.

Update `.env.example` with same vars (placeholder values, no secrets).

### 3.10 NX only — register project

If workspace tooling is NX, add entry to `nx.json` or create `{path}/project.json`:

```json
{
  "name": "{name}",
  "projectType": "{application|library}",
  "sourceRoot": "{path}/src",
  "targets": {
    "build": { "executor": "@nx/...", "options": {} },
    "serve": { "executor": "@nx/...", "options": {} }
  }
}
```

---

## § Phase 4 — Update workspace config

### 4.1 `.cursor/AGENTS.md` — Active Apps/Services table

Append row to the table:

```
| {name} | {stack} | {app/service/lib} | {apps|services|packages}/{name} |
```

If the table doesn't exist yet → create it.

### 4.2 `.cursor/AGENTS.md` — Docs-Path Formula table

Add row:

```
| mono — {type}: {name} | `{apps|services}/{name}/docs/features/{feature-id}` |
```

### 4.3 `pnpm-workspace.yaml` (pnpm only)

Verify glob already covers the new path. Standard globs (`apps/*`, `services/*`, `packages/*`) need no change — just confirm they're there. If missing, add the missing glob.

---

## § Phase 5 — Verify

Run verification for the new member only (scoped):

```bash
# pnpm
pnpm --filter {name} lint
pnpm --filter {name} typecheck
pnpm --filter {name} build

# NX
nx lint {name}
nx build {name}

# Non-Node
cd {path} && {stack verification commands from ref-stack file}
```

If any step fails: diagnose and fix before reporting done.

---

## § Phase 6 — Summary

```
## New Project Added

  Name   : @{workspace}/{name}
  Type   : {app | service | package}
  Stack  : {stack}
  Path   : {path}/

  Workspace updated:
    ✓ docker-compose.yml — {name} service added (port {port})
    ✓ .env — {NAME}_PORT and service vars added
    ✓ .cursor/AGENTS.md — Active Apps/Services + Docs-Path Formula
    ✓ pnpm-workspace.yaml — glob verified

  Start:
    docker compose up -d {name}   ← or `docker compose up -d` for all services
    pnpm --filter {name} dev      ← hot-reload on local code

  First feature:
    /new-feature → PM will resolve docs_path to {path}/docs/features/{feature-id}
```

---

## § Rules

- Always read `.cursor/AGENTS.md` first — stop if missing or repo-type = mini
- Never touch existing apps/services — only create new directories
- Never modify root `tsconfig.base.json` or `turbo.json` unless strictly necessary
- `package.json → name` must follow `@{workspace}/{name}` pattern for workspace imports
- Docs path formula in AGENTS.md must be updated — this is the source of truth for PM
- Always update `docker-compose.yml` and `.env` — Docker is mandatory in this workspace
- Port selection: read existing ports first, never duplicate — assign next available

## ▶ What's next?

| Kết quả | Skill tiếp theo |
|---|---|
| Project initialized | `/new-feature` — bắt đầu tính năng đầu tiên |
| Cần sync global agents | `/sync-master` — link global agents vào project |
| Monorepo setup xong | `/configure-workspace` — cấu hình team settings |
| AGENTS.md cần review | Review với team lead trước khi /new-feature |
