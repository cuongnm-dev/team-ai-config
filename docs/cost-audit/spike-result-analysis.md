---
parent: _state.md
spike-id: cost-audit-2026-05-01
created: 2026-05-01 (post-spike)
---

# Spike F-003 — Result Analysis

## Số liệu thực tế

### Cursor billing 01/05/2026 (spike day)

| | Value |
|---|---|
| Events | 12 (tất cả 1h, 08h UTC) |
| **Total cost** | **$4.88** |
| Total tokens | 6.28M |
| Cache hit ratio | 92% |
| Avg/event | $0.41, 524K tok |

**By model**:
| Model | Events | Cost | Note |
|---|---|---|---|
| `claude-4.6-sonnet-medium-thinking` | 5 | **$3.11 (64%)** | THINKING bật despite "auto" |
| `composer-2-fast` | 3 | $1.13 | |
| `auto` | 4 | $0.64 | |

### F-003 transcript metrics

| Metric | F-001 baseline | F-003 actual | F-003 target | ✓/✗ |
|---|---|---|---|---|
| Cursor billing | $219 | **$4.88** | <$5 | ✓ |
| Visible tokens | 1.7M total project | **140,566** | <100K | ~ |
| Task() invocations | 19 | **8** | 4-6 | ~ |
| Parent messages (max run) | 442 | 30 | <50 | ✓ |
| Avg tokens / Task() | ~40K | **~17K** | <30K | ✓ |
| Pipeline completed | yes | **yes** | yes | ✓ |
| Output quality (reviewer) | Approved | **Approved** | OK | ✓ |

## ✅ Cái GÌ work

### 1. Pipeline end-to-end OK
- 4 stages done: ba → tech-lead → dev-wave-1 → reviewer
- Reviewer verdict: Approved (0 must-fix)
- Code shipped: `health.rs` với `/health/version` endpoint + 3 unit tests

### 2. Cold-restart pattern emerged naturally
User chạy `/resume-feature RFID-F-003` **5 lần** (1 lần/stage hoặc gần đó). Mỗi lần = fresh skill execution = parent context không accumulate cross-stage. **Đây là cách I17 nên hoạt động** — không phải dispatcher long-thread.

### 3. Per-Task() prompts gọn
Trung bình 700-3,400 tokens prompt/Task(). So với F-001 baseline ~5K-40K. Subagent text response 400-1,500 tokens.

### 4. Path normalization (I16) applied
F-003 transcripts toàn dùng `d:\` lowercase. Không thấy mix với `D:\`.

## ❌ Cái GÌ KHÔNG work

### 🔴 BUG: Active Context Bundle KHÔNG được inline content

**Telemetry bảo bundle-built nhưng `bundle_chars: 0` mọi event:**
```jsonl
{"event":"bundle-built","stage":"ba","files":["_state.md","feature-brief.md"],"bundle_chars":0,"bundle_tokens_est":0}
```

**Verify trên transcripts thực**: Mỗi Task() prompt có `## Active Context Bundle` HEADER nhưng SECTION RỖNG (chỉ 27 chars, không có file content).

| Run / Stage | Total prompt | Bundle section size |
|---|---|---|
| 07717793 / dev-wave-1 | 7,943 chars | **27 chars** (header only) |
| 10a9e6e7 / dev-wave-1 | 3,911 chars | **27 chars** |
| 10a9e6e7 / reviewer | 2,805 chars | **83 chars** (chỉ 1 file marker, vẫn không content) |
| 10a9e6e7 / ba | 3,942 chars | **27 chars** |
| 10a9e6e7 / tech-lead | 3,591 chars | **27 chars** |
| ... | ... | ... |

→ **Skill log "bundle-built" event nhưng KHÔNG thực sự inline file content vào Task() prompt.** Subagents vẫn phải tự Read.

### Hệ quả: I15 chưa được test thực sự
Cost $4.88 thấp KHÔNG phải nhờ bundle. Lý do thật:
1. **Feature scope rất nhỏ**: 1 endpoint 10 lines code (vs F-001 hàng chục files)
2. **Path S** (4 stages) thay vì Path L (9+ stages với rework)
3. **Cold-restart từ /resume-feature** chạy nhiều lần (đây mới là I17 work)
4. **No SA, no QA, no security, no devops** — ít phụ thuộc artifact

Nói cách khác: chúng ta thấy chi phí giảm 97% nhưng **chỉ một phần là nhờ fixes**. Phần lớn là do feature đơn giản hơn.

### 🔴 BUG: Thinking mode bật despite "auto"
5/12 events dùng `claude-4.6-sonnet-medium-thinking` — chiếm 64% chi phí ngày ($3.11/$4.88). User để mode `auto`. Cursor 3 tự routing thinking cho complex requests.

→ **Task() không control được model selection của Cursor IDE.** Đây là Cursor 3 behavior, không phải pipeline bug.

### 🟡 ISSUE: Run 10a9e6e7 parent quá nhiều tool calls
30 messages, 58 tool calls trong 1 run:
- 19 Read, 13 Glob, 5 Task, 8 StrReplace, 4 Shell, 3 Delete, 1 Grep
- Chỉ 5 Task() — phần còn lại parent tự làm

**Nguyên nhân**: Parent ở đây là **resume-feature SKILL EXECUTOR** (chạy trong main chat), không phải dispatcher. Skill cần Read/Glob/Write để build bundle, update _state.md. Nhưng vẫn nhiều hơn cần.

## 🎯 Kết luận honest

### Spike PASS điều kiện cost target ($4.88 < $5)... NHƯNG:

**Không validate được I15 (Active Context Bundle)** vì skill chưa thực sự inline content. Cost giảm 97% là do:
- Path S vs Path L (~50% saving)
- Feature đơn giản (~30% saving)
- Cold-restart pattern (~10% saving — partial I17)
- Path normalization (~3-5% saving — I16)
- Bundle inlining: **0% (chưa apply)**

### Cần làm tiếp

**Priority 1 — FIX BUNDLE IMPLEMENTATION**:
Skill `resume-feature` Step 6.5 hiện chỉ "describe algorithm" trong prompt. Cần biến thành **executable instructions cho main agent** — đọc file thực, concat content thực, đo bytes thực.

Cụ thể: Step 6.5 hiện viết "Read file content. If file > 30KB AND not _state.md → truncate..." nhưng main agent (chạy skill) không nhận thấy đây là MANDATORY action với observable side-effect. Cần:
- Wrap thành numbered Action steps với explicit tool calls
- Telemetry chỉ ghi sau khi đã verify bundle_chars > 0
- Add validation: nếu bundle empty AND stage cần bundle → STOP với blocker

**Priority 2 — CONFIRM I15 WORTH IT**:
Sau khi fix Bundle, chạy spike thêm 1 feature **complexity tương đương F-002** (medium, M-class) với vs without bundle. So sánh cost.

**Priority 3 — THINKING MODEL**:
- Verify: có flag nào trong Cursor settings để force-disable thinking khi running pipeline không
- Hoặc accept đây là cost-of-doing-business cho pipeline complex

**Priority 4 — I18 (slim agent.md)**:
B1 research nói cross-Task cache reuse UNKNOWN. Empirical test riêng:
- Run 5 sequential `Task(dev)` với prompt giống nhau trong 1 phút
- Check CSV: cache write fires 1× hay 5×?

### Chưa cần làm vội

- I7, I8 (cleanup): vẫn relevant nhưng nhỏ
- I2 (artifact slim): defer — nếu Bundle inlining work thì artifact size không quan trọng nhiều

## Updated _state.md tracking

I15 status: **PARTIAL — infrastructure ready, content inlining BUG**
I17 status: **PARTIAL — cold-restart works via skill invocation, hard guard untested**
I16 status: **APPLIED — verified in transcripts**
