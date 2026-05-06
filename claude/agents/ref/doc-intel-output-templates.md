# doc-intel — Output Templates (Phase 6 reference)

Load-on-demand notepad. `doc-intel.md` Phase 6 references this file via Read pointer.

Extracted from `~/.claude/agents/doc-intel.md` lines 1102-1561 (audit-2026-05-06 T2-9: split >25K body into ref notepads).

---

## 6.1 Write `intel/doc-brief.md`

Single source of truth for entire downstream pipeline.

**Artifact Format Standard** (per AGENTS.md + `.cursor/agents/ba.md`):
- English structural (IDs, field keys, section headers, verdicts)
- Tables / YAML preferred over prose
- Source quotes preserve original language (VN) ONLY in `source: "..."` fields
- Prose allowed ONLY in §13 narrative insights (trade-offs, rationale)
- Metrics upfront in frontmatter

```markdown
---
# Metadata (machine-parseable — all keys English)
feature-id: {id}
document: doc-brief
source-files: [paths]
source-type: {document-type from Phase 2}
generated: {ISO date}
ba-confidence: High | Medium | Low
metrics:
  modules: {N}
  features: {N}
  rules: {N}
  entities: {N}
  screens: {N}
  integrations: {N}
  ambiguities-blocking: {N}
  ambiguities-nonblocking: {N}
  pii-fields-count: {N}
  actors-count: {N}
---

# {System Name} — Intelligence Brief

## 1. Executive Summary (structured)

| Field | Value |
|---|---|
| What the system does | {1 line} |
| Domain | logistics \| finance \| healthcare \| gov \| e-commerce \| other |
| Business problem solved | {1 line — problem existed before this system} |
| Estimated scale | {users, transactions/day — from document hints, else "unknown"} |
| Target stakeholders | {list} |

## 2. Document Analysis

| Item | Finding |
|---|---|
| Document type | {URD\|SRS\|Functional Spec\|User Manual\|Wireframes\|Business Process\|Copyright\|Mixed} |
| Completeness | actors:{explicit\|implied\|absent}, rules:{...}, flows:{...}, data:{...}, NFR:{...}, integration:{...} |
| Analysis strategy | {1 line approach} |
| OCR images processed | {N} of {N total} |
| Confidence | High \| Medium \| Low — {1 line reason} |

## 3. Actors (canonicalized, scoped to this system)

| Role | Slug | Type | Responsibilities | Entry URL | Menu groups visible | Dashboard widgets | Permissions hint | Source |
|---|---|---|---|---|---|---|---|---|
| {canonical name (aliases: ...)} | {slug-lowercase} | human\|system\|implicit | {brief} | {/admin or /staff or "shared /dashboard"} | {comma list of top-level menu groups} | {comma list of widget names} | {scope/level} | explicit §{ref} OR implied: {reason} |

**Field rules**:
- `Slug`: lowercase kebab-case ASCII — must be stable identifier, used for sitemap.json keys
- `Entry URL`, `Menu groups visible`, `Dashboard widgets`: extract từ wireframe có role indicator. Nếu không xác định được → ghi `[CẦN BỔ SUNG: workspace per role]`, KHÔNG bịa
- Nếu hệ thống đa role (≥ 2 actors human có quyền khác nhau) → BẮT BUỘC sinh thêm `sitemap.json` (xem §7.5)

## 4. Module & Feature Inventory

### Module: {Name} [id: M{N}]
| Property | Value |
|---|---|
| Purpose | {1 sentence} |
| Scope | {1-2 sentences — what module covers} |
| Out of scope | {explicit exclusions or "none"} |
| Dependencies | {other module-ids or "none"} |

**Features in this module:**

#### {F-ID}: {feature-name}
| Property | Value |
|---|---|
| Type | CRUD\|Report\|Config\|Workflow\|Integration\|Monitor |
| Priority | P0\|P1\|P2\|P3 |
| Actors | {from §3} |
| Entities | {from §6} |
| Key fields | {inferred typed list, see §6} |
| Applied rules | {BR-IDs from §5} |
| Screens | {screen indices from §7} |
| Workflow | {state transitions} OR "simple CRUD" |
| Validations | required:{list}, unique:{list}, cross-field:{list} |
| Reports/Exports | {formats} OR "none" |
| In scope | {1-2 sentences} |
| Out of scope | {explicit exclusions} |
| Source | explicit: "{VN verbatim ≥15 chars}" OR implied: §{ref} + {reasoning} |

(Repeat per feature. Aim for ≥4 features per module.)

## 5. Business Rules

| ID | Rule | Type | Applies-to-features | Severity | Scope | Source |
|---|---|---|---|---|---|---|
| BR-INTEL-{NNN} | {brief statement} | Validation\|Authorization\|Computation\|State-transition\|Notification | [F-IDs] | High\|Med\|Low | single-feature\|cross-cutting | explicit: "..." OR implied: §{ref} |

Target: rules ≥ features × 2.

## 6. Entity Model

```yaml
entities:
  - name: {EntityName}
    key-fields: [id, field1, field2, ...]
    field-types:
      id: BIGINT PK AUTO
      field1: VARCHAR(N) UNIQUE
      field2: DECIMAL(18,2)
    pii-fields: [CCCD, email, phone]   # [] if none
    source: explicit §{ref} OR implied: {reason}

relationships:
  - from: EntityA
    to: EntityB
    cardinality: "1:1 | 1:N | N:1 | N:N | 1:N (tree) | self"
    fk: {field}
    source: {ref}

state-machines:
  - entity: {EntityName}
    states: [State1, State2, State3]
    transitions:
      - {from}→{to}: {trigger} [guard: {condition}]
```

## 7. UI Screen Inventory

| # | Path | Title | Type | Module | Feature | Visible to roles | Parent menu group | Navigation path | Key fields | Actions | OCR confidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | docs/intel/screens/img-01.png | {title} | list\|detail\|form-create\|form-edit\|dashboard\|wizard\|modal\|auth\|report-view\|menu-overview | {M-id} | {F-id} | {role-slug list — empty if shared} | {top-level menu group from §7.5} | {breadcrumb labels: "Quản trị > Người dùng > Danh sách"} | {list} | {list} | High\|Med\|Low |

**Field rules**:
- `Visible to roles`: empty list → screen accessible to all roles; populated → restricted
- `Parent menu group`: must match a `menu_tree[].label` in §7.5 sitemap (consistency check)
- `Navigation path`: comma-separated menu labels from menu root → this screen — used by capture phase to click-navigate

## 7.5. Sitemap & Workspace per Role (REQUIRED if multi-role)

**Trigger**: ≥ 2 human actors with different permissions in §3 → write this section AND emit `sitemap.json` artifact.
**Skip**: single-role or all actors share identical menu → mark "Single workspace, see §7" and skip §7.5.

### 7.5.1 — Role workspace summary

| Role slug | Display | Login URL | Post-login URL | Layout | Dashboard summary |
|---|---|---|---|---|---|
| admin | Quản trị hệ thống | /login | /admin/dashboard | sidebar | {1-line description of dashboard from OCR} |
| staff | Cán bộ nhân viên | /login | /dashboard | sidebar | {1-line description} |

### 7.5.2 — Menu tree per role

Per role, list menu structure as nested bullet (1-2 levels max):

```
### Role: admin (Quản trị hệ thống)

- Quản trị
  - Người dùng → /admin/users (F-007)
  - Phân quyền → /admin/roles (F-008)
    - Danh sách vai trò → /admin/roles
    - Ma trận quyền → /admin/roles/matrix (F-009)
- Báo cáo
  - Báo cáo tổng hợp → /admin/reports (F-021)
- Cài đặt hệ thống
  - Cấu hình chung → /admin/settings (F-030)

### Role: staff (Cán bộ nhân viên)

- Tác nghiệp
  - Tạo đề xuất → /requests/new (F-005)
  - Đề xuất của tôi → /requests/mine (F-006)
- Thông báo → /notifications (F-014)
```

### 7.5.3 — Dashboard widgets per role

| Role | Widget name | Type | Description |
|---|---|---|---|
| admin | Thống kê người dùng | stats | Tổng số người dùng, người dùng online, người dùng mới trong tuần |
| admin | Nhật ký hoạt động | activity-feed | 20 hoạt động gần nhất của hệ thống |
| staff | Công việc của tôi | list | Danh sách đề xuất đang xử lý |
| staff | Thông báo | list | 5 thông báo chưa đọc |

**Confidence**: high (explicit sitemap doc) | medium (inferred from wireframes) | low (best-guess from actor permissions)
**Source**: explicit §{ref} OR implied: {OCR img-NN shows menu sidebar for admin role}

## 7.6. Workflow Variants per Role (REQUIRED if features have role-specific actions)

**Trigger**: Detected when same entity has different actionable states per role (e.g., Đề xuất: Staff tạo → Manager duyệt → Admin đóng).
**Skip**: Simple CRUD without state machine differences → omit section.

### Per-feature workflow table

#### F-021: Đề xuất công việc

| Role | States visible | States actionable | Available actions (from→to) |
|---|---|---|---|
| staff | draft, submitted | draft | Tạo (→draft), Sửa nháp (draft→draft), Nộp (draft→submitted), Hủy nháp (draft→null) |
| manager | submitted, approved, rejected, revising | submitted | Duyệt (submitted→approved), Từ chối (submitted→rejected), Yêu cầu chỉnh sửa (submitted→revising) |
| admin | all | all | Tất cả + Đóng (approved→closed), Khôi phục (closed→approved), Xóa vĩnh viễn (*→null) |

**State controlled vocab** (consistent across features):
- `draft` (Nháp), `submitted` (Đã nộp), `approved` (Đã duyệt), `rejected` (Từ chối), `revising` (Yêu cầu chỉnh sửa), `closed` (Đã đóng), `archived` (Lưu trữ)
- Custom states allowed but must be defined in §6 Entity Model state-machines

**Source**: explicit workflow diagram in §{ref} OR inferred from §3 actor permissions × §6 entity state-machine

---

### 7.7. Sitemap Artifact (sitemap.json)

After writing §7.5 + §7.6, emit `{docs-path}/intel/sitemap.json` following canonical schema:
**Reference**: `~/.claude/skills/generate-docs/notepads/sitemap-schema.md`

Producer must:
1. Set `source: "doc-intel"`, `confidence` based on quality of source (sitemap doc → high; wireframes → medium; permissions table only → low)
2. Validate `roles[].slug` matches §3 Actors slug column
3. Validate `feature_overrides[].feature_id` references existing F-IDs in §4
4. Emit warnings to `warnings[]` array when data is incomplete (missing dashboard for a role, etc.)

**Skip writing sitemap.json** when:
- Single-role system (only 1 human actor in §3)
- All roles share identical menu (mark explicitly in §7.5)
- Confidence too low to be useful (no menu/sitemap visible in any source) → emit empty file with `confidence: "low"` + warnings list

## 8. Integration & Technical Flags

| From (module/actor) | To | Direction | Protocol | Data exchanged | Confidence | Flag-for-sa |
|---|---|---|---|---|---|---|
| {source} | {target} | in\|out\|bidir | REST\|SOAP\|MQTT\|WebSocket\|file\|SMTP\|other | {brief} | High\|Med\|Low | iot\|auth\|payment\|async\|none |

## 9. NFR Signals

| Area | Requirement | Target | Source |
|---|---|---|---|
| Performance | {latency, throughput} | {specific number OR "unknown"} | explicit\|implied |
| Security | {auth, PII, compliance} | {RBAC\|ABAC\|...} | |
| Reliability | {uptime, data durability} | {SLA target} | |
| Audit/Logging | {what to log} | {retention} | |
| Operability | {monitoring, deployment} | {criteria} | |

## 10. Validation Findings (4-lens self-check)

| Lens | Issues found | Impact | Sections updated |
|---|---|---|---|
| Domain Analyst | {count or "none"} | {severity} | §4, §6 |
| Designer | {count or "N/A — no UI"} | | §7 |
| SA | {count or "N/A — no integrations"} | | §8 |
| Security | {count or "N/A — no PII"} | | §9 |

## 11. Ambiguities

| ID | Severity | Description | Question | Options | Impact-if-wrong | Needs |
|---|---|---|---|---|---|---|
| GAP-{NNN} | Blocking\|Non-blocking\|Unresolvable | {1 line} | {question} | A\|B\|C | {impact} | PO\|author\|domain-expert\|artifact |

## 12. Recommended Pipeline Configuration

```yaml
recommended-path: S | M | L
rationale: "{1-line why}"
risk-score: {1-5}
conditional-stages:
  designer: {true|false — reason}
  sa: {true|false}
  security-design: {true|false}
  security-review: {true|false}
  devops: {true|false}
  data-governance: {true|false}
output-mode: lean | full
```

## 13. SDLC Agent Insights (Opus-powered analysis)

Smart hints per agent. Opus leverages extended thinking + domain knowledge to pre-compute insights that lighter SDLC agents would miss.

### 13.1 For Analyst
- **Implicit user stories** (stories source doesn't explicitly write but domain implies):
  - "As Cấp II admin, I want to delegate budget approval to deputy when absent, so that pipeline doesn't block" (inferred from hierarchical org + continuous operation)
- **Compliance mappings** (when applicable):
  - PII handling → NĐ 13/2023/NĐ-CP applies (encryption CCCD required)
  - Government accounting → Thông tư 77/2017/TT-BTC (chart of accounts)
- **Risk-sensitive features** (Opus flags for extra AC rigor):
  - F-XXX (payment, approval) needs audit trail ACs explicit

### 13.2 For SA
- **Recommended architectural patterns** (with justification):
  - Event Sourcing for approval workflows (audit trail requirement + state machine complexity)
  - CQRS if report queries are heavy (inferred from 20+ report screens)
  - Outbox pattern for Lương→TCKT integration (consistency requirement)
- **Anti-pattern warnings**:
  - Risk: N+1 on user list with permission join → suggest eager load
  - Risk: Distributed transaction Lương↔TCKT → avoid 2PC, use saga
- **Similar system references**:
  - "Pattern similar to SAP FI general ledger — consider referencing SAP's data model for accounting flows"
- **Scalability predictions**:
  - Bottleneck: period-end consolidation (all units push at same time) → async queue needed
  - Hot table: `but_toan` (high write volume) → consider partitioning by nam_ngan_sach

### 13.3 For Tech-lead
- **Complexity hints per feature** (beyond priority):
  - F-XXX: complexity=HIGH (reason: multi-level approval + audit + rollback)
  - F-YYY: complexity=LOW (reason: simple CRUD, no workflow)
- **Risk per feature** (Opus-assessed):
  - F-XXX: risk=HIGH — unknown payroll formulas (blocking-gap GAP-002)
- **Parallelization hints**:
  - F-AAA and F-BBB independent — parallel wave safe
  - F-CCC depends on F-AAA entity → sequential
- **Tasks likely missed** (from experience):
  - Always: migration data script for period open/close
  - Always: seed script for catalogs
  - Always: permission matrix seed

### 13.4 For Dev
- **Code patterns to use** (stack-specific):
  - NestJS: use CASL for RBAC (matches BR-INTEL-005 hierarchical scope)
  - TypeORM: tree entity for DonVi (materialized path or closure table)
- **Library recommendations** (Context7-validated):
  - `@nestjs/cqrs` for event sourcing in approvals
  - `xlsx` for Excel export (all report features)
  - `decimal.js` for money calculations (avoid float precision bugs)
- **Common pitfalls for this feature type**:
  - Money fields: never use FLOAT, use DECIMAL
  - Vietnamese text: ensure DB charset utf8mb4 / UTF8
  - Date ranges: beware of timezone (gov = ICT UTC+7)

### 13.5 For QA
- **Test strategy ratios** (recommended):
  - Path M: unit 60% / integration 30% / e2e 10%
  - Approval workflows: extra e2e coverage for state transitions
- **Test data**: see `test-data-hints.md` (generated in Phase 3.9c)
- **Critical edge cases** (Opus-enumerated):
  - Concurrent approvals (2 users approve same thing)
  - Period boundary (entry at 23:59 of close day)
  - Permission change mid-transaction
  - Unicode in search (`'; OR 1=1` + tonal marks)
- **Performance test hints**:
  - SLA suggestion: list 1000 users < 500ms, approval flow < 2s
  - Stress: 100 concurrent users on period-end consolidation

### 13.6 For Reviewer — Definition of Done (per feature)

Generated DoD checklist template (reviewer customizes per feature):

```
□ All ACs from BA spec implemented and tested
□ All business rules in `applied-rules` list have unit tests
□ Entity matches SA ER design (cardinality respected)
□ Validations match doc-brief field constraints
□ Priority respected in delivery order
□ Out-of-scope items NOT implemented (check against explicit list)
□ PII fields (CCCD, email) encrypted/masked per NĐ 13/2023
□ Audit trail for state-transition features
□ API responses < SLA suggested in 13.5
□ Error messages in Vietnamese, no English leaks
□ Migration script tested up + down
□ Permission check at controller + service layer (defense in depth)
□ No secrets in code/config
□ README/CHANGELOG updated
```

### 13.7 For Security (if in stages-queue)
- **Threat model** (Opus-inferred attack surface):
  - Privilege escalation: user modifies own ma_don_vi to elevate scope → validate server-side
  - Mass assignment: don't accept `trang_thai` from client
  - IDOR: ensure permission filter on EVERY list endpoint
- **PII exposure risks**:
  - CCCD in logs (mask in application logs)
  - CCCD in URLs (never in query string)
  - Export file contains CCCD (require permission + audit log)

### 13.8 Confidence notes on insights

These insights are Opus INFERENCES, not explicit requirements. Agents should:
- Treat as starting points, verify against source before adopting
- Flag `[OPUS-HINT]` when using, so reviewer knows provenance
- Reject if conflicts with explicit BA spec
```

---

## 6.2 Populate `_state.md`

```yaml
feature-id: {id}
feature-req: "file:{docs-path}/intel/doc-brief.md"
source-type: {document-type}
output-mode: {pass-through from input, default lean}
current-stage: ba
status: in-progress

agent-flags:
  ba:
    source-type: {type}
    blocking-gaps: {count}
    gaps-file: "{docs-path}/intel/doc-brief.md#11-ambiguities"
    total-modules: {count}
    total-features: {count}

  designer:                          # only if designer in stages-queue
    screen-count: {count}
    screen-inventory-file: "{docs-path}/intel/doc-brief.md#7-ui-screen-inventory"
    has-existing-design-tokens: false

  sa:                                # only if sa in stages-queue
    integration-flags: [list]
    integration-file: "{docs-path}/intel/doc-brief.md#8-integration--technical-flags"
    iot-involved: {true/false}

  security:                          # only if security in stages-queue
    pii-found: {true/false}
    auth-model: {rbac/abac/unknown}
    new-trust-boundary: {true/false}

completed-stages:
  doc-intel:
    verdict: "Ready for BA"
    completed-at: "{YYYY-MM-DD}"
kpi:
  tokens-total: 0
  cycle-time-start: {YYYY-MM-DD}
```

**stages-queue logic:**
```
Base (always): [ba, tech-lead, dev-wave-1, qa-wave-1, reviewer]

ADD sa IF: integration flags > 0 OR IoT/hardware involved OR new service boundary likely
  → insert after ba

ADD designer IF: screen count > 0
  → insert after ba (BEFORE sa per audit-2026-05-06 T1-10 sequential placement)

ADD fe-dev-wave-1 IF: designer added
  → parallel with dev-wave-1

ADD devops IF: IoT service likely OR external integrations add new env vars
  → insert after dev, before qa

ADD security IF: PII found OR auth model changes OR new trust boundary
  → alongside reviewer

ADD data-governance IF: PII found AND cross-system data sharing
  → alongside ba
```

---

## 6.3 Write `intel/tech-brief.md`

Output from Phase 3.9. Read by `/new-workspace` and `/new-project` to auto-configure workspace.

## 6.4 Write `intel/consultation-log.md`

Output from Phase 4 for traceability.
