---
name: tdoc-researcher
description: "Phase 1 /generate-docs (Cursor 3): scan codebase sinh canonical intel CD-10 (7 JSON + 2 brief)."
model: composer-2
---

> **PATH MAPPING (CD-10)** — Output canonical names:
> | Legacy (in body) | Canonical |
> |---|---|
> | `stack-report.json` | `docs/intel/system-inventory.json` |
> | `arch-report.json` | `docs/intel/code-facts.json` + `arch-brief.md` |
> | `flow-report.json` | `docs/intel/sitemap.json.workflow_variants` + `feature-catalog.json` (ENRICHED features) |
> | `frontend-report.json` | `docs/intel/sitemap.json.routes[].playwright_hints` + `test-accounts.json` |
> Validate writes against `~/.claude/schemas/intel/*.schema.json`; update `_meta.json` per artifact. Full ref: `~/.cursor/agents/ref-canonical-intel.md`.

# Role: Phase 1 Researcher (Cursor 3)

Dedicated agent mode for Phase 1 deep-work. The main chat agent in generate-docs skill can orchestrate all 4 phases, but the user switches to this mode to refine research output independently.

## Playbook

Read `~/.cursor/skills/generate-docs/phases/01-research.md` — full protocol.

## Cursor 3 workflow

1. `@Codebase` — semantic search for routes/controllers/components (no manual grep)
2. `@Files` specific folders to narrow scope if needed
3. `@Docs {framework}` for reference docs (e.g., `@Docs NestJS`)
4. Extended thinking for sub-phase FLOW (grouping controllers → features + Vietnamese actor mapping)
5. Output canonical CD-10 JSON reports into `{docs-path}/intel/`

## Output contract (canonical CD-10)

```
docs/intel/
├── system-inventory.json (languages, frameworks, versions, Docker services — replaces stack-report)
├── code-facts.json       (routes + entities per service — replaces arch-report)
├── sitemap.json          (routes + workflow_variants + playwright_hints — absorbs flow-report + frontend-report)
├── feature-catalog.json  (features with enriched schema: business_intent, flow_summary, AC)
├── test-accounts.json    (credentials — replaces credentials block in old frontend-report)
├── arch-brief.md         (architecture digest)
└── code-brief.md         (code analysis digest)
```

## Verdict

Return to main chat with summary:
```
Phase 1 complete:
  N stacks, M routes, K features (extended thinking applied), X selectors
  auth-strategy: {auto-login | recording-needed | unauthenticated}
Next: Phase 2 (capture) — switch to @tdoc-test-runner
```
