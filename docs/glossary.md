---
title: Glossary — Thuật ngữ
order: 90
---

# Glossary

Tra cứu nhanh các thuật ngữ thường gặp trong ai-kit. Mỗi mục trỏ đến tài liệu chi tiết khi có.

---

## A

**Agent** — Một LLM-driven worker có vai trò cố định, chạy trong context riêng. Trong Cursor, mỗi stage (ba/sa/tech-lead/dev/fe-dev/qa/reviewer) là một agent. Trong Claude Code, agents thường là background workers (`tdoc-*`, `doc-*`).
→ reference/agents

**ai-kit** — CLI quản lý team config. Pull repo, deploy agents/skills, restart MCP. Single source of truth.
→ reference/ai-kit

---

## C

**Canonical intel** — Tập artifacts JSON chuẩn hoá ở `docs/intel/{workspace}/`, là "shared knowledge" giữa các skills (`from-doc`, `from-code`, `from-idea`, `resume-feature`, `generate-docs`). Mỗi skill READ → VALIDATE → WRITE theo LIFECYCLE contract.
→ Schema: `~/.claude/schemas/intel/`

**Cascade refresh** — Cơ chế khi user pick "Rewind to Spiral X" trong `/from-idea` Phase 0.0 Resume: mark Spiral X..current là `rerun-needed`, decisions[] sau Spiral X mark `rolled-back` (preserve, không xóa), workshop docs move vào `_idea/.history/`. Subsequent spirals MUST re-derive từ new Spiral X output.
→ workflows/from-idea § Section 4.1

**Class A/B/C/D** — Phân loại agent theo vai trò:
- **A** — Stage-report writer (ba, sa, dev, qa, ...)
- **B** — Verifier (validator, lint)
- **C** — Orchestrator (skill dispatcher, `/from-idea`)
- **D** — Doc-generation consumer (`tdoc-*`, `generate-docs`)
→ LIFECYCLE.md §5.8–§5.11

**close-feature** — Skill đóng 1 feature: validate test-evidence đầy đủ, đồng bộ canonical intel.
→ workflows/close-feature

**Coherence flags / Coherence protocol** — Cơ chế phát hiện mâu thuẫn cross-spiral trong `/from-idea` (vd Spiral 4 feature contradicts Spiral 1 PRFAQ assumption). Trigger 3 chỗ: end-of-gate G2/G3/G4 north-star check + inter-spiral semantic compare + Phase 5 5-rule semantic audit. Khi flag → present Reconciliation menu 3 paths (edit prior / edit current / accept với caveat).
→ workflows/from-idea § Section 4.2 · `_idea/coherence-log.md`

**Confidence calibration** — Doctrine B6 trong `/from-idea`: sau mọi quyết định lớn, skill hỏi *"Confident bao % rằng X đúng?"*. < 50% → trigger `[NEEDS-VALIDATION]` flag, propagate vào `feature-catalog.features[].validation_flags[]`.

---

## D

**DEDUP / Dedup Protocol** — Quy tắc CT 34 §6: trước khi đề xuất giải pháp/dự án mới, phải kiểm tra cross-project xem đã có nền tảng dùng chung chưa. Tool: `mcp__etc-platform__dedup_check`. Bắt buộc trong Spiral 2 của `/from-idea` (mỗi deliverable phải có verdict UNIQUE/ADOPT/EXTEND/INTEG/REJECT).

**`decisions[]` log** — Append-only immutable log trong `_pipeline-state.json` của `/from-idea`. Mỗi entry có 4-field rationale: `why` + `considered_alternatives[]` + `confidence_pct` + `assumptions[]`. Không xóa, chỉ mark `superseded` hoặc `rolled-back`. Mục đích: future re-evaluation cần biết "tại sao chọn X tại thời điểm Y".
→ from-idea/SKILL.md § State File

---

## F

**feature-brief.md** — Per-feature artifact (`{features-root}/{feature-id}/feature-brief.md`) là **primary `feature-req` file** mà Cursor `resume-feature` Step 3.0 đọc. Trong `/from-idea` (v0.27+) được enrich self-contained: Vision Context + Domain Context + Risks + Critical Assumptions + Source Spirals pointers — Cursor SDLC stage agents không cần lazy-read `_idea/*.md`.

**feature-catalog.json** — Canonical artifact liệt kê tất cả features của workspace, kèm `id`, `roles[]`, `routes[]`, `acceptance_criteria[]`, `test_evidence_ref`.

**from-code** — Skill reverse-engineer codebase → canonical intel (Luồng B).
→ workflows/from-code

**from-doc** — Skill phân tích SRS/BRD/PDF → seed canonical intel (Luồng A).
→ workflows/from-doc

**from-idea** — Skill brainstorm từ ý tưởng thuần túy qua 4 spirals (PRFAQ → Impact Map → Event Storming → Story Map) + Phase 4.5 pre-mortem → seed canonical intel (Luồng C). Đóng vai **thinking partner** (không phải voice recorder) qua 6 Mode B doctrines.
→ workflows/from-idea · on-board-idea

---

## G

**generate-docs** — Skill assembly: gom canonical intel + test-evidence + screenshots → render Office files (TKKT/TKCS/HDSD/test-cases) qua etc-platform MCP.

**glow** — Markdown renderer cho terminal. `ai-kit doc <topic>` ưu tiên dùng glow nếu cài.

---

## I

**`_idea/` folder** — Workshop artifacts directory ở **workspace level** (không per-feature) cho `/from-idea`: idea-brief, impact-map, event-storming, story-map, pre-mortem, dedup-report, idea-graveyard, coherence-log, assumptions. Path: `{features-root}/_idea/`. **Cursor SDLC mặc định không đọc** — đó là context fossil, đã được digest qua Phase 5 crystallize vào `feature-brief.md`. Stage agents có thể lazy-read qua "Source Spirals" pointers nếu cần deep rationale.

**`idea-brainstormed`** — Giá trị `source-type` trong `_state.md` của features sinh từ `/from-idea` (Luồng C). Phân biệt với `SRS`/`BRD`/`user-input` (from-doc) và `code-reverse-engineered` (from-code). CD-20 enum.

**Idea graveyard** — File `_idea/idea-graveyard.md` (append-only) lưu mọi ý tưởng bị loại trong 4 spirals của `/from-idea`. Mỗi entry có ID `G-NNN`, reason category, resurrect-trigger. Resurrect: `/from-idea --resurrect G-NNN`.
→ from-idea/notepads/idea-graveyard.md

**Intel layer** — xem *Canonical intel*.

**Ink** — Thư viện React-for-terminal. `ai-kit` CLI viết bằng Node + Ink (giống Gemini CLI).

---

## L

**LIFECYCLE contract** — Hợp đồng "production line" giữa các agents/skills. Mỗi agent có 8 trường: ROLE, READ-GATES, OWN-WRITE, ENRICH, FORBID, EXIT-GATES, FAILURE, TOKEN-BUDGET. Xem `~/.claude/schemas/intel/LIFECYCLE.md`.

**Luồng A / Luồng B / Luồng C** — 3 entry-points của SDLC pipeline (3 ingestion paths chung intel layer):
- **Luồng A** — `/from-doc` (có SRS/BRD)
- **Luồng B** — `/from-code` (có codebase)
- **Luồng C** — `/from-idea` (chỉ có ý tưởng — greenfield brainstorm)

Cả 3 đều output cùng schema CD-10 → Cursor SDLC nhận bàn giao identical. (Lưu ý: thuật ngữ "Luồng A/B" cũng dùng ở context khác — top-level "🅰 SDLC vs 🅱 Tài liệu nhà nước". Tùy ngữ cảnh.)
→ on-board · on-board-sdlc · on-board-idea

---

## M

**MCP (Model Context Protocol)** — Chuẩn cho LLM tool servers. Team chạy 1 MCP server duy nhất tên `etc-platform` ở `localhost:8001`.
→ reference/mcp-server

**Mode B doctrines** — 6 prompting doctrines bắt buộc trong `/from-idea` (biến skill từ "voice recorder" thành "thinking partner"):
- **B1 Echo + paraphrase** — confirm intent
- **B2 Generative alternatives** — propose 2 alts trước khi commit
- **B3 Multi-perspective stress test** — engineer/end-user/CFO
- **B4 Assumption surfacing** — buộc lộ giả định
- **B5 Quantitative scaffolding** — Fermi estimate
- **B6 Confidence calibration** — `< 50%` flag

Total ≥ 24 mandatory touchpoints xuyên 4 spirals + Phase 4.5.
→ from-idea/notepads/cognitive-aids.md

---

## N

**`[NEEDS-VALIDATION]` flag** — Marker trong `decisions[]` (từ Confidence calibration < 50%) propagate vào `feature-catalog.features[].validation_flags[]`. Phase 6 Handoff surface count như "open validation work" trước khi SDLC start.

**new-feature** — Skill khởi tạo 1 feature mới qua phỏng vấn tương tác (Cursor). Output: thư mục `F-NNN/` + `_state.md`. Khác `/from-idea` ở chỗ: new-feature thêm 1 feature vào project có sẵn; from-idea brainstorm cả dự án greenfield.
→ workflows/new-feature

---

## P

**Pre-mortem (Phase 4.5)** — Mandatory critical-thinking pass giữa Spiral 4 và Phase 5 crystallize trong `/from-idea`. 2 câu hỏi mandatory: (1) *"1 năm sau dự án FAIL — 3 lý do?"* (2) *"1 năm sau dự án THÀNH CÔNG — bằng cách nào?"*. Risks propagate vào `feature-catalog.features[].risks[]`. Mục đích: chống optimism bias.
→ from-idea/phases/pre-mortem.md

**PRFAQ (Press Release + FAQ)** — Workshop pattern Spiral 1 của `/from-idea` (Amazon Working Backwards). Định nghĩa vision + win condition + persona + 5 FAQ + 3 critical assumptions. Output: `_idea/idea-brief.md` — đây là **north star** cho 3 spiral còn lại + Phase 4.5.

**PRFAQ as north star** — Nguyên tắc trong `/from-idea`: PRFAQ là anchor cố định cho mọi Gate G2/G3/G4. Mỗi gate hỏi *"Output spiral này còn align với PRFAQ vision không?"* trước confirm.

---

## R

**`recap_ledger[]`** — Snapshot context cuối mỗi spiral trong `_pipeline-state.json` của `/from-idea`. Khi user resume sau 7+ ngày, skill đọc `recap_ledger[-1].snapshot` render full recap để cold-start lại context nhanh.

**Resurrect protocol** — Cơ chế trong `/from-idea` để revive ý tưởng từ `idea-graveyard.md`. Manual: `/from-idea --resurrect G-NNN`. Auto-detect: skill thấy user mention idea name match graveyard entry → prompt confirm.

**resume-feature** — Skill chạy đường dây SDLC cho 1 feature đang dở. Đọc `_state.md`, tiếp tục stage tiếp theo.
→ workflows/resume-feature

---

## S

**Skill** — Một workflow tự đóng gói (frontmatter `description` + body markdown), invoke qua slash-command (`/from-doc`, `/from-idea`, `/resume-feature`, ...). Khác với agent: skill là **luồng**, agent là **người chạy luồng**.

**sitemap.json** — Canonical artifact mô tả navigation + routes của ứng dụng + Playwright hints.

**Stage agent** — Agent đại diện 1 vai trò trong SDLC (ba/sa/tech-lead/dev/fe-dev/qa/reviewer). Mỗi stage đọc `_state.md`, làm việc của mình, ghi report, update state.

**Spiral 1-4** — 4 workshops bắt buộc trong `/from-idea`:
- **Spiral 1 PRFAQ** (Amazon Working Backwards)
- **Spiral 2 Impact Mapping** (Gojko Adzic) + DEDUP gate
- **Spiral 3 Event Storming** (Brandolini, adaptive depth Light/Heavy)
- **Spiral 4 User Story Mapping** (Patton) + TC seeds

Mỗi spiral có Gate G1-G4 với coherence check + max 2 backs. Phase 4.5 pre-mortem theo sau Spiral 4.

**`source-type`** — Field trong `_state.md` frontmatter (CD-20) phân biệt origin của feature: `SRS`/`BRD`/`user-input` (from-doc), `code-reverse-engineered` (from-code), `idea-brainstormed` (from-idea).

---

## T

**test-evidence** — Artifact `docs/intel/test-evidence/{feature-id}.json` chứa danh sách test cases (prose + executed) + screenshots map. Producer chain: `from-doc/synthesized` (seeds) | `from-code/extracted` (existing tests) | `from-idea/synthesized` (greenfield seeds) | `qa-executed` (passed/failed). Consumer: `generate-docs` (xlsx).

**Thinking partner** — Triết lý thiết kế của `/from-idea`: skill phải đóng vai **partner phản biện** (echo, alternatives, perspectives, assumptions, quant, confidence) thay vì chỉ "voice recorder" ghi lại lời user. 6 Mode B doctrines là hiện thực của triết lý này.

**TKCS** — Thiết kế cơ sở (theo NĐ 45/2026 Đ13). 1 trong các Office output của `generate-docs`.

**TKKT** — Thiết kế kiến trúc kỹ thuật. Cũng là output của `generate-docs`.

---

## W

**Workspace** — Thư mục gốc của 1 dự án (chứa `docs/intel/`). Mỗi `docs/intel/` = 1 workspace, đứng độc lập với workspace khác.

---

> Thiếu thuật ngữ? Mở PR thêm vào file này — phong cách: 1–3 câu, kèm liên kết đến tài liệu chi tiết.
