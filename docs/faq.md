---
title: FAQ — Câu hỏi thường gặp
order: 91
---

# FAQ

Câu hỏi thường gặp khi dùng ai-kit. Nếu vấn đề không được giải, chạy `ai-kit doc troubleshooting` hoặc mở issue.

---

## Mục lục

```
1.  CÀI ĐẶT             1.1 Bắt đầu thế nào    1.2 Node.js?       1.3 Docker?
2.  SỬ DỤNG HẰNG NGÀY   2.1 Update?            2.2 Skill nào?     2.3 Cursor hay Claude?
                        2.4 Lệnh thường dùng   2.5 Resume?
3.  CẤU HÌNH            3.1 File ở đâu?        3.2 Sửa local?     3.3 Local changes?
4.  MCP                 4.1 MCP là gì?         4.2 Không start?   4.3 Version nào?
5.  CHỌN TÌNH HUỐNG     5.1 4 tình huống       5.2 Mix skill?     5.3 Output khác nhau?
                        5.4 Bắt đầu từ ý tưởng
6.  QUY ƯỚC             6.1 Naming F-NNN       6.2 Tiếng Việt/Anh 6.3 source-type values
7.  HIỆU NĂNG           7.1 Sao tốn token?     7.2 Parallel?      7.3 Token Luồng C?
8.  ĐÓNG GÓP            8.1 Skill mới          8.2 Báo bug
9.  LUỒNG C (/from-idea)
                        9.1 Khi nào dùng       9.2 4 spirals      9.3 Pre-mortem
                        9.4 Resume liền mạch   9.5 Idea graveyard 9.6 _idea/ vs feature-brief
                        9.7 Thinking partner   9.8 Confidence
10. CONTINUITY/COHERENCE/IDEA LIFECYCLE
                        10.1 decisions[] log   10.2 Recap ledger  10.3 Cascade refresh
                        10.4 Coherence flags   10.5 PRFAQ north-star
                        10.6 Resurrect protocol
```

---

## 1. Cài đặt

### 1.1 Tôi mới vào team — bắt đầu thế nào?

Chạy bootstrap one-liner:

```bash
# macOS / Linux
curl -sL https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.sh | bash

# Windows (PowerShell)
irm https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.ps1 | iex
```

Bootstrap kiểm tra môi trường, clone repo, deploy agents/skills, start MCP. Sau đó mở terminal mới rồi chạy `ai-kit status`.

### 1.2 Tôi cần Node.js? Tại sao?

`ai-kit` CLI viết bằng Node + Ink (React-for-terminal). Cần Node ≥ 18. Bootstrap có thể tự cài qua `winget` (Windows), `brew` (macOS), `apt`/`dnf`/`pacman` (Linux). Thêm flag `--auto-install`.

### 1.3 Có thể không dùng Docker không?

Không — `etc-platform` MCP chạy như Docker container. Đó là cách team đảm bảo mọi người có cùng phiên bản render engine + templates.

---

## 2. Sử dụng hằng ngày

### 2.1 Khi nào tôi cần `ai-kit update`?

Khi có thông báo từ team rằng có config mới. Hoặc cứ chạy 1 lần mỗi sáng — lệnh nhanh, idempotent.

### 2.2 Khác biệt giữa `from-doc` / `from-code` / `from-idea` / `new-feature` / `resume-feature`?

| Skill | Input | Output | Khi nào |
|---|---|---|---|
| `from-doc` | SRS/BRD (PDF/DOCX) | Seed canonical intel | Có tài liệu nhưng chưa có code |
| `from-code` | Codebase | Canonical intel đầy đủ | Có code nhưng tài liệu thiếu |
| `from-idea` | Phỏng vấn 4 spirals | Seed intel + workshop docs | Greenfield — chỉ có ý tưởng (Luồng C) |
| `new-feature` | Câu trả lời phỏng vấn | F-NNN/_state.md | Thêm 1 feature vào project có sẵn |
| `resume-feature` | F-NNN có sẵn | Code + tests + reports | Tiếp tục feature dở |

Catalog đầy đủ: `ai-kit doc skills`. Decision matrix: `ai-kit doc on-board`.

### 2.3 Tôi nên dùng Cursor hay Claude Code?

| Mục đích | Công cụ |
|---|---|
| Phân tích tài liệu lớn (SRS 200 trang) | Claude Code (`/from-doc`) |
| Brainstorm có cấu trúc từ ý tưởng | Claude Code (`/from-idea`) |
| Code feature mới | Cursor (`/resume-feature`) |
| Review code | Cursor (agent reviewer) |
| Sinh Office files nghiệm thu | Claude Code (`/generate-docs`) |
| Reverse-engineer codebase | Claude Code (`/from-code`) |
| Soạn Đề án CĐS / HSMT | Claude Code (`/new-strategic-document` hoặc `/new-document-workspace`) |

Triết lý: Claude cho **batch + production**, Cursor cho **iterative coding**.

### 2.4 Lệnh ai-kit thường dùng nhất?

```bash
ai-kit               # menu interactive (top-level)
ai-kit update        # pull config mới
ai-kit status        # version + counts + MCP health
ai-kit doc           # mở docs hub interactive
ai-kit doc on-board  # wizard 4 tình huống
ai-kit doctor        # chẩn đoán môi trường
ai-kit mcp start     # bật MCP container
ai-kit !!            # re-run lệnh trước
```

### 2.5 Tôi tạm dừng giữa chừng — quay lại tiếp tục thế nào?

Mỗi skill có cơ chế resume riêng:

| Skill | Resume |
|---|---|
| `/from-doc` | Tự detect `_pipeline-state.json` trong `docs/intel/` |
| `/from-code` | Tự detect (có warm-start MCP) |
| `/from-idea` | Phase 0.0 Resume Detection — 4 lựa chọn (Resume / Restart / Rewind to Spiral X / View digest) + time-aware recap |
| `/resume-feature` | Đọc `_state.md`, dispatch stage tiếp theo |
| `/new-strategic-document` | `/resume-document` — đọc `_strategy_state.md` |
| `/new-document-workspace` | `/resume-document` — đọc `_doc_state.md` |

Đặc biệt `/from-idea` có "time-aware recap": < 24h light recap, 24h–7d full recap, > 7d mandatory vision-check.

---

## 3. Cấu hình

### 3.1 Vị trí các file?

```
~/.ai-kit/
  ├─ team-ai-config/    # repo (git pull về đây)
  └─ bin/               # ai-kit launcher

~/.claude/
  ├─ agents/            # deploy từ repo claude/agents/
  └─ skills/            # deploy từ repo claude/skills/

~/.cursor/
  ├─ agents/            # deploy từ repo cursor/agents/
  └─ skills/            # deploy từ repo cursor/skills/
```

### 3.2 Tôi tự sửa file trong `~/.claude/agents/` được không?

**Không nên** — lần `ai-kit update` tiếp theo sẽ ghi đè. Nếu muốn customize:

1. Sửa trong repo: `~/.ai-kit/team-ai-config/claude/agents/...`
2. Chạy `ai-kit pack` để snapshot vào repo
3. Chạy `ai-kit publish "<msg>"` để push lên team (nếu là maintainer)
4. Hoặc tạo PR lên repo

### 3.3 `ai-kit update` báo "Local changes detected"?

Repo `~/.ai-kit/team-ai-config/` có thay đổi chưa commit. Hai lựa chọn:

```bash
# Bỏ thay đổi local, pull mới (mất sửa của bạn)
ai-kit reset

# Hoặc giữ thay đổi
git -C ~/.ai-kit/team-ai-config stash push -u
ai-kit update
git -C ~/.ai-kit/team-ai-config stash pop
```

---

## 4. MCP

### 4.1 MCP là gì? Tại sao cần Docker?

MCP (Model Context Protocol) là server chứa render engines (DOCX/XLSX) + templates + outline registry + KB. Team đóng gói thành 1 Docker image (`o0mrblack0o/etc-platform:latest`) để mọi người có cùng phiên bản. Image multi-arch (amd64 + arm64), Mac M1/M2 chạy native.

### 4.2 MCP không khởi động được?

```bash
ai-kit doctor       # check Docker daemon
ai-kit mcp pull     # tải image mới
ai-kit mcp start    # docker compose up -d
ai-kit logs         # xem lỗi
```

### 4.3 Tôi cần MCP version nào?

`ai-kit status` hiển thị `MCP image`. Mặc định `:latest`. Maintainer tag cụ thể trong `mcp/etc-platform/.env` của repo.

---

## 5. Chọn tình huống công việc

### 5.1 Tôi đang ở tình huống nào? (4 tình huống)

| Tôi có gì? | Tình huống | Skill bắt đầu | Onboarding |
|---|---|---|---|
| 📄 SRS/BRD .docx | Sản xuất phần mềm — có tài liệu | `/from-doc` | `on-board-sdlc` |
| 💻 Codebase đã ship | Sản xuất phần mềm — có code | `/from-code` | `on-board-sdlc` |
| 💡 Chỉ có ý tưởng (greenfield) | Sản xuất phần mềm — Luồng C | `/from-idea` | `on-board-idea` |
| 🏛 Yêu cầu hành chính (Đề án CĐS, hồ sơ thầu, NCKT, dự toán) | Soạn tài liệu nhà nước | `/new-strategic-document` hoặc `/new-document-workspace` | `on-board-tailieu` |

3 tình huống đầu (📄 💻 💡) → cùng pipeline SDLC. Tình huống thứ 4 (🏛) → pipeline Tài liệu nhà nước hoàn toàn khác.

Quick start interactive: `ai-kit doc on-board` — wizard sẽ hỏi tình huống của bạn.

### 5.2 Có thể mix skill giữa SDLC và Tài liệu nhà nước không?

**Không**. Skill 2 luồng có schema input/output khác nhau:

- `/strategic-critique` cho code review → sẽ flag toàn bộ vì kỳ vọng văn bản hành chính. Dùng `/quality review` thay.
- `/from-code` cho Đề án CĐS → đọc codebase không liên quan. Dùng `/new-strategic-document` thay.
- `/generate-docs` cho HSMT → output bộ 5 file phần mềm, không phải 1 Word độc lập. Dùng `/new-document-workspace` thay.

3 entry-points trong SDLC (`/from-doc`, `/from-code`, `/from-idea`) **đều cùng intel layer** — chia nhau write theo precedence. OK to chain.

### 5.3 Output các tình huống khác nhau thế nào?

| Tình huống | Output bước cuối | Vị trí | State file |
|---|---|---|---|
| 📄 from-doc → SDLC | Bộ 5 Office files (TKKT, TKCS, TKCT, HDSD, test-cases) | `docs/generated/{slug}/output/` | `_state.md` per feature |
| 💻 from-code → SDLC | Same | Same | Same |
| 💡 from-idea → SDLC | Same (sau khi qua SDLC) | Same | `_state.md` (source-type: idea-brainstormed) |
| 🏛 Tài liệu nhà nước | 1 file Word độc lập (Đề án/NCKT/HSMT/HSDT/dự toán) | `<slug>-vN.docx` rời | `_doc_state.md` hoặc `_strategy_state.md` |

### 5.4 Tôi chỉ có ý tưởng — bắt đầu thế nào?

Đó là Luồng C. Pipeline `/from-idea`:

```bash
mkdir my-startup && cd my-startup
/from-idea
# → 4 spirals (PRFAQ → Impact Map → Event Storming → Story Map)
# → Phase 4.5 pre-mortem (mandatory)
# → Phase 5 crystallize (4 intel artifacts + per-feature _state.md)
# → ~1.5-3h, có thể chia nhiều session
```

Sau Phase 6 handoff: `/resume-feature F-001` (Cursor) — Cursor SDLC nhận bàn giao.

Chi tiết: `ai-kit doc on-board-idea` (role-based onboarding) hoặc `ai-kit doc from-idea` (workflow chi tiết).

Câu hỏi sâu hơn về Luồng C: xem **Section 9** dưới.

---

## 6. Quy ước

### 6.1 Naming convention cho features?

- **Mini-repo**: `F-001`, `F-002`, ...
- **Monorepo**: `<service>-F-001`, ví dụ `auth-F-001`

ID **bất biến** sau khi commit (CD-19). 3 entry-points (`from-doc`/`from-code`/`from-idea`) đều dùng cùng convention.

ID issuance: first producer issues. Subsequent producers reuse via lookup `feature-catalog.json` + `feature-map.yaml` + glob `{features-root}/F-*/`.

### 6.2 Tiếng Việt hay tiếng Anh?

| Vị trí | Ngôn ngữ |
|---|---|
| Giao tiếp với LLM | Tiếng Việt |
| Nội dung tài liệu hành chính | 100% tiếng Việt |
| Agent/skill prompts (frontmatter, body) | Tiếng Anh (token economy) |
| Output content examples | Có thể tiếng Việt |
| User-facing CLI strings printed back to user | Tiếng Việt |
| Tên sản phẩm, mã chuẩn | Giữ nguyên (PostgreSQL, ISO 27001) |

Quy tắc CD-9 trong `~/.claude/CLAUDE.md`.

### 6.3 `source-type` trong `_state.md` có những giá trị nào?

CD-20 quy định 4 giá trị (mỗi entry-point 1 giá trị):

| Source-type | Producer | Khi nào dùng |
|---|---|---|
| `SRS` / `BRD` / `user-input` | `/from-doc` | Có tài liệu |
| `code-reverse-engineered` | `/from-code` | Có codebase |
| `idea-brainstormed` | `/from-idea` | Greenfield (Luồng C) |
| Same as above | `/new-feature` | Inherit từ context |

Cursor `resume-feature` đọc `source-type` để route stage agents phù hợp (vd `ba` agent biết feature này có rich context từ 4 spirals nếu source-type là `idea-brainstormed`).

---

## 7. Hiệu năng + chi phí

### 7.1 Sao Claude tốn nhiều token?

Skills lớn (`from-doc`, `from-code`) đọc cả codebase. Tip:

- Dùng `--rerun-stage N` thay vì re-discover toàn bộ
- Tin canonical intel khi FRESH (`_meta.json.stale: false`)
- Không re-fetch khi đã có (CD-10 quy tắc 9 — Reuse-first mandate)

### 7.2 `resume-feature` có thể chạy song song nhiều feature?

**Không khuyến khích**. Mỗi feature dùng `_state.md` riêng nhưng share canonical intel. Chạy song song dễ race condition. Nếu thật sự cần, mở terminal khác và đảm bảo các feature không touching cùng intel artifact.

### 7.3 Luồng C (`/from-idea`) có tốn token không?

Có nhưng được cân bằng qua thiết kế:

| Phase | Token đặc trưng | Tối ưu |
|---|---|---|
| Phase 0 Bootstrap | < 1K | MCP warm-start optional, fallback graceful |
| 4 Spirals (~30-45 phút mỗi) | ~5-10K mỗi spiral | Recap header dùng `decisions[]` ngắn gọn, không repeat workshop content |
| Phase 4.5 Pre-mortem | ~3-5K | 1-shot pass, không iteration |
| Phase 5 Crystallize | ~10-15K | Validator + merger gọi 1 lần |
| Phase 6 Handoff | ~2K | Summary ngắn |

**Total**: ~50-75K tokens cho 1 dự án 6-10 features (so với từ-doc 30-50K, từ-code 60-100K). Tradeoff: tốn hơn từ-doc 1 chút nhưng có **thinking partner doctrines + pre-mortem + idea-graveyard** bù lại.

**Sub-agent tham gia**: chỉ 1 mandatory (`intel-validator`), 2 conditional (`intel-merger`, `policy-researcher`). Lightweight so với `generate-docs` (5+ tdoc agents parallel).

`feature-brief.md` được enrich (v0.27) với Vision Context — Cursor SDLC stage agents có đủ context, không cần lazy-read `_idea/*.md` → tiết kiệm token downstream.

---

## 8. Đóng góp

### 8.1 Tôi muốn thêm 1 skill mới?

Xem `ai-kit doc contributing`. Tóm tắt:

1. Tạo branch
2. Viết SKILL.md (frontmatter + body markdown)
3. Test với `ai-kit pack` trên máy local
4. PR + reviewer phê duyệt

### 8.2 Tôi tìm bug — báo ở đâu?

GitHub issue ở https://github.com/cuongnm-dev/team-ai-config. Kèm output `ai-kit doctor` + `ai-kit version`.

---

## 9. Luồng C — `/from-idea` brainstorm

Tham khảo: `ai-kit doc on-board-idea` (role-based onboarding) + `ai-kit doc from-idea` (workflow chi tiết).

### 9.1 Khi nào dùng `/from-idea`?

Khi anh/chị **chỉ có ý tưởng** — chưa có SRS/BRD, chưa có codebase. Đối tượng: founder/PM/product owner/internal-tool ideator.

| Anti-trigger | Dùng thay |
|---|---|
| Có SRS/BRD đầy đủ | `/from-doc` (Luồng A — đỡ tốn brainstorm) |
| Có codebase đã ship | `/from-code` (Luồng B — extract chính xác hơn) |
| Thêm 1 feature vào project có sẵn | `/new-feature` (Cursor) |
| Soạn Đề án CĐS / hồ sơ thầu | `/new-strategic-document` hoặc `/new-document-workspace` (Luồng tài liệu, không phải SDLC) |

### 9.2 4 spirals là gì? Bắt buộc làm cả 4?

| Spiral | Workshop | Output | Thời gian |
|---|---|---|---|
| 1. PRFAQ | Amazon Working Backwards (Press Release + 5 FAQ + 3 critical assumptions) | `_idea/idea-brief.md` | ~30 phút |
| 2. Impact Mapping | Gojko Adzic (Goal → Actors → Impacts → Deliverables + DEDUP gate) | `_idea/impact-map.md` + `_idea/dedup-report.md` | ~45 phút |
| 3. Event Storming | Brandolini DDD light (adaptive depth Light/Heavy) | `_idea/event-storming.md` | ~20-60 phút |
| 4. Story Mapping | Patton (backbone → walking skeleton → release slices + TC seeds) | `_idea/story-map.md` + `test-evidence/F-NNN.json` | ~45 phút |

**Bắt buộc cả 4** — pipeline mandatory. Spiral 3 có "adaptive depth" (Light vs Heavy) tùy domain complexity (skill heuristic + ask user nếu mơ hồ).

### 9.3 Phase 4.5 pre-mortem có bắt buộc không?

**Có, bắt buộc**. 2 câu hỏi mandatory:

1. *"Tưởng tượng 1 năm sau dự án FAIL — 3 lý do hàng đầu?"*
2. *"Tưởng tượng 1 năm sau dự án THÀNH CÔNG — bằng cách nào?"*

Lý do thiết kế: brainstorm-only workflow dễ rơi vào **optimism bias**. Pre-mortem là cheapest critical-thinking pass break the bias. Risks propagate vào `feature-catalog.features[].risks[]`.

Có thể `--skip-premortem` flag nhưng sẽ logged + audit + flag mọi feature `[CẦN BỔ SUNG: pre-mortem skipped]`.

### 9.4 Resume sau session đứt quãng?

Phase 0.0 Resume Detection tự động kích hoạt khi gọi `/from-idea` lần thứ 2:

```
🕒 Bạn quay lại sau {gap}.
📌 Vision (PRFAQ): "{idea-brief.headline}"
🎯 Win condition: "{success_metric}"

Đã chốt: {decisions[].active count}
Đang dở: Spiral N iteration M

Lựa chọn:
  🟢 Tiếp tục (Resume)
  🔄 Bắt đầu lại (Restart fresh — backup .bak/)
  ⏮ Rewind to Spiral X (cascade refresh)
  📜 Xem digest
```

Time-aware recap:
- < 24h: light recap (3-bullet)
- 24h–7d: full recap (đọc `recap_ledger[-1]`)
- > 7d: mandatory vision-check ("Bạn còn solid với vision không?")

State persist tại `docs/intel/_pipeline-state.json` + `decisions[]` immutable log + `recap_ledger[]` snapshots.

### 9.5 Idea graveyard là gì?

File `{features-root}/_idea/idea-graveyard.md` — append-only log mọi ý tưởng bị loại trong 4 spirals. Mỗi entry có:

```markdown
## G-NNN — {idea title}
- Spiral: 1|2|3|4|4.5
- Captured at: {ISO}
- Reason for rejection: {DEDUP-reject | scope-creep | risk-too-high | user-changed-mind | ...}
- Resurrect-trigger: {context shift would make this relevant again}
- User-confidence in rejection: {pct}%
```

Resurrect: `/from-idea --resurrect <G-NNN>` revive ý tưởng. Skill confirm context changed, integrate vào current spiral, log vào `decisions[]`.

Mục đích: **không bao giờ mất ý tưởng**. Post-MVP backlog mining có thể dùng graveyard để discover next-iteration features.

### 9.6 Cursor SDLC có đọc `_idea/` không?

**Mặc định KHÔNG**. `_idea/*.md` là workshop docs ở workspace level (1 folder shared, không per-feature). Cursor stage agents (ba/sa/dev/qa/reviewer) đọc:

- `_state.md` (current status, feature-req)
- `feature-brief.md` (primary feature-req — đã digest từ workshop)
- `feature-catalog.json#features[id]` (canonical)
- `actor-registry.json`, `permission-matrix.json`, `sitemap.json` (intel layer)

`feature-brief.md` được **enrich** (v0.27) self-contained:
- `## Vision Context` (digest từ PRFAQ — headline + persona + win condition + 3 critical assumptions)
- `## This Feature's Role in Vision`
- `## Domain Context` (aggregate ownership từ event-storming)
- `## Risks` (full table từ pre-mortem)
- `## Critical Assumptions` (feature-level + project-level)
- `## Source Spirals` (pointers cho lazy traversal khi cần)

Stage agents có thể **lazy-read** `_idea/*.md` qua "Source Spirals" pointers nếu cần deep rationale (vd `ba` muốn xem dedup verdict đầy đủ → đọc `_idea/dedup-report.md` § entry).

`_idea/` consumers chính:
- User (manual review)
- `/from-idea` Phase 0.0 Resume + recap_ledger
- `/from-idea --resurrect`
- Audit trail (compliance)

### 9.7 "Thinking partner" doctrines là gì?

6 doctrines bắt buộc trong mọi spiral — biến skill từ "voice recorder" thành "partner phản biện":

| Doctrine | Khi áp dụng | Mục đích |
|---|---|---|
| **B1 Echo + paraphrase** | Sau mỗi câu trả lời ≥ 30 chars | Lộ diễn đạt mơ hồ, confirm intent |
| **B2 Generative alternatives** | Trước commit hướng (vision approach, deliverable, MVP cut, BC grouping) | Force articulate "vì sao chọn X" thay vì "yes-and" |
| **B3 Multi-perspective stress test** | Gate G2 (light) + G4 (full 3 góc: engineer/end-user/CFO) | Lộ tradeoff bị che |
| **B4 Assumption surfacing** | Spiral 1 Step 1.4 + Phase 4.5 Step 4.5.5 | Lộ giả định ngầm, force verifiable specifics |
| **B5 Quantitative scaffolding** | Mọi quyết định lượng (user count, KPI, effort, story points) | Convert "vibes" thành "evidence" (Fermi estimate) |
| **B6 Confidence calibration** | Sau mỗi quyết định lớn | < 50% → trigger `[NEEDS-VALIDATION]` flag |

Total: ≥ 24 mandatory touchpoints xuyên suốt pipeline. Cấm "yes-and" responses.

### 9.8 Confidence calibration là gì? Khi nào trigger `[NEEDS-VALIDATION]`?

Sau mỗi quyết định lớn, skill hỏi: *"Bạn confident bao % rằng `{statement}` đúng / sẽ work?"*

| Confidence | Action |
|---|---|
| ≥ 80% | Log as-is, no flag |
| 50-80% | Log + suggest verification step trong Phase 4.5 risk register |
| < 50% | **Mandatory `[NEEDS-VALIDATION]` flag** trong `decisions[]` + propagate vào `feature-catalog.features[].validation_flags[]` |

Phase 6 Handoff sẽ surface count `[NEEDS-VALIDATION]` items như "open validation work before SDLC". Mục đích: honest về uncertainty thay vì giả định mọi thứ chắc chắn.

---

## 10. Continuity + Coherence + Idea Lifecycle

3 cơ chế đặc biệt của `/from-idea` cho brainstorm dài hơi (có thể chia nhiều session, đôi khi đổi ý). Tham khảo: `ai-kit doc on-board-idea` § Section 4.

### 10.1 `decisions[]` immutable log là gì?

Trong `_pipeline-state.json`, mỗi quyết định lớn được ghi với 4-field rationale:

```json
{
  "id": "D-NNN",
  "spiral": "s1|s2|s3|s4|4.5",
  "topic": "vision|actor|deliverable|event|aggregate|priority|risk|assumption",
  "value": "{decision text}",
  "why": "{1-2 sentence rationale}",
  "considered_alternatives": ["{alt 1}", "{alt 2}"],
  "confidence_pct": 75,
  "assumptions": ["{precondition 1}"],
  "status": "active|superseded|rolled-back",
  "timestamp": "{ISO}"
}
```

**Append-only** — không xóa, chỉ mark `superseded` hoặc `rolled-back`. Lý do: future re-evaluation cần biết "tại sao chọn X tại thời điểm Y" — context có thể đã đổi.

### 10.2 Recap ledger là gì?

`_pipeline-state.json#recap_ledger[]` — snapshot context cuối mỗi spiral. Khi user resume sau 7+ ngày, skill đọc `recap_ledger[-1].snapshot` để render full recap, giúp user "cold-start" lại context nhanh.

```json
{
  "at_spiral": "s2",
  "captured_at": "{ISO}",
  "snapshot": "Spiral 1 (PRFAQ): vision='X', target='Y', win='Z'. Spiral 2 in progress: 3 actors enumerated, 5 deliverables drafted (DEDUP pass: 3 UNIQUE / 1 ADOPT-NDXP / 1 EXTEND)."
}
```

### 10.3 Cascade refresh khi rewind là gì?

Khi user pick "⏮ Rewind to Spiral X" (X < current):

1. Mark Spiral X..current là `status: rerun-needed`
2. Decisions từ Spiral X+1 trở đi → `status: rolled-back` (preserve, không xóa)
3. Workshop docs `_idea/spiral-{X..current}.md` → move vào `_idea/.history/{spiral}-{ISO}.md`
4. Subsequent spirals MUST re-derive từ new Spiral X output (không copy old content)

Cascade refresh **bắt buộc** — vì Spiral X output đã đổi, dependent decisions không còn trustworthy.

Compare-mode: sau khi rerun, skill offer side-by-side diff với `.history/` version để user nhận biết unintended drift.

### 10.4 Coherence flags là gì? Khi nào surface?

3 trigger:

1. **PRFAQ north-star check** — cuối Gate G2/G3/G4: *"Output spiral còn align với vision PRFAQ + win condition không?"*
2. **Inter-spiral semantic compare** — start G3 + G4: 6 rule check (vd G3-R1: actor trong event-storming phải có trong actor-registry seed; G4-R3: PRFAQ.target_users ⊆ story-map roles)
3. **Phase 5 semantic audit** — 5 rule cuối (orphan role, orphan feature, persona consistency, MVP ancestry, aggregate reference)

Khi flag → present **Reconciliation menu** 3 paths:
- (a) Edit Source A (rewind to prior spiral)
- (b) Edit Source B (current spiral, align with prior)
- (c) Accept conflict với explicit caveat trong `_idea/coherence-log.md`

Caveat propagate vào `feature-catalog.features[].coherence_notes[]` để traceability.

### 10.5 PRFAQ as north star nghĩa là gì?

Spiral 1 PRFAQ output = **immutable anchor** cho 3 spiral còn lại. Mọi Gate G2/G3/G4 hỏi *"Output spiral này còn align với PRFAQ vision không?"* trước khi confirm.

Lý do: PRFAQ định nghĩa **win condition** — nếu Spiral 4 MVP cut không serve win condition, đó là scope drift. North-star check phát hiện sớm.

Nếu user muốn change PRFAQ giữa chừng → rewind to Spiral 1 (cascade refresh áp dụng).

### 10.6 Resurrect protocol cho idea-graveyard?

Cách 1 (manual): `/from-idea --resurrect G-NNN`

Cách 2 (auto-detect): khi user mention idea name match graveyard entry (Levenshtein), skill prompt: *"Mình thấy `{title}` đã ở graveyard (G-NNN, lý do: {reason}). Resurrect không?"*

Khi confirm:
1. Read G-NNN entry
2. Move entry vào "Resurrected" section của `idea-graveyard.md` (preserve original với strikethrough)
3. Insert idea vào current spiral output:
   - Spiral 2 deliverable → re-run DEDUP (verdict có thể đã thay đổi)
   - Spiral 4 story → re-evaluate priority + story-points
   - Phase 4.5 risk-driven drop → confirm risk profile changed
4. Append `decisions[]` với `topic: "resurrect"` + user-supplied context-shift reason

Subsequent processing treat resurrected idea như regular active candidate.

---

## Tham khảo nhanh

| Câu hỏi | Lệnh |
|---|---|
| Wizard 4 tình huống | `ai-kit doc on-board` |
| Onboarding SDLC chung (Luồng A + B) | `ai-kit doc on-board-sdlc` |
| Onboarding Luồng C (greenfield brainstorm) | `ai-kit doc on-board-idea` |
| Onboarding tài liệu nhà nước | `ai-kit doc on-board-tailieu` |
| Skills catalog + decision matrix | `ai-kit doc skills` |
| Agents organization + Class A/B/C/D | `ai-kit doc agents` |
| Workflow chi tiết per skill | `ai-kit doc from-doc` · `from-code` · `from-idea` · `resume-feature` · ... |
| Lệnh CLI ai-kit | `ai-kit doc ai-kit` |
| Lỗi thường gặp | `ai-kit doc troubleshooting` |
| Thuật ngữ | `ai-kit doc glossary` |
| Quyết định kiến trúc lớn (ADRs) | `ai-kit doc decision-log` |

---

> Câu hỏi không có ở đây? Mở PR thêm vào hoặc hỏi trên kênh team.
