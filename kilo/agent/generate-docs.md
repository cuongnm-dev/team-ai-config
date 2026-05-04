---
description: Sinh trọn bộ tài liệu kỹ thuật ETC từ mã nguồn — Thiết kế Kỹ thuật, Thiết kế Cơ sở, Thiết kế Chi tiết, Hướng dẫn sử dụng, Test Case. Render Word/Excel qua etc-platform MCP. Pre-req - intel layer complete (run /from-code trước nếu chưa).
mode: primary
model: anthropic/claude-sonnet-4-20250514
---

# /generate-docs

ASSEMBLY skill (CD-10 Q.10): collect test evidence + intel + screenshots → render Office docs.

User-facing: Vietnamese.

## Pre-req check

REQUIRED in `docs/intel/`:
- `actor-registry.json`, `permission-matrix.json`, `sitemap.json`, `feature-catalog.json` (block if missing/stale)
- `_meta.json` valid

OPTIONAL:
- `test-accounts.json` (block for HDSD/Playwright targets)
- `test-evidence/{feature-id}.json` per feature

If missing → STOP. Suggest `/from-code` or `/from-doc` first.

## Stage 1 — Reuse summary

Per-feature reuse-first scan (CD-10 Q.9, Q.17):
```
For each feature in feature-catalog where status: implemented:
  IF test-evidence/{id}.json exists AND test_cases populated:
    print "♻ {feature_id}: assembled {N} executed TCs (passed: {M}/{N})"
    Mark for ASSEMBLY (no re-synthesis)
  ELSE:
    Mark for FALLBACK synthesis (Stage 4f)
```

## Stage 2 — Reuse intel

Read intel JSONs (canonical, pro-tier mode for full detail). NO re-discovery if `_meta.stale: false`.

## Stage 3a — Screenshot capture (if missing)

Scan `docs/intel/screenshots/` for existing CD-4-named files. Capture only for features WITHOUT QA evidence.

Use `tdoc-test-runner` equivalent (Cascade auto-load) → Playwright via MCP.

## Stage 3b — Vision verification

Mandatory `tdoc-screenshot-reviewer` for captured screenshots. Filter wrong-state/blank/broken. Re-capture flagged.

## Stage 4 — Doc-gen phase (parallel writers)

Dispatch 5 parallel writers (CD-10 CD-2):
- `tdoc-arch-writer` → architecture.* blocks (TKKT)
- `tdoc-tkcs-writer` → tkcs.* (TKCS Đ13 NĐ 45/2026)
- `tdoc-tkct-writer` → tkct.* (TKCT)
- `tdoc-catalog-writer` → tkct.feature_catalog (cross-doc)
- `tdoc-manual-writer` → hdsd.* (HDSD per service if monorepo)
- `tdoc-testcase-writer` → test_cases.* (xlsx)

Each writer:
- Reads intel + service-specific
- Writes block JSON
- Calls `mcp__etc-platform__merge_content` (auto_validate=True)
- Loops on warnings until DoD met

## Stage 4f — XLSX test cases

Step 0: print reuse summary per feature.
- ASSEMBLY mode (test-evidence populated) → use TCs as-is, mark `source: qa-executed`
- FALLBACK synthesis (no evidence) per CD-10 Q.18:
  - ISTQB techniques
  - VN gov dimensions
  - Cross-pollinate from HDSD output
  - Tag `source: generate-docs/fallback-synthesized`, `status: proposed`
  - xlsx warning sheet at top

## Stage 5 — Cross-block validation

`mcp__etc-platform__validate` on full content-data.json. Check refs, terminology consistency.

### Stage 5b — Pass 7 confidence aggregate

Block if any low_confidence_critical OR low ratio > 5%. Major warning if 1-5%.

## Stage 6 — Office export (CD-8 single source)

Through `etc-platform` MCP only:
1. `mcp__etc-platform__upload_capacity` — upload content-data.json
2. `mcp__etc-platform__export` (or async) — submit job (type: tkct|tkcs|tkkt|hdsd|xlsx)
3. `mcp__etc-platform__job_status` — poll
4. Download rendered Office files

NO local subprocess (CD-8 forbidden).

## Stage 6.5 — Output validation

Mandatory:
- `xlsx` skill recalc formulas
- `docx` skill scan placeholder residuals (`{{...}}` shouldn't remain)

## Stage 6.7 — PDF conversion (optional)

If `mcp__word_document_server__convert_to_pdf` registered → run. Else skip + warn user manual convert.

## Hand off

Output `{docs-path}/output/` with TKKT.docx, TKCS.docx, TKCT.docx, HDSD.docx, TestCases.xlsx (and PDF if available).

## Scalability batching (CD-10 CD-7)

- > 10 features/service → test-runner batch (10/batch)
- > 30 features → researcher chunk
- > 50 features → warn user split module

## What's next

| Outcome | Next |
|---|---|
| Docs rendered clean | Manual final review, deliver |
| Fallback synthesis used | QA review proposed TCs before sign-off |
| Validation issues | Fix per merge_content warnings, re-export |
