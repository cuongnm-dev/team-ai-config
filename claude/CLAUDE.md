# Claude Code — Global Rules

## Ngôn ngữ

- Giao tiếp với user: tiếng Việt (trừ khi user dùng tiếng Anh)
- Nội dung tài liệu hành chính: 100% tiếng Việt
- Giữ nguyên: tên sản phẩm (PostgreSQL), mã tiêu chuẩn (ISO 27001), đơn vị đo (GB, Mbps)
- Dùng thuật ngữ Việt: "máy chủ" không "server", "cơ sở dữ liệu" không "database"

## Agent Orchestration Pattern

Khi cần dispatch nhiều agents:
- Dùng Agent tool với `run_in_background: true` cho parallel dispatch
- Mỗi sub-agent nhận context tối thiểu cần thiết (≤ 5K tokens)
- Sub-agent GHI file trực tiếp + trả summary cho parent
- Parent tổng hợp, validate, merge
- KHÔNG dùng JSON handoff files — Agent tool result là cơ chế handoff

## Tool Usage Discipline

- **Read before Edit/Write (mandatory):** MUST Read the target file (or relevant range via offset+limit / Grep) before any Edit/Write call. Eliminates "File has not been read yet" + "String not found" errors (24% workflow errors per ai-kit statistics 2026-05). Sub-agents inherit this rule — include reminder in dispatch prompts when Edit/Write is expected.
- **Grep before bulk Read:** for files >2K lines or unknown structure, use Grep first to locate, then Read with `offset` + `limit`.
- **Parallel independent calls:** when multiple tool calls have no dependency, batch in 1 message.
- **Specialist-first dispatch (cost guardrail):** before dispatching `general-purpose`, check whether a specialist agent (Explore for code lookup, Plan for design, doc-writer/doc-reviewer for admin docs, tdoc-* for technical docs, policy-researcher for legal/policy, strategy-analyst for CĐS) fits the task. `general-purpose` is the FALLBACK, not the default. ai-kit statistics 2026-05 flagged $230 spent on `general-purpose` (98 dispatches) — most could have been Explore/Plan at lower cost.

## Cache Discipline (mandatory)

Every prompt template (FROZEN_HEADER, 4-block dispatcher, agent .md) MUST follow cache discipline:
- **STATIC first, DYNAMIC last** — runtime values MUST NOT appear in the prefix region
- **APPEND-ONLY** — new fields go at the END of block; never reorder existing fields
- **Whitespace consistency** — `.rstrip("\n")` + `+ "\n\n" +`, no Windows line endings, no trailing spaces
- **Load-on-demand refs** — never inline ref-* into system prompt; use pointer + Read when needed
- **No timestamps in system prompts** — date/time stays in user message or tool results
- **English-only prompt bodies (CD-9)** — VN allowed only in: frontmatter `description`, output content examples, schema `description` JSON fields, user-facing CLI strings printed back to user

Full guide + anti-pattern checklist: `~/.claude/schemas/intel/CACHE_OPTIMIZATION.md`. Review before every PR that touches skill/agent templates.

## Document Pipeline Rules

### G1: Outline immutability
Outline template BẤT BIẾN cho TKCS, TKCT, dự toán, HSMT, HSDT, NCKT.
Chỉ fill `{{content:X.Y}}` placeholders. Không thêm/xóa/đổi tên section.
**Exception:** Đề án CĐS outline là MUTABLE ở THINK layer, LOCKED ở WRITE layer.

### G2: Văn phong hành chính
Câu bị động, vô nhân xưng, trang trọng. Không "tôi/mình/chúng ta".
Mỗi section mở bằng căn cứ/bối cảnh, kết bằng tóm tắt/dẫn tiếp.

### G3: Placeholder for unknowns
`[CẦN BỔ SUNG: describe]` — KHÔNG bịa số liệu, tên đơn vị, viện dẫn pháp lý.

### G4: Verify before done
Check `{{content:X.Y}}` filled, outline intact, cross-refs valid.

### G5: Document content in files
Agents viết trực tiếp vào files. Chat chỉ hiển thị summary/status.

## Document Structure (NĐ 30/2020)

### Section numbering
- Level 1: `1.` `2.` — Bold
- Level 2: `1.1.` `1.2.` — Bold  
- Level 3: `1.1.1.` — Normal
- Level 4: `a)` `b)` — Lowercase
- Level 5: `-` bullet

### Formatting
- Font: Times New Roman 13pt
- Line spacing: 1.5
- Margins: Top/Bottom 20mm, Left 30mm, Right 15mm
- Page numbers: center bottom
- Alignment: Justify

### Table/Figure numbering
- `Bảng {chapter}.{seq}: {title}`
- `Hình {chapter}.{seq}: {title}`
- Reset mỗi top-level section

### Citation format
- Full: `Nghị định số XX/YYYY/NĐ-CP ngày dd tháng mm năm yyyy của Chính phủ...`
- Short: `Nghị định số XX/YYYY/NĐ-CP`
- Article: `theo quy định tại khoản Y Điều X Nghị định số...`

### Số liệu
- Tiền: `XXX.XXX.XXX đồng`
- Ngày prose: `ngày dd tháng mm năm yyyy`
- Ngày bảng: `dd/mm/yyyy`

## Strategic Thinking Pipeline Rules

### ST-1: Research trước, viết sau
KHÔNG viết document content khi Thinking Bundle chưa FROZEN.

### ST-2: DEDUP bắt buộc
MỌI đề xuất giải pháp/dự án PHẢI qua Dedup Protocol. Không exception.
Cơ sở: CT 34 Nguyên tắc 6 — dùng nền tảng dùng chung, không xây lại.

### ST-3: KB-first
Trước phân tích/đề xuất → đọc KB. Sau phát hiện mới → ghi KB.

### ST-4: Interview liên tục
Không giới hạn ở Spiral 1. Thiếu info → hỏi user. Không bịa.

### ST-5: Giải pháp thực tiễn
Mỗi giải pháp phải trả lời: vấn đề gì? giải quyết thế nào? ai? kinh phí? kết quả đo được?

### ST-6: Spiral back cho phép
Phát hiện mới thay đổi direction → quay lại spiral trước. Max 2 backs per checkpoint.

### ST-7: Outline MUTABLE → LOCKED
THINK layer: structure-advisor customize. Sau Checkpoint 3: LOCKED, bất biến cho WRITE layer.

## Code-to-Docs Pipeline Rules (`/generate-docs`)

### CD-1: Namespace isolation
Agents: `tdoc-*` prefix (technical docs) — tách biệt với `doc-*` (admin docs) + `doc-intel` (document ingestion). Không trộn namespace.

### CD-2: Parallel writers mandatory
5 writers (`tdoc-{arch,tkcs,catalog,testcase,manual}-writer`) PHẢI được dispatch trong 1 message Agent() calls. Sequential = defeat the purpose.

### CD-3: Vision verification là bắt buộc
Sau `tdoc-test-runner` → BẮT BUỘC chạy `tdoc-screenshot-reviewer` để filter ảnh sai. KHÔNG skip để tiết kiệm token — chi phí rework > chi phí vision review.

### CD-4: Screenshot naming canonical
`{feature-id}-step-{NN}-{state}.png`. Không dùng slug, không dùng service prefix. State vocab: `initial | filled | success | error | loading | modal | list | detail | placeholder`.

### CD-5: Templates external
File templates (`test-case.xlsx`, `huong-dan-su-dung.docx`) nằm trong project của user, không bundle vào `.claude/`. Skill đọc qua param `--templates-path`.

### CD-6: Output validation
Sau export, BẮT BUỘC invoke `anthropic-skills:xlsx` (recalc formulas) + `anthropic-skills:docx` (pandoc scan placeholder residuals). Không trust blind output.

### CD-7: Scalability batching
>10 features/service → test-runner batch (10/batch). >30 → researcher chunk (split flow-report). >50 → warn user chia module.

### CD-8: Office export routing — MCP-only via etc-platform (post-merge 2026-04-28)

**Single source of truth**: All Office rendering (DOCX/XLSX) goes through `etc-platform` MCP `/jobs` API. Render engines (`docx.py` + `xlsx.py` + diagram renderer + synthesizers) are bundled into the MCP container at `<MCP image>/src/etc_platform/engines/`. Templates are in `assets/templates/` inside the same image.

**Mandatory flow** (Stage 6 export):
1. `POST localhost:8001/uploads` — upload `content-data.json`
2. `POST localhost:8001/jobs` — submit `{type: "tkct"|"tkcs"|"tkkt"|"hdsd"|"xlsx", upload_id}`
3. `GET  localhost:8001/jobs/{id}` — poll status
4. `GET  localhost:8001/jobs/{id}/files/{name}` — download rendered Office file

**Forbidden patterns**:
- ❌ `python render_docx.py ...` subprocess from Claude/Cursor side
- ❌ `python fill_xlsx_engine.py ...` subprocess
- ❌ `python fill-manual.py` / `python fill-testcase.py` (legacy paths — these files were moved into MCP image)
- ❌ Local `templates/*.docx` reads — templates are bundled in MCP, not user-side

**MCP down → BLOCK**: Skill must instruct user `docker compose up -d` from `~/.ai-kit/team-ai-config/mcp/etc-platform/`. No silent Python fallback. This is non-negotiable per CD-8 single-source-of-truth.

**PDF conversion** (optional post-export step):
- If `mcp__word_document_server__*` registered (separate Word MCP, NOT etc-platform) → call `convert_to_pdf` after docx export
- If not registered → skip + warn user, manual convert via Word UI

Template mapping: documented in `<MCP image>/src/etc_platform/assets/schemas/*.yaml` (canonical, baked into image).

Word/Excel MCP re-enable (only if PDF convert needed):
- Word MCP: `uvx --from office-word-mcp-server word_mcp_server` + add to mcp.json
- Excel MCP: `dotnet tool install --global Sbroenne.ExcelMcp.McpServer` + add to mcp.json (yêu cầu Windows + Excel 2016+ + .NET SDK)

### CD-9: Agent prompts English-only
Tất cả `tdoc-*` agent prompts viết bằng tiếng Anh (machine-readable).
Tiếng Việt CHỈ xuất hiện trong: output content examples, template field values, frontmatter description.

### CD-10: Intel Layer Contract
Shared knowledge layer giữa `from-doc`, `from-code`, `generate-docs` (và SDLC tooling tương lai) đặt tại `{workspace}/docs/intel/`. JSON Schema draft-07 chuẩn hoá tại `~/.claude/schemas/intel/`.

**Single source of truth — KHÔNG skill nào được tạo path khác:**
- `_meta.json` — provenance, TTL, staleness, lock registry (arbiter cho reuse)
- `actor-registry.json` — roles + auth + RBAC mode (NIST 800-162)
- `permission-matrix.json` — Role × Resource × Action (Casbin/IAM pattern)
- `sitemap.json` — navigation + routes + Playwright hints + workflow variants (absorb `frontend-report.json`)
- `feature-catalog.json` — features với role-visibility tagging
- `test-accounts.json` — test credentials per role (Playwright + manual QA bridge). MUST be in `.gitignore` khi `storage=inline`. FK `accounts[].role_slug` → `actor-registry.roles[].slug`.
- `test-evidence/{feature-id}.json` — playwright test cases + execution results + screenshot map per feature. Producer chính: `resume-feature` QA stage. Consumer chính: `generate-docs` Stage 3a (capture) + Stage 4f (xlsx). FK `feature_id` → `feature-catalog.features[].id`.

**Quy tắc:**
1. Mọi producer write intel artifact PHẢI: (a) validate theo schema, (b) update `_meta.json` (producer, produced_at, ttl_days, checksum_sources, source_evidence).
2. Mọi consumer đọc intel artifact PHẢI check `_meta.artifacts[file].stale` trước khi tin.
3. Mọi field user edit thủ công PHẢI được declare trong `_meta.artifacts[file].locked_fields[]` — producer subsequent KHÔNG ghi đè.
4. Conflict giữa nhiều producer → `intel-merger` agent/script áp precedence (tham khảo `~/.claude/schemas/intel/README.md` § Conflict Resolution).
5. Cross-reference integrity bắt buộc: permission.role ∈ actor-registry.roles[].slug; sitemap.routes ↔ feature-catalog.features[].routes; test-accounts.role_slug ∈ actor-registry.roles[].slug; vv. `intel-validator` enforce.
6. Reuse mode default: `reuse_if_fresh` cho cùng workspace; vendor export qua `intel-export` (Phase 3).
7. **Block-if-missing contract**: Consumer skills (generate-docs, resume-feature, intel-refresh) MUST block when a REQUIRED artifact is missing instead of re-discovering. REQUIRED set = {actor-registry, permission-matrix, sitemap, feature-catalog}. test-accounts is OPTIONAL (separate block for HDSD/Playwright targets).
8. **Cursor-side awareness**: `~/.cursor/skills/resume-feature` dispatcher MUST inject `intel-path` + `intel-contract` into FROZEN_HEADER (cache-safe; static text only) so every sub-agent implements code that matches intel from the start — preventing 3-way drift between from-doc → resume-feature → generate-docs.
9. **Reuse-first mandate**: Consumer skills (generate-docs Stage 1-2-3a-4f) MUST reuse + print user-visible reuse summary when intel artifact is FRESH. Only override is `--rerun-stage N` flag. Silent skip is FORBIDDEN. Re-discovery when intel is fresh = anti-pattern (token waste + divergence).
10. **Assembly-not-testing principle (generate-docs)**: `generate-docs` is an ASSEMBLY skill — it collects test cases + screenshots from `test-evidence/{feature-id}.json` (produced by `resume-feature` QA stage) into documents. Stage 3a runs Playwright fresh ONLY for features without evidence. Stage 4f reuses evidence test_cases[] as authoritative; only AUGMENTs (does not re-invent).
11. **Quality gate upstream**: `from-code` Phase 8 MUST hard-stop if `feature-catalog.json` is missing or fields are thin (description < 200 chars, business_intent < 100, flow_summary < 150, acceptance_criteria < 3 items). Cursor SDLC is only accurate when intel input is rich — invest upstream, save downstream.
12. **Close-feature intel sync**: Cursor `close-feature` MUST update `feature-catalog.json` (status: implemented, implementation_evidence{}, test_evidence_ref) — not just `feature-map.yaml`. Bidirectional sync SDLC ↔ canonical intel.
13. **Confidence-aware extraction**: All entry-level intel (`actor-registry.roles[]`, `permission-matrix.permissions[]`, `feature-catalog.features[]`, `sitemap.routes[]`) carries `confidence: high|medium|low|manual` + `evidence[]` + `source_producers[]`. Producers MUST emit confidence per signal-tier rules in `~/.claude/skills/generate-docs/notepads/confidence-routing.md`. Consumers (generate-docs Stage 4) MUST route by tier — never treat low-confidence claims as authoritative without `[CẦN BỔ SUNG]` markers. Stage 5b Pass 7 enforces aggregate stats (block if any `low_confidence_critical` entry, major if low ratio > 5%). Backwards compatible: unset confidence treated as informational, never blocks.

14. **Test-evidence is feature deliverable** (TC enforcement chain): `test-evidence/{feature-id}.json.test_cases[]` MUST be populated through producer chain — `from-doc` synthesizes seeds (status=proposed, source=from-doc/synthesized), `from-code` extracts existing test files (Jest/Pytest/Playwright `describe/it`/`test_*`, source=from-code/extracted), Cursor `resume-feature` QA stage executes (status=passed/failed). `close-feature` HARD-STOPs if test_cases empty or fail. Test-evidence is NOT a doc-time artifact; `generate-docs` is downstream consumer only.

15. **TC count minimum per feature**: `min_tc(feature) = max(5, len(acceptance_criteria) × 2 + len(roles) × 2 + len(dialogs) × 2 + len(error_cases) + 3 edge_cases)`. Cursor `close-feature` HARD-STOPs `feature.status = done` when `test_cases.length < min_tc(feature)` OR any TC has `execution.status != "passed"`. Computed minimum is informational for `from-doc` seed phase (proposed quota), strict for `close-feature` gate.

16. **QA artifacts are co-produced atomically**: Cursor `resume-feature` QA agent MUST produce 3 artifact groups in single nghiệm thu pass — (a) `test-evidence/{id}.json.test_cases[]` (prose, executed, with execution.status), (b) `playwright/{id}.spec.ts` or equivalent E2E framework (executable script, re-runnable by CI), (c) `screenshots/{id}-step-NN-{state}.png` (CD-4 naming, captured DURING Playwright execution — single capture pass, dual-purpose: regression evidence + doc illustration). Triple co-production is atomic — missing any one blocks close-feature.

17. **generate-docs is ASSEMBLY-only on healthy projects**: Stage 4f (xlsx) Step 0 prints reuse summary `"♻ {feature_id}: assembled {N} executed TCs (passed: {M}/{N})"` when test-evidence populated. Stage 3a (screenshot capture) and Stage 4e (HDSD) MUST first scan `docs/intel/screenshots/` for existing CD-4-named files before initiating new capture. Re-capture only allowed for features explicitly lacking QA evidence. Healthy project (full QA pass) → zero re-synthesis, zero re-capture.

18. **Rich fallback for legacy/document-only projects**: When `test-evidence/{id}.json.test_cases[]` empty, generate-docs Stage 4f synthesizes via deterministic ISTQB techniques (Boundary Value Analysis, Equivalence Partition, Decision Table, State Transition, Error Guessing) PLUS VN gov mandatory dimensions (audit log assertion, PII masking, concurrent edit, Vietnamese diacritics, SLA timeout, session expire mid-workflow). Cross-pollinate from HDSD output (`services[].features[].{dialogs, error_cases, ui_elements, steps}`) when feature-catalog lacks these fields. All synthesized TCs tagged `source: "generate-docs/fallback-synthesized"`, `status: "proposed"`. xlsx MUST include warning sheet at top: "⚠ N TCs là PROPOSED, chưa execute — QA team review + execute trước sign-off". Same fallback discipline for screenshots (suffix `-doc-only` to distinguish from QA-captured).

19. **Canonical ID convention**: Feature IDs across all skills (from-doc, from-code, new-feature, generate-docs) MUST use the canonical format — `F-NNN` (mini-repo) or `{service}-F-NNN` (monorepo). Forbidden in ID: date stamps, source-prefix (BOTP/SRS/BRD), module names. ID is immutable after first commit. ID issuance: first producer issues, subsequent producers reuse via lookup against feature-catalog.json + feature-map.yaml + glob `{features-root}/F-*/`. Legacy IDs (`{PREFIX}-{YYYYMMDD}-{NNN}`) are migrated via `docs/intel/id-aliases.json` during transition. Cursor `resume-feature` accepts canonical IDs only; legacy IDs are resolved through aliases.

20. **Unified _state.md schema**: All skills producing per-feature `_state.md` (from-doc Step 5f, from-code Phase 5, new-feature Step 4) emit IDENTICAL frontmatter (21 fields) + 6 body sections (Business Goal, Stage Progress table, Current Stage, Next Action, Active Blockers, Wave Tracker, Escalation Log). Schema reference: from-doc/SKILL.md §5f. Differences only at field-VALUE level (e.g. `source-type: SRS` vs `code-reverse-engineered` vs `user-input`). Resume-feature uniformly consumes any `_state.md` regardless of producer. `feature-req` MUST use structured format (`file:`/`canonical-fallback:`/`scope-modules:`/`scope-features:`/`dev-unit:`) — prose-form `feature-req` is forbidden (resume-feature Step 3.0 parser depends on the structured form).

21. **Production-line lifecycle contract**: All skills/agents that READ or WRITE intel artifacts MUST conform to a contract box defined in `~/.claude/schemas/intel/LIFECYCLE.md` §5. The contract enforces 9 principles (P1-P9): single-writer per field, read-validate-write, no re-discovery, no silent drift, stale-block, information sufficiency, anti-fishing, role refusal, context economy. Each contract box specifies ROLE, READ-GATES, OWN-WRITE, ENRICH, FORBID, EXIT-GATES, FAILURE, TOKEN-BUDGET. Stage agents (ba/sa/qa/dev/etc.) follow individual boxes (§5.1-§5.7); support agents follow class contracts (§5.8 Class A stage-report writers; §5.9 Class B verifiers; §5.10 Class C orchestrators; §5.11 Class D doc-generation consumers). Skill/agent edits PR that violate the contract are blocked. New skills MUST add a contract box before merge.

## etc-platform MCP Rules (UNIFIED — post-merge 2026-04-28)

### MCP-1: Single unified MCP server (port 8001)
**Sau merge ngày 2026-04-28**, etc-platform + etc-platform được hợp nhất thành 1 MCP server duy nhất tại `localhost:8001`. Container name: `etc-platform` (đã rename). Image: `etc-platform:latest`. FastMCP internal name vẫn là `etc-platform` → tool prefix trong client = `mcp__etc-platform__*` (canonical). Port :8000 vẫn expose làm back-compat alias trong giai đoạn migration. Source folder: `~/.ai-kit/team-ai-config/mcp/etc-platform/` (sẽ rename `etc-platform/` khi WSL2 lock release — defer until reboot).

**Tool surface (24 tools)**:

**Render pipeline (kế thừa từ etc-platform)**:
- `validate(content_data)` / `validate_uploaded(upload_id)` / `validate_workspace(workspace_id)` — Pydantic ContentData validation
- `export(...)` / `export_async(...)` — render Office files
- `job_status(job_id)` / `cancel_job(job_id)` / `upload_capacity()` — job queue management
- `schema()` / `section_schema(doc_type)` — content data schema introspection
- `merge_content(base, patch)` — deep merge content-data partials
- `field_map(doc_type)` — interview-to-field mapping
- `template_list()` / `template_fork(source_path, kind)` — Office template management

**Registry (kế thừa từ etc-platform)**:
- `outline_load(doc_type, version)` / `outlines_list()` — IMMUTABLE outlines NĐ 45/2026 (TKCT/TKCS/TKKT/HSMT/HSDT/dự toán/NCKT/thuyết minh/báo cáo CT)
- `kb_query/kb_save` — knowledge base (legal refs, ATTT patterns, NFR boilerplate)
- `dedup_check/dedup_register` — CT 34 §6 cross-project deduplication
- `intel_cache_lookup/intel_cache_contribute` — cross-project pattern library (AGI #2). Anonymization default-deny.
- `template_registry_load(namespace, template_id)` / `templates_registry_list(namespace)` — new-workspace stack scaffolds (renamed from `template_load/templates_list` to avoid collision với render-side `template_list/template_fork`).

**HTTP API** (FastAPI, port 8001): `/uploads`, `/jobs`, `/workspaces`, `/jobs/{id}/files/{name}`, `/healthz`, `/readyz`.

### MCP-2: Default ON, opt-out via `--no-mcp` or `ETC_USE_MCP=0`
Skills default to MCP for centralized state. Local fallback when MCP unavailable; skill must still complete (print warning).

**Universal rule for ANY agent/skill referencing local KB / DEDUP / templates / outlines**: when running on MCP-enabled session, prefer the corresponding MCP tool over local file scan. Files NOT individually updated still inherit this default.

### MCP-3: Bootstrap order
First install: `docker compose up -d` in `~/.ai-kit/team-ai-config/mcp/etc-platform/`. Outlines + KB schema baked into image; KB starts empty (use `kb_save` to populate).

### MCP-4: Anonymization mandate (intel cache)
`intel_cache_contribute` requires `contributor_consent=True` AND server scan passes (no email/phone/CCCD/Bộ-Tỉnh-Sở patterns). Caller pre-redacts; server is last line of defense.

### MCP-5: DEPRECATED (was: co-existence with etc-platform)
Pre-merge state. Both servers consolidated into single etc-platform MCP at :8001 on 2026-04-28. The dual-server architecture is no longer used.

**Migration path for existing skills**:
- Replace `localhost:8000` references → `localhost:8001` (back-compat alias :8000 still active during migration)
- Tool prefix: unified `mcp__etc-platform__*` (FastMCP server-internal name). Cursor `mcp.json` registers both `etc-platform` (:8000/sse) and `etc-platform` (:8001/sse) aliases — both work. Claude Code `settings.json` only enables `etc-platform` alias — use `mcp__etc-platform__*` prefix.

## Knowledge Base Rules

### KB-1: Frontmatter bắt buộc
Mỗi file KB: `domain`, `last_verified`, `confidence`, `sources`, `tags`.

### KB-2: Verify trước dùng
< 90 ngày: dùng. 90-180 ngày: flag verify. > 180 ngày: PHẢI verify.

### KB-3: Không duplicate
Trước KB_WRITE: check entry tương tự. UPDATE thay vì tạo mới.

### KB-4: Dedup data integrity
ecosystem/ entries = source of truth cho DEDUP. Phải chính xác.

## Legal References (Quick)

| Topic | Văn bản |
|---|---|
| CĐS quốc gia | QĐ 749/QĐ-TTg |
| 9 nguyên tắc CĐS | CT 34/CT-TTg |
| Quản lý ĐTƯDCNTT | NĐ 45/2026/NĐ-CP (thay NĐ 73/2019) — Đ9:ngưỡng, Đ11:BCCT, Đ12:NCKT, Đ13:TKCS, Đ14:TKCT, Đ16:DT, Đ17:TĐ, Đ22:KT |
| Dự toán PM | TT 04/2020/TT-BTTTT |
| Đầu tư công | Luật 58/2024/QH15 |
| Đấu thầu | Luật 22/2023/QH15 + NĐ 214/2025/NĐ-CP (thay NĐ 24/2024, hiệu lực 04/08/2025) |
| Văn bản hành chính | NĐ 30/2020/NĐ-CP |
| Bảo vệ DLCN | NĐ 13/2023/NĐ-CP |
