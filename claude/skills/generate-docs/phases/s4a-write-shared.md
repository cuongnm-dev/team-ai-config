# Stage 4a — Shared Writer

**ROLE**: Write fields shared across all doc types. Execute FIRST in Phase 3.

**OWNED BLOCKS**: `project`, `meta`, `dev_unit`, `overview`, `diagrams`

**MODEL**: Sonnet

**AGENT**: Orchestrator runs inline (no sub-dispatch)

---

## Context load

```
@Files {DOCS_PATH}/intel/feature-catalog.json
@Files {DOCS_PATH}/intel/system-inventory.json
@Files {DOCS_PATH}/intel/domain-skeleton.json
@Files {DOCS_PATH}/intel/code-facts.json
@Files MEMORIES.md
@Notepads hanh-chinh-vn-rules
@Notepads mermaid-templates
```

**Auto-attach MDC**: `generate-docs-base`, `generate-docs-diagrams`, `generate-docs-prose-quality`, `generate-docs-placeholder-policy`

---

## Output spec

### `project`, `dev_unit` (fill from MEMORIES or ask user)

Schema: `{display_name, code, client}` + `dev_unit` string.

### `meta`

Schema: `{today: "dd/mm/yyyy", version, test_period}`.

### `overview` — MIN WORD COUNTS

| Field | Min words | Source |
|---|---|---|
| `purpose` | 200 | doc-intel.overview.purpose + project goals |
| `scope` | 200 | doc-intel.overview.scope |
| `system_description` | 300 | doc-intel + architecture hint |
| `conventions` | 150 | UI conventions, terminology |
| `terms[]` | 10+ entries | doc-intel.overview.terms + glossary |
| `references[]` | 5+ entries | doc-intel.overview.references |

Each prose field MUST contain (per prose-quality rule):
- ≥ 5 numbers per 500 words
- ≥ 3 named entities per 500 words
- Zero banned phrases

### `diagrams` — 12+ sources MANDATORY (Mermaid default + SVG hero optional)

Reference `@Notepads mermaid-templates`. Fill ALL keys:

```
diagrams.architecture_diagram           (TKKT)  ← có thể ESCALATE SVG hero
diagrams.logical_diagram                (TKKT)
diagrams.data_diagram                   (TKKT)
diagrams.integration_diagram            (TKKT)  ← có thể ESCALATE SVG hero
diagrams.deployment_diagram             (TKKT)
diagrams.security_diagram               (TKKT)
diagrams.tkcs_architecture_diagram      (TKCS)
diagrams.tkcs_data_model_diagram        (TKCS)
diagrams.tkct_architecture_overview_diagram  (TKCT)
diagrams.tkct_db_erd_diagram            (TKCT)
diagrams.tkct_ui_layout_diagram         (TKCT)
diagrams.tkct_integration_diagram       (TKCT)  ← có thể ESCALATE SVG hero swimlane cho DVC
```

**Decision tree — Mermaid hay SVG hero?**

```
Project thuộc diện Chính phủ số / CQĐT (doc-intel có từ khoá "CPĐT",
"CQĐT", "chính phủ số", "QĐ 749", "QĐ 292", "kiến trúc 4 lớp")?
├─ YES → architecture_diagram → SVG hero "kien-truc-4-lop"
└─ NO  → architecture_diagram → Mermaid flowchart

Project có tích hợp qua NDXP / LGSP (external_integrations có NDXP/LGSP)?
├─ YES → integration_diagram → SVG hero "ndxp-hub-spoke"
└─ NO  → integration_diagram → Mermaid sequenceDiagram

Project là hệ thống DVC trực tuyến toàn trình (cổng DVC, VNeID, eKYC)?
├─ YES → tkct_integration_diagram → SVG hero "swimlane-workflow"
└─ NO  → tkct_integration_diagram → Mermaid sequenceDiagram thông thường

Các key khác → LUÔN Mermaid.
```

**Cảnh báo**: chỉ escalate SVG hero ở key docx đã có placeholder — nếu invent
key mới (VD `business_flow_diagram`), PNG sẽ render nhưng không nhúng được →
orphan. Chỉ 12 key mandated trên là hợp lệ.

**Format Dạng B (SVG hero — object)**:
```jsonc
"architecture_diagram": {
  "template": "kien-truc-4-lop",
  "data": { /* schema riêng — xem notepad section "SVG hero templates" */ }
}
```

**Format Dạng A (Mermaid — string, default)**:
```jsonc
"logical_diagram": "flowchart TB\n  Web --> API\n  API --> DB"
```

Khi escalate SVG hero → vẫn phải cross-reference field ref trong `architecture`:
```jsonc
"architecture": {
  "architecture_diagram": "architecture_diagram.png"  // filename ref không đổi
}
```

No data → placeholder Mermaid (KHÔNG dùng SVG hero với data rỗng):
```
flowchart TB\n    P["[CẦN BỔ SUNG: diagram type — BA/KTS fill]"]
```

Never skip a key.

**Mermaid syntax self-check (before merge — prevents Stage 6 delivery failure):**

After writing each Mermaid string, verify:
- Starts with a valid graph type: `flowchart`, `sequenceDiagram`, `erDiagram`, `classDiagram`
- Node labels with special chars are quoted: `A["label with spaces"]` not `A[label with spaces]`
- Arrows use correct syntax: `-->`, `-->>`, `->>` (not `->` or `=>`)
- No unmatched quotes or parentheses inside node labels
- Test mentally: "Would mmdc accept this string?"

If unsure → use simpler Mermaid (fewer nodes) rather than complex syntax that may break.

**SVG hero key guard:**

Only use SVG hero (`{"template": "...", "data": {...}}` object format) for these exact 3 keys:
- `diagrams.architecture_diagram` (when CPĐT/CQĐT project)
- `diagrams.integration_diagram` (when NDXP/LGSP integration exists)
- `diagrams.tkct_integration_diagram` (when DVC online full-service system)

Any other key → **always use Mermaid string**. An SVG hero in a custom or unsupported key produces an orphan image that export engine cannot embed.

---

## Commit + feedback loop

```python
result = mcp__etc-platform__merge_content(
    partial={
        "project": {...}, "meta": {...}, "dev_unit": "...",
        "overview": {...}, "diagrams": {...}
    }# returns validation feedback immediately
)

# Check result.validation:
# {
#   "valid": true,
#   "errors":   [],          # Pydantic violations — fix immediately
#   "warnings": [...],       # quality violations — fix and re-merge
#   "dod_met":  false,       # true = done
#   "action_required": "..."
# }

while not result["validation"]["dod_met"]:
    # Fix every warning (expand prose, add diagrams, remove banned phrases)
    result = mcp__etc-platform__merge_content(data_path, fixed_partial)
```

---

## Success criteria — DoD-bound

Shared writer MUST NOT proceed to specialist dispatch until `dod_met: true`:

- [ ] overview.purpose ≥ 200 words
- [ ] overview.scope ≥ 200 words
- [ ] overview.system_description ≥ 300 words
- [ ] ≥ 10 terms, ≥ 5 references
- [ ] All 12 diagram keys present (Mermaid placeholder acceptable for diagrams without data)
- [ ] 0 banned phrases
- [ ] project/meta/dev_unit filled (no placeholder)

Return JSON:
```json
{"specialist": "shared", "status": "done", "validate_clean": true, "remaining_warnings": [], "words": 3200, "diagrams": 12, "terms": 14, "references": 8}
```
