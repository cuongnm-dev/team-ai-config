---
title: On-board 🅰 SDLC — Sản xuất phần mềm (from-doc, from-code, SDLC pipeline)
order: 11
---

# On-board 🅰 — Luồng SDLC (Sản xuất phần mềm)

Tài liệu này dành cho **dev/BA/SA/QA team** làm phần mềm bàn giao. Nếu anh/chị đang soạn Đề án CĐS hay làm hồ sơ thầu, chạy `ai-kit doc on-board-tailieu` thay vì đọc tài liệu này.

> Đọc xong, bạn sẽ biết:
> - Pipeline SDLC có những thành phần gì (Claude / Cursor / MCP)
> - Dữ liệu chảy thế nào từ SRS/codebase đến Office docs nghiệm thu
> - Skill nào nằm ở đâu trong pipeline
> - Khi nào dùng Cursor, khi nào dùng Claude Code

> Đầu vào: SRS/BRD docx HOẶC codebase đã ship.
> Đầu ra: code chạy được + 5 file Office nghiệm thu (TKKT, TKCS, TKCT, HDSD, test-cases) theo NĐ 45/2026.

---

## 1. Ba thành phần cốt lõi

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   ┌───────────────────┐    ┌───────────────────┐                    │
│   │   CLAUDE CODE     │    │      CURSOR       │                    │
│   │   (terminal CLI)  │    │   (IDE + chat)    │                    │
│   │                   │    │                   │                    │
│   │   - from-doc      │    │   - new-feature   │                    │
│   │   - from-code     │    │   - resume-feature│                    │
│   │   - generate-docs │    │   - close-feature │                    │
│   │   - intel-fill    │    │   - feature-status│                    │
│   │   - intel-refresh │    │                   │                    │
│   │                   │    │   Stage agents:   │                    │
│   │   11 skills       │    │   ba/sa/dev/qa/...│                    │
│   │   22 agents       │    │   31 agents       │                    │
│   │                   │    │   26 skills       │                    │
│   └─────────┬─────────┘    └─────────┬─────────┘                    │
│             │                        │                              │
│             │   Cùng đọc/ghi vào:    │                              │
│             ▼                        ▼                              │
│         ┌──────────────────────────────────┐                        │
│         │     CANONICAL INTEL LAYER        │                        │
│         │     docs/intel/*.json            │                        │
│         │                                  │                        │
│         │  - actor-registry  (roles)       │                        │
│         │  - sitemap         (routes)      │                        │
│         │  - feature-catalog (features)    │                        │
│         │  - permission-matrix (RBAC)      │                        │
│         │  - data-model      (entities)    │                        │
│         │  - test-evidence/  (TC + screens)│                        │
│         │  - _meta.json      (provenance)  │                        │
│         └──────────────┬───────────────────┘                        │
│                        │                                            │
│                        ▼                                            │
│              ┌──────────────────────┐                               │
│              │  etc-platform MCP    │  (port 8001 — Docker)         │
│              │                      │                               │
│              │  - Render TKKT/TKCS  │                               │
│              │  - Render TKCT/HDSD  │                               │
│              │  - Render test cases │                               │
│              └──────────────────────┘                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**3 phần là độc lập** nhưng giao tiếp qua intel layer:
- Cursor agents (ba/sa/dev/qa) làm SDLC pipeline
- Claude skills làm "ingestion" (đọc tài liệu/code) và "rendering" (sinh Office)
- MCP server là engine render Office files

**Intel layer = single source of truth.** Mọi skill/agent đều ĐỌC từ đây hoặc GHI vào đây, không trao đổi trực tiếp với nhau.

---

## 2. Dòng chảy dữ liệu — Big picture

Đây là pipeline đầy đủ từ "có ý tưởng" đến "có Office docs nghiệm thu":

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   STEP 1: INGESTION                          STEP 2: SDLC                │
│   ──────────────────────                     ──────────────────────      │
│                                                                          │
│   ┌──────────┐                                                           │
│   │ SRS.docx │──► /from-doc ─────┐                                       │
│   └──────────┘                   │                                       │
│                                  ▼                                       │
│   ┌──────────┐                                                           │
│   │ Codebase │──► /from-code ─► docs/intel/ ──┐                          │
│   └──────────┘                       ▲        │                          │
│                                      │        ▼                          │
│                                      │   /new-feature     ──┐            │
│                                      │   /resume-feature  ──┤            │
│                                      │                      ▼            │
│                                      │            ┌─────────────┐        │
│                                      │            │ ba → sa →   │        │
│                                      │            │ tech-lead   │        │
│                                      │            │ → dev →     │        │
│                                      │            │ qa →        │        │
│                                      │            │ reviewer    │        │
│                                      │            └──────┬──────┘        │
│                                      │                   │               │
│                                      │                   ▼               │
│                                      │            /close-feature         │
│                                      │                   │               │
│   STEP 3: RENDERING                  │                   │               │
│   ──────────────────────             │                   │               │
│                                      │                   ▼               │
│   /generate-docs ◄───────────────────┴───── enriched intel layer         │
│        │                                                                 │
│        ▼                                                                 │
│   etc-platform MCP                                                       │
│        │                                                                 │
│        ▼                                                                 │
│   ┌─────────────────────────────────────────┐                            │
│   │   docs/generated/{slug}/output/         │                            │
│   │   ├── tkkt.docx                         │                            │
│   │   ├── tkcs.docx                         │                            │
│   │   ├── tkct.docx                         │                            │
│   │   ├── hdsd.docx                         │                            │
│   │   └── test-cases.xlsx                   │                            │
│   └─────────────────────────────────────────┘                            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

3 step:
1. **INGESTION** (Claude Code) — biến input (tài liệu hoặc code) thành intel layer
2. **SDLC** (Cursor) — phát triển feature qua các stage có quy trình
3. **RENDERING** (Claude + MCP) — biến intel thành Office files

---

## 3. Pipeline chi tiết — `/from-doc` (greenfield)

Khi bạn có SRS/BRD và **chưa code** gì:

```
   docs/source/SRS-v0.3.docx
            │
            ▼
   ┌─────────────────────────────────────────┐
   │  /from-doc <path>                       │
   │                                         │
   │  Step 1: OCR + read full content        │
   │  Step 2: Detect modules/features/roles  │
   │  Step 3: Confirm pipeline split         │
   │  Step 4: Write doc-brief.md             │
   │  Step 5: Generate _state.md per feature │
   └─────────────────────────────────────────┘
            │
            ▼
   docs/intel/
   ├── doc-brief.md                  ◄── narrative summary
   ├── actor-registry.json           ◄── role seeds
   ├── feature-catalog.json          ◄── features status:planned
   ├── sitemap.json                  ◄── modules + planned routes
   └── _meta.json                    ◄── producer: from-doc

   docs/features/
   ├── F-001/_state.md               ◄── pipeline-type: sdlc, status: in-progress
   ├── F-001/feature-brief.md
   ├── F-002/_state.md
   └── ...

            │
            ▼   (per feature, on Cursor side)

   /resume-feature F-001
            │
            ▼
   ba → sa → tech-lead → dev → qa → reviewer
   (each stage enriches feature-catalog with its own data)
            │
            ▼
   /close-feature F-001
            │
            ▼   (after all features done)

   /generate-docs
            │
            ▼
   ┌─────────────────────────────────────────┐
   │  6-stage pipeline:                      │
   │  1. Preflight  (verify intel fresh)     │
   │  2. Discovery  (load catalog)           │
   │  3. Analysis   (gap analysis)           │
   │  4. Capture    (Playwright if missing)  │
   │  5. Synthesis  (build content-data.json)│
   │  6. Delivery   (etc-platform MCP)       │
   └─────────────────────────────────────────┘
            │
            ▼
   docs/generated/{slug}/output/*.{docx,xlsx}
```

---

## 4. Pipeline chi tiết — `/from-code` (codebase đã có)

Khi project đã code rồi, cần reverse-engineer + sinh tài liệu:

```
   D:/Projects/be-portal/  (codebase có sẵn)
            │
            ▼
   ┌─────────────────────────────────────────┐
   │  /from-code <path>                      │
   │                                         │
   │  Phase 0: Preflight (detect framework)  │
   │  Phase 1: Static harvest                │
   │           (parse routes, entities, RBAC)│
   │  Phase 1.5: Actor enumeration           │
   │           (extract roles từ auth code)  │
   │  Phase 2: Feature synthesis             │
   │           (group endpoints + UI → features)│
   │  Phase 3: Validation                    │
   │  Phase 4: Architecture diagrams         │
   │  Phase 5: Scaffold _state.md            │
   │  Phase 6: Handoff                       │
   └─────────────────────────────────────────┘
            │
            ▼
   docs/intel/                    docs/features/
   ├── system-inventory.json      ├── F-001/_state.md
   ├── code-brief.md              │   (status: implemented vì code đã có)
   ├── arch-brief.md              ├── F-002/...
   ├── actor-registry.json        └── ...
   ├── permission-matrix.json
   ├── feature-catalog.json   ◄── ENRICHED so với from-doc
   ├── sitemap.json (concrete)
   ├── data-model.json
   ├── integrations.json
   └── test-evidence/{id}.json (extracted từ tests có sẵn)

            │
            ▼   (skip SDLC vì code đã có — đi thẳng tới generate-docs)

   /generate-docs
            │
            ▼
   ASSEMBLY MODE (Healthy project — có test-evidence rồi):
        - Stage 4f reuse TC, không synthesize
        - Stage 3a skip features có screenshots
        - Output Office files trong vài phút

   FALLBACK MODE (Legacy — không có test-evidence):
        - Synthesize TC qua ISTQB techniques
        - Đánh dấu status:proposed
        - Cảnh báo trong xlsx warning sheet
            │
            ▼
   docs/generated/{slug}/output/*.{docx,xlsx}
```

---

## 5. SDLC pipeline — Bên trong Cursor

Khi `/resume-feature F-NNN`, Cursor dispatch agents tuần tự theo `stages-queue` trong `_state.md`:

```
                       ┌──────────────────┐
                       │   _state.md      │
                       │   current-stage  │ ◄── dispatcher đọc
                       │   stages-queue   │
                       └────────┬─────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   dispatcher    │  ──► invoke 1 stage rồi return
                       └────────┬────────┘
                                │
                                ▼
            ┌───────────────────────────────────────┐
            │           STAGE PIPELINE              │
            │                                       │
            │  ┌──────┐                             │
            │  │  ba  │  ──── elaborate AC,         │
            │  └───┬──┘       business_rules        │
            │      │                                │
            │      ▼                                │
            │  ┌──────┐                             │
            │  │  sa  │  ──── routes, entities,     │
            │  └───┬──┘       permission concrete   │
            │      │                                │
            │      ▼                                │
            │  ┌─────────────┐                      │
            │  │ tech-lead   │  ── wave plan        │
            │  └──────┬──────┘                      │
            │         │                             │
            │         ▼                             │
            │  ┌─────────────────────┐              │
            │  │ dev / fe-dev waves  │  ── code     │
            │  └──────────┬──────────┘              │
            │             │                         │
            │             ▼                         │
            │  ┌──────────────┐                     │
            │  │ qa-wave      │  ── 3 atomic        │
            │  │              │     artifacts:      │
            │  │              │     - test-evidence │
            │  │              │     - playwright    │
            │  │              │     - screenshots   │
            │  └───────┬──────┘                     │
            │          │                            │
            │          ▼                            │
            │  ┌────────────┐                       │
            │  │ reviewer   │  ── verdict           │
            │  └─────┬──────┘                       │
            │        │                              │
            └────────┼──────────────────────────────┘
                     │
                     ▼
            verdict = Approved → /close-feature
            verdict = Changes  → loop back
            verdict = Blocked  → escalate PM


   Conditional agents (dispatch khi flag):
   - designer       (UI screens detected)
   - security       (auth/PII/payment touched)
   - data-governance (PII flow / cross-system)
   - sre-observability (SLO-sensitive)
   - devops         (deploy impact)
   - release-manager (DB migration / multi-service)
```

---

## 6. Agent classification — Production-line model

54 agents được phân theo 4 class theo `LIFECYCLE.md`:

```
   ┌──────────────────────────────────────────────────────────────────────┐
   │                                                                      │
   │   STAGE AGENTS (own contract box, individual)                        │
   │                                                                      │
   │   ┌────────┬────────┬────────┬────────┬────────┬────────┬────────┐   │
   │   │  ba    │  sa    │tech-   │ dev    │ qa     │reviewer│  pm    │   │
   │   │  +pro  │  +pro  │ lead   │ fe-dev │  +pro  │  +pro  │        │   │
   │   └────────┴────────┴────────┴────────┴────────┴────────┴────────┘   │
   │                                                                      │
   ├──────────────────────────────────────────────────────────────────────┤
   │                                                                      │
   │   CLASS A — Stage-report writers  (write 1 file, không touch intel) │
   │   ┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐      │
   │   │tech-lead│reviewer │designer │ devops  │release- │         │      │
   │   │         │         │         │         │ manager │         │      │
   │   └─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘      │
   │                                                                      │
   ├──────────────────────────────────────────────────────────────────────┤
   │                                                                      │
   │   CLASS B — Verifiers  (read intel, FLAG drift, không tự fix)        │
   │   ┌──────────┬─────────────────┬──────────────────┐                  │
   │   │ security │ data-governance │ sre-observability│                  │
   │   └──────────┴─────────────────┴──────────────────┘                  │
   │                                                                      │
   ├──────────────────────────────────────────────────────────────────────┤
   │                                                                      │
   │   CLASS C — Orchestrators  (control flow only)                       │
   │   ┌────────────┬─────┬───────────┐                                   │
   │   │ dispatcher │ pm  │ telemetry │                                   │
   │   └────────────┴─────┴───────────┘                                   │
   │                                                                      │
   ├──────────────────────────────────────────────────────────────────────┤
   │                                                                      │
   │   CLASS D — Doc-generation consumers  (read-only intel, render docs) │
   │   doc-* (9 agents)  +  tdoc-* (4 agents Cursor + 8 Claude)           │
   │                                                                      │
   └──────────────────────────────────────────────────────────────────────┘
```

**Vì sao có classification?**
- Class A KHÔNG được ghi `docs/intel/*` → stage report là duy nhất
- Class B đọc intel cross-check vs code, nếu drift → flag, KHÔNG tự sửa (ai tự sửa = bug)
- Class C không sản xuất nội dung — chỉ điều phối
- Class D chỉ ĐỌC intel → render → output Office. Cấm ghi intel.

→ Mỗi nhân viên (agent) có **scope hẹp**, không "tiện tay làm hộ khâu khác". Đảm bảo quality + token efficiency.

Chi tiết: xem `ai-kit doc agents` hoặc `agents`.

---

## 7. Khi nào dùng Claude vs Cursor?

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   CLAUDE CODE (terminal CLI)                                        │
│                                                                     │
│   ► Khi cần phân tích / sinh tài liệu (batch, không UI)             │
│   ► /from-doc, /from-code, /generate-docs, /intel-fill              │
│   ► Khi anh/chị là maintainer, làm release                          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   CURSOR (IDE + chat)                                               │
│                                                                     │
│   ► Khi cần code feature, làm SDLC                                  │
│   ► /new-feature, /resume-feature, /close-feature                   │
│   ► Khi cần chat với AI có context của codebase                     │
│   ► Khi xem/edit file nhiều (IDE features)                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Một feature đầy đủ thường đi qua cả 2:**
1. Claude `/from-doc` → khởi tạo intel
2. Cursor `/resume-feature` cho từng feature → SDLC stages
3. Claude `/generate-docs` → render Office output

Không có cuộc tranh giành — 2 tool bổ trợ, đều đọc/ghi cùng `docs/intel/`.

---

## 8. Kiến trúc bộ nhớ — Intel evolution

`docs/intel/` không phải static. Nó **EVOLVE** qua từng stage:

```
   t=0   /from-doc                /from-code
         ──────────                ──────────
         actor-registry            actor-registry  (concrete)
         (seeds, role names)       permission-matrix (extracted)
         feature-catalog           feature-catalog (implemented features)
         (status: planned)         sitemap (concrete routes)
         sitemap (planned routes)  data-model
                                   integrations

   t=1   /new-feature
         ─────────────
         feature-catalog: append F-NNN (status: planned)
         sitemap: placeholder route
         permission-matrix: proposed rows

   t=2   ba stage
         ─────────
         feature-catalog: enrich
            - description (>= 200 chars)
            - acceptance_criteria (>= 3 items)
            - business_rules
         actor-registry: append permission_seeds (sa concretizes later)

   t=3   sa stage
         ─────────
         sitemap: routes (concrete, replace placeholder)
         permission-matrix: action enum (replace proposed)
         data-model: new entities
         integrations: new integrations
         feature-catalog: routes[], entities[]

   t=4   qa stage
         ─────────
         test-evidence/F-NNN.json (CREATED)
         feature-catalog: test_case_ids[], test_evidence_ref

   t=5   /close-feature
         ──────────────
         feature-catalog: status=implemented
         feature-catalog: implementation_evidence (commits, coverage, ADRs)
         _state.md: SEALED
         intel-snapshot regen

   t=6   /generate-docs (consumer)
         ──────────────────────────
         READ ONLY — no writes to intel
         Output: Office files
```

Đây là lý do **single-writer per field per stage** (LIFECYCLE.md P1) — mỗi field tại mỗi thời điểm chỉ có 1 owner. Conflict = bug.

---

## 9. Liên quan

- `skills` — Catalog các skill chính với "khi nào dùng"
- `agents` — Tổ chức agent + class chi tiết
- `workflows/` — Hướng dẫn từng skill cụ thể
- `lifecycle` — Contract đầy đủ (CD-10 Quy tắc 21)
- `troubleshooting` — Lỗi thường gặp

## Đọc tiếp

Sau khi nắm tổng thể, đi sâu theo role:

| Role | Đọc tiếp |
|---|---|
| BA | `from-doc`, `agents` |
| SA | `resume-feature`, `agents` |
| Dev | `resume-feature`, `agents` |
| QA | `close-feature`, `agents` |
| PM/Maintainer | `maintainer`, `ai-kit` |
