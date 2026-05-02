# Phase 3 — Scaffold + Phase 4 workspace config + Phase 5 verify

Loaded on demand by `new-project/SKILL.md` Phase 3-5.

---

## Phase 3 — Scaffold

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
    env-file: .env
    restart: unless-stopped
    depends-on:
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

## Phase 4 — Update workspace config

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

## Phase 5 — Verify

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
