---
parent: _state.md
created: 2026-05-01 (post F-005 + Phase 3 revert)
status: deep synthesis — mandatory read before next action
---

# Deep Synthesis — Cursor SDLC Cost Optimization Retrospective

## Câu hỏi user

> "đã làm tốt chưa, đã tối ưu hóa điểm mạnh của Cursor chưa
> workflow đã tối đa hóa cache chưa, tìm mọi cách để tránh cache miss"

Câu trả lời thẳng: **Mới làm được 60-70%. Có 4 góc chưa tối ưu, 2 trong số đó structural.**

---

## Phần 1 — Đã làm gì, kết quả thực

| Phase | Action | Measured impact |
|---|---|---|
| 1A | Move 13 doc/tdoc agents → archive | ✅ Cache_read floor: 261K → 49K min, 476K → 209K avg (F-004 probe) |
| 1B | 13 optional skills `disable-model-invocation: true` | ✅ Defensive (không đo được trực tiếp) |
| 2 | All agent.md `model: auto` + Cursor Settings → composer-2 | ✅ Thinking events 5/12 → 0/7 (eliminated $3 thinking premium) |
| 3 | Active Context Bundle inlining | ❌ **Net negative**: bundle changes per stage = cache miss → +$3 fresh input cost |
| Revert | Removed Phase 3 | Pending re-test |

### Bottom line F-005 vs F-003 (tương đương complexity):

| Metric | F-003 baseline | F-005 (with bundle) | F-005 expected (post-revert) |
|---|---|---|---|
| Total cost | $4.88 | $4.83 | **~$1.50-2.00** |
| Avg cost/event | $0.41 | $0.69 | **~$0.21** |
| Thinking events | 5 | 0 | 0 |
| Bundle inflation | 0 | 4-5K tok/event | 0 |

**Ước tính cost saving thật khi loại bundle**: 60-65% so với F-003 baseline.

---

## Phần 2 — Cursor's strengths đã tận dụng vs CHƯA

### ✅ Đã tận dụng đúng

1. **Tier routing qua dual-agent file** (không dùng model param) — đúng pattern với Cursor 3 bug 151917
2. **Subagent isolation** — Task() spawn fresh context, dispatcher không leak parent history (verified B1 research)
3. **alwaysApply discipline** — chỉ 1 rule (00-agent-behavior.mdc, 1.5K) auto-load mọi chat
4. **Skill lazy loading** (B3 research) — skills load name+description ở startup, body load on `/invoke`
5. **MCP minimal config** (mcp.json: 2 servers) — 10 plugins discovered nhưng inert
6. **Path normalization (I16)** — lowercase drive letter cho cache hit
7. **State machine via _state.md** — file-based handoff (không qua chat history)

### ❌ CHƯA tận dụng (or done WRONG)

#### 1. **Cache TTL — 5min default, có 1h beta nhưng chưa enable**

Anthropic prompt cache có 2 variant:
- 5-minute TTL (default — Cursor đang dùng)
- **1-hour TTL beta** — chậm hơn invalidate, cache hit qua span dài hơn

**Tác động**: User chạy `/resume-feature` từng stage cách nhau 5-15 phút. **Cache TTL 5 min nghĩa là stage 2 → stage 3 hầu như luôn miss**. Mỗi stage = re-cache tax.

**Action**: Investigate Cursor 3 có flag enable 1h beta không. (Anthropic: `extra-headers: anthropic-beta: prompt-caching-2024-07-31` hoặc Cursor settings).

#### 2. **Cache_write events — Cursor không cache prompt content**

F-005 data: 7 events, **icw=0 mọi event**. Nghĩa là KHÔNG có content nào cache CHO TƯƠNG LAI sử dụng.

→ Cursor 3 chỉ set cache_control breakpoints trên HARNESS (system prompt + tool defs + agent.md). Pipeline-supplied prompt content KHÔNG được cache.

**Hệ quả**: Mọi cố gắng "cache-friendly prompt design" (4-block structure, frozen header) **CHỈ benefit khi nội dung trùng với harness**, KHÔNG cho dynamic content. Cache writes chỉ xảy ra trên harness boundary.

→ **4-block design là PLACEBO** ở góc cache. Stable bytes vẫn miss vì không có cache_control marker.

**Action**: Có 2 cách verify/fix:
- Đo: parse Cursor Agent Exec.log xem có cache_control headers không
- Check: Cursor 3 có support manual cache breakpoint qua Task() param không

#### 3. **Workflow gap — User chạy 1 feature/session/30-60min**

Mỗi `/resume-feature` lần là một **fresh dispatcher session**. Cache từ session trước có thể đã expire (5min TTL). Nếu user pause chat giữa stages > 5 phút, cache tiêu hết.

F-005 timeline:
- 10:08 ba stage
- 10:14 tech-lead (6 min gap — cache có thể expire)
- 10:16 dev-wave-1 (2 min — cache còn)
- 10:20 reviewer (4 min — cache còn)

→ **Continuous burst run = max cache hit. Pause-resume pattern = max cache miss.**

**Action**: Nếu pipeline run continuous (1 session, không đứt) → cache stays warm hơn. Cần enforce ở skill level: `/resume-feature` không exit giữa stages, chạy hết queue rồi exit.

Hiện skill có `WHILE iter < 50` loop nhưng user dường như invoke nhiều lần (5-7 invocation cho F-003). Có thể vì PM escalation hoặc user kiểm tra giữa chừng.

#### 4. **Per-feature warm-up tax không amortize**

User reject "multi-feature session" (Option E). Nghĩa là mỗi feature = lần đầu cold cache. Cache_write tax (1.25× input) áp dụng lần đầu mỗi Task() call.

F-003 baseline có 5 cache_write events ($1.05 tổng). F-004 probe có 2 cache_writes ($0.43). F-005 ZERO cache writes (cache đã warm từ ngày — different pattern!).

→ Nếu user open Cursor → run feature → close → reopen ngày sau: cache reset 100%. Pay full cache_write again.

**Action**: Cân nhắc: giữ Cursor IDE open background giữa features cùng project? Cache có persist không (qua quit/reopen)?

#### 5. **Conversation history accumulation in main thread**

Mỗi `/resume-feature` invocation chạy trong user's main chat. Main chat tích lũy:
- Skill output text
- Telemetry summaries
- Status reports

Sau 5-10 features, main chat context phình. Mỗi Task() spawn từ main chat **có thể** đẩy nhiều history vào cache (need verify).

**Action**: User tạo new chat per feature? Hay periodic clear chat?

#### 6. **Project-rules 00-agent-behavior.mdc DUPLICATE**

Inventory phát hiện:
- `~/.cursor/rules/00-agent-behavior.mdc` (5,741B, alwaysApply: true)
- `D:\Projects\ufh-rfid\.cursor\rules\00-agent-behavior.mdc` (5,741B, alwaysApply: true)

**Cả 2 đều load mỗi chat = 3K tokens redundant**. Project-level override hay cộng thêm? Cần verify, có thể dọn 1 cái.

---

## Phần 3 — Cache hit / miss analysis chi tiết

### Cache HIT scenarios (làm tốt):
- Cùng agent type spawn 2 lần liên tục < 5min → agent.md cached
- alwaysApply rule giữ identical bytes → 1.5K cached
- Cursor harness (system prompt) — managed by Cursor

### Cache MISS scenarios (đang xảy ra):
1. **Stage transition** (ba → tech-lead) — different subagent_type = different system prompt = miss
2. **Pause > 5min** — TTL expire
3. **Different feature** — feature-id changes prompt, partial miss
4. **Bundle inlining changes per stage** — Phase 3 mistake, đã revert
5. **Dispatcher prompt changes per iteration** — current-stage, last-verdict change = mid-prompt difference (cache breaks ở point đó)

### Cache miss UNAVOIDABLE:
- Stage transitions (different agent.md)
- New feature (new feature-id)
- Time gaps > TTL

### Cache miss AVOIDABLE (cải thiện được):
- Pause-resume pattern → run pipeline burst
- Bundle inlining → đã revert
- Project rule duplicate → dọn
- Main chat accumulation → new chat per feature

---

## Phần 4 — Strategic recommendations (priority order)

### 🟢 Priority 1: Verify post-revert cost (MUST DO FIRST)

Run F-006 probe (giống F-005 minimal) **post-revert**:
- Same complexity (1 endpoint, Path S, 4 stages)
- Continuous burst (don't pause between stages)
- Measure: cost should drop to ~$1.50-2

If F-006 ≤ $2: Phase 1A+1B+2 confirmed. Floor identified.
If F-006 > $3: there's another issue, investigate.

### 🟡 Priority 2: Investigate Cursor 1h cache TTL

Anthropic supports cache TTL extension. Cursor có thể inherit. Test:
- Check Cursor settings or extra-headers
- If supported: enable. Could halve cost on resume-pause patterns.

### 🟡 Priority 3: Project-rule deduplication

```bash
diff ~/.cursor/rules/00-agent-behavior.mdc D:/Projects/ufh-rfid/.cursor/rules/00-agent-behavior.mdc
```
If identical: keep ONE (probably user-level). Saves 1.5K tokens/Task().

### 🟡 Priority 4: Workflow patterns

Document for users:
- **DON'T** quit Cursor between stages of same feature
- **DO** run `/resume-feature` then let it complete the queue
- **DO** clear main chat after each feature
- **DON'T** invoke other slash commands mid-pipeline (breaks cache by changing context)
- **DO** keep Cursor Settings → Default model = composer-2 stable

### 🟠 Priority 5: Restructure dispatcher prompt for stable prefix

Current DYNAMIC_SUFFIX:
```
## Current State
current-stage: {current-stage}     ← changes
iter: {iter}                        ← changes
last-verdict: {last_verdict}       ← changes
```

These changes are at FRAGMENT-level (small bytes), but cache breaks at any change. If we move them to END of prompt and keep everything before identical, cache prefix stays warm.

Possible reorganization: put the high-volatility line LAST. Dispatcher reads prompt linearly anyway.

### 🔴 Priority 6: Accept Cursor 3 floor — set realistic expectations

Empirical data: **per-event cost floor ~$0.20-0.30 with composer-2-fast**. We're at this floor for trivial features.

For 50 features × Path M (8 stages, 2-3 dispatcher iter each = ~16-24 events):
- Current ceiling: ~$5-7/feature = $250-350/tháng/user
- Optimistic floor: ~$2-3/feature = $100-150/tháng/user
- **Realistic post-optimization: ~$3-4/feature = $150-200/tháng/user**

Saving from $285 baseline: **30-50%**, not the 70% we initially projected.

### 🔴 Priority 7: Long-term — pipeline architecture changes

Considered earlier but rejected by user:
- Reduce Task() count (Option A)
- Multi-feature session (Option E)

**These are still the biggest levers untouched.** Each Cursor 3 Task() pays ~$0.20-0.30 floor. Reducing count = direct linear saving.

If/when user is open: reconsider Path XS for 80% trivial features (3 stages instead of 4-12).

---

## Phần 5 — Open questions cần verify empirical

1. **Cursor 1h cache TTL**: supported? How to enable? — needs research
2. **Cache_write trên user prompts**: Cursor 3 có set cache_control trên prompts pipeline pass không? — empirical test
3. **Project-level rule duplicate**: load 1× hay 2×? — empirical test (delete project rule, measure)
4. **Main chat history bleed**: parent thread context có inflate Task() spawn không? — measure delta giữa fresh chat vs long chat
5. **Cursor IDE open vs closed**: cache persist qua quit/reopen không? — empirical
6. **Settings → Default model = composer-2**: actually applied khi Task() có model: auto? — verified via F-005 (all events composer-2-fast ✓)

---

## Phần 6 — Summary card

### Cái rút ra:

1. **Cursor 3 có cost FLOOR cứng** ~$0.20-0.30/event với composer-2-fast — content optimization chỉ trim được trên top
2. **Cache hệ thống chỉ benefit harness** (Cursor system prompt, agent.md). Pipeline content KHÔNG được cache (no breakpoint)
3. **4-block frozen header design = placebo** ở góc cache (vẫn có lý do giữ vì readability, debug)
4. **Phase 3 bundle inlining = anti-pattern** vì variable content trong prefix region
5. **Real wins**: Phase 1A (agent prune), Phase 2 (no thinking) — đo được, structural
6. **Workflow = biggest unaddressed lever**: continuous burst run, no pause, single chat per feature

### Cái thừa nhận:

- Tôi đã design Phase 3 (bundle) sai cách — cần measure trước rollout
- 4-block cache philosophy được over-emphasize — cache không hoạt động như giả định
- Estimate ban đầu (50-70% saving) lạc quan quá — thực tế ~30-50%

### Cái cần làm tiếp:

1. **F-006 probe post-revert** → validate floor
2. **Verify 1h cache TTL** option
3. **Workflow guidelines** cho user
4. **Project rule dedup**
5. Long-term: revisit architecture options khi user sẵn sàng

---

## Final assessment

**Đã làm tốt 70%**. Các fixes work nhưng compound effect bị bundle phá hủy. Sau revert F-005, cost expected ~$1.50-2.00 cho equivalent feature = **60-65% saving thực**.

**Chưa tối ưu 30%**: chủ yếu workflow patterns + Cursor cache TTL beta + dispatcher prompt structure. Có thể đẩy thêm 10-15% saving nếu enforce burst-run pattern.

**Trần thực tế Cursor 3 SDLC**: ~$3-4/feature Path M, $150-200/tháng/user (5 user team = $750-1000/tháng). Nếu cần dưới mức này, phải thay đổi architecture (giảm Task() count) hoặc chuyển workload sang Claude API direct.
