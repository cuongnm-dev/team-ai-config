---
title: Cursor SDLC Workflow Guide — Cost-Optimized Patterns
created: 2026-05-01
audience: developers using team-ai-config Cursor SDLC pipeline
status: practical guide based on F-003/F-004/F-005 spike measurements
---

# Cursor SDLC Workflow — Cost Optimization Guide

## Why this exists

Empirical measurements (F-003 baseline $4.88 cho 1 trivial endpoint feature) cho thấy Cursor 3 có cost floor cao nếu workflow không tối ưu. Guide này tổng hợp các pattern đã đo được — DO và DON'T.

Cost floor đo được: **~$0.20-0.30/Task() event** với composer-2-fast. Mục tiêu workflow: KHÔNG inflate floor + maximize cache hit.

---

## TL;DR — 7 quy tắc vàng

1. ✅ **Continuous burst**: chạy 1 feature trong 1 session liên tục (<10 min). KHÔNG pause > 5 phút.
2. ✅ **Cursor Settings**: Default model = `composer-2`. Auto mode OFF.
3. ✅ **New chat per feature**: clear chat khi đổi feature.
4. ❌ **KHÔNG quit Cursor giữa stages** cùng feature.
5. ❌ **KHÔNG invoke slash command khác** trong khi `/resume-feature` đang chạy.
6. ✅ **Click "Continue" mỗi khi Cursor hỏi** — đừng để skill exit giữa pipeline.
7. ❌ **KHÔNG click Stop button** giữa pipeline trừ khi thực sự cần abort.

## ⚠️ Pipeline stops mid-pipeline — known issue

User đã quan sát: pipeline đôi khi dừng giữa chừng (đặc biệt sau wave hoặc giữa stages), buộc phải `/resume-feature` lại. **Đây là cost leak nghiêm trọng** — mỗi re-invocation = ~$0.30-0.50 cache_write tax.

### Nguyên nhân khả dĩ

1. **Cursor IDE auto-pause** sau N tool calls per skill invocation
2. **User click Stop** (vô tình hoặc cố ý)
3. **Cursor IDE timeout** trên long-running skill
4. **Skill loop exit** do unexpected status từ dispatcher (đã fix 2026-05-01: skill nay LENIENT với unknown status)

### Cách giảm thiểu

- ✅ **Click "Continue" / "Run" prompt** khi Cursor hỏi giữa pipeline (đừng để default time-out)
- ✅ **Để Cursor IDE foreground** (focus) khi pipeline chạy — tránh background pause
- ✅ **Đóng các tool/extension không cần** giảm Cursor processing overhead
- ✅ **Pipeline burst < 10 phút** — Path S/M Pipeline xong trước khi Cursor timeout
- ❌ **Đừng đa nhiệm trong Cursor** khi pipeline running

### Skill changes 2026-05-01 (đã apply)

- iter limit 50 → 200 (more headroom)
- `status` field LENIENT: unknown status → treat as continuing (was: STOP)
- `status=done` SAFETY CHECK: re-read _state.md, nếu queue chưa empty → continue (was: trust dispatcher)
- Transient blockers (PARSE-001, NO-INVOKE-001) retry once before STOP

### Nếu pipeline VẪN dừng giữa chừng

Báo tôi với telemetry log. Có thể là Cursor IDE limit nằm ngoài skill control.

---

## DO — patterns tiết kiệm

### 1. Burst run end-to-end

```
1. Mở project trong Cursor
2. /resume-feature RFID-F-XXX
3. Để skill chạy tự động hết queue
4. Confirm pipeline status: done
5. Đóng feature, mở next
```

**Tại sao**: Cache TTL 5 phút. Mỗi stage spawn Task() = 1 cache potential. Nếu stage 2 cách stage 1 > 5 min → cache miss → re-cache tax 1.25× input. Burst pattern giữ cache warm.

### 2. New chat per feature

```
Cursor → File → New Chat (Ctrl+Shift+L hoặc tương đương)
→ /resume-feature RFID-F-XXX
```

**Tại sao**: Main chat context tích lũy giữa features → mỗi Task() spawn từ chat dài kéo theo overhead (UNKNOWN — đang verify). New chat = clean slate.

### 3. Cursor Settings stable

```
Settings → Models:
  - Default model: composer-2
  - Auto mode: OFF (hoặc explicit composer-2 nếu UI cho)
```

**Tại sao**: Thinking model auto-fire khi prompt phức tạp = cost premium 5×. F-003 spike 5/12 events thinking = $3.10 cost (64% probe).

### 4. PM escalation chỉ khi thực sự cần

PM agent invoke = thêm 1 Task() event. Mỗi event ~$0.30. PM dùng cho judgment phức tạp (path selection, exception protocols). Nếu rule rõ → dispatcher tự handle.

### 5. Pipeline path đúng từ đầu

Path S (4 stages) cho trivial features. Path M (8 stages) cho feature có UI. Path L (12 stages) cho high-risk. **Sai path = lãng phí 4-8 stages** (~$1-3/feature).

PM xác định path post-BA dựa trên `risk-score` từ feature-brief. Đảm bảo BA produce đúng risk-score.

### 6. Tech-lead-plan có "files-to-read" list rõ ràng

Sau khi remove Active Context Bundle, dev/qa subagents tự Read file. Để giữ chúng KHÔNG free-Glob (đắt), tech-lead PHẢI list explicit:

```yaml
W1-T1:
  files_to_read:
    - src/ingest/src/health.rs
    - src/ingest/src/main.rs
  files_to_modify:
    - src/ingest/src/health.rs
```

Dev agent đọc đúng files này, KHÔNG Glob lan man.

### 7. Reuse intel artifacts

`docs/intel/_snapshot.md` (3-5K) thay vì full intel JSONs (~150K). Subagents đọc snapshot trước, escalate full JSON nếu cần.

---

## DON'T — patterns đốt tiền

### ❌ Pause-resume pattern

```
[10:00] /resume-feature RFID-F-XXX → ba stage done
[10:30] (User đi họp 30 phút)
[11:00] /resume-feature RFID-F-XXX → tech-lead stage
```

Cache TTL 5 min đã expire. Toàn bộ harness re-cache → 1.25× input cost. Lặp lại mỗi stage = $2-3 wasted.

**Fix**: Nếu phải pause, hoàn thành stage hiện tại trước. Hoặc accept rằng resumes sau pause ăn cache_write tax.

### ❌ Quit Cursor giữa pipeline

Cache reset 100%. Mọi cache_write phải pay lại. **Cost: same as fresh start.**

### ❌ Multi-tasking trong main chat

```
/resume-feature RFID-F-XXX → ba running
[cùng lúc user] /spike "ý tưởng abc"
```

Slash command khác inject context vào chat → main chat bị "ô nhiễm" → next Task() spawn carry mess. Confusion + wasted tokens.

### ❌ Bật thinking mode mid-pipeline

User đôi khi click "thinking" toggle trong Cursor UI khi thấy stage chậm. Cost: 5× per token. F-003 measurement: thinking events $0.62 avg vs composer-2 $0.32. **Default OFF, đừng bật trừ khi feature thực sự cần reasoning.**

### ❌ Mở nhiều file editor khi pipeline chạy

Cursor inject open files context vào harness. Càng nhiều file open → harness inflate → cache_read tăng. **Đóng các file không liên quan trước khi run pipeline.**

### ❌ Modify rules/agents/skills mid-session

Thay đổi `.cursor/rules/`, `.cursor/agents/`, `.cursor/skills/` khi đang có session active = cache invalidation. Nếu cần update config: quit Cursor → modify → restart → run.

### ❌ Project rule duplicate

Hiện tại ufh-rfid có:
- `~/.cursor/rules/00-agent-behavior.mdc` (alwaysApply, 5.7KB)
- `D:\Projects\ufh-rfid\.cursor\rules\00-agent-behavior.mdc` (alwaysApply, 5.7KB — likely duplicate)

→ Có thể load 2× = 3K tokens lãng phí mọi chat. Verify với `diff`, dọn 1 cái.

---

## Workflow theo từng phase pipeline

### Path S (BA → tech-lead → dev → reviewer)

Continuous burst:
```
[09:00] /resume-feature RFID-F-XXX
[09:00-09:02] BA stage (~2 min)
[09:02-09:05] tech-lead (~3 min)
[09:05-09:08] dev (~3 min, code edit)
[09:08-09:10] reviewer (~2 min)
[09:10] status: done
```

Total: ~10 min wall clock, cache stays warm cả pipeline.
Expected cost: **$1.50-2.50** post-Phase 1A+1B+2.

### Path M (8 stages, có designer + QA)

Pause point chấp nhận được:
- Sau BA (user verify spec OK)
- Sau dev wave (user verify code build/test pass)

KHÔNG pause:
- Giữa BA và SA (both reasoning stages)
- Giữa dev và QA (related artifacts)
- Giữa QA và reviewer

### Path L (high-risk, full pipeline)

Run continuously trên 1 giờ. Skill loop tự động dispatch tất cả 12 stages.

User chỉ intervene khi PM escalation hỏi.

---

## Per-day cost budget (target)

Sau optimization Phase 1A+1B+2:

| Day usage | Expected cost |
|---|---|
| 1 trivial feature (Path S) | $1.50-2.50 |
| 1 medium feature (Path M) | $4-6 |
| 1 complex feature (Path L) | $10-15 |
| Light coding (no pipeline, just chat edits) | $1-3 |

Monthly target / user (50 features mix):
- 30× Path S = $45-75
- 15× Path M = $60-90
- 5× Path L = $50-75
- **Total: $155-240/month/user**

Vs current $285 baseline = **15-45% saving**.

---

## Empirical signs cost đang BLEED

Watch these in Cursor billing CSV:

🔴 **Avg cost/event > $0.50** — likely thinking model fired
🔴 **Cache_read avg > 500K/event** — harness inflated (open files? duplicate rules?)
🔴 **Cache_write events frequent** — pause-resume pattern, cache cold on each /resume
🔴 **Total tokens/event > 1M** — long main chat history bleed

Healthy:
- ✅ Avg cost < $0.30
- ✅ Cache_read < 300K
- ✅ Cache_write rare (only first call per agent type)
- ✅ Total tokens < 500K

---

## Debugging cost spike — checklist

If feature cost > $5:

1. [ ] Check Cursor Settings → Default model = composer-2 ?
2. [ ] Thinking mode OFF in UI ?
3. [ ] Open files trong editor < 3 ?
4. [ ] Main chat fresh (vừa New Chat) ?
5. [ ] Pipeline runs continuous (<10min) ?
6. [ ] Tech-lead-plan có files_to_read explicit ?
7. [ ] No mid-pipeline slash commands ?
8. [ ] `~/.cursor/agents/` đúng 31 files (post Phase 1A) ?
9. [ ] Optional skills disable-model-invocation: true ?
10. [ ] No bundle-built telemetry events ?

Nếu tất cả OK mà vẫn >$5 → escalate, có thể Cursor 3 changed pricing hoặc bug.

---

## When to invoke `/intel-refresh`

Sau pipeline với `intel-drift: true` (dev touched RBAC/routes/schema).

Lý do: cache pipeline reuse intel JSON. Stale intel → wrong assumptions → rework cycle (2× cost).

Run `/intel-refresh` lazily (1 lần per ngày, EOD) — không sau mỗi feature.

---

## Long-term hygiene

Hàng tuần:
- Xóa branches dead, close stale features
- Clear Cursor projects cache: Settings → Storage → Clear projects
- Review `~/.cursor/agents/` còn dùng đủ không

Hàng tháng:
- Audit Cursor billing CSV — features tốn nhất + features tốn ít nhất
- Compare với target trong guide này
- Adjust workflow nếu drift

---

## Future improvements (chưa apply)

- Cursor 1h cache TTL beta (UNKNOWN — research pending)
- Project rule deduplication (Priority 3 trong synthesis)
- Dispatcher prompt re-structure để stable prefix (Priority 5)
- Path XS (3 stages) cho trivial features (cần user buy-in)

---

**This guide is empirical. Numbers from F-003/F-004/F-005 spikes 2026-05-01. Re-measure quarterly.**
