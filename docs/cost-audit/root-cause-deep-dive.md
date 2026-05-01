---
parent: _state.md
created: 2026-05-01 (post-spike)
status: root-cause-identified
---

# Root Cause Deep Dive — Tại sao Cursor 3 đắt

## Decomposition $4.88 spike (12 events ngày 01/05)

| Component | Cost | % | Source |
|---|---|---|---|
| Cache writes (1.25× input) | $1.05 | 23% | NEW system content cached lần đầu |
| Input no-cache | $0.66 | 15% | Dynamic per-call (prompts pipeline gửi) |
| **Cache reads (0.1× input)** | **$1.71** | **38%** | **Cursor harness reused mỗi Task()** |
| Output (5× input) | $1.05 | 23% | Agent generated content |

## 🔴 ROOT CAUSE 1: Cursor harness floor 261-993K tokens/Task()

**Đo được**:
- Min cache_read: **261,120 tokens** (event $0.09)
- Avg cache_read: **476,273 tokens**
- Max cache_read: **993,287 tokens** (claude-thinking event)

→ Mỗi Task() bắt buộc load 261K-1M tokens **trước cả khi agent làm gì**. Đây là FLOOR không thể giảm bằng pipeline optimization.

## 🔴 ROOT CAUSE 2: Cursor inflate harness vì có quá nhiều plugin/skill registered

### Inventory thực tế:

| Loại | Số lượng | Kích thước |
|---|---|---|
| Custom rules (`~/.cursor/rules/`) | 8 files | 27KB total, **1× alwaysApply** = ~1.5K/Task() |
| Custom agents (`~/.cursor/agents/`) | 44 files | **617KB** total (avg 14KB/agent ~3.5K tokens) |
| Custom skills (`~/.cursor/skills/`) | **26 skills** | ~250KB total (avg 9KB/skill) |
| Plugin cache (`~/.cursor/plugins/cache/`) | varies | **3.4MB** doc/rule content |
| MCP servers configured (`~/.cursor/mcp.json`) | 2 | playwright + etc-platform |
| **MCP plugins discovered in project** | **12** | figma, gitlab, prisma×2, sentry, supabase, context7×2, playwright×2, etc-platform, nx-mcp |
| Cursor IDE log: rule load events | **48 + 89 = 137 rules** | logged at startup |
| Cursor IDE log: skill load events | **48 + 50 = 98 skills** | logged at startup |

### Vấn đề:

- 12 MCP plugins discoverable trong project — **chỉ 2 actually configured**. 10 plugins khác có thể vẫn load definitions vào harness.
- 137 rules + 98 skills tổng cộng được Cursor 3 register. Mỗi cái đóng góp prefix.
- Khi user enable nhiều plugin (figma, gitlab, prisma, sentry, supabase...) trên Cursor account, ALL of them inflate harness floor — kể cả không dùng cho project hiện tại.

## 🔴 ROOT CAUSE 3: Agent.md verbose

Top 5 agent files lớn:
- `doc-intel.md`: 39KB (~9.8K tok)
- `dispatcher.md`: **33KB (~8.2K tok)** — load mỗi Task() qua dispatcher (mỗi stage)
- `tech-lead.md`: 25.5KB (~6.4K tok)
- `qa-pro.md`: 24.5KB (~6.1K tok)
- `sa-pro.md`: 24KB (~6K tok)

Tổng 44 agents = 617KB / 4 = **~154K tokens** of agent content.

→ Mỗi Task() chỉ cần 1 agent.md (5-10K tokens). Nhưng nếu Cursor 3 pre-load ALL agent.md vào harness (tương tự skill registry) thì mỗi Task() pay ~154K tokens cache.

## 🔴 ROOT CAUSE 4: Plugin context7 trong project

Quan sát: project ufh-rfid có 2 instances `plugin-context7`:
- `plugin-context7-context7`
- `plugin-context7-plugin-context7`

Trong mcp.json chỉ `playwright` + `etc-platform`. Cursor 3 tự install context7 vào project. Các tool description từ context7 inject vào harness.

## Đối chiếu observed vs estimated

```
Estimated harness floor (best case):
  Cursor system prompt: 25K tok
  Built-in tool schemas: 5-10K tok
  Subagent agent.md: 5-10K tok
  alwaysApply rule: 1.5K tok
  + 2 MCP servers tools: 5-10K tok
  TOTAL minimum: ~50-65K tokens

Observed minimum cache_read: 261,120 tokens (5×-10× estimated)
```

**Gap 200-450K tokens** giữa estimate và observed → từ:

1. **Plugin/skill registries auto-load** (figma, gitlab, prisma, etc.) — confirmed: 12 plugins in project mcps/, only 2 in config
2. **Multi-rule registries** — 89 plugin rules + 48 local rules = 137 entities
3. **All ~/.cursor/agents/ pre-loaded** — 154K tok possible
4. **All ~/.cursor/skills/ pre-loaded** — 62K tok possible
5. **Cursor IDE workspace state** — open files, terminal buffer, conversation cache

## Kế hoạch hành động — ROOT CAUSE FIX

### 🎯 Phase 1 — DISABLE THỪA (highest expected ROI)

**1A. Disable unused MCP plugins**:
Xóa từ Cursor settings (Settings → MCP) hoặc từ `~/.cursor/mcp.json`:
- ❌ figma (nếu không dùng Figma cho project)
- ❌ gitlab (nếu dùng GitHub không dùng GitLab)
- ❌ prisma (cả Local + Remote — nếu không dùng Prisma)
- ❌ sentry (nếu chưa setup error tracking)
- ❌ supabase (nếu không dùng Supabase)
- ✅ Giữ: playwright (cần cho QA), etc-platform (cần cho doc-gen MCP), context7 (optional, có thể giữ 1 instance)

**1B. Disable unused skills**:
Skills không dùng cho SDLC pipeline — disable từ Cursor:
- ❓ Audit list 26 skills, mark each "essential" or "optional"
- Disable optional → dropdown từ 26 → ~12 essential

**1C. Force composer-2** (per user direction Option D):
- Hiện thinking mode firing 5/12 events = 64% cost
- Cần force model qua Task() parameter HOẶC settings

### 🎯 Phase 2 — FIX BUNDLE (đã hứa từ Option C)

**2A. Bundle inlining ACTUAL implementation**:
Skill `resume-feature` Step 6.5 hiện chỉ describe — không execute. Cần:
- Convert thành numbered Action steps with explicit Read tool calls
- Add bundle_chars > 0 validation gate
- Block Task() invocation nếu bundle empty

**2B. Empirical cache test**:
- Run 5 sequential `Task(dev)` trong 1 phút trên 1 project
- Check CSV: cache write fires 1× hay 5×
- Confirm cross-Task cache reuse hypothesis

### 🎯 Phase 3 — SLIM CONTENT (defer until Phase 1+2 measured)

**3A. Slim agent.md** (per user keeping multi-Task philosophy):
- dispatcher.md: 33KB → target <10KB
- ba.md/sa.md/dev.md/qa.md/reviewer.md: 20-25KB → target <8KB each
- Move chi tiết examples sang `ref-*.md` (load on-demand)

**3B. Active Context Bundle effective format**:
Hiện format prose-style. Test xem JSON-compact có giảm tokens không.

### 🚫 Đã loại

- **Option E (multi-feature session)**: User reject — 1 user 1 feature
- **Option A (giảm Task() count)**: User reject — giữ multi-Task philosophy
- **Doc-gen via Cursor**: Bỏ rồi, đã chuyển sang MCP etc-platform (Claude side)

## Expected savings — realistic

Nếu apply Phase 1 + 2:

| Fix | Saving estimate | Confidence |
|---|---|---|
| Disable 8/12 plugins | -100K to -300K tok cache_read floor | HIGH |
| Force composer-2 (no thinking) | -60% cost (thinking $1.15/event vs composer-2 $0.32) | HIGH |
| Bundle inlining (real) | -30K visible reads/Task() | MEDIUM (depends on impl) |
| Disable unused skills | -50K to -100K tok | MEDIUM |

**Combined Phase 1+2**: F-003-equivalent feature có thể giảm $4.88 → **$1.50-2.50** = saving 50-70%.

50 features × Path M sau optimization: **~$80-130/tháng/user** (vs current $285).

## Câu hỏi cần verify trước khi rollout

1. **Có cách nào trong Cursor settings để see "tokens per harness"?** Cần đo trước/sau fix để confirm.
2. **Disable MCP plugin có persist qua Cursor restart không?** Hay reset.
3. **Cursor 3 có flag bypass thinking mode default không?** Hoặc Task() parameter `model: "composer-2"` có override "auto"?
4. **Skills dùng cho SDLC essential** vs optional — cần user confirm list để disable đúng.

---

## Action plan ngắn gọn (cho user approve)

1. **Tôi ghi script audit** — list MCP plugins, skills, rules → user xem và mark "keep/disable"
2. **Disable theo list** — manual via Cursor UI hoặc edit config files
3. **Empirical floor measurement** — 1 minimal Task() trước/sau, confirm reduction
4. **Force composer-2** — modify resume-feature skill + dispatcher Task() params
5. **Fix bundle inlining** — real implementation
6. **Run F-004 spike** — same complexity as F-003, đo lại
7. **Compare** F-003 vs F-004 → quantify savings của Phase 1+2

ETA: ~2-3h work + 1 spike run.
