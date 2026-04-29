# Outline Coverage Matrix — Intel ↔ Document Sections

**Status**: v1 draft (2026-04-28)
**Scope**: TKCS (NĐ 45/2026 Đ13) + TKCT (NĐ 45/2026 Đ14) + TKKT (QĐ 292/2025 — Khung KT CPĐT 4.0)
**Goal**: Reverse-engineer from outline placeholders back to intel fields. For each `{{content:X.Y}}` in immutable outlines, declare WHICH intel field feeds it, WHICH producer is responsible, and WHETHER the current schema covers it.

---

## How to read this matrix

| Column | Meaning |
|---|---|
| **Section** | Outline anchor (`X.Y`) + topic |
| **Required content** | What NĐ/QĐ mandates per the outline `<!-- Pháp lý -->` annotations |
| **Intel field** | JSON path that supplies this content |
| **Producer** | Skill that emits this field (`from-doc` / `from-code` / `from-doc+code` / `manual`) |
| **Status** | ✅ schema covers + producer emits / ⚠ schema partial / ❌ missing — NEW field needed |

**Convention**: when both `from-doc` and `from-code` contribute, conflict resolution per `README.md` § Conflict Resolution Precedence (code wins for facts, doc wins for prose/business).

---

## 1. TKCS — Thiết kế Cơ sở (NĐ 45/2026 Điều 13)

**Audience**: Bộ TC / Sở TC / ban QLDA — non-technical, đầu tư approval focus.
**Length target**: 30-50 trang.
**Mandatory artifacts** (Đ13 explicit): 3 mô hình kiến trúc (tổng thể/lô-gic/vật lý), mapping Khung KT QGS, IPv6 readiness, LGSP/NGSP integration analysis, dự toán sơ bộ.

### §1. Thông tin chung về hoạt động ứng dụng CNTT

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 1.1 Giới thiệu dự án | Project name, owner, group A/B/C per Đ9 | `business-context.project.{name,owner,investment_amount,investment_group}` | `from-doc` (manual) | ❌ no schema |
| 1.2 Căn cứ pháp lý | Legal references list | `business-context.legal_basis[]` (list of `{ref_code, title, date, applicability}`) | `from-doc` (KB-driven) | ❌ no schema |
| 1.3 Sự cần thiết đầu tư | Pain points, gaps in current state | `business-context.pain_points[]` + `feature-catalog.features[].business_intent` | `from-doc` | ⚠ feature-level OK, project-level missing |
| 1.4.1 Mục tiêu tổng quát | Strategic goal | `business-context.objectives.overall` | `from-doc` | ❌ no schema |
| 1.4.2 Mục tiêu cụ thể | Concrete objectives (≥3) | `business-context.objectives.specific[]` | `from-doc` | ❌ no schema |
| 1.5 Phạm vi đầu tư | Scope statement | `business-context.scope.{in_scope[], out_of_scope[], boundaries}` | `from-doc` | ❌ no schema |

### §2. Hiện trạng hệ thống CNTT

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 2.1 Hiện trạng hạ tầng | Existing servers, network | `current-state.infrastructure.{servers[], network_topology, datacenter}` | `from-doc` (interview) | ❌ no schema |
| 2.2 Hiện trạng phần mềm | Existing apps, integrations | `current-state.applications[]` + `system-inventory.services[]` (if migration) | `from-doc+code` | ⚠ partial — `system-inventory` not yet schematized |
| 2.3 Hiện trạng nhân lực CNTT | IT staff numbers, skills | `current-state.human_resources.{count, skills[], training_need}` | `from-doc` | ❌ no schema |
| 2.4 Đánh giá chung | SWOT or pain points | `current-state.assessment.{strengths[], weaknesses[], opportunities[], threats[]}` | `from-doc` | ❌ no schema |

### §3. Giải pháp thiết kế sơ bộ (LÕI — most critical)

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 3.1 Yêu cầu chức năng | Module/feature catalog | `feature-catalog.features[].{name, description, module}` | `from-doc+code` | ✅ schema covers |
| 3.2 Yêu cầu phi chức năng | NFR (perf, security, scale, integration) | `nfr-catalog.items[].{category, requirement, target, measurement_method}` | `from-doc` (target) + `from-code` (current measurements) | ❌ no schema |
| 3.3 Kiến trúc hệ thống — **3 MÔ HÌNH** | tổng thể + lô-gic + vật lý (Đ13 BẮT BUỘC) | `architecture.{overall_diagram, logical_diagram, physical_diagram}` + `architecture.components[]` | `from-code` (logical) + `from-doc` (overall+physical) | ❌ no schema |
| 3.4 Giải pháp công nghệ | Tech stack + framework + DB | `system-inventory.tech_stack[].{layer, technology, version, license}` | `from-code` | ❌ no schema |
| 3.5 Giải pháp ATTT | ATTT level (1-5 per NĐ 85/2016) + IPv6 readiness | `nfr-catalog.security.{attt_level, ipv6_readiness, encryption[], certificates[]}` | `from-doc` (level) + `from-code` (controls) | ❌ no schema |
| 3.6 Giải pháp tích hợp | LGSP/NGSP + external systems | `integrations[].{name, type:lgsp\|ngsp\|external, protocol, data_exchanged, status}` | `from-doc+code` | ❌ no schema |

### §4. Thiết kế hạ tầng kỹ thuật

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 4.1 Mô hình triển khai | On-prem / Cloud / Hybrid | `infrastructure.deployment_model.{type, rationale, cloud_provider}` | `from-doc` | ❌ no schema |
| 4.2 Danh mục thiết bị | Hardware list + cost | `infrastructure.hardware[].{type, spec, quantity, unit_price}` | `from-doc` (manual) | ❌ no schema |
| 4.3 Thiết kế mạng | Network diagram + zones | `infrastructure.network.{zones[], topology_diagram, ipv6_plan}` | `from-doc` | ❌ no schema |

### §5. Kế hoạch triển khai

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 5.1 Phân kỳ đầu tư | Phases | `project-plan.phases[].{name, deliverables[], duration_months, budget_pct}` | `from-doc` (manual) | ❌ no schema |
| 5.2 Tiến độ thực hiện | Gantt/timeline | `project-plan.timeline[].{task, start, end, dependency}` | `from-doc` (manual) | ❌ no schema |
| 5.3 Tổ chức thực hiện | Roles + responsibilities | `project-plan.organization.{owner, contractor, supervisor, qa}` | `from-doc` (manual) | ❌ no schema |

### §6. Dự toán chi phí sơ bộ

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 6.1 Cơ sở lập dự toán | TT 04/2020 method | `cost-estimate.basis.{method:tt04\|reference, sources[]}` | `from-doc` | ❌ no schema |
| 6.2 Tổng hợp chi phí | 6-line item table (TKCS aggregate level) | `cost-estimate.summary[].{item, amount, ratio_pct, note}` | `from-doc` (manual) | ❌ no schema |
| 6.3 Nguồn vốn | Funding source | `cost-estimate.funding.{source, amount, schedule[]}` | `from-doc` | ❌ no schema |

### §7. Hiệu quả đầu tư

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 7.1 Hiệu quả kinh tế | Cost savings, revenue | `business-context.expected_benefits.economic[]` | `from-doc` | ❌ no schema |
| 7.2 Hiệu quả xã hội | Service quality, citizen impact | `business-context.expected_benefits.social[]` | `from-doc` | ❌ no schema |

### §8. Kiến nghị

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 8 | Recommendations to approver | `business-context.recommendations[]` | `from-doc` | ❌ no schema |

**TKCS gap summary**: 24/27 sections need new schema fields. Of those, ~18 belong to `business-context.json` (manual/from-doc), 4 to `architecture.json` + `nfr-catalog.json`, 3 to `infrastructure.json` + `cost-estimate.json` + `project-plan.json` (mostly manual interview).

---

## 2. TKCT — Thiết kế Chi tiết (NĐ 45/2026 Điều 14)

**Audience**: Engineer, QA, đơn vị thi công, tư vấn giám sát — kỹ thuật sâu.
**Length target**: 60-100+ trang.
**Mandatory artifacts** (Đ14 explicit): module spec chi tiết, ERD + từ điển dữ liệu, RBAC matrix, API spec, test cases, dự toán Function Point per TT 04/2020.

### §1. Giới thiệu

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 1.1 Mục đích | Why TKCT exists | derived from doc-brief intro | `from-doc` | ⚠ no explicit field, derive from doc-brief |
| 1.2 Phạm vi | Scope of detailed design | derived from `business-context.scope` (kế thừa TKCS) | `from-doc` | ❌ no schema |
| 1.3 Tài liệu tham chiếu | TKCS, NCKT, standards | `business-context.references[]` | `from-doc` | ❌ no schema |
| 1.4 Thuật ngữ | Glossary | `glossary[].{term, definition}` | `from-doc` | ❌ no schema |

### §2. Tổng quan hệ thống

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 2.1 Kiến trúc tổng thể | Inherit from TKCS §3.3 | `architecture.overall_diagram` + summary | (TKKT is authoritative) | ❌ no schema |
| 2.2 Mô hình triển khai | Inherit from TKCS §4.1 | `infrastructure.deployment_model` | `from-doc` | ❌ no schema |
| 2.3 Công nghệ sử dụng | Tech stack với version chính xác | `system-inventory.tech_stack[]` | `from-code` | ❌ no schema |

### §3. Thiết kế chi tiết phần mềm (LÕI #1)

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 3.1 Thiết kế module | Per module: use case, sequence, function spec | `feature-catalog.features[]` + `sitemap.routes[]` + per-feature: dialogs, ui_elements, error_cases | `from-code` (routes/components) + `from-doc` (use case prose) | ⚠ feature-catalog has flow_summary but lacks dialogs/ui_elements |
| 3.2 Thiết kế giao diện | Wireframe + screen catalog | `sitemap.routes[].component` + screenshots | `from-code` (route+component) | ⚠ schema OK, screenshots in `docs/intel/screenshots/` |
| 3.3 Thiết kế báo cáo | Reports: id, name, source, user | `reports[].{id, name, description, data_source, target_role}` | `from-doc+code` | ❌ no schema |

### §4. Thiết kế CSDL (LÕI #2)

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 4.1 Mô hình DL logic | ERD tổng thể | `data-model.erd_diagram` + `data-model.entities[]` (logical) | `from-code` (ORM/migrations) | ❌ no schema |
| 4.2 Mô hình DL vật lý | Per-table: columns, types, constraints, indexes | `data-model.tables[].{name, columns[].{name, type, nullable, default, fk}, indexes[], constraints[]}` | `from-code` (DDL/migration) | ❌ no schema |
| 4.3 Từ điển dữ liệu | Data dictionary | `data-model.data_dictionary[].{table, column, type, business_meaning, valid_values}` | `from-code` (schema) + `from-doc` (business_meaning) | ❌ no schema |
| 4.4 Backup/Recovery | Backup strategy | `data-model.backup_strategy.{frequency, retention, rpo, rto, method}` | `from-doc` | ❌ no schema |

### §5. Thiết kế ATTT (LÕI #3)

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 5.1 Phân tích rủi ro | Threat model | `security-design.risk_analysis[].{threat, likelihood, impact, mitigation}` | `from-doc` | ❌ no schema |
| 5.2 Xác thực + phân quyền | RBAC matrix | `actor-registry.json` + `permission-matrix.json` | `from-code` | ✅ schema covers |
| 5.3 Mã hóa + bảo vệ DL | Encryption at rest/in transit | `security-design.encryption.{at_rest_method, in_transit_method, key_management}` | `from-code` (cipher suite) + `from-doc` (policy) | ❌ no schema |
| 5.4 Logging + giám sát | Audit log + monitoring | `security-design.logging.{log_categories[], retention, monitoring_tool, alerts[]}` | `from-code` (impl) + `from-doc` (policy) | ❌ no schema |
| 5.5 Ứng phó sự cố | Incident response plan | `security-design.incident_response.{rpo, rto, escalation, contacts[]}` | `from-doc` | ❌ no schema |

### §6. Thiết kế hạ tầng kỹ thuật chi tiết

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 6.1 Kiến trúc hạ tầng | Detailed deployment diagram | `infrastructure.deployment_diagram` | `from-doc+code` | ❌ no schema |
| 6.2 Cấu hình máy chủ | Server table: CPU/RAM/storage/OS/role | `infrastructure.servers[].{role, cpu, ram, storage, os, count}` | `from-doc` (manual) | ❌ no schema |
| 6.3 Thiết kế mạng chi tiết | Network spec | `infrastructure.network.{vlans[], firewall_rules[], dmz_zones[]}` | `from-doc` | ❌ no schema |
| 6.4 Môi trường triển khai | Dev/Staging/Prod | `infrastructure.environments[].{name, purpose, sizing, access_control}` | `from-doc+code` | ❌ no schema |

### §7. Thiết kế tích hợp

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 7.1 Danh mục API | API table: endpoint, method, I/O, auth | `api-spec.endpoints[].{path, method, request_schema, response_schema, auth, role[]}` | `from-code` | ⚠ `sitemap.routes[]` has path+method, missing payload schema |
| 7.2 Giao thức tích hợp | REST/SOAP/MQ | `integrations[].protocol` + per-protocol detail | `from-code` | ❌ no schema |
| 7.3 LGSP/NGSP | Government bus integration | `integrations[].{type:lgsp\|ngsp, dichvuhanhchinh_code, data_exchanged}` | `from-doc+code` | ❌ no schema |

### §8. Kế hoạch kiểm thử

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 8.1 Chiến lược kiểm thử | Test strategy | `test-strategy.{levels[], types[], tools[], coverage_target}` | `from-doc+code` | ❌ no schema |
| 8.2 Kịch bản kiểm thử | Test case table | `test-evidence/{feature-id}.json.test_cases[]` | `resume-feature` (QA) + `from-code` extracted | ✅ schema covers (CD-10 quy tắc 14-18) |
| 8.3 Tiêu chí nghiệm thu | Acceptance criteria | `feature-catalog.features[].acceptance_criteria[]` aggregated | `from-doc+code` | ✅ schema covers |

### §9. Kế hoạch đào tạo + chuyển giao

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 9.1 Đào tạo | Training plan per role | `handover-plan.training[].{audience_role, topics[], hours, method}` | `from-doc` | ❌ no schema |
| 9.2 Tài liệu chuyển giao | Doc list | `handover-plan.deliverables[].{type, format, audience}` | `from-doc` | ❌ no schema |
| 9.3 Bảo hành + bảo trì | Warranty + maintenance | `handover-plan.warranty.{period_months, sla, support_tier}` | `from-doc` | ❌ no schema |

### §10. Dự toán chi phí chi tiết

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 10.1-10.5 Dự toán FP | Function point calculation per TT 04/2020 | `cost-estimate.detailed.{function_points[], hardware[], software[], services[], training[]}` | `from-doc` (FP method) + `from-code` (FP count) | ❌ no schema |

**TKCT gap summary**: 22/29 sections need new schema fields. Of those, ~10 belong to `data-model.json`, ~6 to `infrastructure.json` + `security-design.json`, ~4 to `api-spec.json` + `integrations.json`, rest to `business-context` + `handover-plan` + `test-strategy`.

---

## 3. TKKT — Thiết kế Kiến trúc (QĐ 292/2025 — Khung KT CPĐT 4.0)

**STATUS**: ⚠ Outline NOT YET REGISTERED in MCP `outlines_list()`. Must be created based on QĐ 292/2025 + agent `tdoc-tkkt-writer.md` requirements (4 layers + 6 mandatory diagrams).

**Audience**: Lãnh đạo Bộ/Tỉnh + KTS trưởng — strategic, abstract.
**Length target**: 30-50 trang + 6 sơ đồ.
**Mandatory artifacts** (per agent spec): components≥3, data_entities≥5, nfr≥7, tech_stack≥5, 6 diagrams.

### Proposed outline (to register in MCP as `tkkt` v1)

| Section | Required content | Intel field | Producer | Status |
|---|---|---|---|---|
| 1. Giới thiệu | Purpose + scope + business context | `business-context.{purpose, scope, target_users}` + `arch-brief.md` § intro | `from-doc` | ❌ no schema |
| 2. Nguyên tắc thiết kế | Layered separation, modular, reusable | static (template) + `architecture.design_principles[]` | template | ❌ no schema |
| 3. Kiến trúc tổng thể (4 layer CPĐT 4.0) | 4 layer mapping + diagram | `architecture.cpdt_layers[].{layer:giao-dien\|nghiep-vu\|du-lieu\|ha-tang, components[], description}` + `architecture.tkkt_architecture_diagram` | `from-code+doc` | ❌ no schema |
| 4. Phân hệ logic (components) | components[]: name, purpose, layer, owned_entities | `architecture.components[].{name, cpdt_layer, purpose, owned_entities[], integrations[]}` | `from-code` (modules) + `from-doc` (purpose) | ❌ no schema |
| 5. Mô hình dữ liệu | Entity catalog (NO column-level — TKCT territory) | `data-model.entities[].{name, purpose, key_relations[]}` (aggregated, NOT chi tiết) | `from-code` | ⚠ overlaps with TKCT — need aggregation level |
| 6. API tổng hợp | Route count by module (NEVER list paths per audience-profile) | `architecture.apis_aggregate[].{module, route_count, public_count, internal_count}` | `from-code` (aggregate) | ❌ no schema |
| 7. Tích hợp ngoài | External systems + LGSP/NGSP | `integrations[]` aggregate | `from-doc+code` | ❌ no schema |
| 8. Mô hình triển khai | Deployment overview (NO Docker/K8s words per banned-jargon) | `infrastructure.deployment_overview` | `from-doc` | ❌ no schema |
| 9. NFR | ≥7 items: requirement + solution + measurable target | `nfr-catalog.items[]` | `from-doc+code` | ❌ no schema |
| 10. ATTT | ATTT cấp độ + RBAC overview + encryption + audit | `security-design.{attt_level, rbac_summary, encryption, audit}` | `from-doc+code` | ❌ no schema |
| 11. Tech stack | layer × technology × version | `system-inventory.tech_stack[]` (translated via tropes) | `from-code` | ❌ no schema |
| Diagrams (6) | architecture / logical / data / integration / deployment / security | `diagrams.tkkt_*` (Mermaid sources) | producer-emitted | ✅ render engine OK |

**TKKT gap summary**: outline itself missing from MCP registry; 11/12 sections need new schema fields (mostly aggregate views over `architecture.json` / `data-model.json` / `system-inventory.json` / `nfr-catalog.json` / `security-design.json`).

---

## 4. Consolidated Schema Gap List

Below is the **delta between what 3 outlines need and what current `~/.claude/schemas/intel/` covers**. Each new schema is justified by ≥1 outline placeholder.

### NEW schemas to create

| New schema | Purpose | Justified by |
|---|---|---|
| `business-context.schema.json` | Project metadata, legal_basis, pain_points, objectives, scope, expected_benefits, recommendations | TKCS §1, §2.4, §7, §8; TKCT §1.2-1.3; TKKT §1 |
| `system-inventory.schema.json` | Tech stack with version + license, services list, runtimes | TKCS §3.4; TKCT §2.3; TKKT §11 |
| `architecture.schema.json` | components[], cpdt_layers[], 3 mandatory models (overall/logical/physical), apis_aggregate, design_principles | TKCS §3.3; TKCT §2.1; TKKT §3-4, §6 |
| `data-model.schema.json` | entities[], tables[] with full DDL detail, ERD, data_dictionary, backup_strategy | TKCT §4 entirely; TKKT §5 (aggregated view) |
| `nfr-catalog.schema.json` | NFR items: category, requirement, target, measurement_method, current_value | TKCS §3.2, §3.5; TKKT §9-10 |
| `security-design.schema.json` | risk_analysis[], encryption, logging, incident_response, ATTT level, IPv6 | TKCS §3.5; TKCT §5; TKKT §10 |
| `infrastructure.schema.json` | deployment_model, hardware[], network, environments[], servers[] | TKCS §4 entirely; TKCT §6 |
| `integrations.schema.json` | external systems, LGSP/NGSP, protocols, data exchanged | TKCS §3.6; TKCT §7; TKKT §7 |
| `api-spec.schema.json` | endpoints[] with request/response schema, auth, role mapping | TKCT §7.1 (sitemap.routes[] insufficient — needs payload spec) |
| `cost-estimate.schema.json` | basis, summary[] (TKCS aggregate), detailed[] (TKCT FP-level), funding | TKCS §6; TKCT §10 |
| `project-plan.schema.json` | phases[], timeline[], organization | TKCS §5 |
| `handover-plan.schema.json` | training[], deliverables[], warranty | TKCT §9 |

**12 new schemas needed.** Total intel artifact count: 7 existing + 12 new = 19.

### Existing schemas — augmentations needed

| Schema | Field to add | Justified by |
|---|---|---|
| `feature-catalog.schema.json` | `features[].dialogs[]`, `features[].ui_elements[]`, `features[].error_cases[]` (already partial in some agents — formalize) | TKCT §3.1 module detail |
| `feature-catalog.schema.json` | `features[].reports[]` link to `reports.id` | TKCT §3.3 |
| `sitemap.schema.json` | `routes[].request_schema`, `routes[].response_schema` (or split to api-spec.json) | TKCT §7.1 |

---

## 5. Acceptance Criteria for `from-doc` and `from-code`

Concrete deliverables to enforce upstream so 3 writers (TKKT/TKCS/TKCT) downstream get sufficient intel.

### `from-doc` MUST emit (after Phase 8 hard-stop expansion per CD-10 quy tắc 11)

| Artifact | Min richness | Hard-stop if |
|---|---|---|
| `business-context.json` | project info + legal_basis (≥3 refs) + pain_points (≥3) + objectives (overall + ≥3 specific) + scope + expected_benefits (economic + social) | any of: project.name empty, legal_basis empty, objectives.specific < 3 |
| `feature-catalog.json` | per feature: description ≥200 chars, business_intent ≥100, flow_summary ≥150, acceptance_criteria ≥3 items × ≥30 chars (existing rule) | already enforced |
| `actor-registry.json` | roles with display + type + auth.session_strategy populated | `manual` confidence on all = block |
| `infrastructure.json` (interview-driven) | deployment_model + hardware[] (≥1 row) + network.zones[] | empty hardware → block |
| `cost-estimate.json` (TKCS aggregate) | summary[] with 6 standard line items | missing line items → block |
| `nfr-catalog.json` | ≥7 items per TKKT minimum, each with requirement + target (numeric where applicable) | < 7 items → block |
| `security-design.json` | attt_level (1-5) + ipv6_readiness + risk_analysis (≥3 threats) | attt_level empty → block |

### `from-code` MUST emit (after Phase 8 hard-stop)

| Artifact | Min richness | Hard-stop if |
|---|---|---|
| `system-inventory.json` | services[] + tech_stack[] with version (≥5 entries) | tech_stack < 5 → block |
| `feature-catalog.json` | features extracted from routes + components, status detected, role_visibility tagged | feature count = 0 → block |
| `actor-registry.json` | rbac_mode detected from auth code, roles enumerated | rbac_mode = `implicit` AND no auth code → block |
| `permission-matrix.json` | permissions[] populated from decorators/middleware | empty permissions[] when rbac_mode != implicit → block |
| `sitemap.json` | routes[] with method + path + auth.allowed_roles + playwright_hints | route count < 5 → block |
| `data-model.json` | tables[] with full DDL (columns, types, constraints, FK) + ERD diagram | table count = 0 → block |
| `api-spec.json` | endpoints[] with request/response schema (OpenAPI-style) | endpoint count = 0 → block |
| `architecture.json` | components[] grouped by cpdt_layer + apis_aggregate | components < 3 → block |
| `integrations.json` | external_integrations[] detected from HTTP clients / SDK calls | (warning if 0 — not all systems integrate) |

### Cross-validation (run `intel-validator` after both skills)

- Every `feature-catalog.features[].entities[]` member ∈ `data-model.entities[].name`
- Every `permission.role` ∈ `actor-registry.roles[].slug`
- Every `sitemap.routes[].path` corresponds to `api-spec.endpoints[].path` (or auto-create stub)
- `nfr-catalog.security.attt_level` ∈ {1, 2, 3, 4, 5}
- `architecture.components[]` count ≥ 3 (TKKT minimum)
- `architecture.cpdt_layers[]` covers all 4 layers (giao-dien / nghiep-vu / du-lieu / ha-tang)

---

## 6. Implementation Roadmap

| Step | Owner | Output | Status |
|---|---|---|---|
| 1. Register TKKT outline in MCP (`outline_load(tkkt)`) | etc-platform team | TKKT outline v1 (nd292-2025) | TODO |
| 2. Author 12 new schemas (this doc § 4) | schemas team | 12 × `*.schema.json` draft-07 | TODO |
| 3. Update `from-code` Phase 8 hard-stops per § 5 | from-code skill | Updated SKILL.md + phase guards | TODO |
| 4. Update `from-doc` Phase 8 hard-stops per § 5 | from-doc skill | Updated SKILL.md + phase guards | TODO |
| 5. Update `intel-validator` cross-ref rules per § 5 | intel-validator agent | Updated agent .md | TODO |
| 6. Update 3 writer agents (`tdoc-tkkt/tkcs/tkct-writer`) to cite new fields | agents | Updated cross-reference contracts | TODO |
| 7. End-to-end test on 1 sample project | QA | Run from-doc + from-code → 3 docs render OK | TODO |

**Suggested order**: Step 1 (TKKT outline) is independent and unblocks downstream. Steps 2-3-4 can run in parallel. Step 5-6 depend on 2. Step 7 depends on all.

---

## 7. Versioning + Decay

- Schema version pin: `schema_version: "1.0"` for all new schemas (per `README.md` § Versioning)
- NĐ change → bump outline version (e.g. `nd45-2026` → `nd45-2028` if revised)
- This matrix MUST be updated when any outline changes
- Each new schema MUST cite which outline section justifies it (in `description` field)

---

## 8. Pipeline Match Analysis — 3-Stage Flow

The schemas above must serve **three distinct skills** without bloat or gap. Verified by reading `~/.cursor/skills/resume-feature/SKILL.md` + `~/.cursor/agents/{ref-canonical-intel,sa,dev,qa}.md`.

### 8.1 The 3-stage flow

```
Stage 1: GENESIS (Claude)
  ┌─────────────────────────┐         ┌─────────────────────────┐
  │  /from-doc              │         │  /from-code             │
  │  (PDF/DOCX/screenshots) │         │  (codebase scan)        │
  └────────────┬────────────┘         └────────────┬────────────┘
               │                                    │
               ▼                                    ▼
            ┌──────────────────────────────────────────────┐
            │  docs/intel/*.json (canonical contract)      │
            └──────────────────────┬───────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼

Stage 2: BUILD (Cursor)                                Stage 3: DOCUMENT (Claude)
  ┌─────────────────────────┐                          ┌─────────────────────────┐
  │  /resume-feature        │                          │  /generate-docs         │
  │  - dispatcher loop      │                          │  - 6-stage pipeline     │
  │  - sa/dev/qa/reviewer   │                          │  - 3 writers parallel   │
  │  - close-feature        │                          │  - MCP render           │
  └────────────┬────────────┘                          └────────────┬────────────┘
               │                                                     │
   updates intel:                                          consumes intel +
   - feature-catalog.implementation_evidence               renders TKKT/TKCS/TKCT
   - test-evidence/{id}.json                               + HDSD + xlsx
   - intel-drift flag → /intel-refresh
```

### 8.2 Schema tier classification (consumer-driven)

To balance richness vs bloat, schemas split into **3 tiers** based on who consumes them:

#### Tier 1 — MANDATORY cross-stage (all 3 skills depend on)

| Schema | Stage 1 emits | Stage 2 reads | Stage 2 updates | Stage 3 reads |
|---|---|---|---|---|
| `actor-registry.json` ✅ | from-doc + from-code | all SDLC agents (base+pro) | (drift flag only) | all writers |
| `permission-matrix.json` ✅ | from-doc + from-code | dev, qa, reviewer, security | (drift flag only) | TKCT §5.2 |
| `sitemap.json` ✅ | from-doc + from-code | dev, qa, fe-dev | (drift flag only) | HDSD, TKCT §3.2/§7.1 |
| `feature-catalog.json` ✅ | from-doc + from-code | all SDLC agents | close-feature updates `implementation_evidence{}`, `status=implemented` | all writers |
| `test-accounts.json` ✅ | from-doc (interview) | qa, qa-pro | (rarely) | HDSD prerequisites |
| `code-facts.json` ⚠ no schema yet | from-code | sa, sa-pro, dev-pro, reviewer-pro | (drift flag only) | TKCT diagrams; arch facts |
| `system-inventory.json` ❌ NEW | from-code | sa-pro, dev-pro, devops, sre | (rare; drift if stack change) | TKCS §3.4, TKCT §2.3, TKKT §11 |

**Tier 1 acceptance criteria** (block all 3 skills if missing):
- `from-code` MUST emit Tier 1 → block downstream consumers if any missing
- `resume-feature` STOPs with `intel-missing: {file}` if any Tier 1 missing/stale
- `generate-docs` Stage 1-2 reuse-mode skips if Tier 1 fresh (per CD-10 quy tắc 9)

#### Tier 2 — OPTIONAL cross-stage (pro-tier SDLC + generate-docs)

Pro-tier SDLC reads to inform decisions; generate-docs reads to fill outlines. Base-tier SDLC (`dev`, `qa`, `reviewer`, `ba`, `sa`) skips.

| Schema | Stage 1 emits | Stage 2 reads (pro tier) | Stage 2 updates | Stage 3 reads |
|---|---|---|---|---|
| `data-model.schema.json` ❌ NEW | from-code (DDL/migrations) | sa-pro, data-governance, dev (when migration) | dev sets drift flag on migration; close-feature → /intel-refresh | TKCT §4 entirely; TKKT §5 |
| `api-spec.schema.json` ❌ NEW | from-code (route + request/response inference) | sa-pro, dev (when adding endpoint), qa (contract testing) | drift flag on new endpoint | TKCT §7.1 |
| `architecture.schema.json` ❌ NEW | from-code (modules) + from-doc (cpdt_layers narrative) | sa-pro, tech-lead | drift flag on refactor crossing service boundary | TKKT §3-4, §6; TKCS §3.3 (overall_diagram) |
| `integrations.schema.json` ❌ NEW | from-code (HTTP clients + SDK) + from-doc (LGSP/NGSP business) | sa-pro, devops, security | drift flag on new external dep | TKKT §7; TKCT §7.2-7.3; TKCS §3.6 |

**Tier 2 acceptance criteria** (warn but don't block SDLC):
- Missing Tier 2 in resume-feature → pro-tier agent emits `intel-thin: {file}` warning, fallback to code reading
- Missing Tier 2 in generate-docs → block (writer cannot fill outline placeholder)

#### Tier 3 — DOC-ONLY (Stage 3 only)

`resume-feature` skips entirely. SDLC has zero dependency. These exist purely to fill outlines for non-technical reviewers.

| Schema | Stage 1 emits | Stage 2 status | Stage 3 reads |
|---|---|---|---|
| `business-context.schema.json` ❌ NEW | from-doc (interview-driven) | SKIP — BA agent uses `feature-brief.md` prose narrative, not JSON form | TKCS §1, §2.4, §7, §8; TKCT §1.2-1.3; TKKT §1 |
| `nfr-catalog.schema.json` ❌ NEW | from-doc + from-code measurements | SKIP (sre-observability MAY peek for SLO alignment, optional) | TKCS §3.2, §3.5; TKKT §9-10 |
| `security-design.schema.json` ❌ NEW | from-doc (threat model + policy) | SKIP (security agent MAY peek for threat verification, optional) | TKCS §3.5; TKCT §5; TKKT §10 |
| `infrastructure.schema.json` ❌ NEW | from-doc (interview: hardware list, sizing) | SKIP (devops sources from terraform/k8s, not this JSON) | TKCS §4 entirely; TKCT §6 |
| `cost-estimate.schema.json` ❌ NEW | from-doc + manual | SKIP | TKCS §6; TKCT §10 |
| `project-plan.schema.json` ❌ NEW | from-doc (interview) | SKIP | TKCS §5 |
| `handover-plan.schema.json` ❌ NEW | from-doc (interview) | SKIP | TKCT §9 |

**Tier 3 acceptance criteria**:
- `from-doc` block if missing (Stage 3 needs them)
- `resume-feature` ignores entirely — these are not in `ref-canonical-intel.md` read protocol
- `generate-docs` block if missing (writer hard-stop)

### 8.3 Bidirectional drift handling

**Key insight**: Stage 2 (resume-feature) MAY mutate code that invalidates Tier 1/Tier 2 intel. Without proper drift signaling, Stage 3 will render stale docs.

| Stage 2 action | Affects | Drift signal | Resolution |
|---|---|---|---|
| Add/remove route | sitemap, api-spec, feature-catalog | `_state.md.intel-drift: true` (existing) | `/intel-refresh` regenerates Tier 1+2 from code |
| Migration (DDL change) | data-model, feature-catalog.entities[] | drift flag (NEW for Tier 2) | `/intel-refresh` regenerates data-model |
| Auth refactor | actor-registry, permission-matrix | drift flag (existing) | `/intel-refresh` regenerates auth-related Tier 1 |
| New external integration | integrations, system-inventory | drift flag (NEW) | `/intel-refresh` regenerates Tier 2 |
| Architecture refactor (split/merge service) | architecture, system-inventory | drift flag (NEW) | `/intel-refresh` regenerates Tier 2 |
| BA scope change | business-context | NO drift (Tier 3 doc-only) | Manual edit by BA before generate-docs |
| Cost re-estimate | cost-estimate | NO drift (Tier 3 doc-only) | Manual edit before generate-docs |

**Implementation requirement**: Update `~/.cursor/agents/ref-canonical-intel.md` § Drift events to enumerate Tier 2 drift triggers (currently only mentions auth/role/route).

### 8.4 Snapshot generator alignment (base-tier optimization)

Per `ref-canonical-intel.md`, base-tier SDLC reads `_snapshot.md` (compressed ~3-5K tokens) instead of full Tier 1 JSONs. Snapshot generator (`~/.cursor/skills/intel-snapshot/generate.py`) MUST:

1. Compress Tier 1 fields into snapshot (existing for 5 core; **add code-facts + system-inventory summary**)
2. SKIP Tier 2 fields (pro-tier reads canonical anyway — no snapshot ROI)
3. SKIP Tier 3 fields (SDLC doesn't read these)

This keeps base-tier read cost flat (~5K tokens) regardless of how many doc-only schemas we add.

### 8.5 No-bloat verification checklist

Before adding any field to Tier 1/Tier 2 schemas, ask:

- [ ] Is this field consumed by ≥1 SDLC agent (base or pro)?
- [ ] If only consumed by generate-docs writer → move to Tier 3 schema
- [ ] If consumed by SDLC pro-tier only → keep in Tier 2 (warn, don't block on missing)
- [ ] If consumed by SDLC base-tier → keep in Tier 1 + add to snapshot generator

Before adding any field to Tier 3 schemas, ask:

- [ ] Is this field cited in ≥1 outline placeholder (`{{content:X.Y}}`)?
- [ ] If not → reject (dead field, no consumer)

### 8.6 Updated implementation roadmap (supersedes § 6)

| Step | Owner | Output | Tier | Status |
|---|---|---|---|---|
| 1. Register TKKT outline in MCP | etc-platform team | TKKT outline v1 (qd292-2025) | — | ⏳ DRAFT-READY (`outline-drafts/tkkt-qd292-2025.md`) — handoff to etc-platform team to bake into image |
| 2a. Author Tier 1 NEW schemas (`code-facts`, `system-inventory`) | schemas team | 2 × `*.schema.json` | T1 | ✅ DONE |
| 2b. Author Tier 2 schemas (`data-model`, `api-spec`, `architecture`, `integrations`) | schemas team | 4 × `*.schema.json` | T2 | ✅ DONE |
| 2c. Author Tier 3 schemas (`business-context`, `nfr-catalog`, `security-design`, `infrastructure`, `cost-estimate`, `project-plan`, `handover-plan`) | schemas team | 7 × `*.schema.json` | T3 | ✅ DONE |
| 3a. Update `from-code` to emit Tier 1+2 with hard-stops | from-code skill | Updated `phases/06-handoff.md` Step 8.1 + 8.1.5 | T1+T2 | ✅ DONE |
| 3b. Update `from-doc` to emit Tier 1+T3 + partial Tier 2 (business-driven fields) with hard-stops | from-doc skill | Updated `SKILL.md` — Step 5h Intel quality gate | T1+T2+T3 | ✅ DONE |
| 4. Update `~/.cursor/agents/ref-canonical-intel.md` Tier 2 drift triggers | resume-feature | Updated drift event list (7 trigger types), legacy mapping | T2 | ✅ DONE |
| 5. Update `intel-snapshot/generate.py` to include code-facts + system-inventory | snapshot generator | Updated `generate.py` + `SKILL.md` (T1 only, T2/T3 excluded) | T1 | ✅ DONE |
| 6. Update Cursor pro-tier agents to reference Tier 2 schemas | base agents (sa, dev, qa, ba, reviewer) + security/devops/data-governance/sre-observability/tech-lead; pro-variants regenerated via `cache-lint/make-pro-agents.py` | Updated read protocols | T2 | ✅ DONE |
| 7. Update 3 writer agents to cite Tier 2+3 fields | `tdoc-tkkt/tkcs/tkct-writer.md` | Tier-classified Inputs table + extended BLOCKING rules | T2+T3 | ✅ DONE |
| 8. Update `intel-validator` for Tier-aware cross-ref | `intel-validator.md` | 27 rules (T1/T2/T3 severity), tier-aware exit codes | All | ✅ DONE |
| 9. Update `/intel-refresh` to regenerate Tier 1+2 (skip Tier 3) | `intel-refresh` skill | NEW skill at `~/.claude/skills/intel-refresh/SKILL.md` | T1+T2 | ✅ DONE |
| 10. End-to-end test on 1 sample project (full 3-stage flow) | QA | from-doc + from-code → resume-feature (1 feature) → close-feature → generate-docs | All | ⏳ PENDING (see § 8.8 below for plan) |

**Status as of {2026-04-28}**: 9/10 steps DONE. Step 1 awaits etc-platform team to register `tkkt` outline (draft ready). Step 10 awaits sample project nomination + QA run.

### 8.7 Files changed in this implementation pass

For verification, here is the complete diff scope:

**New files (16):**
- `~/.claude/schemas/intel/OUTLINE_COVERAGE.md` (this document)
- `~/.claude/schemas/intel/outline-drafts/tkkt-qd292-2025.md` (TKKT outline draft)
- `~/.claude/schemas/intel/code-facts.schema.json` (T1 — canonicalized from skill-local)
- `~/.claude/schemas/intel/system-inventory.schema.json` (T1)
- `~/.claude/schemas/intel/data-model.schema.json` (T2)
- `~/.claude/schemas/intel/api-spec.schema.json` (T2)
- `~/.claude/schemas/intel/architecture.schema.json` (T2)
- `~/.claude/schemas/intel/integrations.schema.json` (T2)
- `~/.claude/schemas/intel/business-context.schema.json` (T3)
- `~/.claude/schemas/intel/nfr-catalog.schema.json` (T3)
- `~/.claude/schemas/intel/security-design.schema.json` (T3)
- `~/.claude/schemas/intel/infrastructure.schema.json` (T3)
- `~/.claude/schemas/intel/cost-estimate.schema.json` (T3)
- `~/.claude/schemas/intel/project-plan.schema.json` (T3)
- `~/.claude/schemas/intel/handover-plan.schema.json` (T3)
- `~/.claude/skills/intel-refresh/SKILL.md` (Tier-aware refresh skill)

**Modified files (16):**
- `~/.claude/schemas/intel/README.md` (Tier classification, TTL defaults, 27 cross-ref rules)
- `~/.claude/skills/from-code/phases/06-handoff.md` (T1+T2 emission gate)
- `~/.claude/skills/from-doc/SKILL.md` (Step 5h Intel quality gate)
- `~/.claude/agents/intel-validator.md` (Tier-aware 27 rules + exit codes)
- `~/.claude/agents/tdoc-tkkt-writer.md` (Tier-classified Inputs)
- `~/.claude/agents/tdoc-tkcs-writer.md` (Tier-classified Inputs + extended blocking)
- `~/.claude/agents/tdoc-tkct-writer.md` (Tier-classified Inputs + extended blocking)
- `~/.cursor/agents/ref-canonical-intel.md` (Tier-aware read protocol + drift triggers)
- `~/.cursor/agents/sa.md`, `dev.md`, `qa.md`, `ba.md`, `reviewer.md` (CANONICAL INTEL with T1/T2/T3 references)
- `~/.cursor/agents/security.md` (T1+T2+T3 peek)
- `~/.cursor/agents/tech-lead.md`, `devops.md`, `data-governance.md`, `sre-observability.md` (NEW CANONICAL INTEL block)
- `~/.cursor/skills/intel-snapshot/generate.py` (T1 includes code-facts + system-inventory)
- `~/.cursor/skills/intel-snapshot/SKILL.md` (Tier scope clarification)

**Auto-regenerated files (5):**
- `~/.cursor/agents/{sa,dev,qa,ba,reviewer}-pro.md` (regenerated via `cache-lint/make-pro-agents.py`)

### 8.8 E2E test plan (Step 10)

**Goal**: Verify full 3-stage flow end-to-end on 1 sample project to catch contract drift between schemas, skills, and agents before promoting to other projects.

**Sample project criteria**:
- Small to medium scale: 5-15 features, 1-2 services, 3-5 roles
- Has both source documents (PDF/DOCX of business reqs) AND existing code (any stack)
- VN gov IT context (LGSP/NGSP integration ideal)
- Suggested candidates: nominate from active ETC projects

**Test sequence**:

| Step | Action | Verify |
|---|---|---|
| 1 | Run `/from-doc` with sample PDF/DOCX | T1 + business-context.json emitted; Step 5h passes |
| 2 | Run `/from-code` against codebase | T1 (code-facts, system-inventory updated) + T2 (data-model, api-spec, architecture, integrations) emitted; Phase 06 Step 8.1.5 passes |
| 3 | Run `intel-merger` to reconcile | No unresolvable conflicts; check `merged_from` in `_meta.json` |
| 4 | Run `intel-validator` | All 27 cross-ref rules pass (or expected warnings only) |
| 5 | Run `~/.cursor/skills/intel-snapshot/generate.py` | `_snapshot.md` includes 6 T1 sections; T2/T3 excluded |
| 6 | Switch to Cursor; run `/resume-feature {first-feature-id}` | base-tier reads `_snapshot.md` (verify load < 5K tokens); pro-tier reads canonical T1+T2 |
| 7 | Cursor SDLC completes 1 feature (mock dev/qa/reviewer) | `test-evidence/{id}.json` created; `intel-drift` flag set if migration/route added |
| 8 | If `intel-drift: true` → run `/intel-refresh` | T1+T2 regenerated; `intel-drift` cleared; T3 untouched |
| 9 | Run `/close-feature` | `feature-catalog.implementation_evidence` updated |
| 10 | Switch to Claude; run `/generate-docs all` | TKKT/TKCS/TKCT/HDSD/xlsx all render; no `[CẦN BỔ SUNG]` from intel thinness; cross-ref between docs intact (TKKT components ↔ TKCT modules ↔ TKCS architecture summary) |

**Pass criteria**:
- Each producer Phase 8 / Step 5h passes hard-stops
- 27 cross-ref rules green (or expected warnings only)
- Documents render without contract drift errors
- No silent skips (every step has visible state in `_pipeline-state.json` or `_state.md`)
- Tier 3 schemas NOT touched by SDLC (verify `_meta.artifacts[business-context].produced_at` unchanged from /from-doc baseline through SDLC pipeline end)

**Failure modes to catch**:
- Schema field cited by writer agent but absent in producer output
- Producer emits field but no consumer reads it (dead field)
- Cross-ref FK between artifacts broken
- Tier 1 snapshot misses a field needed by base-tier agent
- Tier 2 schema field consumed by 2 consumers with conflicting expectations
- Tier 3 schema accidentally included in snapshot (bloat)

### 8.9 Next maintenance cadence

- **Quarterly**: Re-validate every schema description still cites the outline section it serves (drift detection)
- **On NĐ change**: Bump outline version (e.g. NĐ 45/2028 supersedes NĐ 45/2026), update relevant schemas + matrix § 1-3
- **On new tier 2 schema demand**: User adds new SDLC concern (e.g. observability config) → propose schema, run no-bloat checklist § 8.5, get sign-off, then add

### 8.7 Match summary — answers user's "match - khớp - useful" requirement

| Concern | Resolution |
|---|---|
| **Khớp**: from-doc/from-code emit đủ cho resume-feature | Tier 1+2 schemas designed with SDLC agent consumption in mind (verified against `ref-canonical-intel.md`) |
| **Khớp**: resume-feature emit đủ cho generate-docs | `feature-catalog.implementation_evidence{}` + `test-evidence/{id}.json` + `intel-drift` flag → `/intel-refresh` ensures Tier 1+2 freshness before Stage 3 |
| **Useful**: SDLC base-tier không bị bloat | Tier 3 schemas excluded from base-tier reads (snapshot omits them); pro-tier reads canonical when needed |
| **Useful**: generate-docs có đủ data fill outline | Tier 3 schemas designed by reverse-engineering outline placeholders (§ 1-3 of this matrix); from-doc hard-stop ensures freshness |
| **Không thiếu**: outline placeholder nào cũng có producer | § 1-3 matrices prove every `{{content:X.Y}}` traces to ≥1 intel field with named producer |
| **Hạn chế thừa**: schema field có nơi consume | § 8.5 no-bloat verification checklist enforced at schema design time |

---

## See Also

- `~/.claude/CLAUDE.md` — Rules CD-10 (Intel Layer Contract), G1 (Outline immutability)
- `~/.claude/schemas/intel/README.md` — Producer/Consumer Matrix, Conflict Resolution
- `~/.claude/agents/tdoc-{tkkt,tkcs,tkct}-writer.md` — Writer-side cross-reference contracts
- `mcp__etc-platform__outline_load(doc_type)` — IMMUTABLE outlines source of truth
