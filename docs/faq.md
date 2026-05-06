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
11. SDLC 2-TIER (POST-ADR-003)
                        11.1 Module-driven vs feature-driven  11.2 Cấu trúc module folder
                        11.3 /resume-module vs /resume-feature  11.4 /new-module + /new-feature interview-first
                        11.5 /update-module + /update-feature
12. /FROM-DOC REFINEMENT MODES
                        12.1 9 case từ thực tế  12.2 --deepen  12.3 --add-input
                        12.4 --reextract  12.5 --redecompose  12.6 --rollback
                        12.7 Backup retention  12.8 Locked fields
13. EDGE CASES + USE CASE NÂNG CAO
                        13.1 Migrate legacy → post-ADR-003   13.2 Multi-user race
                        13.3 Resume sau gap dài (>7 ngày)    13.4 from-doc + from-code combined
                        13.5 Module split/merge              13.6 Cross-cutting feature 5+ modules
                        13.7 Hallucination detect            13.8 CI/CD automation
                        13.9 Multi-language docs             13.10 OCR scanned PDF
                        13.11 Pipeline stuck in stage        13.12 dev wave conflict
                        13.13 Project handoff team           13.14 Snapshot stakeholder review
                        13.15 Schema migration intel         13.16 Token budget exceeded
                        13.17 ai-kit version mismatch        13.18 Just estimate scope, no scaffold
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

## 11. SDLC 2-tier (post-ADR-003 — module-driven)

Refactor 2026-05-06 theo ADR-003 D8 đổi đơn vị pipeline từ **feature** sang **module**. Đọc kỹ section này nếu bạn đã quen pre-ADR-003 (ufh-rfid era) — workflow hiện tại khác.

### 11.1 Module-driven vs feature-driven — khác biệt cốt lõi

| Aspect | **Pre-ADR-003** (feature-driven) | **Post-ADR-003** (module-driven) |
|---|---|---|
| Pipeline unit | Feature | Module |
| State machine | `docs/features/F-NNN/_state.md` | `docs/modules/M-NNN/_state.md` |
| Stage outputs (ba/sa/designer/security/tech-lead/qa/reviewer) | AT feature folder | AT module folder — shared cross-feature |
| Feature folder content | Full pipeline + `feature-brief.md` + `_state.md` | Spec card `_feature.md` + `dev/` + `qa/` + `implementations.yaml` + `test-evidence.json` |
| Pipeline driver | `/resume-feature F-NNN` | `/resume-module M-NNN` |
| Scale | 254 features = 254 pipelines | 254 features = ~20 module pipelines |

**Tại sao đổi?** Cluster overhead-bound stages (ba/sa/designer/reviewer) per business domain để giảm token cost ~12x; parallelize implementation-bound stages (dev/qa) per feature để giữ throughput.

### 11.2 Cấu trúc module folder post-ADR-003

```
docs/modules/M-001-iam/                           # MODULE — pipeline driver
├── _state.md                                     # state machine (current-stage, stages-queue)
├── module-brief.md                               # 1 brief / cluster nhiều features
├── implementations.yaml
├── ba/00-feature-spec.md                         # BA cover cả module
├── sa/00-architecture-overview.md                # SA cover cả module
├── designer/  ← chỉ tồn tại nếu screen_count > 0 (Issue 2b fix v0.32.1)
├── security/  ← chỉ tồn tại nếu Path L hoặc PII (Issue 2b)
├── tech-lead/04-tech-lead-plan.md                # decompose tasks per feature
├── reviewer/08-review-report.md                  # review cả module 1 lần
└── features/
    ├── F-001-citizen-account-pin-link/
    │   ├── _feature.md                           # FeatureSpec — KHÔNG phải state machine
    │   ├── implementations.yaml
    │   ├── test-evidence.json
    │   ├── dev/05-dev-w1-tN.md                   # per-feature dev outputs
    │   └── qa/07-qa-report.md                    # per-feature QA evidence
    ├── F-002-.../
    └── F-003-.../
```

**Lưu ý active stage folders match risk_path** (Issue 2b fix v0.32.1):
- Path S → 4 folders: ba, tech-lead, dev, reviewer
- Path M → 6 folders: + sa, qa
- Path L → 7 folders: + security
- + designer if `agent_flags.designer.screen_count > 0`

→ Module Path S sẽ KHÔNG có sa/, designer/, security/, qa/ folder. Module Path L mới đủ 7.

### 11.3 Khi nào /resume-module vs /resume-feature?

**Nếu pipeline post-ADR-003 (module-driven)**: dùng `/resume-module M-NNN`. Gọi `/resume-feature F-NNN` trên feature nested → skill **Schema variant detection** sẽ redirect:

```
$ /resume-feature F-001-citizen-account-pin-link

⚠ F-001-citizen-account-pin-link là feature post-ADR-003 nested trong M-001-iam.
  Pipeline drive ở cấp module — feature nested không có state machine riêng.

  → Dùng /resume-module M-001 để tiếp tục.

EXIT (no lock, no state mutation)
```

**Nếu pipeline legacy (pre-ADR-003)**: `/resume-feature F-NNN` chạy bình thường (legacy F có state machine riêng tại `docs/features/F-NNN/_state.md`).

**Hotfix H-NNN**: `/resume-feature H-NNN` (hotfix có state machine riêng, không nested under module).

**Workspace mixed (legacy F + nested F)**: Schema variant detection auto-route theo path prefix.

### 11.4 `/new-module` + `/new-feature` interview-first (refactor v0.32.0)

2 skill này đã refactor thành interview-first — không nhận tham số ID:

```bash
/new-module              # Interactive — auto-allocate M-NNN + slug, dedup-check, dependency suggest, scaffold
/new-feature             # Interactive — Step 1.5 chọn parent module trước, rest tương tự
```

Đặc điểm:
- **Auto-allocate ID + slug** (Q1=A): user không edit. ID = `max(catalog) + 1`, slug = transliterate Vietnamese name.
- **Hard-stop dedup ≥ 0.85**: nếu trùng module/feature có sẵn → STOP, suggest `/update-{module|feature} {existing-ID}`.
- **Partial dedup 0.60-0.85**: display top-3 candidates, user chọn `[u]` update / `[c]` cross-cutting reuse / `[n]` new with references / `[a]` abort.
- **Không tự spawn /resume-***: skill kết thúc bằng "Còn bổ sung gì?" prompt rồi suggest user gõ `/resume-module M-NNN`.
- **Claude port** (~/.claude/skills/new-{module,feature}/): dùng Opus 4.7 cho interview/dedup chất lượng cao. Cursor port (~/.cursor/skills/new-{module,feature}/): inherit model main agent.

Chi tiết: `ai-kit doc workflows/new-feature` hoặc đọc SKILL.md trực tiếp.

### 11.5 `/update-module` + `/update-feature` (skill mới v0.32.0)

Pre-refactor: UPDATE flow gắn vào `/new-feature` (legacy era). Post-refactor: tách 2 skill riêng:

```bash
/update-module M-NNN                            # Update module-level CR
/update-module M-NNN --change-feature F-NNN     # Update 1 feature trong module (sub-flow)
/update-feature F-NNN                           # Variant-aware:
                                                 #   post-ADR-003 → redirect /update-module --change-feature
                                                 #   legacy → in-place update flow
```

Workflow update-module:
1. Validate arg + resolve M-NNN
2. Pre-flight gates: sealed re-open prompt; in-progress feature conflict check; lock check
3. Interview change request (5 câu: change-type, description ≥80 chars, AC change, constraints, risk delta)
4. Active CR check (merge or new)
5. Triage starting stage (per change-type → ba/sa/tech-lead)
6. Risk re-evaluation (jump ≥2 levels → ASK extended roles)
7. Ripple analysis (consumed_by_modules, downstream features, auth/data heuristic)
8. Backup + atomic state reset (CD-12 next-action mandatory)
9. Post-reset review prompt
10. Suggest `/resume-module M-NNN`

Atomic backup tại `_state.md.bak.{ISO}` + `change-impact-report.md` cho audit trail.

---

## 12. `/from-doc` Refinement modes (v0.33.0)

Sau khi `/from-doc` chạy xong initial extraction, real-world cần refinement: deeper extraction, supplemental inputs, targeted re-extraction, decomposition rework, rollback. 5 mode mới (Step 0.5 trong from-doc/SKILL.md).

### 12.1 9 case từ thực tế dùng `/from-doc`

| # | Case | Tần suất | Flag/Action |
|---|---|---|---|
| A | Extraction chưa đủ sâu — same inputs, muốn LLM đào kỹ hơn | ★★★ rất thường | `/from-doc {ws} --deepen [--focus area]` |
| B | Bổ sung document mới vào `docs/inputs/` | ★★★ rất thường | `/from-doc {ws} --add-input <file>` |
| C | Replace document cũ bằng v2 | ★★ thỉnh thoảng | `/from-doc {ws} --reextract <file>` |
| D | Re-organize modules (split/merge) | ★ thỉnh thoảng | `/from-doc {ws} --redecompose` HOẶC `/update-module --split` |
| E | Patch input doc trực tiếp (user sửa file đầu vào) | ★★ | `/from-doc {ws} --reextract <file>` (auto-detect mtime + sha256) |
| F | Manual enrichment sau /from-doc — không muốn bị overwrite | ★★★ | CD-10 #3 `locked_fields[]` enforcement (mọi mode honor) |
| G | Comparative re-run (so sánh 2 extraction) | ★ hiếm | Out-of-scope skill — dùng git branch |
| H | Rollback — extraction lần này tệ hơn lần trước | ★★ | `/from-doc {ws} --rollback [--to {ISO}]` |
| I | Targeted re-extract chỉ 1 module | ★★ | `/from-doc {ws} --reextract --module M-NNN` |

Mọi mode tự backup với rotation N=5 + honor `locked_fields[]` + log lineage.

### 12.2 `--deepen` — re-extract sâu hơn

```bash
/from-doc {workspace} --deepen
/from-doc {workspace} --deepen --focus PII        # narrow lens (PII | security | integration | NFR | ...)
```

Behavior:
1. Verify state.steps.3.status == done (else error)
2. Backup intel + state (rotation N=5)
3. Re-run Step 3 với enriched system prompt: "DEEPEN MODE — đã có doc-brief.md trước. Tìm missing edge cases, exception flows, gaps, ambiguities. Append/enrich, don't override locked_fields."
4. Validate output: nếu coverage giảm → reject as regression, restore backup
5. Reset Step 5 → "pending" (downstream cần rerun với deeper data)
6. User re-run `/from-doc` để populate downstream

Use case điển hình: SRS có 254 features nhưng doc-brief chỉ extract 170 explicit names → `--deepen --focus "feature granularity"` để LLM dig out 84 implied features.

### 12.3 `--add-input` — bổ sung file mới

```bash
/from-doc {workspace} --add-input docs/inputs/15_new_addendum.md
```

Behavior:
1. Validate file exists + chưa trong `state.config.input_files`
2. Backup intel
3. Add file vào config, extract fragment chỉ file mới
4. Diff fragment vs existing doc-brief → classify mỗi entry:
   - **NEW**: append (safe)
   - **COMPATIBLE**: refines existing → propose merge
   - **CONFLICT**: contradicts existing → require user resolution
5. Per-conflict interactive: `[k]eep-old / [k]eep-new / [m]erge / [s]kip` — log decisions vào `_meta.json.artifacts.doc-brief.conflict_log[]`
6. Apply merged result + reset Step 5h pending

Use case điển hình: User nhận thêm 1 phụ lục Q&A từ stakeholder → `--add-input` để skill merge incremental thay vì re-extract toàn bộ corpus.

### 12.4 `--reextract` — replace + re-extract

```bash
# By file:
/from-doc {workspace} --reextract docs/inputs/03_business_capability_v2.md

# By module:
/from-doc {workspace} --reextract --module M-005
```

Behavior:
- **By file**: invalidate intel entries có lineage = file (qua `_meta.json.artifacts[*].source_lineage`), re-extract chỉ file đó, replace invalidated entries (preserve locked_fields)
- **By module**: identify input sections relevant M-NNN (heuristic name-match), re-extract focus module này, replace M-NNN-related entries trong feature-catalog

Use case:
- File: stakeholder cập nhật v2 của 1 spec doc → re-extract chỉ phần liên quan
- Module: phát hiện M-005 Filing thiếu nhiều ACs → targeted re-extract focus module

### 12.5 `--redecompose` — re-run module decomposition

```bash
/from-doc {workspace} --redecompose
```

Behavior:
1. Backup intel + modules
2. Re-run Step 5d (decompose modules) từ existing doc-brief
3. Show diff: Added / Removed / Renamed / Merged / Split modules
4. User chọn `[a]pply / [c]ancel / [s]elective` (per-change confirm)
5. If apply: wipe docs/modules/, scaffold new modules, reset Step 5h+ pending

Use case: Sau khi /from-doc chạy, user thấy 20 modules decomposition không hợp lý (vd. M-005 Filing nên tách thành 2 sub-modules) → `--redecompose` để LLM thử lại.

### 12.6 `--rollback` — atomic restore

```bash
/from-doc {workspace} --rollback                  # most recent backup
/from-doc {workspace} --rollback --to 2026-05-07T00-33-26
```

Behavior:
1. List 5 backup gần nhất với metadata (current_step, modules count, features count, age)
2. User pick (default: most recent) HOẶC explicit `--to {ISO}`
3. Show what will be restored: intel + modules + state
4. **Pre-rollback snapshot**: tự backup current state để rollback chính nó reversible
5. Confirmation phrase: "CONFIRM ROLLBACK"
6. Atomic restore: intel JSONs + `_pipeline-state.json` + `docs/modules/` + catalogs + maps

Use case: User chạy `--deepen` nhưng kết quả tệ hơn lần trước → `--rollback` về backup pre-deepen.

### 12.7 Backup retention (Q4 = N=5)

Mỗi mode auto-rotate backup:
- `_pipeline-state.json.bak.{ISO}` — keep 5 most recent
- `docs/intel/.bak/{ISO}/` — keep 5 most recent
- `docs/modules/.bak/{ISO}/` — keep 5 most recent

Older backups auto-prune. **All-time history** preserve qua `git commit` — khuyến nghị commit trước mỗi refinement run.

### 12.8 Locked fields (CD-10 #3)

Manual user edits trong feature-catalog/business-context/doc-brief KHÔNG bị overwrite bởi mọi mode. Đánh dấu trong `_meta.json.artifacts[file].locked_fields[]`:

```json
{
  "artifacts": {
    "feature-catalog.json": {
      "producer": "from-doc",
      "locked_fields": ["features[id=F-001].business_intent", "features[id=F-022].acceptance_criteria"]
    }
  }
}
```

Mọi refinement mode (`--deepen`, `--add-input`, `--reextract`, `--redecompose`) check `locked_fields[]` trước khi mutate → nếu conflict, surface user `[k]eep-locked / [u]nlock-and-update`. Lý do: BA-level enrichment manual (vd. user sửa `business_intent` cho rich hơn) phải được tôn trọng qua mọi rerun.

---

## 13. Edge cases + use case nâng cao

Tổng hợp 18 tình huống ít gặp nhưng critical khi xảy ra. Đa số đã được skill handle, một số cần manual workflow.

### 13.1 Tôi có project pre-ADR-003 (legacy `docs/features/F-NNN/`) — migrate sang post-ADR-003 thế nào?

**Nguyên tắc**: legacy projects KHÔNG bắt buộc migrate — `/resume-feature` vẫn drive được legacy. Nhưng nếu muốn tận dụng module-driven (cluster BA/SA, parallel dev waves), có 2 path:

**Path A — Migrate dần (recommend)**: 
- Giữ legacy F-NNN active, scaffold thêm module mới cho features thêm vào
- Workspace mixed: skill tự handle (Schema variant detection)
- Khi tất cả legacy features done + sealed → có thể xóa `docs/features/`

**Path B — Full migrate (chỉ khi project chưa active dev)**:
1. `/from-doc {workspace} --rollback --to {pre-feature-state-iso}` (nếu có) hoặc backup manual
2. Tạo `module-catalog.json` từ feature-catalog grouping logic
3. `/from-doc {workspace} --redecompose` để LLM propose module decomposition
4. Manually move `docs/features/F-NNN/` → `docs/modules/M-NNN/features/F-NNN/` per mapping
5. Convert `_state.md` per feature → 1 `_state.md` per module + `_feature.md` per feature

Effort cao — chỉ làm khi value/scale cao và team có bandwidth migrate.

### 13.2 2 dev cùng chạy `/resume-module M-001` — race condition?

**Resume-module có advisory lock** (`{module_path}/.resume-lock` với session_id + timestamp). Nếu lock < 10min old → ask user A "wait or force-takeover". Nếu force-takeover → user B's PM session sẽ collision khi update `_state.md` sau.

**Recommend**:
- Coordinate qua chat: 1 dev driver, others observer
- Nếu cần parallel: split module thành 2 modules với `/from-doc --redecompose` HOẶC mỗi dev chạy 1 module khác nhau
- KHÔNG nên `/resume-module` cùng module đồng thời

**Cross-module parallel an toàn**: dev A `/resume-module M-001` + dev B `/resume-module M-002` cùng lúc → OK nếu M-001 và M-002 không có cross-cutting features active.

### 13.3 Tôi resume project sau 7+ ngày — context có còn không?

**Có** — intel artifacts persistent on disk. Skill `/from-doc` resumable qua `_pipeline-state.json`:
- Đọc `current_step` → biết đang ở đâu
- Đọc `doc-brief.md`, `tech-brief.md`, `actor-registry.json`, `business-context.json` (đã extract trước đó)
- Skip Steps đã done

**Recommend trước khi resume**:
1. `git log --oneline -20` xem commit gần nhất của project
2. `cat docs/intel/_meta.json | jq '.artifacts[].produced_at'` — check freshness của từng artifact
3. Nếu `stale: true` ở artifact nào → `/intel-refresh --tier T1` trước
4. Đọc `recap_ledger[-1]` (nếu có — Luồng C có) để cold-start nhanh

`/from-idea` đặc biệt có "time-aware recap" tự động:
- < 24h: light recap
- 24h–7d: full recap
- > 7d: mandatory vision-check

### 13.4 Project có cả tài liệu (SRS) lẫn code đã start — dùng `/from-doc` hay `/from-code`?

**Cả hai theo thứ tự**:

```bash
1. /from-doc D:/Projects/myproj         # Extract intel từ SRS first (business intent layer)
2. /from-code D:/Projects/myproj        # Merge code-grounded fields (routes, entities, integrations actual)
```

Skill chia sẻ canonical intel layer — `/from-code` đọc existing intel từ `/from-doc`, **append/refine** không overwrite. Kết quả: catalog có cả business prose (from doc) lẫn code-grounded specifics (from code).

**Conflict giữa 2 sources** (vd. doc nói feature X có 5 ACs, code show 7 endpoints implemented):
- `/from-code` flag conflict trong `_meta.json.artifacts.feature-catalog.cross_validation[]`
- User review qua `/intel-refresh --validate` rồi resolve manually

**Anti-pattern**: chạy `/from-code` trước `/from-doc` khi có SRS — thiếu business intent layer, code-only catalog sẽ thiếu "vì sao".

### 13.5 Module quá lớn (50 features) hoặc quá nhỏ (1 feature) — xử lý sao?

**Module > 30 features**: BA stage sẽ blow token budget, tech-lead plan phức tạp. Split:

```bash
/from-doc {workspace} --redecompose                  # LLM tự propose split
# HOẶC manual:
/update-module M-005 --split-into M-021              # CHƯA implement — workaround manual:
# 1. Edit module-catalog.json: copy M-005 entry → M-021, split feature_ids[]
# 2. Move docs/modules/M-005/features/F-NNN-... vào M-021/features/ theo mapping
# 3. Update feature-catalog.features[].module_id của moved features
# 4. ai-kit sdlc verify --scopes cross_references --strict block
```

**Module = 1 feature**: overhead BA/SA cho 1 feature lãng phí. Merge với module liên quan:

```bash
# Manual workflow:
# 1. Edit feature-catalog.features[F-NNN].module_id = M-target
# 2. Move docs/modules/M-NNN-orphan/features/F-NNN/ → M-target/features/F-NNN/
# 3. Delete M-NNN-orphan từ module-catalog.json
# 4. Verify: ai-kit sdlc verify --scopes structure,cross_references --strict block
```

Sweet spot: 5-15 features/module.

### 13.6 Cross-cutting feature lan ra 5+ modules — CD-24 enforcement

Vd. F-084 SSO VNeID owned by M-001 IAM, consumed by M-002 + M-003 + M-004 + M-005:

```yaml
# feature-catalog.features[F-084]:
module_id: M-001                              # primary owner
consumed_by_modules: [M-002, M-003, M-004, M-005]  # downstream consumers
```

**Khi `/resume-module M-002` chạy** (vd. M-002 dùng F-084):
- Step 3c.2 (resume-module 2026-05-06 fix) reverse-lookup feature-catalog cho `consumed_by_modules ∋ M-002`
- Nếu F-084.status != "implemented" → ASK/BLOCK depending on stage:
  - BA/SA/Designer: WARN + continue
  - Tech-lead: ASK
  - Dev/QA/Reviewer: BLOCK + suggest `/resume-module M-001` trước

User override → log `_state.md.sync-warnings[]`, reviewer stage refuse Approved nếu F-084 vẫn chưa implemented tại review time.

→ CD-24 enforcement đảm bảo cross-cutting integrity. Chi tiết: `~/.claude/CLAUDE.md#CD-24`.

### 13.7 Tôi nghi LLM hallucinated content trong intel — audit thế nào?

**Confidence-aware extraction** (CD-10 #13): mọi entry trong intel có `confidence: high|medium|low|manual` + `evidence[]` + `source_producers[]`.

```bash
# Check overall confidence stats:
cat docs/intel/feature-catalog.json | jq '[.features[].confidence] | group_by(.) | map({(.[0]): length}) | add'
# Expected: {"high": 80%, "medium": 15%, "low": 5%}

# List low-confidence entries:
cat docs/intel/feature-catalog.json | jq '.features[] | select(.confidence == "low")'

# Audit evidence per suspect entry:
cat docs/intel/feature-catalog.json | jq '.features[] | select(.id == "F-XXX") | .evidence'
```

**Action**:
- Low confidence + critical feature → manually verify against source docs, fix bằng `/intel-fill` hoặc edit + mark `confidence: manual`
- High low-confidence ratio (> 5%) → `/from-doc --deepen` để LLM re-pass với rich context
- Suspicious specific field → check `_meta.json.artifacts[file].locked_fields[]` để lock manual fix

Generate-docs Stage 5b enforce: block nếu có `low_confidence_critical` entry.

### 13.8 Tôi muốn /from-doc chạy trong CI/CD pipeline (automation)?

**Currently NOT recommended** — /from-doc có interactive gates (Gate A confirm, Gate B confirm, partial dedup choice...) cần user input. CI sẽ block.

**Workaround partial automation**:
```bash
# Pre-extract layer (auto-run trong CI):
ai-kit sdlc verify --scopes structure,cross_references --strict warn   # validate only

# /from-doc full pipeline: chạy local trên dev machine
# Output commit qua git → CI consume kết quả
```

Future feature: `/from-doc --non-interactive` mode với defaults preset. Track ở `~/.claude/CLAUDE.md#TODO`.

### 13.9 Document đa ngôn ngữ (VN + EN mix) — extract thế nào?

`/from-doc` doc-intel agent handle song ngữ tự nhiên (Opus 4.7 + tốt với VN/EN switching). Tip:
- Tên feature/module Vietnamese → slug auto-transliterate (`unidecode`) thành kebab-case ASCII
- Field `name` (Vietnamese) + optional `name_en` (English) trong feature-catalog
- Business intent prose: giữ nguyên ngôn ngữ gốc, agents downstream xử lý hỗn hợp
- Tham chiếu pháp lý VN: trích dẫn full Vietnamese (vd. "Nghị định số 30/2020/NĐ-CP")

**Edge case**: doc 100% English nhưng team Vietnamese → từ-doc vẫn extract OK, nhưng:
- `name_vn` có thể empty → BA stage sẽ enrich
- User có thể `/from-doc --deepen --focus "Vietnamese localization"` để LLM gen `name_vn` cho catalog entries

### 13.10 SRS scanned PDF (image-based, không OCR) — xử lý sao?

Doc-intel agent đọc PDF qua text layer. Scanned PDF không có text layer → extract empty.

**Pre-processing required**:
```bash
# Tesseract OCR (offline):
tesseract input.pdf output -l vie+eng pdf
# Output: output.pdf with text layer

# HOẶC dùng Adobe Acrobat OCR (commercial)
# HOẶC convert qua Google Drive (upload → re-download as Google Doc → export PDF có OCR)

# Then run /from-doc:
/from-doc {workspace}                        # docs/inputs/output.pdf — OCR'd
```

**OCR quality affect extraction**:
- VN diacritics đôi khi sai (ô → o, ặ → a) → manual fix critical fields after Step 3
- Tables OCR không đáng tin → LLM có thể hallucinate cell values
- Recommend: OCR review pass trước /from-doc, hoặc `--deepen --focus tables` sau

### 13.11 `/resume-module` stuck ở 1 stage (vd. ba) — debug

Triệu chứng: PM dispatch ba agent → ba agent return verdict nhưng `_state.md.completed-stages.ba` không update.

**Diagnose**:
1. Đọc `{module_path}/ba/00-feature-spec.md` — xem ba agent có write file không
2. Đọc `_state.md.kpi.tokens-by-stage.ba` — agent có chạy và spend tokens không
3. Đọc PM verdict JSON từ Task() result — xem có blocker hay không
4. `tail -50 docs/intel/_meta.json` — check stale flags

**Common causes**:
- Intel artifact stale → STOP `next-action: /intel-refresh` (đọc skill output kỹ)
- Atomic state update CLI fail → check `ai-kit doctor` 
- BA agent loop max-iter (200) → manual edit `_state.md` để pop stage rồi retry
- Lock conflict (>10min old) → `rm {module_path}/.resume-lock` rồi retry

**Recovery**:
```bash
# Hard reset cụ thể stage:
ai-kit sdlc state update --kind module --id M-NNN --op stage_rollback --to-stage ba
/resume-module M-NNN
```

### 13.12 dev wave parallel agents conflict — file tranh chấp

PM dispatch 4 dev agents parallel trong dev-wave-1. Nếu 2 agents cùng touch 1 file → race.

**Tech-lead phải plan tasks orthogonal** (mỗi task touch khác file/module). Nếu plan có overlap → tech-lead lỗi, PM hold dev wave + escalate.

**Recovery**:
1. Read `04-tech-lead-plan.md` — verify task isolation
2. Nếu overlap → user edit plan, split tasks
3. PM `--rerun-stage tech-lead` rồi resume dev wave

**CD-10 Q.13 confidence-aware**: nếu tech-lead `low_confidence` về task isolation → mark `[NEEDS-VALIDATION]`, PM block dev wave cho đến user review.

### 13.13 Handoff project cho dev/team mới — cần gì?

**Onboarding path (recommended order)**:
1. Clone workspace + `ai-kit update`
2. `ai-kit doctor` — verify môi trường
3. Đọc `docs/intel/_snapshot.md` — compressed view ~5-7K tokens, cover 95% orientation
4. Đọc `docs/modules/*/module-brief.md` — list modules + scope
5. `cat docs/intel/_pipeline-state.json` — current state pipeline
6. `git log --oneline --all -50` — recent activity
7. `/feature-status --module M-NNN` per module quan tâm
8. Skill specific tutorials: `ai-kit doc workflows/{from-doc|resume-feature|generate-docs}`

**Maintainer khi handoff**:
- Commit + push tất cả intel artifacts
- Clean up `.bak/` orphans
- Document decisions trong `docs/intel/decisions.md` hoặc `_meta.json.decisions[]`
- Tag commit `handoff-{date}` cho rollback point

### 13.14 Cần "snapshot read-only cho stakeholder review" — không cho phép edit?

**Snapshot pattern**:
```bash
# Tạo branch read-only:
git checkout -b stakeholder-review-2026-05-15
git push origin stakeholder-review-2026-05-15

# Hoặc generate compact bundle:
ai-kit zip-disk --output stakeholder-pkg-2026-05-15.zip
# Bundle: docs/intel/_snapshot.md + docs/modules/*/module-brief.md + 
#         docs/generated/*.docx (nếu có) + README.md hướng dẫn xem

# Stakeholder review qua:
# - Read-only git branch trên GitHub
# - HOẶC zip file extract local
```

→ Stakeholder không có ai-kit installed vẫn xem được markdown + docx. Feedback qua issues / comments.

### 13.15 Intel JSON schema bumped sau ai-kit update — migration?

ai-kit có `schema_version` trong mỗi intel JSON. Khi update bump schema:
```bash
ai-kit update                                          # Pull new version
ai-kit doctor                                          # Detect schema mismatch warning
ai-kit sdlc verify --scopes schemas --strict warn      # List drift

# Auto-migrate:
ai-kit sdlc autofix --scope schema-migration           # Apply known migrations
```

**Manual migration** (khi auto fail):
- Read `~/.claude/schemas/intel/CHANGELOG.md` cho version delta
- Backup `cp -r docs/intel/ docs/intel.bak/`
- Edit intel JSON theo new schema (vd. CD-23 thêm `module_id` field cho feature-catalog post-ADR-003)
- `ai-kit sdlc verify --scopes schemas --strict block` — verify

Future feature: full auto migration via `ai-kit migrate intel --from {old-version} --to {new-version}`.

### 13.16 Token budget exceeded mid-run — graceful resume?

Triệu chứng: Claude báo "context limit reached" hoặc API throttle giữa Step 5g loop.

**Skill design auto-checkpoint**: mỗi sub-step (5a, 5b, ..., 5g) write state ngay sau hoàn thành. Nếu interrupt:
- `_pipeline-state.json.steps.5.sub_state` ghi nhận sub-step cuối cùng done
- Re-run `/from-doc` → resume từ sub-step kế tiếp

**Token-saving strategies**:
- `output-mode: lean` (default) — agents write minimal artifacts vs `full`
- Split module thành nhiều smaller modules (10-15 features each)
- Defer "estimated" features (chọn option 2 trong scaffold prompt) thay vì full 254
- `/from-doc --deepen --focus area` thay vì full re-extract

**Cost monitoring** (Cursor): `ai-kit telemetry` show token usage per stage.

### 13.17 ai-kit version mismatch (skill v0.32 nhưng project intel v0.31) — backward compat?

Skill prose CD-10 #1 mandate: producers MUST validate against schema before write. Old intel may have:
- Missing fields (added in v0.32) → skill treat as default/empty
- Removed fields (v0.31 had, v0.32 dropped) → skill ignore
- Renamed fields → migration needed (Q13.15)

**Detection**: `ai-kit sdlc verify --scopes schemas` cảnh báo cụ thể.

**Recommendation**:
- Forward-compat: skill v0.32 OK đọc v0.31 intel (graceful degradation)
- Backward-compat: skill v0.31 KHÔNG đảm bảo đọc v0.32 intel (new required fields)
- Always update ai-kit + intel schema together: `ai-kit update && ai-kit sdlc autofix --scope schema-migration`

### 13.18 Tôi chỉ muốn estimate scope (số features, modules, complexity) — không scaffold?

**Light extraction mode** (chưa có flag, manual workflow):
```bash
# Spawn doc-intel agent only (no Step 4 scaffold, no Step 5):
@doc-intel "Read docs/inputs/*.md and produce metrics-only summary:
            - Total features count
            - Modules count + decomposition proposal
            - Complexity per module (S/M/L)
            - Estimated total features count + variance
            - Potential blocking gaps
            Output: docs/intel/scope-estimate.md (markdown table only, no full doc-brief)"

# Review scope-estimate.md → quyết định proceed full /from-doc hay không
```

Future feature: `/from-doc {workspace} --estimate-only` — Step 1-3 ngắn, output 1 markdown table, không scaffold workspace, không emit full intel.

Use case: project quote/estimate trước khi commit pipeline; budget planning; decide split-monorepo trước.

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
