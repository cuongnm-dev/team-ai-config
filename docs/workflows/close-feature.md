---
title: Workflow — /close-feature (seal feature, sync canonical intel)
order: 12
---

# Workflow — /close-feature

Skill **Cursor**. Đóng pipeline feature đã hoàn thành: seal `_state.md`, sync `feature-catalog.json`, cập nhật evidence.

## Khi nào dùng

- `/resume-feature` báo `status: done` (reviewer verdict = Approved)
- Đã có đầy đủ QA atomic triple (TC + Playwright spec + screenshots)
- Sẵn sàng nghiệm thu / merge release

## Quy trình

```
/close-feature F-042
```

Skill thực hiện:

### Step 1 — Validate close condition
- `_state.md.status` = `in-progress` (không phải `done` rồi hoặc `blocked`)
- Reviewer verdict = `Approved`
- Có 08-review-report.md

### Step 2 — QA atomic triple gate (CD-10 Quy tắc 16)
HARD-STOP nếu thiếu 1 trong 3:
- `docs/intel/test-evidence/F-042.json` — TC prose với `execution.status` set
- `playwright/F-042.spec.ts` — executable spec
- `docs/intel/screenshots/F-042-step-NN-{state}.png` — captured khi Playwright chạy

### Step 3 — Compute min_tc
HARD-STOP nếu `test_cases.length < min_tc(feature)`:
```
min_tc = max(5, AC×2 + roles×2 + dialogs×2 + error_cases + 3)
```

### Step 4 — Update feature-map.yaml
```yaml
features:
  F-042:
    status: "done"
    current-stage: "closed"
    updated: "2026-04-29"
```

### Step 5 — Sync feature-catalog.json
```json
{
  "id": "F-042",
  "status": "implemented",
  "implementation_evidence": {
    "commits": ["abc123", "def456"],
    "test_files": ["tests/e2e/F-042.spec.ts"],
    "coverage_pct": 87,
    "adrs": ["docs/adr/0042-...md"],
    "manual_qa_passed": true,
    "closed_at": "2026-04-29T15:00:00Z"
  },
  "test_evidence_ref": "docs/intel/test-evidence/F-042.json"
}
```

### Step 6 — Seal _state.md
- `status: done`
- `current-stage: closed`
- Compress historical sections (tiết kiệm token cho future resume scans)

### Step 7 — Update _meta.json
```bash
python ~/.claude/scripts/intel/meta_helper.py update docs/intel/ feature-catalog.json \
  --producer close-feature --append-merged-from
```

### Step 8 — Trigger intel-snapshot regen
Snapshot canonical intel state cho audit trail.

## Bypass (rủi ro)

```
/close-feature F-042 --skip-qa-gate
```

Skip Step 2 (QA triple). Logged + visible trong feature-map.yaml + feature-catalog.qa_status. Reviewer audit lần feature sau sẽ surface bypassed features (CD-10 Quy tắc 6.7).

## Output

- `docs/features/F-042/_state.md` (sealed, compressed)
- `docs/feature-map.yaml` (updated)
- `docs/intel/feature-catalog.json` (synced với evidence)
- `docs/intel/_meta.json` (provenance)
- `docs/intel/snapshots/{timestamp}/` (snapshot)

## Ví dụ thất bại

```
/close-feature F-042
✗ QA atomic triple incomplete:
   - test-evidence/F-042.json     ✓
   - playwright/F-042.spec.ts     ✗ MISSING
   - screenshots/F-042-*.png      ✓ (8 files)

Run /resume-feature F-042 → qa stage produces missing artifact, retry.
```

## Sau close-feature

- `/feature-status` — verify F-042 = done
- `/generate-docs` — sinh tài liệu Office (TKKT/TKCS/HDSD/test-cases)
- `/zip-disk` — đóng gói deliverable

## Liên quan

- resume-feature — Chạy pipeline tới khi reviewer Pass
- agents — qa stage atomic triple contract
- troubleshooting — Khi close-feature fail
