# Stage 2a — Doc Harvester (Path A — Cursor Edition)

**Stage**: 2 ANALYSIS, sub-step 2a — Custom Mode "Doc Harvester"
**Predecessor**: Stage 1 Discovery (actor-registry.json exists)
**Successor**: Stage 2.4 (code-facts) parallel + Stage 3 if HDSD

**ROLE**: Document reader. Extract prose content from `docs/` via Cursor semantic search.

**TRIGGER**: `DOCS_ROUTE=A` (doc coverage ≥ 2/5).

**OUTPUT** (split across Stage 1+2 artifacts): `actor-registry.json`, `system-inventory.json`, `domain-skeleton.json`, `data-model.json`, `feature-catalog.json`, `sitemap.json`

**MODEL**: Sonnet

---

## CORE RULES

1. READ ONLY from `docs/`, README, ARCHITECTURE.md, ADR files. NEVER read source code.
2. Missing fields → emit `[CẦN BỔ SUNG: <what>]`. NEVER infer from code.
3. Preserve VN prose from docs verbatim — reformat only, no paraphrase.
4. MANDATORY citation — every field has `source` pointer (file path + heading).
5. NEVER create Python scripts. Use `@Codebase` / `@Files` only.

---

## Protocol

### Step 1 — Inventory (no content read)

```
@Folders docs/ docs/adr docs/features docs/strategic
@Files README.md ARCHITECTURE.md CHANGELOG.md
```

Output `intel/doc-inventory.md` listing: path + first heading + exists-status.

### Step 1.5 — Check upstream `from-doc` intel (REQUIRED reuse when fresh)

When upstream `/from-doc` (or `/from-code`) intel exists and is FRESH per `_meta.json`, reuse is **MANDATORY** (per CD-10 Quy tắc 7 + reuse-first mandate). Re-extraction allowed ONLY with `--rerun-stage 2` flag.

Print to user (REQUIRED):
```
Stage 2a (Doc Harvest): ♻ REUSED feature-catalog ({N} features), domain-skeleton ({M} modules)
                        enrich: data-model.entities (3 missing fields)
```

```bash
# Check existence
FROM_DOC_DOC_BRIEF=""
FROM_DOC_TECH_BRIEF=""
for p in docs/intel/doc-brief.md docs/intel/tech-brief.md; do
  [ -f "$p" ] && echo "📚 from-doc intel found: $p"
done
[ -f docs/intel/doc-brief.md ] && FROM_DOC_DOC_BRIEF=docs/intel/doc-brief.md
[ -f docs/intel/tech-brief.md ] && FROM_DOC_TECH_BRIEF=docs/intel/tech-brief.md
```

If found, load them:
```
@Files docs/intel/doc-brief.md docs/intel/tech-brief.md
```

**Why reuse**: `doc-brief.md` is AI-analyzed digest of customer docs (PDF/DOCX) from Stage 1. It contains project-level business context already condensed. Re-extracting from scattered README/ARCHITECTURE/docs/strategic wastes tokens + risks lossy extraction.

**Priority** (when both available): `from-doc intel` > `README/ARCHITECTURE` > `@Codebase` semantic search.

**Mapping table**: from-doc fields → content-data fields

| from-doc section | content-data field |
|---|---|
| `doc-brief.overview` / `purpose` | `overview.purpose`, `overview.scope` |
| `doc-brief.system-description` | `overview.system_description` |
| `doc-brief.business-context` | `architecture.business_overview` |
| `doc-brief.integrations` | `architecture.external_integrations` |
| `doc-brief.current-state` / `hiện trạng` | `tkcs.current_state` |
| `doc-brief.necessity` / `sự cần thiết` | `tkcs.necessity` |
| `doc-brief.objectives` / `mục tiêu` | `tkcs.objectives` |
| `doc-brief.legal-basis` / `căn cứ pháp lý` | `tkcs.legal_basis` |
| `doc-brief.scope-modules` | `architecture.components[].name` hints |
| `tech-brief.stack` | Cross-check với `code-facts.tech_stack` (code-facts wins if conflict) |

**Citation**: When field sourced from from-doc, set `source: "docs/intel/doc-brief.md#<section>"` in the relevant artifact.

### Step 2 — Semantic harvest per content-data block

If Step 1.5 loaded from-doc intel → skip overlapping queries below (marked with ★).

pattern: 1 block = 1-2 `@Codebase` queries + targeted `@Files` read.

| content-data block | Query pattern | ★ Skip if from-doc |
|---|---|---|
| `overview.purpose/scope` | `@Codebase "mục đích phạm vi tổng quan hệ thống"` | ★ |
| `overview.system_description` | `@Codebase "tổng quan hệ thống"` | ★ |
| `overview.terms` | `@Files docs/glossary.md docs/thuat-ngu.md README.md` | |
| `overview.references` | `@Codebase "tài liệu tham chiếu references"` | |
| `services[].features[]` | `@Folders docs/features` | |
| `troubleshooting` | `@Codebase "xử lý sự cố troubleshooting FAQ"` | |
| `architecture.business_overview` | `@Codebase "nghiệp vụ quy trình business flow"` | ★ |
| `architecture.design_principles` | `@Folders docs/adr` + `@Codebase "nguyên tắc thiết kế"` | |
| `architecture.tech_stack` | `@Files ARCHITECTURE.md docs/stack.md` | (also cross-check code-facts) |
| `architecture.components` | `@Codebase "thành phần component service microservice"` | |
| `architecture.data_entities` | `@Files docs/data-model.md docs/erd.md` | |
| `architecture.apis` | `@Files docs/api-reference.md` | |
| `architecture.external_integrations` | `@Codebase "tích hợp integration external"` | ★ |
| `architecture.security_description` | `@Folders docs/security` | |
| `architecture.nfr` | `@Files docs/nfr.md ARCHITECTURE.md` | |
| `tkcs.legal_basis` | `@Folders docs/legal` | ★ (if doc-brief has legal section) |
| `tkcs.current_state` | `@Codebase "hiện trạng nghiệp vụ CNTT"` | ★ |
| `tkcs.necessity` | `@Codebase "sự cần thiết đầu tư"` | ★ |
| `tkcs.objectives` | `@Codebase "mục tiêu kết quả đầu ra"` | ★ |
| `tkcs.architecture_compliance` | `@Codebase "khung kiến trúc CPĐT 4.0 QĐ 292"` | |
| `tkcs.timeline / milestones` | `@Files docs/roadmap.md docs/schedule.md` | |
| `tkcs.total_investment / opex` | `@Files docs/budget.md` | |

legend: ★ = skip if `docs/intel/doc-brief.md` already provided this block (Step 1.5).

Read section-only via `@Files path.md#heading` when possible.

### Step 3 — Produce intel artifacts via Composer (one per Stage 1+2 sub-output)

Write draft in-memory → Composer proposes → user accept → file saved.

---

## Schema

Wrapper pattern `{value, source}` per field (Phase 3 unwraps):

```jsonc
{
  "meta": {
    "generated_at": "<ISO timestamp>",
    "route": "A",
    "doc_coverage_score": <int>,
    "queries_used": [<query strings>],
    "sources_cited": [{"path": "<file>", "sections": [<heading names>]}],
    "missing_blocks": [<dotted paths absent in docs>]
  },

  "overview": {
    "purpose": {"value": "<prose>", "source": "<file#heading>"},
    "scope": {...},
    "system_description": {...},
    "terms": [{"short": "...", "full": "...", "explanation": "...", "source": "..."}],
    "references": [{"stt": "1", "name": "...", "ref": "...", "source": "..."}]
  },

  "features_from_docs": [
    {
      "id": "F-001",
      "name": "<vn-name>",
      "description": "<vn>",
      "actors": [<vn-role>],
      "entry_ui": "<path>",
      "preconditions": "<vn>",
      "ui_elements": [...],
      "steps": [...],
      "error_cases": [...],
      "source": "docs/features/F-001/**"
    }
  ],

  "architecture_from_docs": {
    "business_overview": {...},
    "design_principles": {...},
    "tech_stack": [{"layer": "...", "technology": "...", "version": "<or placeholder>", "source": "..."}],
    "security_description": {...},
    "data_classification": {...}
  },

  "tkcs_from_docs": {
    "legal_basis": {...},
    "current_state": {...}
    // Keys missing from docs → omit entirely, NEVER null/placeholder here.
    // Phase 3 will emit [CẦN BỔ SUNG] when key absent.
  },

  "troubleshooting_from_docs": [
    {"situation": "...", "cause": "...", "resolution": "...", "source": "..."}
  ]
}
```

---

## Token budget

| Repo size | Expected tokens |
|---|---|
| Small (README + 5 ADRs) | ~5K |
| Medium (+ 20 feature specs) | ~12K |
| Large (+ strategic docs) | ~20K |

---

## Error handling

| Situation | Action |
|---|---|
| Cursor indexing stale | Settings → Features → Codebase Indexing → Re-index |
| `@Codebase` 0 hits for key query | Fallback `@Files docs/**/*.md` broad + warn in meta |
| Content conflict between 2 docs | Composer conflict UI, user picks source of truth |
| Single doc > 50K tokens | Use `@Files path.md#section` for section-only read |

---

## Anti-patterns

- ❌ Read source code (package.json, *.ts, *.py, etc.) — that's Stage 2c (s2c-code-facts.md)
- ❌ Grep `@Controller` / `@Get` / route decorators
- ❌ Infer from folder structure
- ❌ Dispatch sub-agents (single-agent phase)
- ❌ Create `.py` script to extract — use @-mention only

User needs code facts → abort Path A, re-run `/generate-docs --force-code-scan` → Path B.
