---
title: On-board 🅒 Luồng C — SDLC từ ý tưởng (greenfield brainstorm)
order: 13
---

# On-board 🅒 — Luồng C: SDLC từ ý tưởng thuần túy

Tài liệu này dành cho **founder / PM / product owner / internal-tool ideator** đang **chỉ có ý tưởng trong đầu** — chưa có SRS/BRD, chưa có codebase. Nếu anh/chị có sẵn tài liệu yêu cầu → `ai-kit doc on-board-sdlc` (Luồng A: from-doc). Nếu đã có codebase → `ai-kit doc on-board-sdlc` (Luồng B: from-code).

> Đọc xong, bạn sẽ biết:
> - Khi nào nên dùng Luồng C (vs A và B)
> - Pipeline 6 phases + 4 spirals + pre-mortem
> - Vai trò "thinking partner" (không phải voice recorder) của skill
> - Output đích cuối + handoff sang Cursor SDLC

> Đầu vào: ý tưởng + (tùy chọn) 1-3 ảnh tham khảo.
> Đầu ra: bộ intel + per-feature `_state.md` cho team SDLC bắt nhịp ngay.

---

## 1. Khi nào dùng Luồng C?

Quyết định nhanh:

| Tình huống | Luồng | Skill |
|---|---|---|
| Có SRS/BRD docx | 🅐 Luồng A | `/from-doc` |
| Có codebase đã ship | 🅑 Luồng B | `/from-code` |
| **Chỉ có ý tưởng + (tùy chọn) mockup ngắn** | **🅒 Luồng C** | **`/from-idea`** |
| Thêm 1 feature vào project hiện có | (any) | `/new-feature` (Cursor) |

**Anti-trigger** (KHÔNG dùng Luồng C):
- Đã có SRS/BRD đủ chi tiết → dùng Luồng A (đỡ tốn brainstorm)
- Có codebase → dùng Luồng B (extract từ code chính xác hơn)
- Soạn Đề án CĐS hoặc hồ sơ thầu nhà nước → đi sang `on-board-tailieu`

---

## 2. Triết lý — Thinking Partner (không phải Voice Recorder)

`/from-idea` không chỉ "ghi lại" lời user. Skill đóng vai **partner phản biện** áp dụng 6 doctrine bắt buộc trong mọi spiral:

| Doctrine | Ý nghĩa |
|---|---|
| **B1 Echo + paraphrase** | Diễn giải lại ý của user để confirm intent — phát hiện diễn đạt mơ hồ |
| **B2 Generative alternatives** | Đề xuất 2 hướng thay thế (1 contrarian, 1 KB pattern) trước khi commit — chống "yes-and" |
| **B3 Multi-perspective stress test** | Chuyển góc nhìn (engineer / end-user / CFO) — lộ tradeoff bị che |
| **B4 Assumption surfacing** | Buộc user list 3 giả định lớn nhất + cách verify — chống optimism bias |
| **B5 Quantitative scaffolding** | Convert "vibes" thành "evidence" (Fermi estimate, ngưỡng KPI) |
| **B6 Confidence calibration** | Buộc calibrate % confidence — < 50% trigger `[NEEDS-VALIDATION]` flag |

Lý do quan trọng: brainstorm-only workflow dễ rơi vào **optimism bias** + **scope creep**. 6 doctrine + Phase 4.5 pre-mortem là cơ chế phòng vệ.

---

## 3. Pipeline tổng thể — 6 phases

```
USER nhập "/from-idea"
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 0.0   Resume Detection (4 lựa chọn nếu state đã có)          │
│  PHASE 0     Bootstrap (workspace + intel + MCP warm-start)         │
│  PHASE 0.5   Visual Primer (optional, ≤ 3 ảnh + ≤ 1000 chars text)  │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 1   Spiral 1 — PRFAQ (Amazon Working Backwards)              │
│            Vision + 5 FAQ + 3 critical assumptions                  │
│            → _idea/idea-brief.md                                    │
│                                                                      │
│  PHASE 2   Spiral 2 — Impact Mapping (Gojko Adzic)                  │
│            Goal → Actors → Impacts → Deliverables + DEDUP gate      │
│            → _idea/impact-map.md + _idea/dedup-report.md            │
│                                                                      │
│  PHASE 3   Spiral 3 — Event Storming (Brandolini, adaptive depth)   │
│            Light: ≤ 5 events, ≤ 3 aggregates                        │
│            Heavy: full timeline + bounded contexts (mono only)      │
│            → _idea/event-storming.md                                │
│                                                                      │
│  PHASE 4   Spiral 4 — User Story Mapping (Patton) + TC seeds        │
│            Backbone → walking skeleton (MVP) → release slices       │
│            min_tc = max(5, AC×2 + roles×2 + dialogs×2 + errors + 3) │
│            → _idea/story-map.md + test-evidence/F-NNN.json          │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 4.5   Pre-mortem & Post-mortem (mandatory critical pass)     │
│              Q1: "1 năm sau dự án FAIL — 3 lý do hàng đầu?"         │
│              Q2: "1 năm sau dự án THÀNH CÔNG — bằng cách nào?"      │
│              → _idea/pre-mortem.md + risks vào feature-catalog      │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 5   Crystallize                                              │
│            FK validate + Semantic audit (5 rules)                   │
│            Per-artifact merge decision (Replace / Append / Skip)    │
│            Emit: actor-registry, permission-matrix, sitemap,        │
│                  feature-catalog, test-evidence/F-NNN.json,         │
│                  per-feature _state.md + feature-brief.md           │
│            intel-validator --quick + snapshot regen                 │
│                                                                      │
│  PHASE 6   Handoff                                                  │
│            VN summary + next-step (`/resume-feature {first-MVP}`)   │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
   Cursor SDLC takes over (resume-feature → ba → sa → dev → qa → ...)
```

---

## 4. Pipeline đặc biệt — Liền mạch + Nhất quán + Tỉnh táo

Brainstorm hiếm khi liền mạch 1 lần. User pause, quay lại sau vài ngày, đôi khi đổi ý. `/from-idea` thiết kế 3 cơ chế:

### 4.1 Continuity (across sessions)

| Cơ chế | Mô tả |
|---|---|
| **Phase 0.0 Resume Detection** | Detect state → 4 lựa chọn: Resume / Restart / Rewind to Spiral X / View digest |
| **Time-aware recap** | < 24h: light recap. 24h–7d: full recap. > 7d: vision-check (đọc lại PRFAQ + xác nhận solid) |
| **`decisions[]` immutable log** | Mọi quyết định lớn ghi `why`/`considered_alternatives`/`confidence_pct`/`assumptions` |
| **Cascade refresh on rewind** | Rewind to Spiral N → mark Spiral N+1..4 "rerun-needed", preserve originals trong `_idea/.history/` |

### 4.2 Coherence (between spirals)

| Cơ chế | Mô tả |
|---|---|
| **PRFAQ as north star** | Spiral 1 output = anchor cố định. G2/G3/G4 hỏi "còn align với vision không?" |
| **Inter-spiral semantic compare** | 6 rule check tại G3 + G4 (persona ↔ actors, MVP cut ↔ must-have impacts) |
| **Conflict resolution menu** | Phát hiện mâu thuẫn → 3 paths (edit prior / edit current / accept với caveat) |
| **Phase 5 semantic audit** | 5 rule cuối: orphan role, orphan feature, persona consistency, MVP ancestry, aggregate reference |

### 4.3 Clarity (chống decision fatigue)

| Cơ chế | Mô tả |
|---|---|
| **Recap header mỗi spiral** | 3-bullet: Đã chốt / Đang quyết / Để sau |
| **Sanity check tại iteration 2** | "Feature X bạn đề xuất — vẫn solid hay scope creep / fatigue?" |
| **Fatigue gate** | 2 backs + > 30 min → suggest break, auto-save |
| **Scope creep detector** | `must_have / win_conditions > 3` → cảnh báo |
| **Idea graveyard** | File `_idea/idea-graveyard.md` persist mọi ý tưởng đã loại + reason + resurrect-trigger |

---

## 5. Output đích cuối

Sau Phase 6 hoàn tất, anh/chị có:

```
{workspace}/
├── docs/
│   ├── intel/                              # Canonical intel layer
│   │   ├── actor-registry.json             # Roles + auth (manual confidence)
│   │   ├── permission-matrix.json          # Proposed RBAC (low confidence — sa enriches)
│   │   ├── sitemap.json                    # Placeholder routes (sa designs)
│   │   ├── feature-catalog.json            # Features status: proposed
│   │   ├── test-evidence/F-NNN.json        # TC seeds source: from-idea/synthesized
│   │   ├── _meta.json                      # producer: manual-interview, produced_by_skill: from-idea
│   │   ├── _pipeline-state.json            # Skill state for resume
│   │   └── _snapshot.md                    # Cursor Rule 24 regen
│   └── features/
│       ├── _idea/                          # Workshop artifacts
│       │   ├── idea-brief.md               # PRFAQ — north star
│       │   ├── impact-map.md               # 4-tier mind-map
│       │   ├── event-storming.md           # Domain events + aggregates
│       │   ├── story-map.md                # MVP cut + TC seeds
│       │   ├── pre-mortem.md               # Risks + success pathways
│       │   ├── dedup-report.md             # CT 34 Nguyên tắc 6 verdicts
│       │   ├── idea-graveyard.md           # Loss-less rejected ideas
│       │   ├── coherence-log.md            # Cross-spiral conflict resolutions
│       │   └── assumptions.md              # Critical assumptions register
│       ├── F-001/
│       │   ├── _state.md                   # CD-20 unified, source-type: idea-brainstormed
│       │   └── feature-brief.md            # Primary feature-req file
│       ├── F-002/...
│       └── feature-map.yaml                # Registry
```

Bộ này **identical** với output của `/from-doc` và `/from-code` (cùng schema CD-10) — Cursor SDLC nhận bàn giao mượt mà.

---

## 6. Bước tiếp — Handoff sang Cursor SDLC

Sau khi `/from-idea` hoàn tất Phase 6:

```bash
# 1. Bàn giao đầu tiên
/resume-feature F-001

# Cursor sẽ:
# - Đọc docs/features/F-001/_state.md (current-stage: ba)
# - Đọc feature-brief.md (primary feature-req)
# - Dispatch ba agent → elaborate AC, business_rules
# - Tiếp tục: ba → sa → tech-lead → dev → qa → reviewer → close

# 2. Lặp cho mỗi must-have feature
/resume-feature F-002
/resume-feature F-003
...

# 3. Sau khi tất cả features `done`
/generate-docs
# → Sinh 5 file Office (TKKT, TKCS, TKCT, HDSD, test-cases.xlsx)

# 4. Bàn giao deliverable
/zip-disk
# → {project-name}-ban-giao-{date}.zip
```

---

## 7. So sánh 3 luồng SDLC

| Aspect | 🅐 Luồng A (from-doc) | 🅑 Luồng B (from-code) | 🅒 **Luồng C (from-idea)** |
|---|---|---|---|
| Đối tượng | BA / dev team có SRS | Dev team / SA legacy | **Founder / PM / product owner** |
| Input | SRS/BRD .docx | Codebase | **Ý tưởng + (optional) mockup** |
| Producer tag | `doc-intel` | `code-harvester` | **`manual-interview` (from-idea)** |
| Source-type | `SRS`/`BRD` | `code-reverse-engineered` | **`idea-brainstormed`** |
| Confidence baseline | `medium` | `high` | **`manual`** |
| Critical pass | (tùy doc) | (tùy code) | **Phase 4.5 pre-mortem mandatory** |
| Continuity mechanism | _pipeline-state.json | _pipeline-state.json | **+ decisions[] log + cascade refresh + idea-graveyard** |
| Coherence checks | Cơ bản | Cơ bản | **PRFAQ north-star + 6 inter-spiral rules + 5-rule semantic audit** |
| Thời gian estimate | 30-60 phút | 60-120 phút | **1.5-3h (chia nhiều session OK)** |
| Output | Identical (CD-10 schema) | Identical | Identical |

`/from-idea` initialize bottom rung của confidence ladder. Khi sau này có code → `/from-code` raise confidence từ `manual` lên `high`.

---

## 8. Pitfalls thường gặp

| Vấn đề | Cause | Fix |
|---|---|---|
| Phase 4.5 pre-mortem mandatory, không cho skip | Chống optimism bias by design | Trả lời 3 failure + 3 success. `--skip-premortem` flag sẽ logged + audit |
| DEDUP REJECT > 50% deliverables | Scope quá rộng, trùng nền tảng dùng chung | Skill recommend rewrite scope, focus vào unique value-add |
| Pre-mortem: > 50% failure modes unmitigated | Kế hoạch quá optimistic | User chọn rewind to Spiral 4 (giảm scope) hoặc accept high-risk profile |
| `[CẦN BỔ SUNG]` > 30% fields | Thiếu thông tin nền (chưa nói chuyện với stakeholder) | Skill recommend offline clarification, save state, resume sau |
| MCP down khi DEDUP gate | Docker container etc-platform stopped | `ai-kit mcp start`, hoặc skill fallback local KB read (degraded) |
| Iteration > 2 trong 1 spiral | Stuck hoặc decision fatigue | Force-decision menu: Confirm-with-gaps / Cancel / Continue-with-warning |

---

## 9. Liên quan

- `from-idea` — Workflow chi tiết của skill `/from-idea`
- `on-board-sdlc` — Tổng quan SDLC pipeline (3 luồng A/B/C + stage agents)
- `on-board-tailieu` — Luồng B (Tài liệu nhà nước, KHÁC luồng SDLC)
- `from-doc` — Luồng A (có SRS/BRD)
- `from-code` — Luồng B (có codebase)
- `resume-feature` — Cursor SDLC tiếp nhận sau Phase 6 handoff
- `skills` — Decision matrix đầy đủ
- `glossary` — Thuật ngữ (intel, LIFECYCLE, CD-10, ...)

## Triết lý

`/from-idea` được thiết kế theo nguyên tắc:

- **Brainstorm là quá trình**, không phải sự kiện đơn lẻ → resume liền mạch
- **Ý tưởng tốt phải qua thẩm tra** → DEDUP + pre-mortem + multi-perspective bắt buộc
- **Decision rationale quan trọng hơn decision** → 4-field schema cho `decisions[]`
- **Không mất ý tưởng** → idea-graveyard append-only + resurrect protocol
- **Confidence honest hơn confidence cao** → calibration rule, < 50% trigger `[NEEDS-VALIDATION]`

Output là intake-stage intel chất lượng cao để Cursor SDLC nhận bàn giao mượt mà.
