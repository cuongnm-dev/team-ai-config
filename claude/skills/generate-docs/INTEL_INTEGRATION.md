# Intel Layer Integration — `generate-docs`

This skill consumes the shared Intel Layer at `{workspace}/docs/intel/` (CLAUDE.md rule **CD-10**) and contributes back to it. Rather than maintaining its own `docs/generated/{slug}/intel/` subtree, it now reads/writes the workspace-level canonical location.

## NEW Stage 0.5 — Intel Bootstrap

Inserted between Stage 0 (Preflight) and Stage 1 (Discovery).

### Step 0.5.1 — Probe existing intel

```bash
# Check freshness for each canonical artifact
for art in actor-registry.json permission-matrix.json sitemap.json feature-catalog.json; do
  python ~/.claude/scripts/intel/meta_helper.py is-fresh docs/intel/ "$art"
done
```

Build a 4-cell decision table:

| Artifact | Status | Action |
|---|---|---|
| FRESH | Reuse | Skip producer for this artifact |
| EXPIRED | TTL exceeded | Mark stale, schedule regeneration |
| CHECKSUM_DIFF | Sources changed | Mark stale, schedule regeneration |
| MISSING | Never produced | Schedule production |

### Step 0.5.2 — User confirmation (only if any reusable artifact found)

Display a one-line summary per artifact:

```
docs/intel/actor-registry.json — FRESH (produced 2026-04-20 by doc-intel, 4 roles)
  → Reuse [Y/n]?
docs/intel/sitemap.json — EXPIRED (TTL 30d, age 45d)
  → Regenerate
```

Default action = follow status. User can override (e.g. force regenerate fresh artifact).

### Step 0.5.3 — Interview fallback (when MISSING and no source available)

Trigger when:
- `actor-registry.json` MISSING
- AND no `docs/source/` (Path A) AND no codebase (Path B)
- AND user did not pass `--actors-from <file>`

Run interview (English internal prompts; user-facing in Vietnamese):

```
Q1. How many distinct user types does the system have?
    (Number + Vietnamese display name + role identifier slug)

Q2. RBAC enforcement model?
    [a] role-based (rbac) — most common
    [b] attribute-based (abac) — conditional permissions
    [c] access control list (acl) — per-resource grants
    [d] hybrid
    [e] none / implicit

Q3. Per role, login URL and post-login redirect (or "n/a" if SSO/external)?

Q4. Test credentials reference (key only, not the secret value)?
    Format: secrets://{slug} or env://{VAR_NAME}
```

Write `actor-registry.json` with `confidence: "manual"`, `source_producers: ["manual-interview"]`. Update `_meta.json` via `meta_helper.py update --producer manual-interview`.

### Step 0.5.4 — Validate

Invoke `intel-validator --quick`. If errors → fix interactively before Stage 1. Block until green.

## Stage 1 changes

Stage 1 (Discovery) no longer auto-produces actor-registry from scratch. Instead:

1. Read existing `docs/intel/actor-registry.json` (guaranteed present after Stage 0.5)
2. If Path A (docs available) → `doc-intel` enriches with display names, descriptions
3. If Path B (code available) → `tdoc-researcher` enriches with auth metadata, evidence
4. If both → produce `<artifact>.new.json` and invoke `intel-merger`

Stage 1.2 ("Actor enumeration") becomes Stage 1.2 ("Actor enrichment + verification").

## Stage 2.3 (UX architecture) — sitemap absorption

`frontend-report.json` is REMOVED as a separate artifact. Its content is absorbed into `sitemap.routes[].playwright_hints` and `sitemap.roles[]`. Consumers (`tdoc-test-runner`, `tdoc-screenshot-reviewer`) updated accordingly.

## Path migration

| Old path (per-slug) | New path (workspace-level) |
|---|---|
| `docs/generated/{slug}/intel/actor-registry.json` | `docs/intel/actor-registry.json` |
| `docs/generated/{slug}/intel/sitemap.json` | `docs/intel/sitemap.json` |
| `docs/generated/{slug}/intel/feature-catalog.json` | `docs/intel/feature-catalog.json` |
| `docs/generated/{slug}/intel/code-facts.json` | `docs/intel/code-facts.json` |
| `docs/generated/{slug}/intel/frontend-report.json` | (absorbed into `sitemap.json`) |

`docs/generated/{slug}/output/` (rendered .docx/.xlsx) **unchanged**.

## Producer responsibilities

Stage 1-2 agents (`doc-intel`, `tdoc-researcher`) MUST:

1. Read existing intel BEFORE producing
2. If existing → produce `<artifact>.new.json` then call `intel-merger`
3. If absent → produce `<artifact>.json` directly + `meta_helper.py update`
4. Validate via `intel-validator --quick` before Stage gate

## Consumer responsibilities (Stage 4 writers)

Writers (`tdoc-tkkt-writer` / `tdoc-tkcs-writer` / `tdoc-tkct-writer` for Stage 4b/4c/4d specialists; `tdoc-data-writer` for Stage 4e HDSD + 4f xlsx; `doc-writer` for admin-doc pipeline) read intel artifacts read-only. They MUST:

1. Check `_meta.artifacts[file].stale` — if true, halt with error message instructing user to re-run upstream skill
2. Use `actor-registry.roles[].slug` as the role identifier vocabulary across all sections
3. Use `permission-matrix` for TKCS section 3 (security/RBAC) and HDSD per-role manuals
4. Use `sitemap.menu_tree[]` for HDSD navigation chapters
5. Use `feature-catalog.role_visibility[]` for test case generation (xlsx)

## Anti-patterns (forbidden)

- Writing actor-registry to `docs/generated/{slug}/intel/` (legacy path)
- Skipping `_meta.json` update after artifact write
- Inferring permissions from prose without writing to `permission-matrix.json`
- Storing credentials inline in `actor-registry.auth.credentials_ref` (must be reference)
