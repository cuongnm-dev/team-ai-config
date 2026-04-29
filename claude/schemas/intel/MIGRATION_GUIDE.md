# Intel Layer Migration Guide

End-to-end guide for migrating projects from legacy artifact paths/schemas to the unified Intel Layer (Phase 1-3).

## Phase rollout summary

| Phase | Status | Scope |
|---|---|---|
| **Phase 1** | DONE | Schemas + meta + validator (additive, zero breaking) |
| **Phase 2** | DONE | Producer integration (from-doc, from-code, generate-docs) + merger + actor-enum agent |
| **Phase 3** | DONE | Vendor export + staleness watcher + cleanup of frontend-report.json + bridge files |

## File inventory

### Schemas (`~/.claude/schemas/intel/`)

```
_meta.schema.json              Provenance + TTL + lock registry
actor-registry.schema.json     Roles + auth + RBAC mode
permission-matrix.schema.json  Role × Resource × Action
sitemap.schema.json            Navigation + routes + Playwright hints
feature-catalog.schema.json    Features + role-visibility
README.md                      Contract overview + reuse policy
MIGRATION_GUIDE.md             This file
```

### Scripts (`~/.claude/scripts/intel/`)

```
meta_helper.py     init / update / is-fresh / mark-stale / checksum
merger.py          Conflict resolver (deterministic + locked-field aware)
watch.py           Staleness probe (compares checksums to source files)
export.py          Vendor bridge (cursor / windsurf / generic / openapi)
```

### Agents (`~/.claude/agents/`)

```
intel-validator.md   Schema + cross-ref auditor (haiku, read-only)
intel-merger.md      Conflict resolver (sonnet, wraps Python merger)
tdoc-actor-enum.md   Phase P1.5 of from-code (actor enumeration from code-facts)
```

### Skill integration files

```
~/.claude/skills/from-doc/INTEL_INTEGRATION.md
~/.claude/skills/from-code/INTEL_INTEGRATION.md
~/.claude/skills/generate-docs/INTEL_INTEGRATION.md
```

Each skill's `SKILL.md` has a top-level "Intel Layer Integration (CLAUDE.md CD-10)" pointer block.

### Rules (`~/.claude/CLAUDE.md`)

- **CD-10: Intel Layer Contract** — single source of truth, schema conformance, validation, merge

## Per-project migration checklist

For each existing project that previously used `from-doc`, `from-code`, or `generate-docs`:

### 1. Initialize meta

```bash
cd <project>
python ~/.claude/scripts/intel/meta_helper.py init docs/intel/ "<workspace-slug>"
```

### 2. Path migration

If project has legacy `docs/generated/<slug>/intel/` artifacts:

```bash
# Move to canonical location
mkdir -p docs/intel/
for f in actor-registry.json permission-matrix.json sitemap.json feature-catalog.json code-facts.json; do
  if [ -f docs/generated/<slug>/intel/$f ]; then
    mv docs/generated/<slug>/intel/$f docs/intel/$f
  fi
done

# Backfill _meta entries
for f in actor-registry.json sitemap.json feature-catalog.json; do
  python ~/.claude/scripts/intel/meta_helper.py update docs/intel/ $f \
    --producer manual-interview \
    --ttl 30
done
```

### 3. Schema upgrade

Old artifacts may not conform to new schemas. Run validator:

```bash
# Invoke intel-validator subagent in Claude Code
# Or run JSON Schema validation directly:
npx --yes ajv-cli validate -s ~/.claude/schemas/intel/actor-registry.schema.json -d docs/intel/actor-registry.json
```

Common upgrade tasks:
- Rename `rbac-mode` → `rbac_mode` (kebab → snake)
- Move `evidence: {file: ...}` → `evidence: [{kind: "code", file: ...}]`
- Add missing `confidence` field to roles
- Move permission prose from `doc-brief.md` into `permission-matrix.json`

### 4. Frontend-report absorption

If `frontend-report.json` exists:

```bash
# Manually merge fields into sitemap.routes[].playwright_hints
# Then archive:
mv docs/intel/frontend-report.json docs/intel/.archive/frontend-report.json.bak
```

### 5. Export to non-Claude IDEs (optional)

```bash
python ~/.claude/scripts/intel/export.py docs/intel/ --target cursor
python ~/.claude/scripts/intel/export.py docs/intel/ --target windsurf
python ~/.claude/scripts/intel/export.py docs/intel/ --target generic
```

### 6. Set up watcher (optional, recommended for active projects)

Run periodically (cron / pre-commit hook):

```bash
python ~/.claude/scripts/intel/watch.py docs/intel/ --apply
```

Or via Claude Code `/loop`:

```
/loop 30m python ~/.claude/scripts/intel/watch.py docs/intel/ --apply
```

## Verification checklist

After migration, validate:

- [ ] `docs/intel/_meta.json` exists and lists all artifacts
- [ ] `intel-validator --quick` returns exit 0
- [ ] No artifacts at legacy paths (`docs/generated/*/intel/*.json` empty/removed)
- [ ] No `frontend-report.json` (absorbed into sitemap)
- [ ] CLAUDE.md rule **CD-10** present
- [ ] Each skill SKILL.md has "Intel Layer Integration" pointer block

## Backward compatibility

- Phase 2 introduces NEW writes to canonical paths but does NOT remove legacy reads. Consumers (writers) prefer canonical, fall back to legacy with warning.
- Phase 3 cleanup removes legacy fallback once user confirms Phase 2 stable in their projects.
- Agents written before Phase 2 (`doc-intel`, `tdoc-researcher`) need a one-time prompt update to call `meta_helper.py` after writes — see `INTEL_INTEGRATION.md` per skill.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `intel-validator` reports cross-ref error `permission.role not in actor-registry` | Producer wrote permission before actor-registry | Re-run actor producer first, then permission producer |
| `meta_helper.py is-fresh` always returns CHECKSUM_DIFF | Source file paths changed | Re-run producer with `--sources <new paths>` |
| `intel-merger` overwrites manual edit | `locked_fields` not declared | Add JSONPath to `_meta.artifacts[file].locked_fields[]` |
| Cursor/Windsurf rules out of sync | Export not re-run after intel update | Add export to post-producer hook or `/loop` |
| New skill cannot find intel | Path search wrong | Always read `{workspace}/docs/intel/`, never `{workspace}/docs/generated/*/intel/` |

## Future extensions (not in current rollout)

- `intel-watch` daemon mode (currently one-shot)
- Web UI for browsing intel artifacts
- Direct Casbin policy export (currently only OpenAPI augmentation)
- Multi-workspace federation (single `_meta.json` pointing to multiple project intel dirs)
