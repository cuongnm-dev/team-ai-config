# Phase 0 — Pre-flight (intel detection + AGENTS.md check + tooling detect)

Loaded on demand by `new-project/SKILL.md` Phase 0.

---

## Intel detection (check FIRST)

Check for `intel/tech-brief.md` in current directory or `docs/intel/tech-brief.md`:

If found → **Intel-driven mode**:

1. Read `intel/tech-brief.md` — extract full services list with stacks
2. Read `.cursor/AGENTS.md` (if exists) — extract already-scaffolded services from Active Apps/Services table
3. Compute **remaining services** = tech-brief services − already-scaffolded services
4. Show menu:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Intel-driven project setup
  source: intel/tech-brief.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Already scaffolded:
    ✓ {service-name} ({stack})     ← from AGENTS.md
    ✓ {service-name-2} ({stack})

  Remaining (from intel):
    [ ] {service-name-3} — {type}: {stack} (port: {suggested})
    [ ] {service-name-4} — {type}: {stack} (port: {suggested})

  Recommended next: {first in scaffold-order not yet done}
  reason: {rationale from tech-brief scaffold-order}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Which service to scaffold? (enter name or number, or 'all' to scaffold all remaining in order)
```

  - Single selection → scaffold that service, skip Phase 1 (pre-populated from tech-brief)
  - `all` → scaffold each remaining service in scaffold-order, confirm before each
  - User types different name → treat as manual override, proceed with Phase 1 normally

**If not found** → standard flow below.

---

## AGENTS.md check + repo-type guard

**Read `.cursor/AGENTS.md` first. Hard stop if missing:**
```
No .cursor/AGENTS.md found. This workspace is not configured.
Run /configure-workspace first, then retry /new-project.
```

**Check repo-type:**
- If `repo-type: mini` → stop:
  ```
  This is a mini-repo workspace — it has one project by definition.
  To add a second stack, convert to monorepo first (ask or use /new-workspace).
  ```
- If `repo-type: mono` → continue.

**Detect workspace tooling** from root files:

| File | Tooling |
|---|---|
| `nx.json` | NX |
| `turbo.json` | Turborepo |
| `pnpm-workspace.yaml` | pnpm workspaces |
| `lerna.json` | Lerna |

**Detect package manager** from lockfile.

**Read existing `apps/` and `services/` dirs** — list current members for context.
