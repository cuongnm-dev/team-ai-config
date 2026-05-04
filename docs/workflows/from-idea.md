---
title: Workflow — Từ Ý tưởng → Intel + SDLC handoff
order: 13
---

# Workflow — Từ Ý tưởng thuần túy → Intel + SDLC handoff (Luồng C)

Pipeline 2 bước: **`/from-idea` → SDLC (Cursor) → `/generate-docs`**.

Đây là entry-point thứ 3 (alongside `/from-doc` và `/from-code`) cho luồng SDLC, dành cho trường hợp **chưa có code, chưa có tài liệu — chỉ có ý tưởng**.

## Khi nào dùng

- Greenfield project: chỉ có ý tưởng trong đầu, chưa có SRS/BRD, chưa có codebase
- Founder/PM muốn brainstorm có cấu trúc trước khi thuê dev
- Internal tool ideation, không có business analyst
- Concept exploration cần "kết tinh" thành backlog shippable

> **KHÔNG dùng nếu**: Có doc → `/from-doc`. Có code → `/from-code`. Thêm 1 feature vào project có sẵn → `/new-feature` (Cursor).

## Tiền điều kiện

- Workspace trống hoặc workspace mới (`mkdir my-idea && cd my-idea`)
- Docker đang chạy (cho MCP `etc-platform` warm-start KB cache, optional)
- Thời gian **liên tục 1.5-3 giờ** cho 4 spirals + pre-mortem (có thể chia nhiều session — skill resume liền mạch)
- Đã chạy `ai-kit update` để có config mới nhất

## Triết lý — Thinking Partner (không phải Voice Recorder)

`/from-idea` không chỉ "ghi lại" ý tưởng. Skill đóng vai **partner** áp dụng 6 doctrine bắt buộc trong mọi spiral:

1. **Echo + paraphrase** — diễn giải lại ý của user để confirm intent
2. **Generative alternatives** — đề xuất 2 hướng thay thế (1 contrarian, 1 từ KB pattern) để force user articulate "vì sao chọn X"
3. **Multi-perspective stress test** — chuyển góc nhìn (engineer / end-user / CFO)
4. **Assumption surfacing** — buộc lộ 3 giả định lớn nhất + cách verify
5. **Quantitative scaffolding** — convert "vibes" thành "evidence" (Fermi estimate, ngưỡng KPI)
6. **Confidence calibration** — buộc user calibrate % confidence; <50% trigger `[NEEDS-VALIDATION]` flag

## Quy trình — 6 phases (4 spirals + pre-mortem + crystallize/handoff)

### Phase 0 — Bootstrap

Skill init `docs/intel/` + `_pipeline-state.json`. Optional MCP warm-start lookup actor-pattern + feature-archetype từ project tương tự (nếu MCP up).

**Phase 0.5 — Visual Primer (optional):** anh/chị có thể share 1-3 hình ảnh tham khảo (mockup, sketch, screenshot competitor) hoặc đoạn mô tả ngắn ≤ 1000 chars. Skill đọc multimodal + ghi vào `_idea/visual-primer.md`. KHÔNG phải full doc — đó là việc của `/from-doc`.

### Phase 1 — Spiral 1: PRFAQ (Amazon Working Backwards)

Workshop định nghĩa **vision + win condition** trước khi bàn solution. Skill phỏng vấn:
- Headline 1 câu (như Apple/Amazon press release)
- Sub-headline (problem + customer)
- Solution paragraph (HOW, không quá technical)
- Customer quote (1-2 câu cảm xúc)
- 5 FAQ: Why now / Why us / Why this approach / What could fail / Success metric
- 3 critical assumptions (mandatory exit gate)

Output: `_idea/idea-brief.md`. Đây là **north star** cho 3 spiral còn lại.

### Phase 2 — Spiral 2: Impact Mapping (Gojko Adzic)

Workshop dựng mind-map 4 tier: **Goal → Actors → Impacts → Deliverables**.

**DEDUP gate (mandatory)**: mỗi deliverable chạy qua KB ecosystem check (CT 34 Nguyên tắc 6) — phát hiện trùng với nền tảng dùng chung quốc gia (NDXP/LGSP/CSDLQG/VNeID nếu là dự án chính phủ) → rewrite as ADOPT/EXTEND/INTEG thay vì xây mới.

Skill hỏi đầu spiral: *"Đây có phải dự án cho cơ quan nhà nước Việt Nam không?"* — nếu có, dispatch agent `policy-researcher` cho VN gov platform research.

Output: `_idea/impact-map.md` (text tree + Mermaid mind-map) + `_idea/dedup-report.md`.

### Phase 3 — Spiral 3: Event Storming (Brandolini, adaptive depth)

Workshop dựng domain model qua timeline events → commands → aggregates → bounded contexts.

**Adaptive depth heuristic** (skill tự đánh giá từ Spiral 2 output):
- ≥ 2 signals (>3 actors / >8 features / monorepo / domain keywords) → **HEAVY mode** (full)
- 0-1 signals → **LIGHT mode** (≤ 5 events, ≤ 3 aggregates)
- 1 borderline → ASK USER 1 câu trước khi route

Output: `_idea/event-storming.md`. Skill **không** ghi `data-model.json` hay routes cụ thể — đó là việc của `sa` stage.

### Phase 4 — Spiral 4: User Story Mapping (Patton) + TC seeds

Workshop dựng story map: backbone (user journey) → walking skeleton (MVP) → release slices.

Output:
- `_idea/story-map.md` (table + ASCII viz)
- `test-evidence/{F-NNN}.json` cho mỗi must-have feature (synthesized seeds, source: `from-idea/synthesized`, status: `not-executed`)
- Min TC count theo CD-10 #15: `min_tc = max(5, AC×2 + roles×2 + dialogs×2 + errors + 3)`

### Phase 4.5 — Pre-mortem & Post-mortem (mandatory)

Critical thinking pass — buộc user tưởng tượng FAIL/SUCCESS từ 1 năm sau:
1. *"Tưởng tượng dự án FAIL — 3 lý do hàng đầu?"*
2. *"Tưởng tượng dự án THÀNH CÔNG vang dội — bằng cách nào?"*

Output: `_idea/pre-mortem.md` với risk register + success pathways. Risks propagate vào `feature-catalog.features[].risks[]`.

### Phase 5 — Crystallize

Convert workshop docs thành 4 intel artifacts + per-feature `_state.md`:
1. FK integrity check (8 rules)
2. Semantic audit (5 rules)
3. Issue F-NNN canonical IDs (collision check)
4. **Per-artifact merge decision (Option 3)**: nếu artifact đã có (vd `from-doc` chạy trước) → ASK USER `Replace` (backup .bak) hoặc `Append` (qua `intel-merger`)
5. Emit `actor-registry.json` + `permission-matrix.json` + `sitemap.json` + `feature-catalog.json`
6. Emit `test-evidence/{F-NNN}.json` per must-have feature
7. Emit `_state.md` + `feature-brief.md` per feature (CD-20 unified, source-type: `idea-brainstormed`, current-stage: `ba`)
8. Run `intel-validator --quick` (mandatory)
9. Run `intel-snapshot/generate.py` (Cursor Rule 24)

### Phase 6 — Handoff

Print summary tiếng Việt: feature count, role count, TC seeds, risks high-severity, idea-graveyard count, [CẦN BỔ SUNG] gaps, [NEEDS-VALIDATION] flags.

Print next-step: `/resume-feature {first-must-have-id}` để Cursor SDLC nhận bàn giao.

## Cơ chế đặc biệt — Liền mạch + Nhất quán + Tỉnh táo

### Continuity (across sessions)

Skill resume liền mạch giữa các session qua:
- **Phase 0.0 Resume Detection**: detect existing state → 4 lựa chọn (Resume / Restart / Rewind to Spiral X / View digest)
- **Time-aware recap**: < 24h light, 24h-7d full, > 7d mandatory vision-check
- **decisions[] immutable log** + **recap_ledger[]** snapshot context
- **Cascade refresh on rewind**: rewind to Spiral N → mark Spiral N+1..4 "rerun-needed", preserve originals trong `_idea/.history/`

### Coherence (between spirals)

- **PRFAQ as north star**: mọi Gate G2/G3/G4 hỏi "còn align với vision không?"
- **Inter-spiral semantic compare**: 6 rule check tại G3 + G4 (persona ↔ actors, MVP cut ↔ must-have impacts, ...)
- **Conflict resolution menu**: phát hiện mâu thuẫn → 3 paths (edit prior / edit current / accept với caveat)
- **Phase 5 semantic audit**: 5 rule cuối (orphan role, orphan aggregate, persona consistency, ...)

### Clarity (chống decision fatigue)

- **Recap header** mỗi spiral entry (3-bullet: Đã chốt / Đang quyết / Để sau)
- **Sanity check** tại iteration 2 mọi spiral
- **Fatigue gate**: 2 backs + > 30 min → suggest break, auto-save state
- **Scope creep detector**: `must_have / win_conditions > 3` → warning

### Loss-less ideas (idea graveyard)

- File `_idea/idea-graveyard.md` persist mọi ý tưởng đã loại + reason + spiral + resurrect-trigger
- `/from-idea --resurrect <G-NNN>` để revive nếu context thay đổi

## Ví dụ thực tế

```bash
# 1. Bắt đầu brainstorm (workspace mới)
mkdir my-startup && cd my-startup
User: /from-idea
> Workspace ready. Visual primer optional?
> [skip] → Spiral 1 PRFAQ
> Q1.1.1: Headline 1 câu...

# 2. 4 spirals (1.5-3 giờ, có thể chia session)
> Spiral 1 PRFAQ (~30 min)
> Spiral 2 Impact Map + DEDUP (~45 min)
> Spiral 3 Event Storming (Light mode detected — ~20 min)
> Spiral 4 Story Map + TC seeds (~45 min)
> Phase 4.5 Pre-mortem (~20 min)

# 3. Crystallize
> Phase 5: 4 intel artifacts + 6 _state.md + 6 test-evidence files written
> intel-validator: PASS
> snapshot: [OK]

# 4. Handoff summary
> Vision: "AI code review cho solo dev"
> Features: 6 total (4 must-have, 2 should-have)
> Actors: 2 (solo-dev, team-lead)
> TC seeds: 38
> Risks: 1 high (single-user adoption uncertain)
> Bước tiếp: /resume-feature F-001 (trong Cursor)

# 5. SDLC từng feature (Cursor)
/resume-feature F-001    → ba elaborate AC → sa design → ... → done
... lặp F-002..F-006

# 6. Sinh tài liệu (Claude, sau khi features done)
/generate-docs
> 6 features, ASSEMBLY mode (test-evidence executed)
> Output: docs/generated/my-startup/output/

# 7. Bàn giao
/zip-disk
> my-startup-ban-giao-20260504.zip created
```

## Resume sau session đứt quãng

```bash
# Quay lại sau 3 ngày
User: /from-idea
> 🕒 Bạn quay lại sau 3 ngày 5 giờ.
> 📌 Vision (PRFAQ): "AI code review cho solo dev"
> 🎯 Win condition: "Giảm 50% review time trong 6 tháng"
> Đã chốt: vision + 5 actors + 4 deliverables (DEDUP done)
> Đang dở: Spiral 3 Event Storming, iteration 1
> 4 lựa chọn:
>   🟢 Tiếp tục (Resume)
>   🔄 Bắt đầu lại (Restart fresh)
>   ⏮ Rewind to Spiral X
>   📜 Xem digest
> Lựa chọn:
User: 🟢
> Continuing Spiral 3...
```

## Quick reference — bridge canonical intel

`docs/intel/` là single-source-of-truth giữa 3 entry-points (CD-10):

```
/from-idea  → seeds (manual confidence: actor-registry, feature-catalog
                     proposed; permission-matrix + sitemap "low" — sa enriches)
/from-doc   → seeds (medium confidence: doc evidence)
/from-code  → seeds (high confidence: code evidence + actor-enum)
SDLC stages → enrich (description, AC, routes, entities, test-evidence)
/generate-docs → consume only (read-only on intel)
```

`/from-idea` initialize bottom rung của confidence ladder. Subsequent producers (from-doc, from-code) raise confidence khi accumulate evidence.

## Output checklist

Sau Phase 6 hoàn tất, anh/chị sẽ có:

- [ ] `docs/intel/{actor-registry, permission-matrix, sitemap, feature-catalog}.json` (4 artifacts)
- [ ] `docs/intel/test-evidence/{F-NNN}.json` (per must-have feature)
- [ ] `docs/intel/_meta.json` (provenance: `manual-interview` / `from-idea`)
- [ ] `docs/intel/_pipeline-state.json` (skill state)
- [ ] `docs/intel/_snapshot.md` (Cursor Rule 24 regen)
- [ ] `docs/features/_idea/{idea-brief, impact-map, event-storming, story-map, pre-mortem, dedup-report, idea-graveyard, coherence-log, assumptions}.md` (workshop artifacts)
- [ ] `docs/features/F-NNN/_state.md` + `feature-brief.md` (per feature, CD-20 unified)
- [ ] `docs/feature-map.yaml` updated

Sẵn sàng cho Cursor `/resume-feature F-NNN`.

## Liên quan

- from-doc — Khi đã có SRS/BRD
- from-code — Khi codebase có sẵn
- new-feature — Thêm 1 feature vào project có sẵn (Cursor)
- resume-feature — Tiếp tục SDLC sau khi from-idea bàn giao
- generate-docs — Sinh Office files sau khi features `done`
- new-strategic-document — KHÁC luồng (Đề án CĐS / tài liệu chiến lược)
- troubleshooting

## Pitfalls thường gặp

| Vấn đề | Cause | Fix |
|---|---|---|
| Skill yêu cầu Phase 4.5 pre-mortem, không cho skip | Mandatory by design (chống optimism bias) | Trả lời 3 failure modes + 3 success pathways. Có thể dùng `--skip-premortem` nhưng sẽ logged + audit |
| DEDUP REJECT verdict trên > 50% deliverables | Scope quá rộng, trùng nền tảng dùng chung | Recommend rewrite scope, focus vào unique value-add |
| Pre-mortem: > 50% failure modes unmitigated | Kế hoạch quá optimistic | Skill warn → user chọn rewind to Spiral 4 (giảm scope) hoặc accept high-risk profile |
| User answers `[CẦN BỔ SUNG]` > 30% fields | Thiếu thông tin nền (chưa nói chuyện với stakeholder, chưa research) | Skill recommend offline clarification, save state, resume sau |
| MCP down khi DEDUP gate | Docker container etc-platform stopped | `ai-kit mcp start`, hoặc skill fallback local KB read (degraded) |
| Iteration > 2 trong 1 spiral | Stuck hoặc decision fatigue | Force-decision menu: Confirm-with-gaps / Cancel session / Continue-with-warning |

## Triết lý

`/from-idea` thiết kế theo nguyên tắc:
- **Brainstorm là quá trình**, không phải sự kiện đơn lẻ → resume liền mạch
- **Ý tưởng tốt phải qua thẩm tra** → DEDUP + pre-mortem + multi-perspective mandatory
- **Decision rationale quan trọng hơn decision** → 4-field schema (`why` / `considered_alternatives` / `confidence_pct` / `assumptions`)
- **Không mất ý tưởng** → idea-graveyard append-only + resurrect protocol
- **Confidence honest hơn confidence cao** → calibration rule, < 50% trigger `[NEEDS-VALIDATION]`

Output là intake-stage intel chất lượng cao để Cursor SDLC nhận bàn giao mượt mà.
