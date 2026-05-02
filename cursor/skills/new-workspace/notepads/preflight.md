# Phase 0 — Pre-flight (automatic, no questions)

Loaded on demand by `new-workspace/SKILL.md` Phase 0.

---

## Intel detection (check FIRST — before everything else)

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
  source: intel/tech-brief.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  system     : {system name from doc-brief}
  Repo type  : {mono | mini}
  services   : {count} — {service names and stacks}
                e.g. seal-api (nestjs), seal-web (nextjs), seal-iot (go)
  infra      : {postgresql, redis, ...}
  auth       : {model + provider}
  preset     : Standard (recommended for all intel-driven scaffolds)

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

## Standard detect (when no intel found)

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
  git: {user@email | NOT CONFIGURED}
  docker: {version | NOT INSTALLED — required}
  context: {standalone | inside monorepo at ../name}
```
