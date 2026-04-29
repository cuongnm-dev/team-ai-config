---
name: intel-snapshot
description: Sinh bản tóm tắt nén (Markdown ~3-5K token) từ các file intel JSON gốc (50K+ token mỗi file). Các agent SDLC cấp cơ bản (dev, qa, reviewer) đọc bản tóm tắt này để hiểu nhanh ngữ cảnh; chỉ agent cấp Pro và SA mới đọc full JSON khi cần quyết định sâu. Producer phải gọi script này sau mỗi lần ghi intel để bản tóm tắt luôn mới.
---

# Intel Snapshot

Compresses canonical intel layer (CD-10) into one Markdown file optimized for low-cost agent reads.

## Why

Each SDLC agent reading full canonical JSON costs:
- `actor-registry.json`: ~3-8K tokens
- `permission-matrix.json`: ~5-15K tokens
- `sitemap.json`: ~10-30K tokens
- `feature-catalog.json`: ~20-80K tokens
- `code-facts.json`: ~30-100K tokens
- `system-inventory.json`: ~5-15K tokens
- **Total Tier 1 per agent: ~75-250K tokens**

For 3 dev agents in parallel + qa + reviewer = 5 agents × ~150K avg = 750K tokens of redundant intel reads per feature.

Snapshot reduces this to ~5-7K per agent. Saving: ~95% on intel-context tokens.

## Tier scope (per OUTLINE_COVERAGE.md § 8.4)

- **Tier 1 (in snapshot):** actor-registry, permission-matrix, sitemap, feature-catalog, code-facts, system-inventory
- **Tier 2 (NOT in snapshot — pro-tier reads canonical when relevant):** data-model, api-spec, architecture, integrations
- **Tier 3 (NOT in snapshot — SDLC ignores entirely; doc-only):** business-context, nfr-catalog, security-design, infrastructure, cost-estimate, project-plan, handover-plan

## Usage

```
python ~/.cursor/skills/intel-snapshot/generate.py [--intel-path PATH] [--check]
```

- `--intel-path` — defaults to `docs/intel/` relative to cwd
- `--check` — verify snapshot is fresh (not stale vs canonical sources). Exit 1 if stale.

## Outputs

- `{intel-path}/_snapshot.md` — compressed view, generated
- `{intel-path}/_snapshot.meta.json` — sources hash + generation timestamp

## Staleness check (CD-10 compliance)

Producers update `_meta.json` after writing intel. Snapshot generator computes sha256 of all 6 Tier 1 sources (actor-registry, permission-matrix, sitemap, feature-catalog, code-facts, system-inventory) → stores in `_snapshot.meta.json.sources_sha256`.

Consumers check freshness:
1. Read `_snapshot.meta.json.sources_sha256`
2. Compute current sha256 of canonical files
3. Match → snapshot fresh, use it. Mismatch → STALE, fall back to canonical JSON OR re-run generator.

## Consumer rules (per CD-10 Quy tắc 14, new)

**Base tier agents (dev, qa, reviewer) — MUST read snapshot first:**
1. Try `Read({intel-path}/_snapshot.md)`. If exists + fresh → use snapshot for orientation
2. If snapshot stale → fall back to canonical JSON (single file at a time, not all)
3. If snapshot missing → STOP with `intel-snapshot-missing`. User runs generator.

**Pro tier agents (sa, sa-pro, reviewer-pro, ba-pro) — MUST read canonical JSON:**
- Pro tier judgment requires full detail; snapshot is summary, may miss edge cases
- Pro tier explicitly bypasses snapshot — reads `actor-registry.json` etc directly

**Specialty:**
- `qa` reads snapshot + `test-accounts.json` (snapshot doesn't include credentials by design)
- `dev` reads snapshot + may glob specific code-facts.json sections if needed

## When to regenerate

| Trigger | Who runs | When |
|---|---|---|
| New intel produced | from-doc, from-code, intel-merger | At end of artifact write phase |
| Manual edit to canonical JSON | User | After save, before next pipeline run |
| `_state.md.intel-drift: true` | resume-feature skill | After pipeline completes (suggests `/intel-refresh` then snapshot) |
| Snapshot staleness detected | Consumer agent | Triggers fallback to canonical, logs warning |

## Failure modes

- Canonical files missing → generator skips with warning, produces partial snapshot
- Schema validation fails → log + skip that section, don't block
- Conflict between sources → use precedence per `~/.claude/schemas/intel/README.md` § Conflict Resolution
