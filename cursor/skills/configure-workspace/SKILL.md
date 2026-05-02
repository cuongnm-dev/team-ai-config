---
name: configure-workspace
description: Trang bị cấu hình pipeline `.cursor/` cho repo có sẵn, đồng thời đồng bộ phiên bản mới nhất từ master config về máy. Đã gộp luôn skill sync-master cũ. Trigger - repo đã có code nhưng thiếu .cursor/AGENTS.md; cần sync master agents/skills mới về workspace; team mới onboard repo legacy. Anti-trigger - tạo workspace mới hoàn toàn thì /new-workspace; thêm service mới thì /new-project. Example - "/configure-workspace" (interactive — detect stack, propose AGENTS.md, sync master).
---

# Skill: Configure Workspace

**Standard: never touch existing code. Only add missing pipeline infrastructure.**

## § File Load Map — Read ONLY when reaching that step

| Step | File | Condition |
|---|---|---|
| Phase 4 | `../new-workspace/ref-workspace.md` | always — AGENTS.md + project-knowledge templates |
| Phase 4 | `../new-workspace/ref-docs.md` | always — ADR, CLAUDE.md, CONTRIBUTING.md templates |
| Phase 4 | `../new-workspace/ref-stack-{stack-id}.md` | only if project-conventions.mdc missing |
| Phase 4 | `../new-workspace/ref-docker.md` | only if docker-compose.yml or .env missing |

**Stack ID mapping** (same as new-project):

| Detected signal | stack-id |
|---|---|
| `package.json` → `"next"` dep | `nextjs` |
| `package.json` → `"react"` + `"vite"` (no next) | `react-spa` |
| `package.json` → `"vue"` | `vue` |
| `package.json` → `"@nestjs/core"` | `nestjs` |
| `package.json` → `"fastify"` or `"express"` (no React/Vue/Nest) | `node-api` |
| `pyproject.toml` or `requirements*.txt` with `fastapi` | `fastapi` |
| `go.mod` present | `go` |
| `Cargo.toml` present | `rust` |
| `pubspec.yaml` present | `flutter` |
| `package.json` → `"react-native"` | `react-native` |
| `turbo.json` / `nx.json` / `pnpm-workspace.yaml` + `src/apps/` or `src/services/` | `mono` |

---

## § Phase 0 — Auto-detect (no questions)

Scan the workspace root silently:

**Stack detection — check in this order:**

1. `nx.json` → mono (NX)
2. `turbo.json` → mono (Turborepo)
3. `pnpm-workspace.yaml` + (`apps/` or `services/` dir) → mono (pnpm)
4. `pubspec.yaml` → flutter
5. `Cargo.toml` → rust
6. `go.mod` → go
7. `pyproject.toml` / `requirements.txt` → fastapi (check for `fastapi` keyword)
8. `package.json` → inspect `dependencies` + `devDependencies`:
   - `next` → nextjs
   - `react-native` → react-native
   - `@nestjs/core` → nestjs
   - `vue` → vue
   - `react` + `vite` → react-spa
   - `fastify` or `express` → node-api

**Repo type determination:**

| Signal | repo-type |
|---|---|
| `nx.json` / `turbo.json` / `pnpm-workspace.yaml` at root | mono |
| `src/apps/` and/or `src/services/` dirs with their own `package.json` | mono |
| Single stack, no workspace tooling | mini |

**For mono:** list all entries under `apps/` and `services/` (name, sub-stack if detectable).

**Gap analysis — check existence of each:**

| File / Dir | Missing → Action |
|---|---|
| `.cursor/agents/` | create junction → `%USERPROFILE%\.cursor\agents\` (master sync) |
| `.cursor/skills/` | create junction → `%USERPROFILE%\.cursor\skills\` (master sync) |
| `.cursor/rules/00-agent-behavior.mdc` | copy from master |
| `.cursor/rules/90-delivery-pipeline.mdc` | copy from master |
| `.cursor/AGENTS.md` | generate |
| `.cursor/rules/project-conventions.mdc` | generate from ref-stack |
| `.cursor/rules/40-project-knowledge.mdc` | generate (empty template) |
| `docs/architecture/adr/` | create dir + ADR-001 |
| `docs/architecture/adr/ADR-001-tech-stack.md` | generate |
| `docs/architecture/adr/ADR-002-repo-structure.md` | generate |
| `CLAUDE.md` | generate |
| `CONTRIBUTING.md` | generate |
| `docker-compose.yml` | generate from `../new-workspace/ref-docker.md` — compose per detected db/cache |
| `.env` | generate — dev defaults matching docker-compose service names |
| `.env.example` | generate — same vars with placeholder values |
| `Dockerfile` | generate if API/service stack (Node/Python/Go/Rust) and missing |
| `.cursor/AGENTS.md` exists but no `Docs-Path Formula` section | patch — add section only |

**Extract from existing files:**

- Project name: `package.json → name` / `go.mod → module` / `pyproject.toml → [project].name` / directory name fallback
- Package manager: presence of `pnpm-lock.yaml` → pnpm / `yarn.lock` → yarn / `bun.lockb` → bun / else → npm
- Existing scripts: `package.json → scripts` (used for CLAUDE.md commands)
- Git remote: `git remote get-url origin` (used for CONTRIBUTING.md)
- Git default branch: `git symbolic-ref refs/remotes/origin/HEAD` or assume `main`

---

## § Phase 1 — Present findings (one block, one confirmation)

Output a single findings block:

```
## Workspace Configure — Findings

project : {name}
stack   : {detected stack or "unknown — will ask"}
repo    : {mini | mono}
pm      : {pnpm | npm | yarn | bun | uv | cargo | go | flutter}

Monorepo members:          ← only if mono
  apps/   {name} ({stack})
  services/ {name} ({stack})

Master sync  : {linked | not found}
  ⟶ .cursor/agents/  → %USERPROFILE%\.cursor\agents\  (junction)
  ⟶ .cursor/skills/  → %USERPROFILE%\.cursor\skills\  (junction)
  ⟶ .cursor/rules/00-agent-behavior.mdc  (copy)
  ⟶ .cursor/rules/90-delivery-pipeline.mdc  (copy)

Missing — will generate:
  ✗ .cursor/AGENTS.md
  ✗ .cursor/rules/project-conventions.mdc
  ✗ .cursor/rules/40-project-knowledge.mdc
  ✗ docs/architecture/adr/ADR-001-tech-stack.md
  ✗ docs/architecture/adr/ADR-002-repo-structure.md
  ✗ CLAUDE.md
  ✗ CONTRIBUTING.md
  ✗ docker-compose.yml
  ✗ .env  (dev defaults — safe to commit)
  ✗ .env.example
  ✗ Dockerfile  (if API/service stack)

Already present — will NOT touch:
  ✓ .gitignore
  ✓ {any other existing files}

Proceed? (yes / no / customize)
```

If stack is unknown: ask one question — "Which stack is this? (list options)" before showing findings.

If user says **customize**: show checklist of items to include/exclude. Then re-confirm.

---

## § Phase 2 — Feature prefix

Ask one question before generating:

```
Feature ID prefix (2-6 uppercase letters, e.g. SHOP, AUTH, API):
Used for: SHOP-20240401-001 feature IDs in this project.
```

default: first 3-4 letters of project name, uppercased.

---

## § Phase 2.5 — Master Sync (agents + skills + pipeline rules)

**Run before generating any other files.**

Check if master exists:
```powershell
$master = "$env:USERPROFILE\.cursor"
Test-Path "$master\agents"   # must be true to proceed
```

**If master found** (`%USERPROFILE%\.cursor\agents\` exists):

```powershell
# 1. Ensure .cursor/ directory exists
New-Item -ItemType Directory -Force -Path ".cursor" | Out-Null

# 2. Junction for agents/ (skip if already a junction or directory)
if (-not (Test-Path ".cursor\agents")) {
  New-Item -ItemType Junction -Path ".cursor\agents" -Target "$master\agents"
}

# 3. Junction for skills/ (skip if already a junction or directory)
if (-not (Test-Path ".cursor\skills")) {
  New-Item -ItemType Junction -Path ".cursor\skills" -Target "$master\skills"
}

# 4. Copy generic pipeline rules (skip if already present)
New-Item -ItemType Directory -Force -Path ".cursor\rules" | Out-Null
@("00-agent-behavior.mdc", "90-delivery-pipeline.mdc") | ForEach-Object {
  if (-not (Test-Path ".cursor\rules\$_") -and (Test-Path "$master\rules\$_")) {
    Copy-Item "$master\rules\$_" ".cursor\rules\$_"
  }
}
```

**If master NOT found**: skip silently — agents and skills will be absent; user can run `/configure-workspace` again after setting up master.

**Why junctions (not copies):** Directory junctions on Windows require no admin rights and are transparent to Cursor. Any update to `%USERPROFILE%\.cursor\agents\` or `skills\` is instantly reflected in all projects. Generic rules are copied (not junctioned) because projects may override them.

---

## § Phase 3 — Generate missing files

**Read required ref files now** (per File Load Map at top).

Generate each missing item. **RULE: if a file already exists, skip it entirely — no merge, no patch, no overwrite.**
exception: if `.cursor/AGENTS.md` exists but is missing the `Docs-Path Formula` section, append that section only.

### 3.1 `.cursor/AGENTS.md`

Fill from `ref-workspace.md` template. Substitute detected values:
- `{project-name}` → detected name
- `repo-type` → detected type
- `feature-prefix` → user answer from Phase 2
- `package-manager` → detected PM
- Tech Stack table → fill from detected stack (mark other layers N/A)
- Docs-Path Formula table → fill correctly for mini or mono
- Active Apps/Services → fill from mono scan (leave blank for mini)
- Key Decisions → add one line per detected technology choice (e.g. "Uses pnpm workspaces + Turborepo for monorepo orchestration")

### 3.2 `.cursor/rules/project-conventions.mdc`

Read `../new-workspace/ref-stack-{stack-id}.md`. Extract the `.cursor/rules/project-conventions.mdc` section verbatim. Substitute `{project-name}`.

For mono: use the mono conventions file. Also note: each app/service should eventually have its own conventions file.

### 3.3 `.cursor/rules/40-project-knowledge.mdc`

Use template from `ref-workspace.md`. Fill `{project-name}`. Leave all sections as `_No entries yet._`

### 3.4 `docs/architecture/adr/ADR-001-tech-stack.md`

Read `../new-workspace/ref-docs.md` for the ADR-001 template. Fill retroactively:
- Decision: what stack was detected
- Context: "Existing project — configuration retrofitted by configure-workspace skill"
- Consequences: list detected dependencies as accepted constraints
- Status: `Accepted` (retroactive)

### 3.5 `docs/architecture/adr/ADR-002-repo-structure.md`

Fill ADR-002 template from `ref-docs.md`. Include the docs-path formula that matches what was written into AGENTS.md.

### 3.6 `CLAUDE.md`

Fill from `ref-docs.md` template. For commands:
- Extract actual scripts from `package.json` (or Makefile for Go/Rust, `pyproject.toml` for Python)
- Use real commands — not placeholders
- If no test script found: write `# No test script configured yet`

### 3.7 `CONTRIBUTING.md`

Fill from `ref-docs.md` template. Use detected git remote and default branch.

### 3.8 Docker files (if missing)

→ Read `../new-workspace/ref-docker.md` now.

**Detect what's already in the project** (check for existing db/cache references in package.json scripts, pyproject.toml, go.mod):
- ORM/DB libs found (prisma, sqlalchemy, gorm, diesel, etc.) → infer database type → add `db` service
- Redis libs found (ioredis, redis-py, go-redis, etc.) → add `cache` service

**Generate `docker-compose.yml`**: compose from ref-docker.md blocks per detected stack + services.
**Generate `.env`**: use `.env` template from ref-docker.md for detected stack. Substitute `{name}` with project name.
**Generate `.env.example`**: same vars with placeholder values.
**Generate `Dockerfile`**: if stack is Node/Python/Go/Rust (API stack) — use matching section from ref-docker.md. Skip for pure frontend stacks (React SPA, Vue, Flutter, React Native).

**If `docker-compose.yml` already exists** — skip entirely, report as "Skipped (already present)".
**If `.env` already exists** — skip entirely, report as "Skipped (already present)". Never merge or overwrite.

---

## § Phase 4 — Confirm and report

After generating all files, output:

```
## Configure Workspace — Done

Master sync (auto-update from %USERPROFILE%\.cursor):
  ⟶ .cursor/agents/   [junction]
  ⟶ .cursor/skills/   [junction]
  ⟶ .cursor/rules/00-agent-behavior.mdc   [copied]
  ⟶ .cursor/rules/90-delivery-pipeline.mdc   [copied]

generated:
  + .cursor/AGENTS.md
  + .cursor/rules/project-conventions.mdc
  + .cursor/rules/40-project-knowledge.mdc
  + docs/architecture/adr/ADR-001-tech-stack.md
  + docs/architecture/adr/ADR-002-repo-structure.md
  + CLAUDE.md
  + CONTRIBUTING.md
  + docker-compose.yml  (services: {detected list})
  + .env               (dev defaults pre-filled)
  + .env.example
  + Dockerfile         (if API stack)

Skipped (already existed):
  ~ {list any skipped files}

Next steps:
  1. Review .cursor/AGENTS.md — fill Overview section with project purpose
  2. Fill CLAUDE.md — verify commands are correct
  3. Start Docker services: docker compose up -d
  4. Run /new-feature to start your first properly-tracked feature
  5. (Optional) Add domain conventions to .cursor/rules/40-project-knowledge.mdc
```

---

## § Rules

- **Never modify existing source code** — `.ts`, `.py`, `.go`, `.rs`, `.dart`, `.vue`, etc.
- **Never modify existing config files** — `package.json`, `tsconfig.json`, `vite.config.ts`, etc.
- **Never overwrite existing `.cursor/` files** — skip entirely, report as "Skipped"
- **Never overwrite existing `docker-compose.yml`, `.env`** — skip entirely, report as "Skipped"
- **Never run install or build commands** — read-only analysis only
- Detect, don't assume — if a signal is ambiguous, say so in findings
- If stack truly cannot be detected: ask before proceeding (one question, list options)
- `.env` generated here contains only dev defaults — no production secrets

## ▶ What's next?

| Kết quả | Skill tiếp theo |
|---|---|
| Config hoàn tất | `/new-project` — tạo project trong workspace đã configure |
| Cần sync agents mới nhất | `/sync-master` — sync từ global `~/.cursor/` |
| UI template cần setup | Cập nhật `30-ui-template.mdc` với Metronic/component config |
| Team onboard xong | `/new-feature` — bắt đầu làm việc |
