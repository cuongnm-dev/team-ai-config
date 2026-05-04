---
description: Đọc tài liệu mô tả nghiệp vụ (PDF/Word/ảnh) → phân tích → dựng cấu trúc dự án và sinh hồ sơ từng tính năng theo Cursor SDLC. Output - docs/intel/{doc-brief, sitemap, actor-registry, feature-catalog, permission-matrix}.json + docs/features/F-NNN/_state.md cho mỗi feature.
---

# /from-doc {input-files...}

Document-driven pipeline: đọc tài liệu → tạo intel + features.

User-facing: Vietnamese.

## Stage 1 — Doc-intel

1. Receive input files (PDF/DOCX/PNG paths)
2. Detect mode: SMALL (single doc) or LARGE (multi-doc, dispatch doc-intel-module per chunk)
3. Run `doc-intel` (Cursor agent equivalent — Cascade auto-loads via context)
4. Outputs:
   - `docs/intel/doc-brief.md` (canonical narrative)
   - `docs/intel/tech-brief.md` (technical extraction)
   - `docs/intel/sitemap.json` (routes + workflow variants)
   - `docs/intel/actor-registry.json` (roles + auth)

## Stage 2 — Validation gate (doc-intel-validator)

Checks: hallucination, incoherence, truncation, semantic drift. Block before Gate A if issues.

## Gate A — User confirm intel

Display summary. User accepts → continue. User rejects specific items → re-run partial.

## Stage 3 — Feature synthesis

For each feature identified in doc-brief:
1. Allocate feature-id `F-NNN` (project prefix)
2. Create `docs/features/{feature-id}/feature-brief.md` (per-feature extract)
3. Create `docs/features/{feature-id}/_state.md` per `ref-pm-templates` template (status: planned, source-type: from-doc)
4. Update `docs/feature-map.yaml` + `docs/intel/feature-catalog.json` (status: planned, confidence per evidence)

## Stage 4 — Feature seed test cases (CD-10 Q.14)

For each feature, synthesize seed test cases:
- Read AC + roles + dialogs + error_cases
- Apply ISTQB techniques (Boundary Value Analysis, Equivalence Partition, Decision Table, State Transition, Error Guessing)
- Apply VN gov dimensions (audit log, PII masking, concurrent edit, diacritics, SLA, session)
- Compute min_tc per CD-10 Q.15
- Save to `docs/intel/test-evidence/{feature-id}.json` with `status: proposed`, `source: from-doc/synthesized`

## Stage 5 — Permission matrix

Synthesize `docs/intel/permission-matrix.json` from sitemap routes × actor-registry roles. Mark uncertain entries `confidence: low`.

## Stage 6 — Confidence stats

Aggregate confidence distribution across artifacts. If >5% low_confidence_critical → warn user, suggest manual review pass.

## Stage 7 — Snapshot regen

`python ~/.ai-kit/scripts/intel-snapshot/generate.py --intel-path docs/intel`

## Hand off

User chooses:
- `/resume-feature {feature-id}` to drive feature pipeline (PM orchestrator)
- `/strategic-critique` to adversarially review proposed features
- Manual review intel JSONs

## What's next

| Outcome | Next |
|---|---|
| Intel + features ready | `/resume-feature {first-feature-id}` |
| Confidence low | Manual review + `/intel-refresh` |
| Need adversarial check | `/strategic-critique` |
