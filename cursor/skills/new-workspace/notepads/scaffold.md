# Phase 6 — Scaffold (14 steps)

Loaded on demand by `new-workspace/SKILL.md` Phase 6.

Report each step: `[N/14] {action}...  ✓` or `✗ {reason}`.
Keep manifest of created files. On any failure: remove all created files, report error.

---

## [1/14] Git init
```bash
git init && git config core.autocrlf false
```

## [2/14] Project skeleton + starter code

**Pre-flight: kiểm tra workspace đã scaffold chưa** (tránh `MCP_E_ALREADY_EXISTS`):

```bash
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
       [r] Re-scaffold (--force) — ghi đè AGENTS.md, .gitignore, stub intel
       [s] Skip step [2/14] — bỏ qua scaffold workspace, chỉ fill missing pieces ở [3-14]
       [a] Abort — gợi ý /configure-workspace nếu chỉ muốn thêm SDLC infra vào repo có sẵn"
  
  IF user picks [r]: thêm `--force` vào CLI bên dưới
  IF user picks [s]: SKIP CLI scaffold, jump tới [3/14]
  IF user picks [a]: STOP, gợi ý `/configure-workspace`
ELSE:
  Continue scaffold bên dưới
```

**THEN — atomic scaffold via ai-kit CLI**:

```bash
ai-kit sdlc scaffold workspace --workspace . --type {mini|mono} --stack {stack-id} [--force]
```

Required flags (DO NOT guess — verify via `ai-kit sdlc scaffold workspace --help`):
- `--workspace .` — thư mục hiện tại
- `--type mini|mono` — workspace topology (KHÔNG phải `--workspace-type` / `--workspace_type` — chính xác là `--type`)
- `--stack nodejs|python|go|rust|none` — stack template
- `--force` (optional) — chỉ khi user chọn [r] re-scaffold

**Lưu ý**: `--config '<json>'` flag được CLI parse nhưng impl HIỆN CHƯA dùng (reserved cho future). Auth/DB/Cache/CI render ở [3-14] manual.

Parse stdout JSON cho `data.files_created`. Trên error → STOP.

ai-kit tạo: AGENTS.md, CLAUDE.md, .gitignore stub, `docs/intel/` (empty stubs), `docs/modules/`, `docs/inputs/`, `docs/generated/`, `_meta.json`.

**THEN — stack-specific starter code** (NOT created by ai-kit — skill must add):
→ Read `ref-stack-{stack-id}.md` now.
Create dirs and files from Directory Tree section (working code, NOT empty stubs):
- Starter app code (server.ts / main.py / cmd/main.go) with framework boilerplate
- `package.json` / `requirements.txt` / `go.mod` with all deps from preset
- Conventions at `.cursor/rules/project-conventions.mdc`
- `.env.example` — all vars with placeholder values for documentation
- `.env` — dev defaults pre-filled using docker-compose service names as hostnames (read `.env` template from `ref-docker.md` for chosen stack, substitute `{name}` with project name). Uncomment Redis vars if cache=Redis selected. `.env` must work with `docker compose up` without any manual edits.

## [3/14] Cursor workspace + Master Sync
→ Read `ref-workspace.md` now.
Create `.cursor/AGENTS.md` and `.cursor/rules/40-project-knowledge.mdc`.

Then run Master Sync — link agents and skills from master, copy generic pipeline rules:
```powershell
$master = "$env:USERPROFILE\.cursor"
if (Test-Path "$master\agents") {
  if (-not (Test-Path ".cursor\agents")) {
    New-Item -ItemType Junction -Path ".cursor\agents" -Target "$master\agents"
  }
  if (-not (Test-Path ".cursor\skills")) {
    New-Item -ItemType Junction -Path ".cursor\skills" -Target "$master\skills"
  }
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
```

## [4/14] Config files
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

## [5/14] Auth scaffold (skip if auth = none)
→ Read `ref-auth.md` now.
Generate auth files for chosen provider + stack combination.

## [6/14] Database scaffold (skip if ORM = none)
Run init commands from `ref-stack-{stack-id}.md` (already in context).
Generate starter schema with example User model.
For SQLite: run `prisma db push` / `alembic upgrade head`. For PostgreSQL: requires Docker first.

## [7/14] Docker (always)
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

## [8/14] CI/CD (skip if CI = skip)
→ Read `ref-ci.md` now.
Create CI config. If team=yes: create PR/MR template.

## [9/14] Tooling (Node.js stacks only)
→ Read `ref-tooling.md` now.
Install Biome or ESLint+Prettier. Install Vitest. If team=yes: install husky+lint-staged+commitlint, run `npx husky init`.

## [10/14] Security baseline
Helmet + rate-limiter already in starter code (`ref-stack-{stack-id}.md`).

## [11/14] Observability (skip if observability = no, or non-API stack)
Structured logger + `/health` endpoint already in starter code (`ref-stack-{stack-id}.md`).

## [12/14] Docs & ADRs
→ Read `ref-docs.md` now.
Create `docs/architecture/adr/ADR-001-tech-stack.md` (fill from Phase 4 choices).
Create `docs/architecture/adr/ADR-002-repo-structure.md` (fill docs-path formula).
Create `docs/features/` (.gitkeep). Create `README.md`. Create `CLAUDE.md`.
If team=yes: create `CONTRIBUTING.md`.

## [13/14] Install dependencies
```bash
{pnpm|uv|cargo|flutter pub} install
```
Show live output. Stop on failure — do not proceed.

## [14/14] Post-install codegen
- Prisma: `npx prisma generate` → `npx prisma db push` (SQLite only)
- Tailwind: build initial CSS pass
- Rust: `cargo build` (verify compilation)
