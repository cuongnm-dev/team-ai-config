---
name: new-project
description: Thêm 1 app, service hoặc package mới vào workspace monorepo hiện tại. Đọc .cursor/AGENTS.md để xác nhận loại workspace, scaffold member mới, cập nhật cấu hình workspace và AGENTS.md. Chỉ dùng cho monorepo — muốn tạo workspace mới hoàn toàn thì dùng /new-workspace. Trigger - monorepo đã setup, cần thêm app/service/package mới (vd "thêm seal-iot service"). Anti-trigger - chưa có workspace thì /new-workspace; mini-repo (chỉ 1 service) thì không hỗ trợ - convert mono trước. Example - "/new-project type=service name=seal-iot stack=go".
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

## § Phase 0 — Pre-flight (intel + AGENTS.md + tooling detect)

→ Read `notepads/preflight.md` and execute.

Covers: intel-driven mode (services list reconciled with already-scaffolded), AGENTS.md hard-stop, repo-type guard (mini → stop), tooling detect (NX / Turborepo / pnpm / Lerna), package manager detect.

---

## § Phase 1 — Collect inputs (3 questions max)

Ask all at once in one block:

```
## New Project Setup

1. Type:  app | service | package
   app = frontend deployable  |  service = backend deployable  |  package = shared lib

2. Name:  {name}
   convention: kebab-case. Will be created at src/apps/{name}/ or src/services/{name}/ or packages/{name}/

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

  updates:
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

  note: stubs are PLACEHOLDERS only. Run /from-doc (if customer docs available) or /from-code (after first scaffold) to populate. Until populated, /new-feature works in legacy mode (feature-map.yaml only).

Proceed? (yes / no)
```

---

## § Phase 3 — Scaffold (3.1-3.10 + intel layer init)

→ Read `notepads/scaffold.md` and execute Phase 3, 4, 5.

Covers: directory tree, package.json, starter code, tsconfig.json, .env.example, .gitkeep, intel layer init (CD-10 stubs at workspace root), Dockerfile, root docker-compose.yml update, root .env update, NX project register, AGENTS.md row updates, pnpm glob verify, scoped verification (lint/typecheck/build).

---

## § Phase 6 — Summary

```
## New Project Added

  name   : @{workspace}/{name}
  type   : {app | service | package}
  stack  : {stack}
  path   : {path}/

  Workspace updated:
    ✓ docker-compose.yml — {name} service added (port {port})
    ✓ .env — {NAME}_PORT and service vars added
    ✓ .cursor/AGENTS.md — Active Apps/Services + Docs-Path Formula
    ✓ pnpm-workspace.yaml — glob verified

  start:
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
