---
parent: _state.md
created: 2026-05-01
updated: 2026-05-01 (v2 — enhanced parser với tool_result size estimation)
analysis-source: parse_transcripts.py output (15 runs, 41 Task() calls trong ufh-rfid)
---

# Transcript Analysis — Bottleneck đã xác định

## Số liệu CHÍNH XÁC (parser v2)

Mỗi tool_use trong JSONL được resolve về kích thước file thực trên disk → estimate tokens injected vào agent context.

| Loại tokens | Tokens | % visible |
|---|---|---|
| Parent text + prompts | 151,827 | 8.9% |
| Parent tool results (estimated) | 592,510 | 34.7% |
| Subagent text + prompts | 120,510 | 7.1% |
| **Subagent tool results (estimated)** | **841,809** | **49.3%** |
| **TOTAL visible context** | **1,706,656** | 100% |

**🔴 KẾT LUẬN: Tool results chiếm 84% visible context. Prompts chỉ 16%.**

## Coverage check

- Visible tokens estimate: **1.7M**
- Cursor billing F-001+F-002 days: **67M tokens**
- Coverage: **2.5%**

97.5% còn lại là gì?
- **Cache reads (95% cache hit ratio)**: cùng nội dung re-loaded từ cache, billed at 0.1× nhưng vẫn count vào "Total Tokens". 41 Task() × 50K agent prompts cached = ~2M cache reads. 41 × 30K tool result re-reads = ~1.2M cache reads. Plus across runs.
- **Agent system prompts**: mỗi `.cursor/agents/{name}.md` 5-30K, reload mỗi Task() (cached after first)
- **Cursor IDE auto-context**: open files, terminal output, possibly @Codebase
- **Cache writes** (lần đầu per content): count trong "Input w/ Cache Write"

→ **Math khớp**: 2.5% visible + 95% cache reads × visible content = ~totals billed.

## 🔴 ROOT CAUSE: File read redundancy

### Top 10 files đọc đi đọc lại (sau path normalization):

| Lần đọc | File size | Tokens redundant (n-1)×size | File |
|---|---|---|---|
| **54×** | 9.4 KB | 124,152 | `_state.md` (F-001) |
| **54×** | 13.6 KB | 180,133 | `_state.md` (F-002) |
| 33× | 0.8 KB | 6,448 | `feature-map.yaml` |
| 25× | 3.1 KB | 18,630 | `src/ingest/src/main.rs` |
| 21× | 14.1 KB | 70,535 | `src/ingest/src/consumer.rs` |
| 18× | 22.5 KB | 95,548 | `04-tech-lead-plan.md` (F-001) |
| 14× | 9.0 KB | 29,227 | `src/ingest/src/config.rs` |
| 13× | 7.0 KB | 21,009 | `src/ingest/src/validate.rs` |
| 9× | 48.8 KB | 97,506 | `feature-brief.md` (F-001) |
| 9× | 23.9 KB | 47,726 | `sa/00-lean-architecture.md` (F-002) |

**Total redundant tokens chỉ riêng visible Reads: ~978,583 tokens**.

Nhân với cache miss factor + ngữ cảnh đầy đủ thực sự: dự đoán ~5-10M billed tokens là RE-READS của cùng vài chục file.

### Phân loại file bị đọc lại

**Group A — Pipeline state (small, đọc cực nhiều)**:
- `_state.md` (54× × 2 features = 108×)
- `feature-map.yaml` (33×)
- `_checkpoints.md` (15×)

→ Mỗi Task() phải đọc state để hiểu context. Sub-agent isolation buộc tự discover.

**Group B — Pipeline artifacts (medium-large, đọc 5-18×)**:
- `04-tech-lead-plan.md` (18× ×22KB)
- `feature-brief.md` (9× ×48KB)
- `ba/00-lean-spec.md` (7× ×39KB)
- `sa/00-lean-architecture.md` (6× ×31KB)

→ Mỗi sub-agent cần biết "đã thiết kế gì" trước đó.

**Group C — Source code (medium, đọc 5-25×)**:
- `main.rs`, `consumer.rs`, `validate.rs`, `config.rs`, `db.rs` etc.
- 87 Read calls trong dev stage, 32 trong QA, 20 trong reviewer

→ Đây là code thực sự agents cần biết để làm việc.

## 🚨 Bonus: agent-tools/*.txt = 64K tokens build logs

5 file Bash output từ Docker builds:
- `1b891ce0...txt`: 62,797 bytes — Docker compose build
- `3e43e14b...txt`: 56,102 bytes — Docker build
- `3b5b6fd0...txt`: 53,552 bytes — Docker build
- `abf445cb...txt`: 47,686 bytes — Docker build
- `159994b8...txt`: 38,545 bytes — Rust crate doc dump

Tổng: **64,670 tokens** Bash output đã inject vào agent context. Đây là output từ `cargo doc` và `docker compose up`. Phần lớn là noise (build progress, layer hashes).

## Top expensive Task() calls (visible portion)

| Total tok | Stage | Prompt | Resp | Tool results | Reads | Tools |
|---|---|---|---|---|---|---|
| 85,574 | qa | 1,258 | 4,266 | **80,050** | 30 | 81 |
| 68,458 | dev | 2,387 | 3,826 | **62,245** | 26 | 81 |
| 67,846 | reviewer | 988 | 12,455 | **54,403** | 20 | 31 |
| 51,558 | tech-lead | 384 | 866 | **50,308** | 13 | 20 |
| 50,597 | security | 748 | 1,371 | **48,478** | 17 | 37 |

QA single Task() = 85K tokens visible (mostly tool results). Multiply by N stages × N rework iterations × N features × cache miss ratio = millions per pipeline.

## Concrete fix proposal — I15 revised

### "Active Context Bundle" pattern

**Thay vì** subagent đọc 5-10 artifacts chung mỗi lần Task() (redundant 18-54×), **dispatcher pre-bundle** content vào Task() prompt:

```python
# In dispatcher (per Task() call):
context_bundle = read_files([
    f"{docs}/_state.md",                            # 9-13KB
    f"{docs}/04-tech-lead-plan.md",                 # 22-15KB
    f"{docs}/feature-brief.md",                     # 48-15KB
    f"{docs}/ba/00-lean-spec.md",                   # 39-18KB (if exists)
    f"{docs}/sa/00-lean-architecture.md",           # 31-23KB (if exists)
])  # ~150KB = ~37K tokens

task_prompt = f"""
## Pipeline Context
[existing 285 tokens]

## Required Context (pre-loaded — DO NOT re-read these files)
### _state.md
{state_content}

### 04-tech-lead-plan.md
{tech_lead_plan_content}

[etc.]

## Your Task
{actual_task_instruction}
"""

Task(subagent_type="dev", prompt=task_prompt)
```

**Subagent rule** (add vào agent .md):
> "FORBIDDEN: Re-Read files đã được pre-loaded trong `## Required Context` section. Chỉ Read source code mới hoặc files KHÔNG có trong bundle."

### Tiết kiệm dự kiến

**Per pipeline (F-001 scale)**:
- Group A artifacts redundant: 124K + 180K + 6K + 18K = ~330K tokens saved
- Group B artifacts redundant: 95K + 97K + 59K + 39K + 47K = ~340K tokens saved
- **Subtotal: ~670K tokens saved per pipeline**
- Multiplied by cache miss + amplification factor: probably ~5-10M billed tokens saved per pipeline

**Per month (10 features)**:
- Save 5-10M tokens × 10 features = 50-100M tokens/month
- At ~$0.5/M billed (cache mostly): ~$25-50/month savings
- **Hoặc nhiều hơn** nếu tỷ lệ rework cao

### Risk evaluation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Subagent vẫn re-Read out of habit | Medium | Strong agent prompt rule + verify in transcripts |
| Bundle quá lớn → exceed prompt limit | Low | Cap bundle ≤ 50K tokens; truncate older artifacts |
| Subagent thiếu context cần thiết | Low | Bundle gồm core artifacts; agent có thể Read source code |
| Pre-load files chưa tồn tại early stages | Low | Try-read pattern, skip missing files |

## I16 — Path normalization fix

Issue: `d:\` vs `D:\` trong tool calls không match cache.

Fix: Add to dispatcher template:
```
NORMALIZE all paths: lowercase drive letter (`d:\` not `D:\`).
```

Plus add to all sub-agent prompts. Đơn giản, low-risk.

## Updated cost driver ranking

| Rank | Driver | % | Fix Effort | Saving |
|---|---|---|---|---|
| 1 | Artifact re-read redundancy (Group A+B) | ~40% | Medium (I15 bundle) | $25-50/mo |
| 2 | Source code re-read (Group C) | ~20% | Hard (I13 — needs design) | TBD |
| 3 | Agent system prompts reload | ~15% | Low (I10 verify cache hit) | Likely already cached |
| 4 | Bash output bloat | ~5% | Easy (filter Docker output) | $5-10/mo |
| 5 | Path canonicalization (cache miss) | ~5% | Very easy (I16) | $5-15/mo |
| 6 | Parent dispatcher long thread (I11) | ~10% | Medium (cold restart) | TBD |
| 7 | Frontmatter | <1% | Defer | <$1 |

## Recommended order

1. **I15 (Active Context Bundle)** — biggest single fix. Test on 1 stage of new feature.
2. **I16 (path normalization)** — trivial, do alongside I15.
3. **Bash output filter** — sub-agent prompt rule: "When running cargo doc / docker build, redirect output, only return summary." Easy.
4. Re-measure cost after 1 feature pipeline. Decide if I13 (source code redundancy) needed.

## Open questions

- [x] **Verify**: Subagent agent.md caching. **DONE** — xem section "Cache behavior" dưới.
- [x] **Verify**: I11 — đo parent dispatcher context size. **DONE** — xem I11/I17 section.
- [ ] **Empirical test**: Chạy 5 sequential `Task(dev)` trong 1 phút trên ufh-rfid, export CSV, kiểm tra Cache Write fires 1× (cross-Task reuse OK) hay 5× (không reuse) — confirms whether I18 cost is real.
- [ ] **Implement**: I17 fix + I15 bundle, đo lại.

---

## Cache behavior (research B1 result)

**Confirmed**:
- Cursor dùng Anthropic prompt cache standard (5-min TTL, ~10× discount cache reads)
- **Within 1 Task() thread**: cache hoạt động tốt, multi-step tool calls reuse cached prefix
- **Cross-Task() reuse**: UNKNOWN — likely NO do VM isolation. Mỗi Task() spawn = "fresh VM instance" → first call pays cache-WRITE (1.25× input cost) on full system prompt + agent.md + tools

**CSV column mapping**:
| Column | Khi nào fire | Multiplier |
|---|---|---|
| `Input (w/ Cache Write)` | Lần đầu mỗi Task thread | 1.25× input |
| `Input (w/o Cache Write)` | New user-message tokens (non-cacheable) | 1× input |
| `Cache Read` | Subsequent calls within TTL same thread | 0.1× input |

**Implication CSV ufh-rfid 30/04**:
- Input w/ Cache Write: 0 (interesting — caches must have been warm from earlier)
- Input w/o Cache Write: 25,550 tokens
- Cache Read: 1,332,224 tokens
- → Most billed activity là cache reads = cùng prefix re-loaded

### 🆕 I18 — Per-Task cache-write tax on agent.md

Mỗi Task() spawn cold = pay cache-write 1.25× cost trên TOÀN BỘ system prompt + agent.md.

**Math**:
- agent.md sizes: dispatcher 35KB / dev 23KB / dev-pro ~25KB / qa 24KB / reviewer-pro 18KB / sa 22KB / ba 22KB
- avg ~23KB = ~5,750 tokens per Task spawn
- Per Path L pipeline: 19-41 Task() spawns × 5,750 tok × 1.25× = **140K-300K tokens cache-write tax / pipeline**
- Plus harness system prompt (Cursor itself, ~25-35K) × Task spawns = **~500K-1.4M tokens cache-write / pipeline**

→ **Đây là cost driver lớn**. Cross-Task reuse UNKNOWN — empirical test cần thiết.

---

## FINAL Cost driver ranking (post all research)

| Rank | Driver | Evidence | Fix | Saving |
|---|---|---|---|---|
| **1** | **I17: Dispatcher does work itself, parent context 770K** | 442 turns, 255 Reads, 256 edits, only 19 Task() | Cold-restart per stage (skill-level) | 30-50% |
| **2** | **I18: Per-Task cache-write tax** | 5K agent.md × 41 Tasks × 1.25× | Slim agent.md ≤2K | 15-30% |
| 3 | I15: Subagent re-read same artifacts | 978K redundant | Active Context Bundle | 5-15% |
| 4 | I13: Source code re-read | 87 dev Reads | Tech-lead-plan strict file list | 5-10% |
| 5 | Bash output bloat | 64K agent-tools | Filter Docker output | 2-3% |
| 6 | Path canonicalization | d:\ vs D:\ | Lowercase rule | 1-3% |

---

## 🚨 I11 + NEW I17 — Parent dispatcher context measurement (DONE)

Đo từ run `3ac87706` (F-001 main pipeline, 442 messages):

| Metric | Value |
|---|---|
| Total messages parent | 442 |
| Cumulative visible text + tool_args | **206,349 tokens** |
| File contents từ Reads (estimate) | **560,513 tokens** |
| **Final turn context** | **~770K tokens** |

### Cumulative growth per turn

| Turn | Cumulative tokens |
|---|---|
| 10 | 6,529 |
| 50 | 32,612 |
| 100 | 52,123 |
| 200 | 107,166 |
| 300 | 146,490 |
| 400 | 192,018 |
| **442** | **206,349** |

→ Linear growth, ~470 tokens/turn. By turn 200, context is already 100K. **Each subsequent turn re-tokenizes 100K+ tokens** (well above cache 5min TTL if turns slow).

### Parent's tool calls — DISPATCHER IS DOING THE WORK

| Tool | Count | Should be? |
|---|---|---|
| Read | **255** | ~10-20 (just _state.md per stage) |
| StrReplace | **199** | ~10 (just _state.md edits) |
| Glob | **83** | ~5-10 |
| Shell (Bash) | **75** | 0 (dev/qa job) |
| Write | **57** | ~5 (only _state.md) |
| Grep | **35** | 0 |
| **Task()** | **19** | should be 8-12 |
| Delete | 12 | unclear |

### 🆕 I17 — Dispatcher acts as worker, not orchestrator

**Violation of dispatcher.md own contract**. Despite explicit forbids in dispatcher.md:
> "❌ Reading ba.md/sa.md/dev.md/etc. agent definitions and 'doing the work yourself'"
> "❌ Writing to ba/00-lean-spec.md, sa/, 04-tech-lead-plan.md, 05-dev-*.md, 07-qa-report.md, 08-review-report.md"
> "❌ Implementing code, running tests, designing UIs, writing architecture"

**Reality**: Parent did 255 Reads, 256 file edits, 75 Bash calls. Only 19 Task() calls.

**Implication**: Either
- (a) dispatcher.md prompt is being ignored by Cursor (Cursor's task model "helpfully" does the work)
- (b) Pipeline currently treats dispatcher.md as advisory; user/Cursor freely override
- (c) Stage failures cause manual recovery → user/parent does the work

**Cost impact**: Parent context grows from 6K → 200K visible (+ ~560K invisible reads) = ~770K tokens at final turn. Cursor re-tokenizes this prompt every turn for parent. Even with cache hit, this is 770K cache reads per turn × 442 turns = HUGE cumulative billing.

This may be the **single biggest cost driver** — bigger than I15 subagent redundancy.

### Updated cost driver ranking (post-B2 measurement)

| Rank | Driver | Evidence | Saving estimate |
|---|---|---|---|
| **1** | **I17: Dispatcher does work itself, parent context phồng to 770K** | 442 turns, 255 Reads, 256 edits | **HIGHEST** — could save 30-50% per pipeline |
| 2 | I15: Subagent re-read same artifacts | 978K redundant reads | 5-15% |
| 3 | I11: Parent doesn't cold-restart per stage | linear context growth | covered by I17 fix |
| 4 | Source code re-read (Group C) | 87 dev Reads | 5-10% |
| 5 | Bash output bloat | 64K agent-tools txt | 2-3% |
| 6 | Path canonicalization | d:\ vs D:\ | 1-3% |
