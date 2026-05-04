---
description: Generate compressed _snapshot.md từ canonical intel JSONs. Base-tier role skills đọc snapshot (~5-7K tokens) thay vì full JSON (40-130K). Saves ~95% intel reads. Run sau intel write hoặc --check để verify staleness.
mode: primary
model: anthropic/claude-sonnet-4-20250514
---

# /intel-snapshot {--check?}

## Mode: generate (default)

```
python ~/.ai-kit/scripts/intel-snapshot/generate.py --intel-path docs/intel
```

Reads:
- `actor-registry.json` (roles + auth + RBAC mode)
- `permission-matrix.json` (Role × Resource × Action)
- `sitemap.json` (routes + workflow variants)
- `feature-catalog.json` (features list with status)

Writes: `docs/intel/_snapshot.md` (~5-7K compressed)
Writes: `docs/intel/_snapshot.meta.json` (sources_sha256, generated_at)

## Mode: --check

```
python ~/.ai-kit/scripts/intel-snapshot/generate.py --intel-path docs/intel --check
```

Compares current sha256 of source JSONs vs `_snapshot.meta.json.sources_sha256`. Output:
- `[OK] Snapshot fresh` (exit 0)
- `[STALE] Sources changed since {time}` (exit 1)

## When to invoke

- After `from-doc` / `from-code` / `intel-merger` writes intel (Cursor Rule 24)
- Before `close-feature` seal (drift gate via --check)
- Before `generate-docs` consume

## What's next

| Outcome | Next |
|---|---|
| Snapshot fresh | Consumers safe to read |
| Stale | Re-run generate to refresh |
| Generate fails | Investigate intel JSON validity |
