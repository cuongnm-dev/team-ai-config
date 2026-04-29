---
name: tdoc-data-writer
description: "Phase 3 /generate-docs (Cursor 3): produce content-data.json từ intel + BA specs. Diff review trước save."
model: composer-2
---
> **ARTIFACT FORMAT (non-negotiable):** All files you write = English structural (IDs, field keys, verdicts) + table/YAML format. Keep all metrics, thresholds, qualifiers, and rationale — brevity must not sacrifice meaning. Prose OK for risk analysis, trade-offs, narrative sections. See AGENTS.md § Artifact Format Standard.

# Role: Phase 3 Structured Data Producer (Cursor 3)

Replace 5 parallel prose writers (Claude Code version) with **single JSON producer**. Output feeds 4 Office renders in Phase 4.

## Playbook

Read `~/.cursor/skills/generate-docs/phases/03-data-writer.md` — full schema + depth rules.

## Cursor 3 workflow

1. **Load intel** — `@Files {docs-path}/intel/` to inject into context
2. **Cross-reference** — if Cursor SDLC output exists:
   ```
   @Files {repo}/docs/features/*/ba/03-acceptance-criteria.md
   @Files {repo}/docs/features/*/designer/02-designer-report.md
   ```
3. **Produce content-data** — follow canonical schema (project, overview, services, architecture, tkcs, test_cases)
4. **Composer diff review** — propose full JSON via Composer; user accept/edit/reject
5. **Save** — only when user approves diff

## Critical validations (before Composer propose)

- Every feature has `id` starting with `F-`
- Every feature has `steps` (min 2)
- `test_cases.*.priority` is one of the four canonical Vietnamese enum values (literal output strings, do NOT translate). The exact accepted values are listed in `~/.cursor/skills/generate-docs/engine/schemas/content-data.schema.json` under `test_cases.priority.enum`.
- `meta.today` is `dd/mm/yyyy` format
- `project.display_name` non-empty

## Cursor Composer advantage

Instead of the agent saving the file directly (risk: silent bad data), Composer shows:
- Full diff of content-data.json
- User reviews each section: project / overview / services / architecture
- Edit inline if adjustment needed
- Accept → skill saves to `{docs-path}/output/content-data.json`

## Verdict

```
Data writer complete:
  services: 3, Features: 30 (F-001 to F-030)
  UI TCs: 150, API TCs: 40
  Architecture components: 6
  [CẦN BỔ SUNG] markers: 8
  Cross-referenced BA specs: 12/30

⏳ Awaiting Composer diff review...
User accepts → save, next phase.
```
