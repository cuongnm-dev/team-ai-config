# Workflow Design — Document Generation Pipeline cho VN Gov IT

**Status**: ✅ FINALIZED 2026-04-28 — 7 decisions aligned via discussion. Ready to implement.
**Author**: James + Claude (collaborative thinking session 2026-04-28)
**Branch**: `feat/sdpa-workflow-redesign`
**Purpose**: Define đúng bản chất workflow trước khi implement bất cứ thứ gì. Tránh anti-pattern accretion.

---

## 0. FINAL ALIGNED DECISIONS (2026-04-28 — single source of truth)

Sau research 8 industry pattern clusters + Q&A 7-câu align, đây là 7 quyết định chốt làm cơ sở implementation:

| # | Decision | Rationale | Implementation impact |
|---|---|---|---|
| **D1** | **Diátaxis taxonomy là primary organizing principle**; Tier T1/T2/T3 demoted sang secondary tag | Industry-tested (Canonical, Stripe, Cloudflare, Sequin); writers natural produce audience-tailored prose | Add `diataxis_type` metadata vào outline/writer prompts; Tier giữ làm tag |
| **D2** | **`/intel-fill` dùng DAG pattern (Docassemble-style), phased — start P1 simple DAG** | Đã proven 15+ năm; user effort scaling tốt; P1 covers 50% benefit với 1.5x effort của linear | Build `/intel-fill` skill với P1 (just-in-time questions, no auto-derive yet) |
| **D3** | **Workflow state machine = conceptual document only** (no LangGraph code, no wrapper script) | Match Claude Code markdown-native paradigm; zero dependency; reversible | WORKFLOW_DESIGN.md describe state machine; user invoke skills manually theo recommended order |
| **D4** | **3-tier confidence routing với 4-level enum** (high/manual=auto, medium=confirm, low=gap) | Schema đã có confidence field; CD-10 quy tắc 13 mandate; industry standard (Syntex 90/70) | Update validate.py output format + intel-validator agent + intel-status skill |
| **D5** | **Independent generation + cross-reference (NĐ 30/2020 style)** — không transclusion engine | Loại 1+2 (facts/diagrams) đã single-source qua intel layer; Loại 3 (prose) match VN gov citation convention | Writers generate prose độc lập; cross-reference qua "kế thừa từ TKCS §X.Y" pattern |
| **D6** | **C2 enhanced — Schema-as-SSoT + Auto-Generated Summaries + Compile-time inline injection** | Industry standard (OpenAPI Codegen, Protobuf); native paradigm; cache-friendly; reversible | NEW `extract_schema_summary.py` script; `_summaries/` folder; sub-agent prompts inline summary verbatim |
| **D7** | **Hybrid migration approach** — Foundation pass big-bang, then iterative TKKT → TKCT → TKCS → HDSD → xlsx | Foundation cross-cutting; per-doc iteration validates pattern incremental; reversible per layer; align user instinct "không chộp giật" | Foundation 3-4 ngày; 5 iterations 8-10 ngày total ~11-14 ngày |

**Decisions DROPPED** từ proposals trước:
- ❌ SDPA (Schema-Driven Phase Architecture) — over-engineered
- ❌ MVP-First Approach M1-M5 — không cover Tier 2/3 emission gap đủ
- ❌ Tier T1/T2/T3 làm primary organizing principle — demoted sang secondary tag
- ❌ Schema-prompt auto-injection custom logic — replaced bằng D6 (compile-time summaries)
- ❌ LangGraph Python orchestrator — replaced bằng D3 (conceptual only)
- ❌ DITA conref transclusion engine — replaced bằng D5 (cross-reference pattern)

---

---

## 1. Executive Summary

Workflow tạo 5 tài liệu (TKKT, TKCS, TKCT, HDSD, xlsx test-case) cho dự án CNTT cơ quan nhà nước Việt Nam **không phải pipeline tự động linear**. Đây là **assisted authoring workflow** với 4 yếu tố:

1. Template-driven scaffold (outline immutable)
2. Multi-source variable binding (intel layer canonical)
3. **Human-in-the-loop checkpoints** (rõ ràng, không silent)
4. **Provenance + completeness tracking** (auditable per field)

Yếu tố 3 và 4 là cái mà infrastructure hiện tại CHƯA có. Tất cả patch đã thử (SDPA, MVP-First, script workaround) đều giả định pipeline có thể auto, và đều thất bại tại 35% information chỉ human có.

Pattern industry chuẩn (HotDocs, Documate, Microsoft Syntex, Adobe LiveCycle, Salesforce DocGen) đều có cả 4 yếu tố. Workflow design này align theo industry, không invent mới.

---

## 2. Problem Reframe — Tại sao "auto pipeline" là ảo tưởng

### Bài học từ session 2026-04-28

| Lần thử | Giả định | Tại sao fail |
|---|---|---|
| Build infrastructure (13 schemas + Tier classification + scripts) | "Schema canonical đủ để pipeline auto" | Schema chỉ là contract — không emit content; skill emit content vẫn cần human knowledge |
| SDPA (registry + auto-injection + validate-on-write) | "Automation hơn = đỡ drift" | Thêm 5 surface fail mới; không address giới hạn nguyên lý của extraction |
| MVP-First (M1-M5 sửa 3 sub-agents + 4 phases) | "Đủ scope để fix bug" | Chỉ fix 3/5 issue (sitemap, ID, status); 2/5 (planned features prose, test-evidence) không skill nào fix được |
| Path A (script workaround) | "Workaround đủ chạy generate-docs" | Chộp giật, không scale, output 3.5/5 — chính cái user đã có |

### Root cause meta

Mọi patch đều **try to hide the limit** thay vì **acknowledge the limit**. User instinct đúng: càng sửa càng tệ vì mỗi layer làm pipeline phức tạp hơn để cố giữ ảo tưởng "auto".

### Sự thật phải chấp nhận

**Information cần cho 5 docs đến từ 4 nguồn khác bản chất:**

| Nguồn | Tỷ lệ ước tính | Nature | Auto được? |
|---|---|---|---|
| Code (AST, manifests, configs, tests) | ~30% | Deterministic | ✅ Yes — `from-code` |
| Documents (PDF/DOCX, screenshots) | ~25% | Structured prose | ⚠ Phụ thuộc chất lượng nguồn — `from-doc` |
| Knowledge Base (legal refs, standards, ATTT patterns) | ~10% | Curated reference | ✅ Yes — `kb_query` |
| **Human knowledge** (NFR targets, cost, plan, ATTT level decision, threat model, planned features prose, organizational structure) | **~35%** | Judgment + business context | ❌ **Không thể auto** |

**35% human knowledge là gì cụ thể** (xem § 5).

→ Bất kỳ pipeline nào cố auto 100% sẽ vấp 35% này. Solution không phải "more automation" — mà phải có **explicit human checkpoint** để fill 35% có hệ thống.

---

## 3. First Principles — 4 Information Sources

### 3.1 Code-derivable (~30%)

| Field | Producer | Confidence default |
|---|---|---|
| `actor-registry.roles[].slug` (RBAC code) | from-code | high |
| `permission-matrix.permissions[]` (decorators) | from-code | high |
| `sitemap.routes[].path/method` (router code) | from-code | high |
| `code-facts.entities[]` (ORM/migrations) | from-code | high |
| `data-model.tables[]` DDL | from-code | high |
| `api-spec.endpoints[]` request/response shape (DTO inference) | from-code | medium |
| `system-inventory.tech_stack[]` (manifest parse) | from-code | high |
| `architecture.components[]` (module boundary) | from-code | medium |
| `integrations.integrations[]` (HTTP client + SDK detection) | from-code | medium |

**Limit**: code không nói **WHY** (business intent), không nói **business rules** không express trong code, không nói NFR target.

### 3.2 Doc-derivable (~25%)

| Field | Producer | Confidence default |
|---|---|---|
| `feature-catalog.features[].business_intent` (PRD prose) | from-doc | medium |
| `feature-catalog.features[].flow_summary` (use case narrative) | from-doc | medium |
| `feature-catalog.features[].acceptance_criteria` (AC text) | from-doc | high if doc structured |
| `business-context.objectives` | from-doc | medium |
| `business-context.pain_points` | from-doc | medium |
| `business-context.scope` | from-doc | medium |
| `actor-registry.roles[].display_vn` (human-friendly name) | from-doc | high |
| `sitemap.menu_tree[]` (UI navigation from screenshot/wireframe) | from-doc + screenshot OCR | low-medium |

**Limit**: doc thường mô tả nghiệp vụ + happy path, hiếm khi cover NFR/ATTT/cost/plan chi tiết. Document chất lượng kém → output chất lượng kém.

### 3.3 KB-derivable (~10%)

| Field | Producer | Confidence default |
|---|---|---|
| `business-context.legal_basis[]` (NĐ/QĐ/CT canonical refs) | `kb_query` | high (nếu KB fresh) |
| Citation format chuẩn NĐ 30/2020 | KB + style helper | high |
| TCVN compliance refs (TCVN 11930, etc.) | KB | high |
| Boilerplate ATTT patterns | KB | medium |
| Dự toán methodology (TT 04/2020) | KB | high |

**Limit**: KB chỉ trả về **patterns có sẵn**. Project mới (CSDLQG mới, NĐ mới chưa cập nhật KB) sẽ không có → manual fill.

### 3.4 Human-knowledge-only (~35%)

Đây là **trái tim của vấn đề**. Section § 5 liệt kê chi tiết.

---

## 4. Information Needs per Target Doc

Tỷ lệ source ước tính per document (không phải metric chính xác — orientation):

| Doc | Code | Doc | KB | Human | Audience |
|---|---|---|---|---|---|
| TKKT (kiến trúc tổng thể) | 50% | 15% | 10% | 25% | Lãnh đạo Bộ/Tỉnh + KTS trưởng |
| TKCS (thiết kế cơ sở — investment approval) | 25% | 25% | 15% | **35%** | Bộ TC / Sở TC / ban QLDA (non-technical) |
| TKCT (thiết kế chi tiết — engineering) | **55%** | 25% | 5% | 15% | Engineer + QA + tư vấn giám sát |
| HDSD (hướng dẫn sử dụng — end user) | 15% | 30% | 5% | **50%** (screenshots, scenarios, training) | End users theo role |
| xlsx test-cases | 35% (extract) | 20% (AC) | 5% (test patterns) | 40% (QA execute + augment) | QA team |

**Insight**: TKCS, HDSD, xlsx có ratio human cao (~35-50%). Bất kỳ "auto pipeline" nào cũng phải có explicit interview/curation stage cho 3 doc này.

---

## 5. Human-Knowledge Inventory — 35% cụ thể là gì

Đây là **danh sách chính xác** các field không skill nào extract được. Mọi workflow design phải có stage cụ thể để fill từng field này.

### 5.1 TKCS-specific (Đ13 NĐ 45/2026)

| Field | Source | Người fill |
|---|---|---|
| `business-context.project.investment_amount_vnd` | Quyết định chủ trương đầu tư | PM/BA |
| `business-context.project.investment_group` (A/B/C) | Tính từ amount theo Đ9 | PM/BA |
| `business-context.project.approving_authority` | Theo group | PM/BA |
| `business-context.legal_basis[]` ≥3 refs (chọn ra refs nào áp dụng dự án này) | KB-driven nhưng SELECT cần judgment | PM/BA |
| `business-context.pain_points[]` ≥3 (đánh giá serverity) | Doc + interview | BA |
| `business-context.objectives.specific[]` ≥3 với measurable target | Workshop với stakeholder | PM/BA |
| `business-context.expected_benefits.economic[]` (estimated_value_vnd_per_year) | Cost-benefit analysis | PM + finance |
| `business-context.expected_benefits.social[]` | Stakeholder workshop | BA |
| `nfr-catalog.items[]` ≥7 với target đo đếm được | Architecture review board | Tech-lead + ops |
| `security-design.attt_level` (1-5 per NĐ 85/2016) | Phân loại dựa data sensitivity + impact | Security officer |
| `security-design.risk_analysis[]` ≥3 threats với mitigation | Threat modeling workshop | Security team |
| `security-design.ipv6_readiness` + `ipv6_plan` | Infra strategy decision | DevOps + architect |
| `infrastructure.deployment_model.type` (on-prem/cloud/hybrid) + rationale | IT strategy decision | CIO + architect |
| `infrastructure.hardware[]` (vendor + spec + price) | Procurement quote | Procurement + IT |
| `infrastructure.network.zones[]` + IPv6 plan | Network architect | Network team |
| `infrastructure.high_availability.{rpo,rto}_minutes` | Business continuity SLA | Ops + business |
| `cost-estimate.summary[]` 6 line items theo TT 04/2020 | Calculation methodology | PM + finance |
| `cost-estimate.detailed.function_points[]` | FP analyst calculation | Tech analyst |
| `cost-estimate.funding.primary_source` + schedule | Budget allocation decision | Finance + leadership |
| `project-plan.phases[]` với timeline + budget_pct | Project planning | PM |
| `project-plan.organization.{owner,implementing_unit,contractor,supervisor}` | Organizational chart | Leadership |
| `project-plan.risks[]` với mitigation | Risk register | PM |

### 5.2 TKCT-specific (Đ14)

| Field | Người fill |
|---|---|
| `data-model.tables[].business_meaning` per column (Vietnamese, từ điển dữ liệu) | BA + DBA |
| `data-model.backup_strategy.{rpo,rto}_minutes` + retention policy | Ops + business |
| `security-design.encryption.{at_rest,in_transit}` cipher decisions | Security architect |
| `security-design.logging_and_audit.retention_days` per category | Compliance officer |
| `security-design.incident_response.escalation_levels[]` + contacts | Security operations |
| `handover-plan.training[]` (hours + method per role) | Training coordinator |
| `handover-plan.warranty.{period_months,sla,support_tier}` | Contract negotiation |
| `cost-estimate.detailed.{software,hardware,deployment,services,contingency}_cost` | Detailed FP per TT 04/2020 | PM + tech analyst |

### 5.3 TKKT-specific (QĐ 292/2025)

| Field | Người fill |
|---|---|
| `architecture.design_principles[]` (≥5 principles aligned với CT 34, QĐ 292) | KTS trưởng |
| Architecture Decision Records (ADRs) — context, decision, consequences, alternatives | Tech-lead + architect |
| `architecture.deployment_overview` (translated từ technical sang strategic narrative) | Architect — phải avoid Docker/K8s jargon |

### 5.4 HDSD-specific

| Field | Người fill |
|---|---|
| Screenshots cho mỗi role workflow | QA + UX (run Playwright) |
| User scenarios (giáo trình tình huống, không phải spec) | Training + UX writer |
| FAQ + troubleshooting (kinh nghiệm thực tế) | Support team |
| Glossary (ngôn ngữ end-user) | UX writer |

### 5.5 xlsx test-case-specific

| Field | Người fill |
|---|---|
| `test-evidence.test_cases[].execution.status` (passed/failed) | QA team chạy thật |
| `test-evidence.test_cases[].screenshots[]` | Playwright execution |
| Edge case TCs ngoài AC (NFR validation, security, vietnamese diacritics, concurrent edit) | QA augment ISTQB techniques |
| Boundary value analysis values | QA tester |

---

## 6. Workflow Stages — Cycle, không Linear

### 6.1 Sai lầm linear pipeline

```
[from-code] → [from-doc] → [resume-feature] → [generate-docs]
   ❌ Linear giả định mỗi stage hoàn thành trước khi chuyển → sai vì có 35% human knowledge cần fill ở giữa
```

### 6.2 Đúng — Cycle với checkpoints

```
                    ┌─────────────┐
                    │  Bootstrap  │  (Stage 0 — once per project)
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   ┌──────────┐      ┌──────────┐     ┌──────────┐
   │ EXTRACT  │      │ EXTRACT  │     │ EXTRACT  │
   │ (code)   │      │ (doc)    │     │ (KB)     │
   └─────┬────┘      └─────┬────┘     └─────┬────┘
         │                 │                 │
         └────────┬────────┴────────┬────────┘
                  ▼                 ▼
            ┌──────────────────────────┐
            │   MERGE + VALIDATE       │  (Stage 2)
            │   intel-merger +         │
            │   intel-validator        │
            └──────────────┬───────────┘
                           │
                           ▼
            ┌──────────────────────────┐
            │   GAP REPORT (★)         │  (Stage 3 — KEY MISSING)
            │   "X complete / Y gaps"  │
            │   "Cần fill: ..."        │
            └──────────────┬───────────┘
                           │
                  ┌────────┴────────┐
                  ▼                 ▼
            ┌─────────┐       ┌──────────────┐
            │ FILL    │       │ FILL         │
            │ (auto:  │       │ (manual:     │
            │  re-    │       │  interview/  │
            │  run    │       │  edit/       │
            │  skill) │       │  upload)     │
            └────┬────┘       └──────┬───────┘
                 │                   │
                 └─────────┬─────────┘
                           ▼
                    ┌──────────────┐
                    │ Re-validate  │
                    └──────┬───────┘
                           │
                  ┌────────┴────────┐
                  ▼                 ▼
            "Ready"            "Still gaps"
                  │                 │
                  ▼                 │
            ┌──────────┐            │
            │ RENDER   │  ◄─────────┘ (loop until ready OR force-render với placeholders)
            │ (gen-    │
            │  docs)   │
            └──────────┘
```

### 6.3 Stage definitions

#### Stage 0 — Bootstrap (per project, once)

- Tạo `docs/intel/` directory
- Khởi tạo `_meta.json` với project metadata
- User declare project context: scale, target docs (subset of 5), legal framework version

**Skill**: `/intel-init` (NEW)

#### Stage 1 — Extract (parallel, idempotent)

3 extractors chạy song song hoặc on-demand:
- `/from-code` → emit T1 + T2 best-effort từ code
- `/from-doc` → emit T1 partial + T3 prose từ PDF/DOCX
- `/intel-kb-fetch` → emit legal_basis + ATTT patterns + boilerplate

**Skill**: existing `/from-code`, `/from-doc`; NEW `/intel-kb-fetch` (hoặc kb_query inline)

#### Stage 2 — Merge + Validate (deterministic)

- `intel-merger` reconcile conflicts theo precedence rules
- `intel-validator` chạy 27 cross-ref + schema rules
- Output: validation report

**Skill**: existing `intel-merger`, `intel-validator`

#### Stage 3 — Gap Report (★ KEY MISSING)

Đây là stage **hiện tại CHƯA có** và là cốt lõi của workflow đúng.

Output cho user:

```
═══════════════════════════════════════════════════════════
  Intel Layer Status — customs-clearance-system
  2026-04-28T18:30:00Z
═══════════════════════════════════════════════════════════

Coverage: 73% (45/62 fields complete)
By tier: T1 95% | T2 60% | T3 0%
By target doc:  TKKT 78% | TKCS 35% | TKCT 65% | HDSD 50% | xlsx 60%

✅ Complete (45 fields)
  T1: actor-registry, permission-matrix, sitemap, code-facts,
      system-inventory, feature-catalog (M01-M10)
  T2: data-model.tables, api-spec.endpoints (partial)

⚠ Needs attention (12 fields — auto-fixable)
  • feature-catalog.features[F-014..016].acceptance_criteria
    Current: 1 item; Required: ≥3
    → Fix: re-run /from-doc OR manual edit
  • sitemap.routes[].playwright_hints
    Current: missing
    → Fix: re-run /from-code with frontend adapter
  • feature-catalog.features[].id format
    6 features có id không match ^F-NNN$
    → Fix: bash script normalize (auto)

❌ Missing — needs human (5 sections, ~35% information)
  • business-context.legal_basis: 0/3 minimum
    → Fill via: /intel-fill --section business-context.legal_basis
       (interactive interview, KB-suggested)
  • nfr-catalog.items: 0/7 minimum
    → Fill via: /intel-fill --section nfr-catalog
       (NFR review board template)
  • security-design.attt_level: missing
    → Fill via: /intel-fill --section security-design.attt_level
       (NĐ 85/2016 wizard)
  • cost-estimate.summary: 0/6 line items
    → Fill via: /intel-fill --section cost-estimate
       (TT 04/2020 worksheet)
  • test-evidence/{F-001..016}.json: 0 features have evidence
    → Fill via: Run /resume-feature {id} in Cursor + QA execute Playwright

▶ Next step:
  [a] Fix auto-fixable (12 fields, ~10 minutes)
  [b] Fill human-required (5 sections, ~2-4 hours BA + tech-lead)
  [c] Force render with placeholders (mark missing as [CẦN BỔ SUNG])
  [d] Render subset only (e.g. /generate-docs tkkt — needs 78% which is current)
═══════════════════════════════════════════════════════════
```

**Skill**: NEW `/intel-status` (hoặc tích hợp vào `intel-validator` output)

#### Stage 4 — Fill (mixed auto + manual)

Auto: re-run skill cụ thể với targeted scope
Manual: NEW skill `/intel-fill --section X` — interactive interview wizard

**Skill**: NEW `/intel-fill`

#### Stage 5 — Render

- `/generate-docs` consume intel state hiện tại
- Behavior controlled by Stage 3 output:
  - "ready" → render full
  - "force-render" → render with `[CẦN BỔ SUNG]` placeholders embedded clearly

**Skill**: existing `/generate-docs`

#### Stage 6 — Review + Iterate

- User review output
- Pinpoint sections cần improve → return to Stage 3 (gap report)
- Loop until production-ready

---

## 7. Field Lifecycle States

Mỗi intel field có **state machine**:

```
   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
   │  not-set    │ ───► │  extracted  │ ───► │  verified   │
   │ (default)   │      │ (auto, low- │      │ (human OK)  │
   │             │      │  med conf)  │      │             │
   └─────────────┘      └──────┬──────┘      └─────────────┘
                               │
                               ▼
                        ┌─────────────┐      ┌─────────────┐
                        │needs-attn   │ ───► │   manual    │
                        │ (low conf,  │      │ (human-     │
                        │  thin, miss)│      │  filled)    │
                        └──────┬──────┘      └─────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │ placeholder │
                        │ ([CẦN BỔ   │
                        │  SUNG])     │
                        └─────────────┘
```

### Schema augmentation

Mỗi intel field cần thêm metadata sub-object:

```json
{
  "value": "...",
  "_state": {
    "lifecycle": "extracted | verified | manual | needs-attention | placeholder",
    "confidence": "high | medium | low | manual",
    "source": "code:routes[5] | doc:section-3.2 | kb:legal[NĐ45-2026] | interview:q-12 | manual",
    "touched_at": "2026-04-28T18:30:00Z",
    "touched_by": "from-code | from-doc | user | intel-merger",
    "notes": "optional human note"
  }
}
```

→ Đây là **augmentation** chứ không thay schema canonical. Provenance metadata tách riêng để không pollute content schema.

**Implementation**: thêm `_provenance.json` parallel với mỗi artifact, hoặc embedded inline với key `_state` per field. Phải decide trade-off file size vs colocation.

---

## 8. Provenance Schema (Cross-cutting concern)

```json
{
  "schema_version": "1.0",
  "fields": [
    {
      "path": "feature-catalog.features[5].business_intent",
      "value_hash": "sha256:abc...",
      "lifecycle": "verified",
      "confidence": "high",
      "sources": [
        { "kind": "code", "ref": "code-facts.routes[12]", "weight": 0.3 },
        { "kind": "doc", "ref": "doc-brief.md#section-3.2", "weight": 0.5 },
        { "kind": "manual", "ref": "user-edit-2026-04-28T18:00", "weight": 0.2 }
      ],
      "touched_at": "2026-04-28T18:30:00Z",
      "touched_by": "user",
      "review_status": "approved",
      "review_notes": null
    },
    ...
  ]
}
```

→ Audit trail per field. Reviewer biết tin field nào, field nào cần re-verify.

---

## 9. Checkpoint UX — User-facing principles

### 9.1 Honesty principles

- **No silent skip** — mọi field thiếu phải explicit trong gap report
- **No false completeness** — coverage % phải tính nghiêm theo schema constraint (description ≥200 chars = chưa đủ thì chưa "complete")
- **No "good enough"** — user quyết định force-render với placeholders, không skill tự assume

### 9.2 Display principles

- **Coverage by dimension** — show % theo Tier, theo target doc, theo schema artifact
- **Actionable per gap** — mỗi gap có "fix via" cụ thể (skill name + flag)
- **Effort estimate** — auto-fixable (~minutes) vs human-required (~hours)
- **Prioritization hint** — gap nào blocking which doc

### 9.3 Mode

- **Strict mode** (default): không render nếu coverage < threshold
- **Force mode**: render với placeholders, output có warning sheet rõ ràng

---

## 10. Skill Responsibilities (Reframed)

### Honest scope per skill

| Skill | Scope ĐÚNG | Scope SAI (đã tránh) |
|---|---|---|
| `/from-code` | Extract code-derivable T1+T2 best-effort. Emit gap markers cho field code không nói được. | "End-to-end pipeline emit đủ intel cho generate-docs" |
| `/from-doc` | Extract doc-derivable T1 prose + T3 partial từ PDF/DOCX. Emit gap markers cho field doc không cover. | "Bridge giữa doc và code" |
| `/intel-kb-fetch` (NEW) | Query KB cho legal_basis, ATTT patterns, boilerplate. Emit candidates list (user select). | – |
| `/intel-fill` (NEW) | Interactive interview wizard cho 35% human knowledge. Per-section guided form. | – |
| `intel-merger` | Reconcile conflicts theo precedence. Update provenance. | "Auto-fill gaps" |
| `intel-validator` | Report schema + cross-ref violations. Tier-aware exit codes. | "Block all gaps" |
| `/intel-status` (NEW) | Generate gap report ở § 6.3 format. | – |
| `/intel-refresh` | Re-run T1+T2 producers + merger + validator. SKIP T3. | "Auto-fill T3" |
| `/generate-docs` | Render từ intel state hiện tại. Strict/force mode user-controlled. | "Synthesize missing fields" |
| Cursor `/resume-feature` | SDLC implementation + QA execute → emit test-evidence | – |
| Cursor `/close-feature` | Update feature-catalog.implementation_evidence | – |

### Anti-pattern (cấm)

- ❌ Skill auto-fill field không có nguồn (hallucination)
- ❌ Silent skip thin field
- ❌ "Best effort" mà không emit gap marker
- ❌ Validate ở stage cuối (validate-late)

### Pattern (bắt buộc)

- ✅ Skill emit only what source supports + emit explicit `[CẦN BỔ SUNG: hint]` cho rest
- ✅ Provenance per field (source + confidence + timestamp)
- ✅ Gap report là first-class output của Stage 2
- ✅ Validate-on-write per phase boundary

---

## 11. Industry Pattern Reference

### 11.1 HotDocs (CT Group, ~25 năm doc automation)

- Template với markup variables `«VarName»` + conditional sections
- Interview wizard hỏi user fill variables
- Conditional rendering: section ẩn nếu variable empty
- → Workflow: template → interview → render

**Borrow**: interview wizard concept cho `/intel-fill`

### 11.2 Documate (legal-focused, low-code)

- Template fields có metadata (label, type, validation, default, help text)
- Per-field provenance (filled by user X at time Y)
- Conditional logic per field
- → Workflow: template + structured data + interview

**Borrow**: per-field metadata + provenance

### 11.3 Microsoft Syntex (AI-augmented Office)

- AI extract từ docs → structured fields
- Human review → confirm/correct
- Output: structured + Office docs với data merge
- → Workflow: AI extract → human curate → render

**Borrow**: explicit "review" stage giữa extract và render

### 11.4 Adobe LiveCycle / Experience Manager Forms

- Workflow engine với approval gates
- Data merge + signing
- Audit trail per field
- → Workflow: data input → workflow gates → render → audit

**Borrow**: workflow gates + audit trail

### 11.5 Salesforce DocGen Industries

- Object-driven binding (fields ↔ Salesforce records)
- Per-recipient personalization
- E-sign integration
- → Workflow: object data → template → render

**Borrow**: source-driven binding (intel layer = our "object data")

### 11.6 Common thread (5 products)

| Yếu tố | HotDocs | Documate | Syntex | LiveCycle | DocGen |
|---|---|---|---|---|---|
| Template scaffold | ✓ | ✓ | ✓ | ✓ | ✓ |
| Variable binding | ✓ | ✓ | ✓ | ✓ | ✓ |
| Interview/review stage | ✓ | ✓ | ✓ | ✓ | – |
| Per-field provenance | – | ✓ | ✓ | ✓ | ✓ |
| Conditional rendering | ✓ | ✓ | – | ✓ | ✓ |
| Audit trail | – | ✓ | ✓ | ✓ | ✓ |
| Workflow loop | – | – | ✓ | ✓ | – |

**Pattern bắt buộc** (5/5 products có): template scaffold + variable binding + interview/review.

**Pattern thường có** (4/5): per-field provenance + conditional rendering + audit trail.

→ Workflow này align với common practice, không invent mới.

---

## 12. Implementation Principles (Guard rails khi viết code)

Để tránh anti-pattern accretion lần sau:

### P1 — Build for the limit, not against it

Acknowledge 35% human-knowledge là first-class. Không cố giấu/auto-fill. Mọi feature mới phải explicit về scope.

### P2 — Extract-only producer rule

Skill `/from-code`, `/from-doc`, `/intel-kb-fetch` chỉ extract — không suy luận thêm field không có nguồn. Suy luận = `intel-merger` job.

### P3 — Gap is first-class output

Stage 2 (Merge+Validate) **PHẢI** output gap report. Không phải side-effect — là deliverable chính của Stage 2.

### P4 — Provenance mandatory

Mọi field write phải emit provenance record. Implementation: write wrapper hook (đã có `~/.claude/scripts/intel/write_wrapper.py` — adapt).

### P5 — User-controlled mode

Render strict default. Force mode opt-in với explicit flag. Không tự assume "user accept gaps".

### P6 — No skill chains

Skill A không tự gọi skill B. User explicitly invoke each. Lý do: mỗi skill có giới hạn rõ, chain ngầm = giấu giới hạn.

### P7 — Schema = contract, không phải template

Schema chỉ define structure + constraints. Schema không emit content. Skill emit content theo schema. Nếu không emit được → emit gap, không fake.

### P8 — Iterate-friendly default

Workflow phải supportable cho re-run/partial-fill. State machine (lifecycle field) bảo đảm idempotent.

### P9 — Honest naming

Skill tên phản ánh scope thực. Đổi: `from-code` → `extract-from-code`, `generate-docs` → `render-docs-from-intel`. Naming tactical sau, nhưng phải honest.

### P10 — Add complexity = subtract pattern

Thêm component mới = chứng minh đã subtract một anti-pattern khác. Net complexity phải giữ hoặc giảm.

---

## 13. Open Questions (cần discuss before implement)

### Q1 — Provenance file colocated hay separate

- (a) Embedded inline (`_state` per field) — tăng intel file size ~30-50%
- (b) Parallel file (`{artifact}.provenance.json`) — phức tạp khi sync
- (c) Single workspace-level `_provenance.json` — single point of failure

Recommend: (b) parallel file, sync managed by `intel-merger`.

### Q2 — `/intel-fill` UI/UX

- Interactive prompt trong terminal (như `npm init`)?
- Hay generate `gap-fill-form.md` template, user edit, re-import?
- Hybrid: simple field interactive, complex section template-import?

Recommend: hybrid theo field complexity.

### Q3 — Coverage threshold for "ready"

- T1 100% + T2 80% + T3 70%? Hay per-doc threshold?
- Per-doc threshold cụ thể: TKKT cần T1+T2 90%; TKCS cần T1 100% + T3 80%; TKCT cần T1+T2 90% + T3 50%; HDSD cần T1 + test-evidence; xlsx tương tự HDSD.

Recommend: per-doc threshold, defined by Stage 3 logic.

### Q4 — Re-extract vs incremental update

Khi code change → re-run `/from-code` extract toàn bộ hay chỉ delta?

Recommend: incremental theo file mtime + hash; full re-extract on `--rescan` flag.

### Q5 — Multi-project workspace?

Workflow này design cho 1 project per workspace. Multi-project?

Recommend: out of scope cho v1. 1 workspace = 1 project. Multi-project là separate skill/concern.

### Q6 — Versioning intel state

User edit T3 manual rồi code change → re-extract code có overwrite T3 không?

Recommend: T3 isolation — `/intel-refresh` chỉ touch T1+T2. Manual fields (`lifecycle: manual` hoặc `verified`) không bao giờ bị overwrite (user-locked).

### Q7 — Migration path từ infrastructure đã build

Đã có 13 schemas + scripts + agents. Workflow này invalidate cái gì? Reuse cái gì?

Recommend: 
- Reuse: schemas (đã đúng), validate.py, intel-merger, intel-validator, intel-snapshot, OUTLINE_COVERAGE.md
- Reframe: SDPA + MVP-First proposals → drop (over-engineered cho problem thực)
- Add: `/intel-status`, `/intel-fill`, provenance schema, gap report logic

---

## 14. Decision required from user before implementation

| Decision | Tôi lean tới | User confirm? |
|---|---|---|
| Approve overall workflow shape § 6 (cycle, không linear) | Yes | ⏳ |
| Approve 4-stage skill responsibility split § 10 | Yes | ⏳ |
| Approve provenance metadata § 7-8 | Yes (parallel file) | ⏳ |
| Approve gap report as first-class § 6.3 | Yes | ⏳ |
| Approve naming reframe § 12.P9 | Optional, can defer | ⏳ |
| Approve drop SDPA + MVP-First proposals | Yes | ⏳ |
| Approve add 3 new skills (`intel-init`, `intel-status`, `intel-fill`) | Yes (minimal viable set) | ⏳ |

---

## 15. What this design does NOT solve

Trung thực để user biết tradeoff:

1. **Vẫn có 35% human knowledge phải fill** — workflow này không loại bỏ, chỉ làm explicit + structured
2. **`/intel-fill` interview vẫn cần ~2-4 giờ BA + tech-lead time** — không skill nào replace BA workshop
3. **Document chất lượng kém vẫn cho output kém** — `/from-doc` extract phụ thuộc PDF source
4. **TKKT/TKCS terminology cần human review** — từ ngữ hành chính + audience-aware translation cần BA polish
5. **First project cost cao hơn template-driven** — nhưng từ project thứ 2, KB + intel-cache cho ROI tăng dần

---

## 16. References

- `~/.claude/CLAUDE.md` — CD-10 Intel Layer Contract (rules 1-18)
- `~/.claude/schemas/intel/OUTLINE_COVERAGE.md` — Outline → field mapping (Tier classification still valid)
- `~/.claude/schemas/intel/README.md` — Schema registry
- Industry: HotDocs documentation, Documate guides, Microsoft Syntex docs, Adobe LiveCycle reference, Salesforce DocGen Industries

---

## 17. Next Steps (after user approves)

1. User review § 14 decisions, confirm or push back per row
2. If approved: create implementation roadmap (separate doc) prioritizing 3 NEW skills (`intel-init`, `intel-status`, `intel-fill`) + provenance layer
3. Migration plan: existing intel files (e.g. customs-clearance-system) → upgrade to provenance-aware format
4. Integration: update existing skills (from-code, from-doc, generate-docs) to emit provenance + consume gap reports
5. Full-cycle E2E test trên 1 sample project

**Implementation roadmap không phải document này.** Document này là design thinking output để decide direction.
