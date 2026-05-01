---
parent: _state.md
phase: 3
applied-at: 2026-05-01
status: applied — awaiting F-005 spike validation
---

# Phase 3 — Bundle Inlining REAL Implementation

## Problem

F-003 spike phát hiện skill log `bundle-built` events với `bundle_chars: 0` — nghĩa là bundle header có nhưng content KHÔNG được inline. Subagents vẫn phải tự Read các artifact (redundancy 5-54×/file).

Root cause: Step 6.5 viết "describe algorithm" — skill executor (Claude/composer-2 trong main thread) đọc như tài liệu mô tả, không thực thi như instruction.

## Fix applied

Rewrite Step 6.5 thành **8 Action steps imperative** với explicit tool calls:

| Action | Mô tả | Tool calls expected |
|---|---|---|
| 1 | Determine bundle file list per stage matrix | (lookup, no tool call) |
| 2 | **Read each file via Read tool** — IMPERATIVE | Read × N (visible in transcript) |
| 3 | Wave extraction (regex slice) cho dev/qa-wave-{N} | (in-memory) |
| 4 | Concat thành bundle string với format `### File: ...` | (in-memory) |
| 5 | **HARD GATE**: bundle_chars < 100 → STOP với blocker `BUNDLE-001` | (validation) |
| 6 | Append bundle vào DYNAMIC_SUFFIX | (in-memory) |
| 7 | Telemetry log với bundle_chars REAL (Bash → jq) | Bash 1× |
| 8 | Cache reuse hash check (optional optimization) | (in-memory) |

## Critical gate (Action 5)

```python
if bundle_chars < 100:
    return {"status": "blocked",
            "blockers": [{"id": "BUNDLE-001",
                          "description": "Active Context Bundle empty — no files inlined"}]}
```

**Constraint**: `bundle_chars: 0` events NEVER acceptable post Phase 3. Nếu vẫn thấy → regression, Action 5 gate failed silently.

## Subagent contract (defensive)

Bundle prompt section bao gồm rules cấm subagent re-Read:
```
context-bundle-protocol:
1. DO NOT Read files in bundle
2. Source code (src/**, tests/**) NOT in bundle — Read normally
3. [truncated] markers → MAY Read for full content
4. If about to Read bundled artifact → STOP, re-read bundle
```

## Reversibility

```bash
git checkout HEAD ~/.cursor/skills/resume-feature/SKILL.md
```

## Expected impact

Nếu bundle inlining thực sự work:
- Subagent reads/Task: 5-30 → 0-3 (chỉ Read source code)
- Tool result tokens/Task: 10-80K → 2-10K
- Cost saving: 30-50% trên tool result component (which was 84% of visible context)

Combined Phase 1A + 1B + 2 + 3 expected:
- F-003 baseline: $4.88
- F-005 target: **$0.80-1.20** (75-83% reduction)

## Risk

- Skill executor có thể vẫn skip Action 2 nếu prompt không đủ explicit. Action 5 hard gate sẽ catch.
- Một số bundle file paths có thể fail nếu artifact chưa tồn tại (ví dụ ba/00-lean-spec.md ở stage `ba`). Action 2 step 3 specifies "skip silently" → an toàn.
- Cache reuse Action 8 chỉ trong session — not persistent. Acceptable.

## Next: F-005 spike — validate combined effect

Spike specs:
- Same complexity as F-003/F-004 (Path S, simple feature, ~4 stages)
- Apply to current ufh-rfid project
- After all 3 phases applied
- Measure:
  - Cache_read floor (target <100K avg)
  - Cost (target <$1.50)
  - Bundle_chars > 100 in all telemetry events
  - Subagent Read count drop vs F-003

User cần làm:
1. **Restart Cursor** (settings change + skill changes)
2. **Settings → Default model = composer-2** (backup for Cursor 3 model param bug)
3. **Settings → Auto mode = OFF** (nếu có toggle)
4. Tạo F-005 minimal feature scaffold (tôi sẽ prepare)
5. `/resume-feature RFID-F-005`
6. Verify: tất cả telemetry events có `bundle_chars > 0`
7. Export CSV → send tôi
