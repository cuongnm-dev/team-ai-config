---
parent: _state.md
phase: 1A
applied-at: 2026-05-01
status: applied — awaiting measurement
---

# Phase 1A — Agent Prune (Applied)

## Changes

Moved 13 agents from `~/.cursor/agents/` to `~/.cursor/agents-archive/`:

```
doc-arch-writer.md      doc-catalog-writer.md   doc-exporter.md
doc-intel.md            doc-manual-writer.md    doc-researcher.md
doc-test-runner.md      doc-testcase-writer.md  doc-tkcs-writer.md
tdoc-data-writer.md     tdoc-exporter.md        tdoc-researcher.md
tdoc-test-runner.md
```

**Before**: 44 agent files, 696KB total
**After**: 31 agent files, 544KB in active dir + 152KB archived
**Removed from registry**: 152KB / ~38K tokens

## Reversibility

100% reversible:
```bash
mv ~/.cursor/agents-archive/* ~/.cursor/agents/
rmdir ~/.cursor/agents-archive
```

## Known orphan references (defer to Phase 3 slim)

Routing table trong `dispatcher.md` (lines 208-212) còn reference các agents đã archived:
- `doc-intel`, `doc-researcher`, `doc-test-runner`, `doc-arch-writer`, `doc-tkcs-writer`, `doc-testcase-writer`, `doc-catalog-writer`, `doc-manual-writer`, `doc-exporter`

Cũng trong: `pm.md`, `designer.md`, `fe-dev.md`, `ref-canonical-intel.md`, `ref-mcp-optional.md`, `ref-pm-rules.md`, `ref-pm-standards.md`, `ref-pm-templates.md`

**Tại sao không sửa ngay**: Đây là text routing tables. Crash chỉ xảy ra nếu dispatcher thực sự `Task(subagent_type="doc-intel")` — chỉ xảy ra với pipeline-type=`doc-generation`. User đã ngừng doc-gen trên Cursor → không trigger được.

Phase 3 (slim agent.md) sẽ xóa text references này.

## Measurement protocol — Phase 1A

User cần làm 4 bước để đo cost floor sau prune:

### Bước 1 — Restart Cursor

**Bắt buộc**: Cursor cache agent registry ở startup. Phải khởi động lại để reload danh sách 31 agents.

```
File → Quit
(Mở lại Cursor)
```

### Bước 2 — Spawn 1 minimal Task() event

Mở project bất kỳ (vd ufh-rfid). Trong Cursor chat:

**Option A — Re-run F-003 stage cuối** (recommended, vì pipeline đã done):
```
/resume-feature RFID-F-003
```
Sẽ trigger 1-2 Task() events vì pipeline đã `status: done`, dispatcher sẽ exit ngay → minimal events.

**Option B — Trigger any minimal subagent**:
Type vào chat: "Read _state.md của RFID-F-003 và summarize"
- Tạo 1-2 Task() events nhỏ
- Đo cost floor

### Bước 3 — Export Cursor billing CSV

Cursor Dashboard → Usage → Export today's events.
Save: `team-usage-events-phase1a-YYYYMMDD.csv` ở `C:\Users\James\Downloads\`.

### Bước 4 — Send tôi CSV

Tôi sẽ:
1. Filter events post-restart
2. Compute min/avg cache_read tokens
3. Compare với baseline (F-003 spike: 261K min, 476K avg)
4. Quantify saving

**Target**: Cache_read floor giảm 30-40K tokens (~10-15% reduction) chỉ từ Phase 1A.

## Success criteria Phase 1A

- ✅ No crashes when invoking SDLC pipeline (ba, sa, dev, qa, reviewer agents still present)
- ✅ Min cache_read per Task() < 230K (was 261K)
- ✅ Avg cache_read per Task() < 440K (was 476K)
- ✅ User: pipeline still works for normal feature

## Failure modes to watch

- ❌ Crash: "subagent_type 'doc-X' not found" → meant we accidentally removed an active SDLC agent
- ❌ Quality drop: agent.md was actually used for routing decisions → check pm.md routing tables
- ❌ No floor reduction: agent registry isn't where the inflation came from → revisit hypothesis

## Next phase (after measurement)

**Phase 1B** — `disable-model-invocation: true` cho 12 optional skills (low risk, easy revert)

**Phase 2** — Force composer-2 (modify Task() params + Cursor settings)

**Phase 3** — Fix bundle inlining (skill rewrite)

**Phase 4** — F-004 spike validation
