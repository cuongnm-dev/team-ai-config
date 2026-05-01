---
parent: _state.md
spike-id: cost-audit-2026-05-01
target-feature: RFID-F-003
created: 2026-05-01
---

# Spike Protocol — Cost Audit Measurement

## Mục đích

Validate 3 fixes trên 1 pipeline thực:
- **I15** Active Context Bundle (dispatcher pre-loads artifacts)
- **I17** Delegation enforcement (dispatcher hard-stops if doing work itself)
- **I16** Path normalization (lowercase Windows drive)

Baseline: RFID-F-001 (Path L, $219, 770K parent context, 442 turns).
Target: RFID-F-003 (Path S, target <$2, <100K parent context, <50 turns).

## Changes đã apply

### File `~/.cursor/agents/dispatcher.md`

1. Task Prompt Template: 4 blocks → **5 blocks** (thêm `## Active Context Bundle` giữa `## Feature Context` và `## Inputs`)
2. Section mới "**Active Context Bundle protocol**": stage-to-files matrix, format spec, size cap 60K tokens, subagent contract cấm re-Read
3. Section mới "**Delegation Enforcement**": tool budget per dispatcher invocation (Read ≤5, Glob ≤3, Write ≤2, Bash 0, Grep 0, Task unlimited). Hard-stop blocker `I17-001` nếu vi phạm.
4. Path normalization rule: lowercase drive letter on Windows.

### File `~/.cursor/skills/resume-feature/SKILL.md`

5. DYNAMIC_SUFFIX template: thêm `## Active Context Bundle` placeholder
6. **Step 6.5 mới — Build Active Context Bundle**: per-iteration algorithm (resolve files → read → truncate >30KB → concat → cache by hash → log telemetry)

### File `D:\Projects\ufh-rfid\docs\features\RFID-F-003\` (NEW)

7. `feature-brief.md` — minimal spec (1 endpoint, Path S, complexity-estimate S)
8. `_state.md` — initialized với `spike-mode: cost-audit-2026-05-01`, queue `[ba, tech-lead, dev-wave-1, reviewer]`

## Cách user chạy spike

### Bước 1 — Backup measurement state hiện tại

Trước khi resume F-003, snapshot transcripts hiện có để diff sau:

```powershell
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item "C:\Users\James\.cursor\projects\d-Projects-ufh-rfid" "C:\Users\James\.cursor\projects\d-Projects-ufh-rfid.snap-$ts" -Recurse
```

### Bước 2 — Run pipeline

Trong Cursor mở project `D:\Projects\ufh-rfid`, gõ:

```
/resume-feature RFID-F-003
```

Để pipeline chạy end-to-end. KHÔNG bật Thinking mode hay Max Mode (giữ default model). Pipeline expected:
- ba → tech-lead → dev-wave-1 → reviewer → done

Nếu dispatcher fire blocker `I17-001` (delegation violation): KHÔNG manual override. Note lại blocker, để dispatcher tự dừng. Đó là tín hiệu I17 guard hoạt động.

### Bước 3 — Sau khi pipeline done

Verify completion:
```bash
cat D:/Projects/ufh-rfid/docs/features/RFID-F-003/_state.md | grep "^status:"
# Expected: status: done
```

Check artifacts created:
```bash
ls D:/Projects/ufh-rfid/docs/features/RFID-F-003/
# Expected:
# _state.md
# feature-brief.md
# ba/00-lean-spec.md
# 04-tech-lead-plan.md
# 05-dev-w1-t01-version-endpoint.md (or similar name)
# 08-review-report.md
```

### Bước 4 — Export Cursor billing CSV

Cursor Dashboard → Usage → Export events for hôm nay (date range = ngày spike).
Save as `team-usage-events-spike-YYYYMMDD.csv` ở `C:\Users\James\Downloads\`.

### Bước 5 — Run measurement script

```bash
cd d:/AI-Platform/team-ai-config/docs/cost-audit
python parse_transcripts.py > spike-result.txt 2>&1
```

Output sẽ có thêm runs cho F-003. So sánh với baseline analysis.

### Bước 6 — Send tôi 3 file

User gửi tôi:
1. `team-usage-events-spike-YYYYMMDD.csv`
2. `spike-result.txt` (output của parse script)
3. `D:/Projects/ufh-rfid/docs/features/RFID-F-003/_state.md` (final state) + `08-review-report.md` (quality check)

## Metrics tôi sẽ đo

| Metric | Baseline F-001 | Target F-003 | Cách tính |
|---|---|---|---|
| Cursor billing | $219 (Path L) | <$2 (Path S) | CSV diff |
| Avg tokens/event | 994K | <300K | CSV |
| Parent dispatcher context (final turn) | 770K | <100K | parse_transcripts.py |
| Task() invocations | 19 (full pipeline) | 4-6 (Path S) | parse_transcripts.py |
| Parent messages | 442 | <50 | parse_transcripts.py |
| Redundant Reads (n>1 reads of same file) | 978K visible | <50K | parse_transcripts.py |
| Bundle built events | 0 | 4-6 (1/stage) | telemetry JSONL |
| Avg bundle size | n/a | 30-50K tokens | telemetry |
| I17 violations | n/a | 0 (or rare) | telemetry |

### Pass criteria

Spike PASS nếu:
- ✅ Pipeline completes end-to-end (status=done)
- ✅ Output quality OK (review-report says ready/conditional, no critical gaps)
- ✅ Cursor billing < $5 cho F-003 (Path S baseline target)
- ✅ Parent context < 200K tokens
- ✅ Redundant reads < 100K tokens
- ✅ Bundle telemetry shows 4+ "bundle-built" events

Spike FAIL nếu:
- ❌ Pipeline hangs/blocks repeatedly without progress
- ❌ Subagents ignore bundle and re-Read files (verify in transcripts)
- ❌ Quality drops (reviewer flags major gaps in spec/plan)
- ❌ Cursor billing > $20 cho F-003 (no improvement)

## Rollback plan

Nếu spike FAIL:
- `git checkout HEAD ~/.cursor/agents/dispatcher.md`
- `git checkout HEAD ~/.cursor/skills/resume-feature/SKILL.md`
- (F-003 có thể giữ làm reference hoặc xoá)
- Quay lại `_state.md` audit, debug specific failure mode

## Known unknowns (từ research B1)

- Cross-Task() prompt cache reuse: chưa confirm. Nếu Cursor cache theo Task spawn (mỗi Task = fresh prefix → cache write 1.25× cost), thì I18 (slim agent.md) sẽ là next priority sau spike.
- Empirical test phụ: chạy 5 sequential `Task(dev)` trong 1 phút, kiểm tra Cache Write fires 1× hay 5× → quyết định I18 worth fixing không.
