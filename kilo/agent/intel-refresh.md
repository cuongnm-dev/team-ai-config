---
description: Cập nhật lại các bản phân tích intel sau khi code/tài liệu thay đổi. Chỉ chạy lại đúng phần cần thiết theo cờ drift, không toàn bộ pipeline. Pre-req - intel-drift flag set in _state.md hoặc user manual trigger.
mode: primary
model: anthropic/claude-sonnet-4-20250514
---

# /intel-refresh {scope?}

Smart partial re-extraction — re-derive intel from current code/doc state.

## Step 1 — Detect refresh scope

Read all `docs/features/*/( _state.md` for `intel-drift: true` flags.

If user provided `scope` arg → respect (e.g., `routes`, `permissions`, `data-model`, `all`).

Default scope = union of drift flags from all in-progress features.

## Step 2 — Run targeted re-extract

| Scope | Action | Output |
|---|---|---|
| `routes` | Re-scan controllers/handlers | Update `sitemap.json` |
| `permissions` | Re-scan auth decorators / RBAC config | Update `permission-matrix.json` + `actor-registry.json` |
| `data-model` | Re-scan entities / migrations | Update `data-model.json` |
| `integrations` | Re-scan external API calls | Update `integrations.json` |
| `api-spec` | Re-scan OpenAPI/contract files | Update `api-spec.json` |
| `feature-catalog` | Re-derive features from clusters | Update `feature-catalog.json` (preserve manual additions per `_meta.locked_fields`) |
| `all` | All above | Full pipeline |

## Step 3 — Validate

Run `code-intel-validator` on changed artifacts. Hard-stop on hallucination/orphan/drift.

## Step 4 — Snapshot regen (Cursor Rule 24)

```
python ~/.ai-kit/scripts/intel-snapshot/generate.py --intel-path docs/intel
python ~/.ai-kit/scripts/intel-snapshot/generate.py --intel-path docs/intel --check
```

Expected: `[OK] Snapshot fresh`.

## Step 5 — Reset drift flags

For features with `intel-drift: true` whose drift was addressed → set `intel-drift: false` in `_state.md`.

## Step 6 — Surface diff

Compare pre/post intel JSONs. Print diff summary:
```
Routes: +2 added, 1 removed
Permissions: 3 changed (role X gained access to Y)
Data model: 1 entity added, 0 removed
```

## What's next

| Outcome | Next |
|---|---|
| Intel refreshed cleanly | Continue with `/new-feature` or `/resume-feature` |
| Validator found issues | Manual review, fix, re-run |
| Major drift detected | `/audit` to investigate broader changes |
