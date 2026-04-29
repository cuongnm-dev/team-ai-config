# Intel Layer Integration — `from-code`

This skill participates in the shared Intel Layer (CLAUDE.md rule **CD-10**). All actor / permission / sitemap data flows through canonical artifacts at `{workspace}/docs/intel/` validated by `~/.claude/schemas/intel/`.

## Phase additions

### P0 (Preflight) — Intel probe

After workspace detection, BEFORE P1:

```bash
# Initialize meta if first run
if [ ! -f docs/intel/_meta.json ]; then
  python ~/.claude/scripts/intel/meta_helper.py init docs/intel/ "<workspace_slug>"
fi

# Check existing intel reusability
python ~/.claude/scripts/intel/meta_helper.py is-fresh docs/intel/ actor-registry.json
# Exit 0 → reusable; print "REUSE" intent in MC-0
# Exit 1/2 → produce fresh in P1.5
```

If reusable AND user does not request `--force-regen` → skip P1.5 and P2 sets `role_visibility[]` from existing `actor-registry.roles[].slug`.

### P1.5 (NEW) — Actor Enumeration

Inserted between P1 (Static Harvest) and P2 (Feature Synthesis).

**Dispatch:** Agent tool, subagent_type = `tdoc-actor-enum`.

**Input prompt template:**

```
Run P1.5 Actor Enumeration for code-to-docs pipeline.

Workspace: {workspace_path}
Intel dir: {workspace}/docs/intel/
Inputs: code-facts.json (already produced by P1)

Output artifacts (per ~/.claude/schemas/intel/):
- actor-registry.json
- permission-matrix.json (draft)
- _meta.json (update)

After write, invoke intel-validator --quick. Return summary only.
```

**Forward context to P2:** Pass `actor-registry.roles[].slug` list so feature synthesis tags `role_visibility[]` from the start instead of retrofitting at P6.

### P5 / P6c — Bridge files DEPRECATED

The legacy "bridge files" pattern (writing `actor-registry.json` and `feature-catalog.json` only as a hand-off to `generate-docs`) is removed. Intel Layer **is** the bridge. P5 still produces `arch-brief.md` and `code-brief.md` (human-readable), but no separate bridge artifacts.

### P6 — Feature catalog write

P6 now writes `docs/intel/feature-catalog.json` conformant to schema (replaces ad-hoc per-feature scaffolding for the catalog field). Per-feature `_state.md` and `feature-brief.md` remain unchanged — these are downstream consumption files.

After write, call:

```bash
python ~/.claude/scripts/intel/meta_helper.py update docs/intel/ feature-catalog.json \
  --producer code-harvester --ttl 30 \
  --sources docs/intel/code-facts.json src/...
```

## Producer responsibilities

`code-harvester` and `tdoc-actor-enum` MUST:

1. **Validate before write** — call `intel-validator --quick` after every artifact write
2. **Update _meta.json** — never write artifact without updating provenance
3. **Atomic write** — `<file>.tmp` then rename
4. **Respect locked_fields** — if `_meta.artifacts[file].locked_fields[]` non-empty, invoke `intel-merger` instead of overwrite
5. **Compute checksum** — `meta_helper.py update --sources <files>` for staleness tracking

## Consumer mapping

| Old reference | New canonical path |
|---|---|
| Bridge `feature-catalog.json` (project-local) | `{workspace}/docs/intel/feature-catalog.json` |
| Bridge `actor-registry.json` | `{workspace}/docs/intel/actor-registry.json` |
| `_pipeline-state.json` | UNCHANGED — pipeline state is internal |

## Backward compatibility (Phase 2 window)

Until Phase 3 cleanup, `from-code` writes BOTH old and new locations for `actor-registry` / `feature-catalog`. After Phase 3, only canonical paths remain. Validator emits warning if old paths still present.

## Cross-skill reuse

When `from-doc` already populated `actor-registry.json`:
- `tdoc-actor-enum` reads existing → produces `<file>.new.json` → invokes `intel-merger`
- Conflict precedence (per `~/.claude/schemas/intel/README.md`): doc-intel wins display names, tdoc-researcher wins URLs/code-derived fields

## Anti-skip

P1.5 entry print: `"P1.5 Actor Enumeration starting (producer=tdoc-actor-enum)"`
P1.5 exit print: `"P1.5 complete — N roles, M permissions, validator PASS/FAIL"`
