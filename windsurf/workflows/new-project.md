---
description: Tạo workspace mới cho dự án — chọn giữa mini-repo (1 service) hoặc monorepo (nhiều service). Có sẵn presets công nghệ phổ biến, kiểm tra điều kiện trước khi cài, sinh starter code chạy được ngay.
---

# /new-project

Equivalent to Cursor `/new-workspace` skill. Initializes a NEW project from scratch.

## Phase 1 — Choose pattern

| Pattern | When |
|---|---|
| **mini** | 1 service / module, single package.json or pyproject.toml |
| **mono** (Nx / pnpm / Turborepo) | Multiple apps + shared libs |

## Phase 2 — Choose stack preset

| Preset | Stack |
|---|---|
| `nx-angular-fastapi` | Angular 18 frontend + FastAPI backend, Nx monorepo |
| `nx-vue-dotnet` | Vue 3 frontend + .NET backend, Nx monorepo |
| `mini-fastapi` | FastAPI standalone |
| `mini-angular` | Angular standalone |
| `mini-go-gin` | Go + Gin |
| `custom` | User-specified |

## Phase 3 — Preflight check

| Check | Action if fail |
|---|---|
| Target dir empty | Ask overwrite or different name |
| Required tools (node, python, docker) installed | Suggest install steps |
| Git initialized OK | `git init` if not |
| User has write permissions | Surface error |

## Phase 4 — Scaffold

Per preset, run scaffolding scripts (npm create, pip install templates, etc.).

## Phase 5 — Configure for SDLC

Auto-run `/configure-workspace`:
- Create `AGENTS.md` (per stack)
- Create `docs/` skeleton
- Create `.cursor/worktrees.json` template (Windsurf compatible — same path)

## Phase 6 — Verify

Run starter command to verify (e.g., `npm install && npm test` or `pip install && pytest`).

## What's next

```
✅ Project scaffolded at {path}.
Next:
- /new-feature     — start first feature
- /from-doc        — if you have BRD/SRS to ingest
- /configure-workspace — re-configure if anything missed
```
