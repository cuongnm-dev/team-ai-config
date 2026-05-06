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

## 11. SDLC 2 tầng (post-ADR-003 — pipeline ở cấp module)

Tái cấu trúc 2026-05-06 theo ADR-003 D8 đổi đơn vị pipeline từ **feature** sang **module**. Đọc kỹ phần này nếu bạn đã quen pattern pre-ADR-003 (era ufh-rfid) — quy trình hiện tại khác.

### 11.1 Pipeline cấp module vs cấp feature — khác biệt cốt lõi

| Khía cạnh | **Pre-ADR-003** (cấp feature) | **Post-ADR-003** (cấp module) |
|---|---|---|
| Đơn vị pipeline | Feature | Module |
| State machine | `docs/features/F-NNN/_state.md` | `docs/modules/M-NNN/_state.md` |
| Output các stage (ba/sa/designer/security/tech-lead/qa/reviewer) | Tại folder feature | Tại folder module — dùng chung cho nhiều feature |
| Nội dung folder feature | Toàn pipeline + `feature-brief.md` + `_state.md` | Thẻ spec `_feature.md` + `dev/` + `qa/` + `implementations.yaml` + `test-evidence.json` |
| Lệnh chạy pipeline | `/resume-feature F-NNN` | `/resume-module M-NNN` |
| Quy mô | 254 feature = 254 pipeline | 254 feature = ~20 pipeline cấp module |

**Vì sao đổi?** Gom các stage tốn token (ba/sa/designer/reviewer) theo domain nghiệp vụ để giảm cost ~12 lần; song song hoá các stage thực thi (dev/qa) theo từng feature để giữ tốc độ.

### 11.2 Cấu trúc folder module post-ADR-003

```
docs/modules/M-001-iam/                           # MODULE — đơn vị pipeline
├── _state.md                                     # state machine (current-stage, stages-queue)
├── module-brief.md                               # 1 brief cho cả cluster nhiều feature
├── implementations.yaml
├── ba/00-feature-spec.md                         # BA bao quát toàn module
├── sa/00-architecture-overview.md                # SA bao quát toàn module
├── designer/  ← chỉ tồn tại nếu screen_count > 0 (Issue 2b sửa ở v0.32.1)
├── security/  ← chỉ tồn tại nếu Path L hoặc có PII (Issue 2b)
├── tech-lead/04-tech-lead-plan.md                # phân rã task theo từng feature
├── reviewer/08-review-report.md                  # review cả module 1 lần
└── features/
    ├── F-001-citizen-account-pin-link/
    │   ├── _feature.md                           # FeatureSpec — KHÔNG phải state machine
    │   ├── implementations.yaml
    │   ├── test-evidence.json
    │   ├── dev/05-dev-w1-tN.md                   # output dev của riêng feature này
    │   └── qa/07-qa-report.md                    # bằng chứng QA của riêng feature này
    ├── F-002-.../
    └── F-003-.../
```

**Lưu ý folder các stage hoạt động khớp với risk_path** (Issue 2b sửa ở v0.32.1):
- Path S → 4 folder: ba, tech-lead, dev, reviewer
- Path M → 6 folder: + sa, qa
- Path L → 7 folder: + security
- + designer nếu `agent_flags.designer.screen_count > 0`

→ Module Path S sẽ KHÔNG có folder sa/, designer/, security/, qa/. Module Path L mới đủ 7.

### 11.3 Khi nào dùng /resume-module thay vì /resume-feature?

**Project post-ADR-003 (pipeline cấp module)**: dùng `/resume-module M-NNN`. Gọi `/resume-feature F-NNN` trên feature nested → skill có cơ chế **Schema variant detection** tự chuyển hướng:

```
$ /resume-feature F-001-citizen-account-pin-link

⚠ F-001-citizen-account-pin-link là feature post-ADR-003 nested trong M-001-iam.
  Pipeline drive ở cấp module — feature nested không có state machine riêng.

  → Dùng /resume-module M-001 để tiếp tục.

EXIT (không tạo lock, không thay đổi state)
```

**Project legacy (pre-ADR-003)**: `/resume-feature F-NNN` chạy bình thường (feature legacy có state machine riêng tại `docs/features/F-NNN/_state.md`).

**Hotfix H-NNN**: `/resume-feature H-NNN` (hotfix có state machine riêng, không nested dưới module).

**Workspace lai (vừa có F legacy vừa có F nested)**: Schema variant detection tự định tuyến theo tiền tố đường dẫn.

### 11.4 `/new-module` + `/new-feature` interview-first (refactor v0.32.0)

Hai skill này đã refactor sang interview-first — không nhận tham số ID:

```bash
/new-module              # Tương tác — tự cấp M-NNN + slug, dedup-check, gợi ý dependency, scaffold
/new-feature             # Tương tự — Bước 1.5 chọn module cha trước, các bước còn lại tương tự
```

Đặc điểm:
- **Tự cấp ID + slug** (Q1=A): user không sửa được. ID = `max(catalog) + 1`, slug = chuyển thể tên Việt sang ASCII.
- **Hard-stop nếu dedup ≥ 0.85**: nếu trùng module/feature có sẵn → STOP, gợi ý `/update-{module|feature} {existing-ID}`.
- **Dedup một phần 0.60-0.85**: hiển thị top 3 ứng viên, user chọn `[u]` update / `[c]` dùng chung cross-cutting / `[n]` tạo mới có tham chiếu / `[a]` huỷ.
- **Không tự gọi /resume-***: skill kết thúc bằng câu hỏi "Còn bổ sung gì?" rồi gợi ý user tự gõ `/resume-module M-NNN`.
- **Bản port cho Claude** (`~/.claude/skills/new-{module,feature}/`): dùng Opus 4.7 cho phỏng vấn/dedup chất lượng cao. Bản Cursor (`~/.cursor/skills/new-{module,feature}/`): kế thừa model của main agent.

Chi tiết: `ai-kit doc workflows/new-feature` hoặc đọc trực tiếp SKILL.md.

### 11.5 `/update-module` + `/update-feature` (skill mới v0.32.0)

Trước refactor: luồng UPDATE gắn vào `/new-feature` (era legacy). Sau refactor: tách thành 2 skill riêng:

```bash
/update-module M-NNN                            # Update change request cấp module
/update-module M-NNN --change-feature F-NNN     # Update 1 feature trong module (sub-flow)
/update-feature F-NNN                           # Tự nhận diện variant:
                                                 #   post-ADR-003 → chuyển hướng /update-module --change-feature
                                                 #   legacy → luồng update tại chỗ
```

Quy trình `/update-module`:
1. Validate tham số + resolve M-NNN
2. Cổng tiền kiểm: hỏi mở lại nếu module đã sealed; phát hiện feature đang chạy dở; kiểm tra lock
3. Phỏng vấn change request (5 câu: loại thay đổi, mô tả ≥80 ký tự, thay đổi AC, ràng buộc, độ tăng risk)
4. Kiểm tra change request đang mở (gộp hoặc tạo mới)
5. Phân loại stage bắt đầu (theo loại thay đổi → ba/sa/tech-lead)
6. Đánh giá lại risk (nhảy ≥2 cấp → HỎI thêm vai trò mở rộng)
7. Phân tích lan truyền (consumed_by_modules, feature phụ thuộc, heuristic auth/data)
8. Sao lưu + reset state nguyên tử (CD-12 bắt buộc next-action)
9. Hỏi review sau khi reset
10. Gợi ý `/resume-module M-NNN`

Sao lưu nguyên tử tại `_state.md.bak.{ISO}` + `change-impact-report.md` cho audit trail.

---

## 12. Các mode tinh chỉnh của `/from-doc` (v0.33.0)

Sau khi `/from-doc` chạy xong lần đầu, thực tế cần tinh chỉnh: trích xuất sâu hơn, bổ sung tài liệu, trích xuất lại có chủ đích, tổ chức lại module, hoàn tác. 5 mode mới (Bước 0.5 trong `from-doc/SKILL.md`).

### 12.1 9 tình huống thực tế dùng `/from-doc`

| # | Tình huống | Tần suất | Lệnh / Hành động |
|---|---|---|---|
| A | Trích xuất chưa đủ sâu — cùng input, muốn LLM đào kỹ hơn | ★★★ rất thường | `/from-doc {ws} --deepen [--focus area]` |
| B | Bổ sung tài liệu mới vào `docs/inputs/` | ★★★ rất thường | `/from-doc {ws} --add-input <file>` |
| C | Thay tài liệu cũ bằng phiên bản v2 | ★★ thỉnh thoảng | `/from-doc {ws} --reextract <file>` |
| D | Tổ chức lại module (tách / gộp) | ★ thỉnh thoảng | `/from-doc {ws} --redecompose` HOẶC `/update-module --split` |
| E | Sửa trực tiếp file input (user vá lại tài liệu đầu vào) | ★★ | `/from-doc {ws} --reextract <file>` (tự nhận diện qua mtime + sha256) |
| F | Bổ sung thủ công sau /from-doc — không muốn bị ghi đè | ★★★ | CD-10 #3 `locked_fields[]` (mọi mode đều tôn trọng) |
| G | Chạy lại để so sánh 2 lần trích xuất | ★ hiếm | Ngoài phạm vi skill — dùng git branch |
| H | Hoàn tác — lần trích xuất này tệ hơn lần trước | ★★ | `/from-doc {ws} --rollback [--to {ISO}]` |
| I | Trích xuất lại có chủ đích chỉ 1 module | ★★ | `/from-doc {ws} --reextract --module M-NNN` |

Mọi mode đều tự sao lưu (giữ 5 bản gần nhất) + tôn trọng `locked_fields[]` + ghi log lineage.

### 12.2 `--deepen` — trích xuất sâu hơn

```bash
/from-doc {workspace} --deepen
/from-doc {workspace} --deepen --focus PII        # ống kính hẹp (PII | security | integration | NFR | ...)
```

Cơ chế:
1. Kiểm tra `state.steps.3.status == done` (chưa thì báo lỗi)
2. Sao lưu intel + state (giữ 5 bản gần nhất)
3. Chạy lại Bước 3 với system prompt được tăng cường: "DEEPEN MODE — đã có doc-brief.md trước. Tìm các edge case bị bỏ sót, luồng exception, gap, ambiguity. Bổ sung / làm giàu, không ghi đè locked_fields."
4. Validate output: nếu coverage giảm → coi là regression, khôi phục backup
5. Reset Bước 5 → "pending" (downstream cần chạy lại với data sâu hơn)
6. User chạy lại `/from-doc` để populate downstream

Tình huống điển hình: SRS có 254 feature nhưng doc-brief chỉ trích được 170 tên cụ thể → `--deepen --focus "feature granularity"` để LLM đào ra 84 feature ngầm còn lại.

### 12.3 `--add-input` — bổ sung tài liệu mới

```bash
/from-doc {workspace} --add-input docs/inputs/15_new_addendum.md
```

Cơ chế:
1. Validate file tồn tại + chưa nằm trong `state.config.input_files`
2. Sao lưu intel
3. Thêm file vào config, trích xuất fragment chỉ từ file mới
4. So sánh fragment với doc-brief hiện có → phân loại mỗi entry:
   - **NEW**: append (an toàn)
   - **COMPATIBLE**: làm rõ thêm cho entry cũ → đề xuất gộp
   - **CONFLICT**: mâu thuẫn với entry cũ → cần user quyết định
5. Tương tác từng conflict: `[k]eep-old / [k]eep-new / [m]erge / [s]kip` — ghi quyết định vào `_meta.json.artifacts.doc-brief.conflict_log[]`
6. Áp dụng kết quả gộp + reset Bước 5h pending

Tình huống điển hình: user nhận thêm 1 phụ lục Q&A từ stakeholder → `--add-input` để skill gộp tăng dần thay vì trích xuất lại toàn bộ corpus.

### 12.4 `--reextract` — thay thế + trích xuất lại

```bash
# Theo file:
/from-doc {workspace} --reextract docs/inputs/03_business_capability_v2.md

# Theo module:
/from-doc {workspace} --reextract --module M-005
```

Cơ chế:
- **Theo file**: vô hiệu hoá các entry intel có lineage = file (qua `_meta.json.artifacts[*].source_lineage`), trích xuất lại chỉ file đó, thay thế các entry vừa vô hiệu hoá (giữ nguyên locked_fields)
- **Theo module**: xác định các phần input liên quan M-NNN (heuristic so khớp tên), trích xuất lại tập trung vào module này, thay thế các entry liên quan trong feature-catalog

Tình huống:
- Theo file: stakeholder cập nhật v2 của 1 spec doc → trích xuất lại chỉ phần liên quan
- Theo module: phát hiện M-005 Filing thiếu nhiều AC → trích xuất lại có chủ đích

### 12.5 `--redecompose` — chạy lại phân rã module

```bash
/from-doc {workspace} --redecompose
```

Cơ chế:
1. Sao lưu intel + modules
2. Chạy lại Bước 5d (phân rã module) từ doc-brief hiện có
3. Hiển thị diff: Thêm / Xoá / Đổi tên / Gộp / Tách module
4. User chọn `[a]pply / [c]ancel / [s]elective` (xác nhận từng thay đổi)
5. Nếu apply: xoá `docs/modules/`, scaffold module mới, reset Bước 5h+ pending

Tình huống: sau khi /from-doc chạy xong, user thấy phân rã 20 module không hợp lý (vd. M-005 Filing nên tách thành 2 sub-module) → `--redecompose` để LLM thử lại.

### 12.6 `--rollback` — phục hồi nguyên tử

```bash
/from-doc {workspace} --rollback                  # backup gần nhất
/from-doc {workspace} --rollback --to 2026-05-07T00-33-26
```

Cơ chế:
1. Liệt kê 5 backup gần nhất kèm metadata (current_step, số module, số feature, thời gian)
2. User chọn (mặc định: gần nhất) HOẶC `--to {ISO}` cụ thể
3. Hiển thị nội dung sẽ được phục hồi: intel + modules + state
4. **Snapshot trước rollback**: tự sao lưu state hiện tại để chính rollback cũng có thể đảo ngược lại
5. Cụm xác nhận: "CONFIRM ROLLBACK"
6. Phục hồi nguyên tử: intel JSON + `_pipeline-state.json` + `docs/modules/` + catalog + map

Tình huống: user chạy `--deepen` nhưng kết quả tệ hơn lần trước → `--rollback` về backup trước khi deepen.

### 12.7 Lưu giữ backup (Q4 = giữ 5 bản)

Mỗi mode tự xoay vòng backup:
- `_pipeline-state.json.bak.{ISO}` — giữ 5 bản gần nhất
- `docs/intel/.bak/{ISO}/` — giữ 5 bản gần nhất
- `docs/modules/.bak/{ISO}/` — giữ 5 bản gần nhất

Backup cũ tự xoá. **Lịch sử dài hạn** giữ qua `git commit` — khuyến nghị commit trước mỗi lần tinh chỉnh.

### 12.8 Field đã khoá (CD-10 #3)

Chỉnh sửa thủ công của user trong `feature-catalog`/`business-context`/`doc-brief` KHÔNG bị ghi đè bởi mọi mode. Đánh dấu trong `_meta.json.artifacts[file].locked_fields[]`:

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

Mọi mode tinh chỉnh (`--deepen`, `--add-input`, `--reextract`, `--redecompose`) đều kiểm tra `locked_fields[]` trước khi thay đổi → nếu xung đột, hỏi user `[k]eep-locked / [u]nlock-and-update`. Lý do: phần làm giàu thủ công ở cấp BA (vd. user sửa `business_intent` cho dày hơn) phải được tôn trọng qua mọi lần chạy lại.

---

## 13. Tình huống nâng cao + edge case

Tổng hợp 18 tình huống ít gặp nhưng then chốt khi xảy ra. Đa số đã được skill xử lý sẵn, một số cần quy trình thủ công.

### 13.1 Project pre-ADR-003 (legacy `docs/features/F-NNN/`) — chuyển sang post-ADR-003 thế nào?

**Nguyên tắc**: project legacy KHÔNG bắt buộc chuyển — `/resume-feature` vẫn chạy được legacy. Nhưng nếu muốn tận dụng pipeline cấp module (gom BA/SA, song song dev wave), có 2 hướng:

**Hướng A — Chuyển dần (khuyến nghị)**:
- Giữ F-NNN legacy đang chạy, scaffold module mới cho các feature thêm vào sau
- Workspace lai: skill tự xử lý qua Schema variant detection
- Khi tất cả feature legacy đã done + sealed → có thể xoá `docs/features/`

**Hướng B — Chuyển toàn bộ (chỉ khi project chưa active dev)**:
1. `/from-doc {workspace} --rollback --to {pre-feature-state-iso}` (nếu có) hoặc backup thủ công
2. Tạo `module-catalog.json` từ logic gom feature-catalog theo nhóm
3. `/from-doc {workspace} --redecompose` để LLM đề xuất phân rã module
4. Di chuyển thủ công `docs/features/F-NNN/` → `docs/modules/M-NNN/_features/F-NNN/` theo ánh xạ
5. Chuyển đổi mỗi `_state.md` per feature → 1 `_state.md` per module + `_feature.md` per feature

Effort cao — chỉ làm khi giá trị/quy mô lớn và team có thời gian chuyển đổi.

### 13.2 Hai dev cùng chạy `/resume-module M-001` — tranh chấp?

**`/resume-module` có advisory lock** (`{module_path}/.resume-lock` chứa session_id + timestamp). Nếu lock < 10 phút tuổi → hỏi user A "đợi hay chiếm quyền". Nếu chiếm quyền → phiên PM của user B sẽ đụng độ khi cập nhật `_state.md` sau đó.

**Khuyến nghị**:
- Phối hợp qua chat: 1 dev điều khiển, người khác quan sát
- Nếu cần song song: tách module thành 2 module qua `/from-doc --redecompose` HOẶC mỗi dev chạy 1 module khác nhau
- KHÔNG nên `/resume-module` cùng module đồng thời

**Song song module khác nhau là an toàn**: dev A `/resume-module M-001` + dev B `/resume-module M-002` cùng lúc → OK nếu M-001 và M-002 không chia sẻ feature cross-cutting đang chạy.

### 13.3 Tôi quay lại project sau 7+ ngày — context có còn không?

**Còn** — intel artifact lưu trên đĩa. Skill `/from-doc` resume được qua `_pipeline-state.json`:
- Đọc `current_step` → biết đang ở đâu
- Đọc `doc-brief.md`, `tech-brief.md`, `actor-registry.json`, `business-context.json` (đã trích xuất trước đó)
- Bỏ qua các bước đã done

**Khuyến nghị trước khi resume**:
1. `git log --oneline -20` xem commit gần nhất
2. `cat docs/intel/_meta.json | jq '.artifacts[].produced_at'` — kiểm tra độ tươi của từng artifact
3. Nếu artifact nào `stale: true` → chạy `/intel-refresh --tier T1` trước
4. Đọc `recap_ledger[-1]` (nếu là Luồng C có) để khôi phục context nhanh

`/from-idea` đặc biệt có "time-aware recap" tự động:
- < 24h: recap nhẹ
- 24h–7d: recap đầy đủ
- > 7d: bắt buộc xác nhận lại vision

### 13.4 Project có cả tài liệu (SRS) lẫn code đã start — dùng `/from-doc` hay `/from-code`?

**Dùng cả hai theo thứ tự**:

```bash
1. /from-doc D:/Projects/myproj         # Trích intel từ SRS trước (lớp business intent)
2. /from-code D:/Projects/myproj        # Gộp các field grounded từ code (route, entity, integration thực tế)
```

Hai skill chia sẻ chung canonical intel layer — `/from-code` đọc intel có sẵn từ `/from-doc`, **append/làm giàu** chứ không ghi đè. Kết quả: catalog có cả prose nghiệp vụ (từ doc) lẫn chi tiết grounded từ code.

**Xung đột giữa 2 nguồn** (vd. doc nói feature X có 5 AC, code show 7 endpoint đã implement):
- `/from-code` ghi nhận xung đột vào `_meta.json.artifacts.feature-catalog.cross_validation[]`
- User review qua `/intel-refresh --validate` rồi giải quyết thủ công

**Anti-pattern**: chạy `/from-code` trước `/from-doc` khi có SRS — thiếu lớp business intent, catalog từ code sẽ thiếu phần "vì sao".

### 13.5 Module quá lớn (50 feature) hoặc quá nhỏ (1 feature) — xử lý sao?

**Module > 30 feature**: BA stage sẽ vượt token budget, kế hoạch tech-lead phức tạp. Tách:

```bash
/from-doc {workspace} --redecompose                  # LLM tự đề xuất tách
# HOẶC thủ công:
/update-module M-005 --split-into M-021              # CHƯA implement — quy trình thủ công:
# 1. Sửa module-catalog.json: copy entry M-005 → M-021, tách feature_ids[]
# 2. Di chuyển docs/modules/M-005/_features/F-NNN-... sang M-021/_features/ theo ánh xạ
# 3. Cập nhật feature-catalog.features[].module_id của các feature vừa di chuyển
# 4. ai-kit sdlc verify --scopes cross_references --strict block
```

**Module = 1 feature**: chi phí BA/SA cho 1 feature lãng phí. Gộp với module liên quan:

```bash
# Quy trình thủ công:
# 1. Sửa feature-catalog.features[F-NNN].module_id = M-target
# 2. Di chuyển docs/modules/M-NNN-orphan/_features/F-NNN/ → M-target/_features/F-NNN/
# 3. Xoá M-NNN-orphan khỏi module-catalog.json
# 4. Verify: ai-kit sdlc verify --scopes structure,cross_references --strict block
```

Điểm cân bằng: 5-15 feature mỗi module.

### 13.6 Feature cross-cutting lan ra 5+ module — CD-24 enforce thế nào?

Vd. F-084 SSO VNeID owned by M-001 IAM, được dùng bởi M-002 + M-003 + M-004 + M-005:

```yaml
# feature-catalog.features[F-084]:
module_id: M-001                              # owner chính
consumed_by_modules: [M-002, M-003, M-004, M-005]  # các module dùng
```

**Khi `/resume-module M-002` chạy** (vd. M-002 dùng F-084):
- Bước 3c.2 (resume-module fix 2026-05-06) đảo chiều tra feature-catalog tìm `consumed_by_modules ∋ M-002`
- Nếu `F-084.status != "implemented"` → HỎI/CHẶN tuỳ stage:
  - BA / SA / Designer: WARN + tiếp tục
  - Tech-lead: HỎI
  - Dev / QA / Reviewer: CHẶN + gợi ý chạy `/resume-module M-001` trước

User chọn override → ghi log vào `_state.md.sync-warnings[]`, stage reviewer sẽ từ chối Approved nếu F-084 vẫn chưa implemented tại thời điểm review.

→ CD-24 enforcement đảm bảo tính toàn vẹn cross-cutting. Chi tiết: `~/.claude/CLAUDE.md#CD-24`.

### 13.7 Nghi ngờ LLM bịa nội dung trong intel — kiểm tra thế nào?

**Trích xuất có confidence** (CD-10 #13): mọi entry intel đều có `confidence: high|medium|low|manual` + `evidence[]` + `source_producers[]`.

```bash
# Xem thống kê confidence chung:
cat docs/intel/feature-catalog.json | jq '[.features[].confidence] | group_by(.) | map({(.[0]): length}) | add'
# Mong đợi: {"high": 80%, "medium": 15%, "low": 5%}

# Liệt kê entry confidence thấp:
cat docs/intel/feature-catalog.json | jq '.features[] | select(.confidence == "low")'

# Kiểm tra evidence của entry nghi ngờ:
cat docs/intel/feature-catalog.json | jq '.features[] | select(.id == "F-XXX") | .evidence'
```

**Xử lý**:
- Confidence thấp + feature quan trọng → đối chiếu thủ công với tài liệu nguồn, sửa qua `/intel-fill` hoặc edit trực tiếp + đánh dấu `confidence: manual`
- Tỉ lệ low quá cao (> 5%) → `/from-doc --deepen` để LLM duyệt lại với context đầy đủ hơn
- Field cụ thể đáng nghi → đưa vào `_meta.json.artifacts[file].locked_fields[]` để khoá phần sửa thủ công

`generate-docs` Bước 5b chặn nếu có entry `low_confidence_critical`.

### 13.8 Muốn `/from-doc` chạy trong CI/CD pipeline (tự động hoá)?

**Hiện tại KHÔNG khuyến nghị** — `/from-doc` có các gate tương tác (xác nhận Gate A, Gate B, lựa chọn dedup một phần...) cần input của user. CI sẽ bị treo.

**Tự động hoá một phần**:
```bash
# Lớp tiền-trích-xuất (chạy được trong CI):
ai-kit sdlc verify --scopes structure,cross_references --strict warn   # chỉ validate

# Pipeline /from-doc đầy đủ: chạy local trên máy dev
# Output commit qua git → CI tiêu thụ kết quả
```

Tính năng tương lai: `/from-doc --non-interactive` với defaults preset. Đang track tại `~/.claude/CLAUDE.md#TODO`.

### 13.9 Tài liệu đa ngôn ngữ (Việt + Anh trộn lẫn) — trích xuất thế nào?

`/from-doc` agent doc-intel xử lý song ngữ tự nhiên (Opus 4.7 chuyển ngữ tốt). Mẹo:
- Tên feature/module Việt → slug tự chuyển thể (`unidecode`) sang kebab-case ASCII
- Field `name` (Việt) + tuỳ chọn `name_en` (Anh) trong feature-catalog
- Prose business intent: giữ nguyên ngôn ngữ gốc, agent downstream xử lý hỗn hợp được
- Trích dẫn pháp lý Việt: trích nguyên văn (vd. "Nghị định số 30/2020/NĐ-CP")

**Edge case**: tài liệu 100% tiếng Anh nhưng team Việt → `/from-doc` vẫn trích xuất OK, nhưng:
- `name_vn` có thể rỗng → BA stage sẽ làm giàu thêm
- User có thể `/from-doc --deepen --focus "Vietnamese localization"` để LLM sinh `name_vn` cho các entry catalog

### 13.10 SRS dạng PDF scan (ảnh, không OCR) — xử lý sao?

Agent doc-intel đọc PDF qua text layer. PDF scan không có text layer → trích ra rỗng.

**Cần tiền xử lý OCR**:
```bash
# Tesseract OCR (offline):
tesseract input.pdf output -l vie+eng pdf
# Output: output.pdf đã có text layer

# HOẶC dùng Adobe Acrobat OCR (thương mại)
# HOẶC convert qua Google Drive (upload → tải lại dạng Google Doc → export PDF có OCR)

# Sau đó chạy /from-doc:
/from-doc {workspace}                        # docs/inputs/output.pdf — đã OCR
```

**Chất lượng OCR ảnh hưởng trích xuất**:
- Dấu tiếng Việt đôi khi sai (ô → o, ặ → a) → sửa thủ công field quan trọng sau Bước 3
- Bảng OCR không đáng tin → LLM có thể bịa giá trị cell
- Khuyến nghị: review OCR trước khi chạy `/from-doc`, hoặc `--deepen --focus tables` sau

### 13.11 `/resume-module` kẹt ở 1 stage (vd. ba) — debug thế nào?

Triệu chứng: PM gọi BA agent → BA trả verdict nhưng `_state.md.completed-stages.ba` không update.

**Chẩn đoán**:
1. Đọc `{module_path}/ba/00-feature-spec.md` — xem BA có ghi file không
2. Đọc `_state.md.kpi.tokens-by-stage.ba` — agent có chạy và spend token không
3. Đọc verdict JSON của PM từ kết quả Task() — có blocker không
4. `tail -50 docs/intel/_meta.json` — kiểm tra cờ stale

**Nguyên nhân thường gặp**:
- Intel artifact stale → STOP `next-action: /intel-refresh` (đọc kỹ output skill)
- CLI cập nhật state nguyên tử bị lỗi → kiểm tra `ai-kit doctor`
- BA agent loop max-iter (200) → sửa thủ công `_state.md` để pop stage rồi retry
- Lock conflict (>10 phút tuổi) → `rm {module_path}/.resume-lock` rồi retry

**Khôi phục**:
```bash
# Reset cứng stage cụ thể:
ai-kit sdlc state update --kind module --id M-NNN --op stage_rollback --to-stage ba
/resume-module M-NNN
```

### 13.12 Dev wave song song xung đột — tranh chấp file

PM gọi 4 dev agent song song trong dev-wave-1. Nếu 2 agent cùng đụng 1 file → tranh chấp.

**Tech-lead phải lập kế hoạch task không giao nhau** (mỗi task chạm file/module khác nhau). Nếu kế hoạch overlap → tech-lead sai, PM giữ dev wave + escalate.

**Khôi phục**:
1. Đọc `04-tech-lead-plan.md` — verify task có cô lập không
2. Nếu có overlap → user sửa kế hoạch, tách task
3. PM `--rerun-stage tech-lead` rồi tiếp tục dev wave

**CD-10 #13 confidence**: nếu tech-lead `low_confidence` về việc cô lập task → đánh dấu `[NEEDS-VALIDATION]`, PM chặn dev wave cho đến khi user xem lại.

### 13.13 Bàn giao project cho dev/team mới — cần gì?

**Lộ trình onboarding (thứ tự khuyến nghị)**:
1. Clone workspace + `ai-kit update`
2. `ai-kit doctor` — verify môi trường
3. Đọc `docs/intel/_snapshot.md` — bản nén ~5-7K token, cover 95% nội dung định hướng
4. Đọc `docs/modules/*/module-brief.md` — danh sách module + scope
5. `cat docs/intel/_pipeline-state.json` — trạng thái pipeline hiện tại
6. `git log --oneline --all -50` — hoạt động gần đây
7. `/feature-status --module M-NNN` cho từng module quan tâm
8. Tutorial từng skill: `ai-kit doc workflows/{from-doc|resume-feature|generate-docs}`

**Maintainer khi bàn giao**:
- Commit + push tất cả intel artifact
- Dọn các backup `.bak/` mồ côi
- Ghi quyết định vào `docs/intel/decisions.md` hoặc `_meta.json.decisions[]`
- Tag commit `handoff-{date}` làm điểm rollback

### 13.14 Cần "snapshot chỉ-đọc cho stakeholder review" — không cho phép sửa?

**Mẫu snapshot**:
```bash
# Tạo branch chỉ-đọc:
git checkout -b stakeholder-review-2026-05-15
git push origin stakeholder-review-2026-05-15

# Hoặc tạo bundle gọn:
ai-kit zip-disk --output stakeholder-pkg-2026-05-15.zip
# Bundle gồm: docs/intel/_snapshot.md + docs/modules/*/module-brief.md +
#            docs/generated/*.docx (nếu có) + README.md hướng dẫn xem

# Stakeholder review qua:
# - Branch chỉ-đọc trên GitHub
# - HOẶC zip giải nén local
```

→ Stakeholder không cần cài ai-kit vẫn xem được markdown + docx. Phản hồi qua issue / comment.

### 13.15 Schema intel JSON bị bump sau `ai-kit update` — chuyển đổi thế nào?

ai-kit có `schema_version` trong từng intel JSON. Khi update bump schema:
```bash
ai-kit update                                          # Pull bản mới
ai-kit doctor                                          # Phát hiện cảnh báo schema mismatch
ai-kit sdlc verify --scopes schemas --strict warn      # Liệt kê drift

# Tự động chuyển đổi:
ai-kit sdlc autofix --scope schema-migration           # Áp dụng các migration đã biết
```

**Chuyển đổi thủ công** (khi auto fail):
- Đọc `~/.claude/schemas/intel/CHANGELOG.md` xem delta giữa các phiên bản
- Backup `cp -r docs/intel/ docs/intel.bak/`
- Sửa intel JSON theo schema mới (vd. CD-23 thêm field `module_id` cho feature-catalog post-ADR-003)
- `ai-kit sdlc verify --scopes schemas --strict block` — verify

Tương lai: `ai-kit migrate intel --from {old-version} --to {new-version}` chuyển đổi tự động đầy đủ.

### 13.16 Vượt token budget giữa lúc chạy — resume êm thuận thế nào?

Triệu chứng: Claude báo "context limit reached" hoặc API throttle giữa lúc chạy Bước 5g loop.

**Skill thiết kế auto-checkpoint**: mỗi sub-step (5a, 5b, ..., 5g) ghi state ngay sau khi xong. Nếu interrupt:
- `_pipeline-state.json.steps.5.sub_state` ghi sub-step cuối cùng đã done
- Chạy lại `/from-doc` → resume từ sub-step kế tiếp

**Cách giảm token**:
- `output-mode: lean` (mặc định) — agent ghi artifact tối thiểu thay vì `full`
- Tách module thành nhiều module nhỏ hơn (10-15 feature mỗi module)
- Trì hoãn các feature "ước lượng" (chọn option 2 ở scaffold prompt) thay vì full 254
- `/from-doc --deepen --focus area` thay vì re-extract toàn bộ

**Theo dõi chi phí** (Cursor): `ai-kit telemetry` xem token usage theo từng stage.

### 13.17 ai-kit version lệch (skill v0.32 nhưng intel project v0.31) — tương thích ngược?

CD-10 #1 yêu cầu producer phải validate trước khi ghi. Intel cũ có thể có:
- Field thiếu (mới thêm ở v0.32) → skill coi là default/empty
- Field bị xoá (v0.31 có, v0.32 bỏ) → skill bỏ qua
- Field đổi tên → cần migration (xem 13.15)

**Phát hiện**: `ai-kit sdlc verify --scopes schemas` cảnh báo cụ thể.

**Khuyến nghị**:
- Tương thích xuôi: skill v0.32 OK đọc được intel v0.31 (graceful degradation)
- Tương thích ngược: skill v0.31 KHÔNG đảm bảo đọc được intel v0.32 (có field bắt buộc mới)
- Luôn update ai-kit + intel schema cùng lúc: `ai-kit update && ai-kit sdlc autofix --scope schema-migration`

### 13.18 Chỉ muốn ước lượng quy mô (số feature, module, độ phức tạp) — không scaffold?

**Chế độ trích xuất nhẹ** (chưa có flag, quy trình thủ công):
```bash
# Gọi agent doc-intel only (không Bước 4 scaffold, không Bước 5):
@doc-intel "Read docs/inputs/*.md and produce metrics-only summary:
            - Total features count
            - Modules count + decomposition proposal
            - Complexity per module (S/M/L)
            - Estimated total features count + variance
            - Potential blocking gaps
            Output: docs/intel/scope-estimate.md (markdown table only, no full doc-brief)"

# Review scope-estimate.md → quyết định có chạy `/from-doc` đầy đủ hay không
```

Tính năng tương lai: `/from-doc {workspace} --estimate-only` — Bước 1-3 ngắn, output 1 bảng markdown, không scaffold workspace, không emit intel đầy đủ.

Tình huống: báo giá/ước lượng project trước khi commit pipeline; lập kế hoạch ngân sách; quyết định tách monorepo trước.

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
