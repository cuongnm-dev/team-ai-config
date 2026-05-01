---
audit-id: cost-audit-2026-05
opened: 2026-05-01
last-updated: 2026-05-01 (paused — resume later)
owner: cuongnm1@etc.vn
status: paused
data-sources:
  - C:\Users\James\Downloads\team-usage-events-19892705-2026-05-01*.csv (6 files: baseline, F-003, post-restart, F-004 probe, F-005 spike, F-006 final)
  - D:\Projects\ufh-rfid (test project — RFID-F-001..006)
  - C:\Users\James\.cursor (SDLC pipeline files)
---

# Cost Audit State — Resume Document

## TL;DR (cho lần quay lại)

**Cursor SDLC pipeline cost optimization.** Bắt đầu từ baseline $4.88/feature đơn giản (F-003), sau 4 phase fixes giảm xuống **$3.99 = 18% saving** (F-006). Cursor 3 có hard floor ~$0.30-0.40/event không break được. Saving thực tế nhỏ hơn dự tính (target 50-70% → thực tế 18%).

**State hiện tại**: Phase 1A + 1B + 2 applied, Phase 3 reverted, continuity fix applied (chưa validate).

**Next step khi resume**: Run F-007 spike validate continuity fix.

---

## Đã làm gì — full timeline

### Phase 1A — Agent prune ✅ APPLIED
**Action**: Move 13 doc/tdoc agents → `~/.cursor/agents-archive/`
**Effect**: Cache_read floor 261K → 49K min, 476K → 209K avg (F-004 probe measured)
**File**: `phase-1a-applied.md`

### Phase 1B — Skills disable-model-invocation ✅ APPLIED
**Action**: 13 optional skills set `disable-model-invocation: true` (adr, arch-review, audit, cache-lint, hotfix, incident, intel-snapshot, release, runbook, strategic-critique, ui-catalog, zip-disk, generate-docs)
**Effect**: Defensive — không đo trực tiếp được
**File**: `phase-1b-applied.md`

### Phase 2 — Pure auto everywhere ✅ APPLIED
**Action**:
- 23 agent .md frontmatter → `model: auto`
- Removed `model="composer-2"` từ Task() params (4 chỗ)
- User configured Cursor Settings → Default = composer-2

**Effect**: Thinking events 5/12 → 0/7 (eliminated $3 thinking premium per pipeline)
**File**: `phase-2-revised-auto.md`

### Phase 3 — Bundle inlining ❌ APPLIED then REVERTED
**Tried**: Active Context Bundle pre-load artifacts vào Task() prompt
**Result**: Net negative. Bundle changes per stage = cache miss = +$3 fresh input cost
**Reverted**: 2026-05-01
**Files**: `phase-3-applied.md`, `synthesis-deep-dive.md`, `spike-result-analysis.md`

### Continuity Fix ✅ APPLIED (chưa validate)
**Problem**: User observed pipeline dừng giữa chừng → phải `/resume-feature` lại → cache_write tax mỗi lần
**Fixes**:
- Skill loop LENIENT (unknown status → continue, not STOP)
- iter limit 50 → 200
- `status=done` safety check (re-verify queue empty)
- Transient blockers (PARSE-001/NO-INVOKE-001) retry once
- Disambiguate "Stop here" trong dispatcher.md
- Canonical status enforcement
- Workflow guide updated với 7 rules

**File**: `continuity-fix-applied.md`
**Validation pending**: F-007 spike

---

## Bằng chứng đo được

| Spike | Phases applied | Events | Total cost | Avg cost/event | Avg cache_read | Thinking events | Notes |
|---|---|---|---|---|---|---|---|
| F-003 | (baseline, no fix) | 12 | **$4.88** | $0.41 | 476K | 5 | Original baseline |
| F-004 probe | 1A only | 3 | $0.99 | $0.33 | 210K | 2 | Single Task() floor measure |
| F-005 | 1A+1B+2+3 | 7 | $4.83 | $0.69 | 651K | 0 | Bundle inflation: per-event cost ↑70% |
| **F-006** | 1A+1B+2 (no bundle) | 11 | **$3.99** | $0.36 | 395K | 0 | **Final state — 18% saving vs F-003** |

---

## Cái RÚT RA (quan trọng để nhớ)

### 1. Cursor 3 có hard floor không break được
- Per-event cost floor: ~$0.30-0.40 với composer-2-fast
- Cache_read floor: ~50-100K tokens/Task() ngay cả minimal call
- Source: Cursor harness (system prompt + tool defs + agent registry + alwaysApply rules)

### 2. 4-block frozen header design = placebo
- F-005 data: `icw=0` mọi event → Cursor không cache_control trên prompt content user pass
- Chỉ HARNESS được cache (Cursor system prompt + agent.md)
- Pipeline content variable stops at any byte change

### 3. Bundle inlining là anti-pattern
- Bundle thay đổi per stage = different prefix bytes = cache miss
- Net: +$3 fresh input > $X redundant Read savings
- Verdict: REJECTED, reverted

### 4. Real wins
- **Phase 1A**: agent prune giảm registry (~38K tokens/Task() saving)
- **Phase 2**: eliminate thinking model premium ($3 saved per pipeline)

### 5. Workflow là biggest unaddressed lever
- Continuous burst run (no pause >5min) = max cache hit
- Pause-resume = max cache miss = duplicate cache_write tax
- User has agency over this — guide created

---

## File index

| File | Purpose |
|---|---|
| `_state.md` (this file) | Resume document — start here |
| `synthesis-deep-dive.md` | Full retrospective + cache analysis |
| `transcript-findings.md` | Empirical analysis 41 Task() calls |
| `root-cause-deep-dive.md` | Cursor 3 harness inflation root cause |
| `on-demand-strategy.md` | Cursor 3 lazy loading research findings |
| `workflow-guide.md` | User-facing workflow rules (7 rules) |
| `phase-1a-applied.md` | Phase 1A: agent prune |
| `phase-1b-applied.md` | Phase 1B: skill disable-model-invocation |
| `phase-2-revised-auto.md` | Phase 2: pure auto + Settings composer-2 |
| `phase-3-applied.md` | Phase 3: bundle (reverted) |
| `spike-result-analysis.md` | F-005 result analysis |
| `continuity-fix-applied.md` | Continuity fix (pending F-007 validation) |
| `spike-protocol.md` | Original spike protocol |
| `audit-cursor-config.py` | Inventory generator |
| `cursor-config-inventory.md` | Generated inventory |
| `parse_transcripts.py` | Transcript parser (v2 with tool_result estimation) |
| `transcript-analysis.json` | Raw analysis output |

---

## Open issues (chưa làm)

### High-priority (next session)

1. **F-007 spike** — validate continuity fix
   - Same complexity F-006 (1 endpoint, Path S, 4 stages)
   - Target: pipeline completes in 1 `/resume-feature` invocation
   - Cost target: <$3.50 (vs F-006 $3.99)

### Medium-priority

2. **1h cache TTL research** — research B4 fail (no web tools), need re-research với web access HOẶC empirical test (parse Cursor logs to detect TTL behavior)

3. **Project rule duplicate** — đã tự dọn (folder removed). Re-check khi user khởi tạo project mới.

### Low-priority / deferred

4. **Path XS** (3 stages) cho trivial features — user reject "giảm Task() count", defer
5. **Multi-feature session** (Option E) — user reject, defer
6. **Slim agent.md content** — defer, marginal effect
7. **Empirical test cross-Task cache reuse** — 5 sequential Task(dev) trong 1 phút, count cache_writes

---

## Next session — checklist resume

Khi quay lại:

1. [ ] Đọc TL;DR ở đầu file này
2. [ ] Verify state hiện tại không drift:
   ```bash
   ls ~/.cursor/agents/ | wc -l                                      # → 31
   ls ~/.cursor/agents-archive/ | wc -l                              # → 13
   grep -c "^model: auto" ~/.cursor/agents/*.md | grep -v ":0" | wc -l  # → 23
   grep -c "disable-model-invocation: true" ~/.cursor/skills/*/SKILL.md | grep -v ":0" | wc -l  # → 13
   ```
3. [ ] Verify Cursor Settings → Default = composer-2
4. [ ] Run F-007 spike to validate continuity fix
5. [ ] Send CSV → analyze → decide A/B/C/D below

### Decision tree post F-007

| F-007 result | Next action |
|---|---|
| ≤$3 (1 invocation done) | Continuity fix work. Document baseline. Roll out workflow guide team-wide. |
| $3-$3.50 (≥2 invocations needed) | Continuity fix partial. Cursor IDE limit external. Document workaround. |
| >$3.50 | Cursor IDE has hard external limit. Accept floor at F-006 $3.99. Move to other levers. |

---

## Numbers to remember

- **Baseline (F-003)**: $4.88/feature, $285/tháng/user
- **Current optimized (F-006)**: $3.99/feature, ~$230/tháng/user
- **Saving achieved**: 18% / $55/month/user
- **Cursor 3 floor**: ~$0.30-0.40/event với composer-2-fast
- **Realistic ceiling** with all known optimizations: $3-3.50/feature, ~$200/tháng/user (estimated)

If team 5 users:
- Current: $1,150/tháng overage potential
- After all optimizations: $850-1000/tháng
- Savings ceiling: ~$150-300/tháng team-wide

---

## Quan điểm chiến lược (cho user)

Cursor 3 là IDE-tight tool ưu việt cho code editing nhưng **đắt cho orchestrated SDLC pipeline**. Phí floor cho mỗi Task() spawn cao (~$0.30) so với Claude API direct (~$0.01-0.05 floor).

**Nếu cần giảm cost dưới $200/tháng/user**: phải xem xét hybrid (Cursor cho code editing, Claude Code cho pipeline orchestration). Đã đề xuất sẵn architecture trong synthesis-deep-dive.md, user reject thời điểm này.

**Đề xuất quay lại**: nếu sau F-007 cost vẫn ≥ $3.50/feature, revisit hybrid option như next strategic move.

---

## Conversation context (cho lần resume)

User priorities qua audit:
- ✅ Multi-Task philosophy — KEEP (no Path XS, no fewer Task() calls)
- ✅ 1 user 1 feature — KEEP (no multi-feature session)
- ✅ Quality preservation — important (don't sacrifice for cost)
- ✅ Doc-gen on Claude (not Cursor) — already done, locked
- ❌ Hybrid Claude Code — rejected this session, may revisit later
- ✅ Continuous burst — agreed, fix applied
- ✅ Pure auto everywhere — agreed, applied

User communication style:
- Directly Vietnamese, technical
- Wants honest measurement, doesn't accept optimistic estimates
- Prefer step-by-step (Option 3 in earlier discussion)
- Will run spike requests but expects clear instructions

---

**RESUME TRIGGER**: User says "tiếp tục cost audit" or similar → Read this file first, then check open issues #1 (F-007 spike).
