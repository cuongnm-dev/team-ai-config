---
name: new-workspace
description: Tạo workspace mới cho dự án — chọn giữa mini-repo (1 service đơn lẻ) hoặc monorepo (nhiều service). Có sẵn các preset công nghệ phổ biến (NestJS, Next.js, FastAPI, Go, Rust, Flutter, ...), kiểm tra điều kiện trước khi cài, sinh starter code chạy được ngay sau khi cài đặt. Trigger - thư mục hoàn toàn trống cần khởi tạo; chọn stack từ đầu. Anti-trigger - workspace đã setup, chỉ cần thêm app/service thì /new-project; repo có code sẵn cần cấu hình pipeline thì /configure-workspace. Example - "/new-workspace --preset=standard --stack=nestjs --auth=keycloak".
---

# Skill: New Project Setup

**Standard: `dev` works in 30 seconds without reading docs.**

> **Skill delegation** (audit-2026-05-06 T2-10; updated ADR-005 2026-05-06): Both `/new-workspace` and `/configure-workspace` ultimately call `Bash("ai-kit sdlc scaffold workspace --type {mini|mono} --mode {full|retrofit} ...")` for canonical scaffolding. Difference is `mode`:
> - `mode='full'` → `/new-workspace` (this skill: greenfield empty dir; git init + starter code + intel + ADRs + scaffolds)
> - `mode='retrofit'` → `/configure-workspace` (existing repo with code; ONLY add missing `.cursor/` + intel + ADRs; never touch source code)
>
> Phase 0 preflight detects workspace state and recommends `/configure-workspace` if directory has existing code (anti-trigger guard).

## § Template Source — ai-kit CLI (default) with local fallback

**Default** (per ADR-005 D3): `Bash("ai-kit sdlc template-registry --namespace new-workspace --action load --template-id ref-X")`. Parse stdout JSON for `data.content`.

**Fallback** — when ai-kit unavailable OR `--no-ai-kit`/`ETC_USE_AI_KIT=0`: `Read("ref-X.md")` from this skill dir.

Skill must complete scaffold even if ai-kit fails — print warning, fall through silently.

## § Reference tables (File Load Map + Stack ID Mapping)

→ Read `notepads/reference.md` when picking the stack (Phase 4) and before Phase 6 scaffold so the correct `ref-*.md` files are loaded at the right step.

---

## § Phase 0 — Pre-flight (intel detection + standard detect + prereq check)

→ Read `notepads/preflight.md` and execute.

Covers: intel-driven mode (`intel/tech-brief.md` discovery + summary card), standard detect (lockfile, parent monorepo, CI env), prerequisite check (Node/pnpm/Python/uv/Go/Rust/Flutter/Docker), pre-flight summary block.

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
  preset: {preset} | Repo: {mini|mono} | Stack: {stack} | Prefix: {PREFIX} | PM: {pm}

  features: auth={auth} db={db}+{orm} cache={cache}
            docker=always ci={tool|skip} e2e={tool|none}
            observability={yes|no} team={yes|no} linter={biome|eslint}

  reproduce: /new-workspace {name} --preset={p} --stack={s} --auth={a} --db={d} --ci={c}

  Approve? (yes / adjust X)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## § Phase 6 — Scaffold (14 steps)

→ Read `notepads/scaffold.md` and execute steps 1-14.

Covers: git init, project skeleton + starter code, Cursor workspace + Master Sync, config files (.editorconfig, .gitleaks.toml), auth scaffold (conditional), database scaffold (conditional), Docker (always), CI/CD (conditional), tooling (Node.js only), security baseline, observability, docs & ADRs, install deps, post-install codegen.

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

stack: {stack} | Preset: {preset}
features: auth={auth} db={db} cache={cache} ci={ci}
docker: compose with {app + db service names}

Generated by /new-workspace"
```

---

## § Phase 9 — Summary Card

→ Read `notepads/summary.md` and render the summary card with stack-specific teaching line.

---

## § Phase 10 — What's Next

Delivery intent: contains "implement", "build", "feature" → auto-invoke `/new-feature`.
otherwise: suggest `/new-feature`.
pass: feature name, business goal, stack, docs_path, feature-prefix, package-manager.

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
