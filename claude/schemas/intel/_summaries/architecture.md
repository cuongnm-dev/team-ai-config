# Schema Summary — Architecture

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/architecture.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): TKKT (§3-4-6), TKCS (§3.3 — 3 mô hình mandate), TKCT (§2.1 kế thừa)
> **Writer voice hint**: Reference + Explanation (architecture facts + design rationale)

## Purpose

Architectural design: 4 CPĐT 4.0 layers, logical components, design principles, 3 mandatory architecture models (overall + logical + physical per NĐ 45/2026 Đ13), API aggregates. Tier 2 cross-stage. Consumed by sa-pro/tech-lead (Cursor when designing solution boundaries) + tdoc-tkkt-writer §3-4-6 (entirely) + tdoc-tkcs-writer §3.3 (3 mô hình mandate) + tdoc-tkct-writer §2.1 (kế thừa kiến trúc). Justified by: TKCS §3.3 (Đ13 BẮT BUỘC 3 mô hình), TKCT §2.1 (kế thừa), TKKT §3 (4 tầng), §4 (components), §6 (apis_aggregate).

## Required top-level fields

- `schema_version`
- `components`
- `cpdt_layers`
- `design_principles`

## Field structure (depth ≤ 2)

- `schema_version` (string) [const='1.0'] **REQUIRED**
- `purpose` (string | null) — 1-paragraph architectural mission statement. Source for TKKT §1.1 + TKCS §1.4.
- `cpdt_layers` (array<object {...}>) **REQUIRED** — 4 layers per QĐ 292/2025 Khung KT CPĐT 4.0. MUST cover all 4 layers when project is gov IT system. Hard-stop in intel-validator if 'giao-dien' or 'nghiep-vu' missing.
  - **(each array item)**:
    - `layer` (string) **REQUIRED** — CPĐT 4.0 layer slug. giao-dien=UI/Presentation, nghiep-vu=Business, du-lieu=Data&Application, ha-tang=Infrastructure.
    - `display_name_vn` (string) — Vietnamese display, e.g. 'Tầng giao diện người dùng'.
    - `description` (string) [min_chars=50] **REQUIRED** — Layer purpose + scope. Min 50 chars to prevent thin output.
    - `components` (array<string>) **REQUIRED** — components[].name belonging to this layer. Denormalization for quick layer-view in TKKT §3.2-3.5.
    - `key_technologies` (array<string>) — tech_stack[].id keys aggregated for this layer. Cross-ref system-inventory.tech_stack[].
- `design_principles` (array<object {...}>) [min_items=5] **REQUIRED** — Architecture principles guiding design decisions. Min 5 (TKKT §2 mandate ≥5 principles). Examples: tách lớp, modular, security-by-default, dùng nền tảng dùng chung (CT 34 §6), open standards.
  - **(each array item)**:
    - `title` (string) **REQUIRED** — Vietnamese principle title.
    - `description` (string) [min_chars=50] **REQUIRED** — Why this principle, how it applies to this project.
    - `legal_basis` (string | null) — Citation. Examples: 'CT 34/CT-TTg §6', 'QĐ 292/2025 Mục II'.
- `components` (array<object {...}>) [min_items=3] **REQUIRED** — Logical phân hệ catalog. Min 3 (per tdoc-tkkt-writer Step 1 minimum). Components are LOGICAL groupings (NOT 1:1 with services). One service may host multiple components; one component may span serv...
  - **(each array item)**:
    - `name` (string) **REQUIRED** — PascalCase or Vietnamese title-case component name. Example: 'QuanLyHoSo', 'AuthService'.
    - `name_vn` (string | null) — Vietnamese display name for TKKT §4.2.
    - `cpdt_layer` (string) **REQUIRED**
    - `purpose` (string) [min_chars=100] **REQUIRED** — ≥100 chars Vietnamese description. Cite owned entities + integrations + business capability. Generic statements without entity names rejected by tdoc-tkkt-writer Step 5 diversity check.
    - `owned_entities` (array<string>) — data-model.entities[].name owned by this component. Authoritative ownership.
    - `integrations_consumed` (array<string>) — integrations[].id this component depends on.
    - `exposed_apis` (array<string>) — api-spec.endpoints[].operation_id exposed by this component (top 5-10 most representative).
    - `service_refs` (array<string>) — system-inventory.services[].id hosting this component.
    - `depends_on_components` (array<string>) — Other components[].name this component depends on. Used for dependency graphs.
    - `evidence` (array<$ref:evidence>)
    - `confidence` (string)
    - `source_producers` (array<string>)
- `models` (object {...}) — 3 mandatory architecture models per NĐ 45/2026 Đ13 (TKCS §3.3). Each emits Mermaid source. ALL 3 required for TKCS export — block if any missing.
  - `overall_diagram` (string | null) — Mermaid graph TD source. High-level architecture overview: external systems + main components + data flow direction. Used by TKCS §3.3 (mô hình tổng thể) + TKKT §3.1.
  - `logical_diagram` (string | null) — Mermaid graph LR source. Logical components grouped by domain/cpdt_layer. Used by TKCS §3.3 (mô hình lô-gic) + TKKT §4.1.
  - `physical_diagram` (string | null) — Mermaid graph TB source. Physical deployment view: zones + servers + network. Used by TKCS §3.3 (mô hình vật lý) + TKKT §8.1 + TKCT §6.1.
- `apis_aggregate` (array<object {...}>) — Aggregated API counts per module. TKKT §6.2 mandate (audience-profile bans listing paths). Pre-computed by from-code Phase 2; writers MUST NOT enumerate api-spec.endpoints[].path at TKKT writer level.
  - **(each array item)**:
    - `component_or_module` (string) **REQUIRED** — components[].name or grouping label.
    - `total` (integer) [min=0] **REQUIRED**
    - `public` (integer) [min=0] — Externally exposed endpoints.
    - `internal` (integer) [min=0]
    - `webhook` (integer) [min=0]
- `external_systems_summary` (array<object {...}>) — Aggregated view of external integrations for TKKT §3.1 overall diagram + TKCS §3.6 narrative. Pre-computed from integrations.json.
  - **(each array item)**:
    - `name` (string) **REQUIRED**
    - `purpose` (string) **REQUIRED**
    - `integration_id_ref` (string | null) — integrations.integrations[].id.
- `deployment_overview` (string | null) — 1-2 paragraph deployment narrative for TKKT §8.2. AVOID Docker/K8s words (use tropes per audience-profile).
- `architectural_decisions` (array<object {...}>) — ADR-style key decisions captured. Optional but recommended for non-trivial projects.
  - **(each array item)**:
    - `id` (string) **REQUIRED** — ADR id, e.g. 'ADR-001'.
    - `title` (string) **REQUIRED**
    - `context` (string) — Why this decision was needed.
    - `decision` (string) **REQUIRED** — What was decided.
    - `consequences` (string) — Trade-offs accepted.
    - `alternatives` (array<string>)
    - `status` (enum ['proposed', 'accepted', 'deprecated', 'superseded'])
    - `date` (string | null) [format=date]
    - `adr_file` (string | null) — Repo-relative path to full ADR markdown.
- `warnings` (array<object {...}>)
  - **(each array item)**:
    - `severity` (enum ['high', 'medium', 'low']) **REQUIRED**
    - `category` (string)
    - `message` (string) **REQUIRED**
    - `component` (string | null)

## Critical constraints (quick reference for emit/validate)

- `cpdt_layers[].description` — min_chars=50
- `design_principles` — min_items=5
- `design_principles[].description` — min_chars=50
- `components` — min_items=3
- `components[].purpose` — min_chars=100

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `architecture.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/architecture.schema.json`