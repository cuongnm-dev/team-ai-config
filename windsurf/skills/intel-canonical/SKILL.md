---
name: intel-canonical
description: Canonical intel layer (CD-10) reference. Tier-aware reads, schema, lifecycle contract for actor-registry / permission-matrix / sitemap / feature-catalog / test-evidence / data-model / integrations / api-spec. Auto-load when role skill needs intel context.
---

# Canonical Intel Layer (CD-10) Reference

> **STATUS**: Reference skill. Loaded by role skills (ba, sa, dev, qa, reviewer, designer) when needing intel context. NOT a standalone task — provides read protocols + schema knowledge.

## Canonical Artifacts at `{repo-root}/docs/intel/`

| File | Purpose | Producer | Consumer |
|---|---|---|---|
| `_meta.json` | provenance, TTL, staleness, lock registry | All producers | intel-validator |
| `actor-registry.json` | roles + auth + RBAC mode (NIST 800-162) | from-doc/from-code | ba/sa/dev/qa/reviewer/permission-matrix |
| `permission-matrix.json` | Role × Resource × Action (Casbin/IAM pattern) | from-doc/from-code | sa/dev/reviewer |
| `sitemap.json` | navigation + routes + Playwright hints + workflow variants | from-doc/from-code | sa/fe-dev/qa/designer |
| `feature-catalog.json` | features + role-visibility tagging + status | new-feature/close-feature | All |
| `test-accounts.json` | test credentials per role (gitignored if storage=inline) | manual | qa |
| `test-evidence/{feature-id}.json` | playwright TC + execution + screenshot map | qa (resume-feature) | reviewer/close-feature/generate-docs |
| `data-model.json` | DDL + entity model | from-code | sa/dev/data-governance |
| `integrations.json` | external APIs + auth method + LGSP/NDXP metadata | from-code | sa/security/release-manager |
| `api-spec.json` | endpoint contracts | from-code/sa | dev/qa/reviewer |
| `_snapshot.md` | compressed view ~5-7K tokens (95% orientation) | intel-snapshot skill | base-tier role skills |

## Tier-Aware Read Protocol (Cursor Rule 22)

| Tier | Read FIRST | Fall back to canonical JSON when |
|---|---|---|
| **Base** (ba, sa, dev, qa, reviewer non-pro) | `_snapshot.md` | snapshot stale (sources_sha256 mismatch in `_meta.json`) OR judgment-critical section needed (full AC text, workflow variants) OR qa needs test-accounts.json (excluded by design) |
| **Pro** (ba-pro, sa-pro, dev-pro, qa-pro, reviewer-pro) | Canonical JSON directly | (always full reads) |

## Intel Read Rules (per CD-10)

1. **Read intel BEFORE planning/coding** — role slugs / route paths / permission decorators are CANONICAL. Use exact strings, do not rename/translate.
2. **Required artifact missing OR stale** → STOP with verdict `intel-missing: {file}`. Do NOT guess.
3. **Code change touching auth/role enum/routes/RBAC decorators** → set `_state.md.intel-drift: true` (PM persists).
4. **Never ground role/permission decisions on prose alone** — JSON is source of truth.
5. **QA stage MUST co-produce 3 artifacts atomically** (CD-10 Quy tắc 16): test-evidence/{id}.json + playwright/{id}.spec.ts + screenshots/{id}-step-NN-{state}.png

## Confidence-Aware Extraction (CD-10 Quy tắc 13)

Entry-level intel carries `confidence: high|medium|low|manual` + `evidence[]` + `source_producers[]`. Producers MUST emit confidence per signal-tier rules. Consumers (generate-docs Stage 4) MUST route by tier — never treat low-confidence claims as authoritative without `[CẦN BỔ SUNG]` markers.

## Test-Evidence as Feature Deliverable (CD-10 Quy tắc 14)

`test-evidence/{feature-id}.json.test_cases[]` populated through producer chain:
- `from-doc` synthesizes seeds (status=proposed)
- `from-code` extracts existing test files (Jest/Pytest/Playwright `describe/it`/`test_*`)
- Resume-feature QA stage executes (status=passed/failed)

`close-feature` HARD-STOPs if test_cases empty or any fail.

## TC Count Minimum (CD-10 Quy tắc 15)

```
min_tc(feature) = max(5,
                       len(AC) × 2 +
                       len(roles) × 2 +
                       len(dialogs) × 2 +
                       len(error_cases) +
                       3)  # 3 baseline edge cases
```

## Cross-Reference Integrity

- `permission-matrix.role` ∈ `actor-registry.roles[].slug`
- `sitemap.routes` ↔ `feature-catalog.features[].routes`
- `test-accounts.role_slug` ∈ `actor-registry.roles[].slug`
- `test-evidence.feature_id` ∈ `feature-catalog.features[].id`

intel-validator skill enforces.

## Stale-Block Contract

Consumer skills (resume-feature, close-feature, intel-refresh, generate-docs) MUST block when REQUIRED artifact missing or stale. REQUIRED set = {actor-registry, permission-matrix, sitemap, feature-catalog}. test-accounts is OPTIONAL.

## Snapshot Regen (Cursor Rule 24)

Producers (from-doc, from-code, intel-merger) MUST regen `_snapshot.md` after writing canonical intel. Failure to regen = stale snapshot = consumers fall back to expensive full JSON reads. close-feature checks via `--check`.
