---
name: new-workspace
description: Smart workspace scaffold — mini-repo or monorepo. Preset system, feature flags, prerequisite checks, working starter code, post-install verification, conditional summary card.
---

# Skill: New Project Setup

**Standard: `dev` works in 30 seconds without reading docs.**

## § Template Source — centralized MCP (default) with local fallback

**Default (Phase 2+)**: `mcp__etc-platform__template_registry_load(namespace="new-workspace", template_id="ref-X")`.

**Fallback** — when MCP unavailable OR `--no-mcp`/`ETC_USE_MCP=0`: `Read("ref-X.md")` from this skill dir.

Skill must complete scaffold even if MCP fails — print warning, fall through silently.

## § File Load Map — Read ONLY when reaching that step

| Step | File | Condition |
|---|---|---|
| Phase 6 Step 2 | `ref-stack-{stack-id}.md` | always — contains dir tree, starter code, conventions, .env, .gitignore |
| Phase 6 Step 3 | `ref-workspace.md` | always — .cursor/AGENTS.md + project-knowledge templates |
| Phase 6 Step 12 | `ref-docs.md` | always — ADR-001/002, CLAUDE.md, CONTRIBUTING.md |
| Phase 7 | `ref-checklist.md` | always — scaffold checklist + verification commands |
| Phase 6 Step 5 | `ref-auth.md` | only if auth ≠ none |
| Phase 6 Step 7 | `ref-docker.md` | always — Docker is always enabled |
| Phase 6 Step 8 | `ref-ci.md` | only if CI ≠ skip |
| Phase 6 Step 9 | `ref-tooling.md` | only if Node.js stack |

**Stack ID mapping:**

| User choice | stack-id |
|---|---|
| React SPA (Vite) | `react-spa` |
| Next.js | `nextjs` |
| Vue / Nuxt | `vue` |
| SvelteKit | `svelte` |
| NestJS | `nestjs` |
| Node.js (Fastify/Express) | `node-api` |
| Python FastAPI | `fastapi` |
| Go | `go` |
| Rust (Axum) | `rust` |
| .NET | `dotnet` |
| React Native | `react-native` |
| Flutter | `flutter` |
| Monorepo | `mono` |

---

## § Phase 0 — Pre-flight (automatic, no questions)

**Intel detection (check FIRST — before everything else):**

Check for `intel/tech-brief.md` in current directory or any parent directory (up to 2 levels):

```
./intel/tech-brief.md
./docs/intel/tech-brief.md
../intel/tech-brief.md
```

If found → **Intel-driven mode**:

1. Read `intel/tech-brief.md` — extract: `repo-type`, `workspace-name`, `services[]`, `infra`, `auth`, `scaffold-order`
2. Read `intel/doc-brief.md` (if exists) — extract: system name, feature-id prefix
3. Show intel summary and ask user to confirm before proceeding:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Intel-driven workspace detected
  Source: intel/tech-brief.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  System     : {system name from doc-brief}
  Repo type  : {mono | mini}
  Services   : {count} — {service names and stacks}
                e.g. seal-api (nestjs), seal-web (nextjs), seal-iot (go)
  Infra      : {postgresql, redis, ...}
  Auth       : {model + provider}
  Preset     : Standard (recommended for all intel-driven scaffolds)

  Scaffold order:
    1. {first service} ({stack})
    2. {second service} ({stack})
    ...

  Stack confidence: {High | Medium | Low}
  {If Low: "Note: {confidence notes from tech-brief}"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use this configuration? (yes / adjust / no — enter manually)
```

  - `yes` → skip Phase 1–4 entirely, jump to Phase 5 with pre-populated values
  - `adjust` → show Phase 1–4 with pre-populated defaults, allow override
  - `no` → proceed with standard interactive flow

If **not found** → standard flow below.

---

**Standard detect (when no intel found):**

| Signal | Source | Inference |
|---|---|---|
| Package manager | lockfile / `packageManager` field | Use detected PM everywhere |
| Stack hints | `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pubspec.yaml` | Existing project — confirm before continuing |
| `.cursor/AGENTS.md` exists | File check | Offer update vs overwrite |
| Parent monorepo | Parent dir has `nx.json`, `turbo.json`, `pnpm-workspace.yaml` | Offer Scope B (add to existing mono) |
| `CI=true` | env var | Skip prompts, use Standard defaults |
| Git identity | `git config user.name` | If missing: warn before git init |

**Prerequisite check** (only for stacks actually selected):
Node ≥ 20 / pnpm / Python ≥ 3.11 / uv / Go / Rust+cargo / Flutter / Docker (always required)
If missing: show install command and pause.

**Output one block:**
```
Pre-flight:
  Project name: {folder} (change? y/N)
  Package manager: {pm} {version}
  Git: {user@email | NOT CONFIGURED}
  Docker: {version | NOT INSTALLED — required}
  Context: {standalone | inside monorepo at ../name}
```

---

## § Phase 1 — Project Identity (3 questions max)

```
1. Project name:      [{folder-name}]  ← Enter to accept
2. One-line desc:     What does this project do?
3. Feature ID prefix: [{auto: NAME[:4].upper}]  e.g. SHOP, AUTH, CMS
```

---

## § Phase 2 — Repo Type

```
A) Mini-repo  — single deployable unit, one stack
B) Monorepo   — multiple apps/services, shared packages
```

---

## § Phase 3 — Preset

```
★ Standard  — production-ready (recommended)
             Docker + CI/CD + lint + testing + security + observability
◦ Starter   — get running in 2 minutes (SQLite, no Docker, minimal tooling)
◦ Custom    — full control
```
CI context → Standard automatically, skip prompt.

---

## § Phase 4 — Feature Selection (decision tree — gate each question on previous answers)

| Feature | Options | Gate | Default |
|---|---|---|---|
| Stack | See stack-id table above | always | — |
| Auth | None / Supabase / Auth0 / Firebase / Keycloak / Custom JWT | always | None |
| ORM | None / Prisma / Drizzle / SQLAlchemy / GORM / Diesel | always | None |
| Database | SQLite / PostgreSQL / MySQL / MongoDB | only if ORM ≠ None | PostgreSQL (always via Docker) |
| Cache | None / Redis | Standard or Custom | None |
| CI/CD | GitHub Actions / GitLab CI / Bitbucket / Skip | Standard or Custom | GitHub Actions (Standard) |
| E2E testing | None / Playwright / Cypress | Custom only | None |
| Observability | Yes / No | API stacks; Standard or Custom | Yes (Standard) |
| Team setup | Yes / No | Standard or Custom | No (Starter) |
| Linter | Biome / ESLint+Prettier / None | Node.js stacks | Biome |

**Docker is always enabled** — `docker-compose.yml` and `.env` are always created. No Docker toggle.

**Conflict rules (surface all at once before Phase 5):**
- ORM=Prisma AND ORM=Drizzle → impossible (single-select enforced)
- SQLite selected → note: SQLite runs locally without Docker; db service omitted from compose

---

## § Phase 5 — Review & Confirm

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {project-name} — Setup Plan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Preset: {preset} | Repo: {mini|mono} | Stack: {stack} | Prefix: {PREFIX} | PM: {pm}

  Features: auth={auth} db={db}+{orm} cache={cache}
            docker=always ci={tool|skip} e2e={tool|none}
            observability={yes|no} team={yes|no} linter={biome|eslint}

  Reproduce: /new-workspace {name} --preset={p} --stack={s} --auth={a} --db={d} --ci={c}

  Approve? (yes / adjust X)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## § Phase 6 — Scaffold

Report each step: `[N/14] {action}...  ✓` or `✗ {reason}`.
Keep manifest of created files. On any failure: remove all created files, report error.

**[1/14] Git init**
```bash
git init && git config core.autocrlf false
```

**[2/14] Project skeleton + starter code**
→ Read `ref-stack-{stack-id}.md` now.
Create dirs and files from the Directory Tree section. Create Starter Code files (not empty — working code). Create Conventions file at `.cursor/rules/project-conventions.mdc`.
Create `.env.example` — all vars with placeholder values for documentation.
Create `.env` — dev defaults pre-filled using docker-compose service names as hostnames (read `.env` template from `ref-docker.md` for chosen stack, substitute `{name}` with project name). Uncomment Redis vars if cache=Redis selected. `.env` must work with `docker compose up` without any manual edits.

**[3/14] Cursor workspace + Master Sync**
→ Read `ref-workspace.md` now.
Create `.cursor/AGENTS.md` and `.cursor/rules/40-project-knowledge.mdc`.

Then run Master Sync — link agents and skills from master, copy generic pipeline rules:
```powershell
$master = "$env:USERPROFILE\.cursor"
if (Test-Path "$master\agents") {
  # Junctions — transparent to Cursor, auto-update from master
  if (-not (Test-Path ".cursor\agents")) {
    New-Item -ItemType Junction -Path ".cursor\agents" -Target "$master\agents"
  }
  if (-not (Test-Path ".cursor\skills")) {
    New-Item -ItemType Junction -Path ".cursor\skills" -Target "$master\skills"
  }
  # Copy generic pipeline rules (project keeps its own copy, can override)
  New-Item -ItemType Directory -Force -Path ".cursor\rules" | Out-Null
  @("00-agent-behavior.mdc", "90-delivery-pipeline.mdc") | ForEach-Object {
    if (-not (Test-Path ".cursor\rules\$_") -and (Test-Path "$master\rules\$_")) {
      Copy-Item "$master\rules\$_" ".cursor\rules\$_"
    }
  }
  Write-Host "✓ Master sync: agents/ and skills/ linked, pipeline rules copied"
} else {
  Write-Host "⚠ Master not found at $master — agents/skills not linked"
}

**[4/14] Config files**
From `ref-stack-{stack-id}.md` (already in context): create `.gitignore`.
Create `.editorconfig` (universal — inline below):
```ini
root=true
[*]
charset=utf-8
end_of_line=lf
insert_final_newline=true
trim_trailing_whitespace=true
indent_style=space
indent_size=2
[*.{py,rs}]
indent_size=4
[Makefile]
indent_style=tab
```
Create `.gitleaks.toml` (from `ref-stack-{stack-id}.md` or inline):
```toml
[extend]
useDefault = true
[allowlist]
paths = [".env.example", ".env.test"]
```

**[5/14] Auth scaffold** (skip if auth = none)
→ Read `ref-auth.md` now.
Generate auth files for chosen provider + stack combination.

**[6/14] Database scaffold** (skip if ORM = none)
Run init commands from `ref-stack-{stack-id}.md` (already in context).
Generate starter schema with example User model.
For SQLite: run `prisma db push` / `alembic upgrade head`. For PostgreSQL: requires Docker first.

**[7/14] Docker** (always)
→ Read `ref-docker.md` now.
Create `Dockerfile` (multi-stage — use section matching stack language).
Create `docker-compose.yml` — compose from blocks in ref-docker.md:
  - Always: `app` service block with port matching stack default
  - Add `db` service block if database ≠ SQLite (PostgreSQL/MySQL/MongoDB)
  - Add `cache` service block if cache = Redis
  - Add `depends_on` to `app` for each added service
  - Merge `volumes:` into one block at file end
Create `.dockerignore`.
**Note:** `.env` was already created in Step 2 with matching defaults — do not recreate, only verify alignment.

**[8/14] CI/CD** (skip if CI = skip)
→ Read `ref-ci.md` now.
Create CI config. If team=yes: create PR/MR template.

**[9/14] Tooling** (Node.js stacks only)
→ Read `ref-tooling.md` now.
Install Biome or ESLint+Prettier. Install Vitest. If team=yes: install husky+lint-staged+commitlint, run `npx husky init`.

**[10/14] Security baseline**
Helmet + rate-limiter already in starter code (`ref-stack-{stack-id}.md`).

**[11/14] Observability** (skip if observability = no, or non-API stack)
Structured logger + `/health` endpoint already in starter code (`ref-stack-{stack-id}.md`).

**[12/14] Docs & ADRs**
→ Read `ref-docs.md` now.
Create `docs/architecture/adr/ADR-001-tech-stack.md` (fill from Phase 4 choices).
Create `docs/architecture/adr/ADR-002-repo-structure.md` (fill docs-path formula).
Create `docs/features/` (.gitkeep). Create `README.md`. Create `CLAUDE.md`.
If team=yes: create `CONTRIBUTING.md`.

**[13/14] Install dependencies**
```bash
{pnpm|uv|cargo|flutter pub} install
```
Show live output. Stop on failure — do not proceed.

**[14/14] Post-install codegen**
- Prisma: `npx prisma generate` → `npx prisma db push` (SQLite only)
- Tailwind: build initial CSS pass
- Rust: `cargo build` (verify compilation)

---

## § Phase 7 — Verification

→ Read `ref-checklist.md` now. Run all verification steps.
All must pass before declaring done. Stop and report on first failure.

---

## § Phase 8 — Initial Git Commit

After verification (not before — node_modules already gitignored):
```bash
git add .
git commit -m "chore: initial scaffold

Stack: {stack} | Preset: {preset}
Features: auth={auth} db={db} cache={cache} ci={ci}
Docker: compose with {app + db service names}

Generated by /new-workspace"
```

---

## § Phase 9 — Summary Card

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ {project-name} is ready!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Stack: {stack} | Repo: {mini|mono} | Prefix: {PREFIX} | PM: {pm}

  Start (services first):
    docker compose up -d          ← starts db, cache, app
    {exact dev command}           ← hot-reload on local code

  [only if database selected and ORM ≠ none]
  DB migrate: {pnpm db:push | uv run alembic upgrade head | go run ./cmd/migrate}

  [only if auth selected and needs env vars]
  Auth: Fill {VAR_NAME} in .env  (all other vars have dev defaults)

  Test / Lint / Build:
    {test cmd} → {lint cmd} → {build cmd}

  Docs:  {docs_path per .cursor/AGENTS.md} | ADRs: docs/architecture/adr/

  {teaching line — see below}

  Next: /new-feature
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Teaching lines (one per stack — include in summary):**
- Next.js: `Server Components fetch data. 'use client' only for interactivity.`
- NestJS: `Controller → Service → Repository. Never skip a layer.`
- FastAPI: `Pydantic validates at the boundary. SQLAlchemy stays in repositories.`
- Go: `Return errors, don't panic. Handlers are just functions with Context.`
- Rust: `The compiler prevents data races. Trust it, don't fight it.`
- React SPA: `Colocate state with the component that owns it. Lift only when forced.`
- Vue/Nuxt: `composables/ is your hooks equivalent. Keep templates declarative.`
- React Native: `Platform.OS for divergence. StyleSheet.create for performance.`
- Flutter: `Widgets are immutable. State lives in State objects or providers.`
- Monorepo: `Run any command twice — the second run hits the cache.`

---

## § Phase 10 — What's Next

Delivery intent: contains "implement", "build", "feature" → auto-invoke `/new-feature`.
Otherwise: suggest `/new-feature`.
Pass: feature name, business goal, stack, docs_path, feature-prefix, package-manager.

---

## § Scope B — Add to Existing Monorepo

When Phase 0 detects parent monorepo (parent dir has `nx.json`, `turbo.json`, or `pnpm-workspace.yaml`):

```
Existing monorepo detected at: {parent-dir}

To add a new app/service to this monorepo, use /new-project instead.
/new-project handles: scaffold, Dockerfile, docker-compose update, .env update, AGENTS.md update.

Continue with /new-workspace only if you want to create a standalone new workspace here.
Proceed? (yes — create standalone workspace / no — use /new-project)
```

---

## § Preference Saving

After successful scaffold, append to `.cursor/AGENTS.md`:
```yaml
last-scaffold:
  date: {YYYY-MM-DD}
  preset: {preset}
  stack: {stack}
  features: [{list}]
  package-manager: {pm}
```
On next `/new-project` in same repo: offer "Use previous config? ({summary})"

## What's Next

| Result | Next skill |
|---|---|
| Workspace created | `/new-project` — scaffold first project |
| Need more config | `/configure-workspace` — setup team rules and templates |
| Need global sync | `/sync-master` — pull global agents/skills into workspace |
| Multi-team setup | Each team runs `/new-project` with their own scope |
