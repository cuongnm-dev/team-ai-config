---
description: Configure existing workspace cho SDLC pipeline. Tạo AGENTS.md, docs/intel/ skeleton, feature-map.yaml. Dùng cho repo đã có code muốn enable SDLC tooling. Anti-trigger - workspace mới hoàn toàn dùng /new-workspace.
---

# /configure-workspace

## Step 1 — Detect

Check at repo root:
- `AGENTS.md` exists? (skip if yes, ask overwrite)
- `docs/feature-map.yaml`? 
- `docs/intel/`?

## Step 2 — Detect repo type

| Signal | Type |
|---|---|
| Single `package.json` / `pyproject.toml` / `go.mod` at root | mini |
| `nx.json`, `lerna.json`, `pnpm-workspace.yaml`, multiple `apps/` or `services/` | mono |
| Multiple repos in workspace folder | multi-repo (suggest separate /configure for each) |

## Step 3 — Collect

Ask:
- `repo-type` (confirm detection)
- `feature-prefix` (e.g., RFID, IAM, OPS — used for feature-id F-NNN)
- `dev-unit` (team/org name for attribution)
- `docs-path` formula (default per repo-type, allow override)
- Tech stack confirmation (vs auto-detect)

## Step 4 — Create AGENTS.md

```yaml
---
repo-type: {mini | mono}
feature-prefix: {PREFIX}
dev-unit: {team}
docs-path-formula: |
  mini → docs/features/{feature-id}
  mono cross-cutting → docs/features/{feature-id}
  mono app/service → src/apps/{name}/docs/features/{feature-id}
input-watch-dir: docs/input
---

# {Workspace Name}

Tech stack: ...
Key conventions: ...
```

## Step 5 — Create docs/ skeleton

```
docs/
├── feature-map.yaml          (empty: features: {})
├── intel/                    (empty, populate via /from-code or /from-doc)
│   └── _meta.json            (initial: {producers: [], artifacts: {}})
├── adr/
│   └── INDEX.md              (empty)
├── features/                 (empty, populate via /new-feature)
└── hotfixes/                 (empty)
```

## Step 6 — Suggest next

```
✅ Workspace configured.
Next:
- /from-code            — extract features từ existing code
- /from-doc {file}      — extract from BRD/SRS doc
- /new-feature          — first feature manual
- /intel-fill           — interactive interview gaps
```

## What's next

| Outcome | Next |
|---|---|
| Configured | `/from-code` if existing code |
| Configured + has docs | `/from-doc {paths}` |
| Manual setup preferred | `/new-feature` |
