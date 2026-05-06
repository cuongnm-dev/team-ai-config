---
name: new-workspace
description: Tạo workspace mới cho dự án — chọn giữa mini-repo (1 service đơn lẻ) hoặc monorepo (nhiều service). Có sẵn các preset công nghệ phổ biến, kiểm tra điều kiện trước khi cài, sinh starter code chạy được ngay sau khi cài đặt.
---

# Skill: New Project Setup

**Standard: `dev` works in 30 seconds without reading docs.**

## ⚠️ ai-kit CLI Enforcement (ADR-005)
**Phase 6 (workspace scaffold) MUST call `Bash("ai-kit sdlc scaffold workspace ...")`** instead of direct `Write`/`mkdir`.

| Legacy step | New ai-kit CLI command |
|---|---|
| Phase 6 §[2/14] mkdir + AGENTS.md/CLAUDE.md Write | `ai-kit sdlc scaffold workspace --workspace . --type {mini|mono} --stack {nodejs|python|go|rust|none}` — atomic 12+ files |
| Phase 6 §[12/14] docs/intel + feature-map.yaml stubs | Generated atomically by `scaffold workspace` |
| Phase 6 §[7/14] Dockerfile + docker-compose.yml | Stack-specific templates bundled in ai-kit (`bin/lib/sdlc/templates.mjs`); current emits `STACK_TEMPLATE_DEFERRED` warning |
| Phase 6 §[3/14] junctions/copies for `.cursor/` | Existing pattern — unchanged |

After `ai-kit sdlc scaffold workspace` succeeds, stdout JSON returns manifest of files created. Skill prints summary + git init via `Bash`.

**Local templates fallback DEPRECATED**: Phase 6 used to read `assets/templates/{stack}/...` from skill folder. Post-ADR-005 (2026-05-06), templates rendered by ai-kit Node CLI inline (no Jinja2 / asset bundle dependency).

**Forbidden**:
- ❌ Write AGENTS.md / CLAUDE.md / .gitignore directly during Phase 6 (handled by `scaffold workspace`)
- ❌ mkdir `docs/intel/` / `docs/modules/`

**Reference**: ADR-003 D6/D8 + ADR-005 D3.

---

## § Template Source — ai-kit CLI (default) with local fallback

**Default** (per ADR-005 D3): `Bash("ai-kit sdlc template-registry --namespace new-workspace --action load --template-id ref-X")` — ai-kit-managed canonical templates. Parse stdout JSON for `data.content`.

**Fallback path** — when ai-kit unavailable OR explicit opt-out (`--no-ai-kit` flag OR `ETC_USE_AI_KIT=0`):
- `Read("ref-X.md")` from this skill dir (local copy preserved as fallback).

**Behavior on ai-kit failure** — print warning, fall through to local Read silently. Skill must still complete the scaffold.

**Why default ON now**: Phase 1 verified byte-identical 17/17 templates, ≥99% uptime over observation window. Centralized source = team-wide updates propagate without per-client edits.

**Verify integrity** (debugging only): compare returned `sha256` against `git hash-object ref-X.md` from skill dir.

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

**Pre-flight: kiểm tra workspace đã scaffold chưa** (tránh `MCP_E_ALREADY_EXISTS`):

```bash
# Phát hiện markers (file đặc trưng project + intel layer):
has_git=[[ -e .git ]]
has_pkg=[[ -e package.json || -e go.mod || -e pyproject.toml || -e Cargo.toml || -e requirements.txt ]]
has_intel=[[ -f docs/intel/_meta.json ]]

IF has_git OR has_pkg OR has_intel:
  Print Vietnamese:
    "⚠ Workspace đã tồn tại tại {workspace_path}:
       - .git:       {has_git}
       - Project marker: {has_pkg}
       - Intel layer (docs/intel/_meta.json): {has_intel}
     
     Lựa chọn:
       [r] Re-scaffold (--force) — ghi đè AGENTS.md, .gitignore, stub intel, mất config tay
       [s] Skip step [2/14] — bỏ qua scaffold workspace, chỉ fill missing pieces ở [3-14]
       [a] Abort — gợi ý /configure-workspace nếu chỉ muốn thêm SDLC infra vào repo có sẵn"
  
  IF user picks [r]: thêm `--force` vào CLI command bên dưới
  IF user picks [s]: SKIP CLI scaffold, jump tới [3/14] (sync-cursor)
  IF user picks [a]: STOP, gợi ý `/configure-workspace` cho retrofit lean
ELSE:
  Continue scaffold bên dưới (workspace mới hoàn toàn)
```

**THEN — atomic scaffold via ai-kit CLI** (chỉ chạy nếu pre-flight cho phép):

```bash
ai-kit sdlc scaffold workspace --workspace . --type {mini|mono} --stack {stack-id} [--force]
```

Required flags (DO NOT guess — verify via `ai-kit sdlc scaffold workspace --help`):
- `--workspace .` — thư mục hiện tại (CLI yêu cầu absolute path; `.` được resolve về cwd absolute)
- `--type mini|mono` — workspace topology (chính xác là `--type`, KHÔNG phải `--workspace-type` / `--workspace_type`)
- `--stack nodejs|python|go|rust|none` — stack template
- `--force` (optional) — chỉ thêm khi user chọn [r] re-scaffold

**Lưu ý**: CLI hiện hỗ trợ `--config '<json>'` (auth/db/cache/...) nhưng `scaffoldWorkspaceImpl` chưa consume nó. Auth/DB/Cache/CI/Observability đã gather ở Phase 1-5 sẽ được render manual ở các step [3-14] dưới (NOT qua --config flag). Flag `--config` reserved cho future schema bump.

Parse stdout JSON cho `data.files_created`. Trên error → STOP với error message hiển thị.

ai-kit tạo: AGENTS.md, CLAUDE.md, .gitignore stub, `docs/intel/` (empty stubs: actor-registry.json, feature-catalog.json, module-catalog.json, sitemap.json, permission-matrix.json), `docs/modules/`, `docs/inputs/`, `docs/generated/`, `_meta.json`.

**THEN — stack-specific starter code** (NOT created by ai-kit — skill must add):
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
