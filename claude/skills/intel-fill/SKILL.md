---
name: intel-fill
description: Interactive interview wizard để fill 35% human-knowledge fields (T3 doc-only schemas). DAG-based question ordering (Docassemble pattern P1) — đọc intel state, identify missing required fields, hỏi theo dependency order, skip fields đã có. Phase 1 simple DAG (no auto-derive yet). Per WORKFLOW_DESIGN.md § 0 D2.
---

# Intel Fill — Interactive Interview Wizard

Build content cho T3 doc-only schemas (business-context, nfr-catalog, security-design, infrastructure, cost-estimate, project-plan, handover-plan) qua interactive interview với user.

**DAG-based ordering (D2 P1)**: thay vì hỏi linear theo schema field order, build dependency graph + ask topological order + skip fields đã filled.

---

## When to invoke

Sau khi `from-code` + `from-doc` đã chạy → Tier 1+2 có sẵn nhưng Tier 3 (35% human knowledge) còn thiếu. User chạy `/intel-fill` để complete T3.

```
$ /intel-fill                     # Auto-detect missing T3, interview all
$ /intel-fill --section X         # Focus 1 schema (e.g. cost-estimate)
$ /intel-fill --resume            # Continue mid-interview state
```

---

## Phase 1 (P1) Scope — what this version does

Per D2 phased adoption:

| Capability | P1 (this version) | P2 future | P3 future |
|---|---|---|---|
| Read intel state, find missing required fields | ✅ | ✅ | ✅ |
| Topological order based on field dependencies | ✅ | ✅ | ✅ |
| Skip fields đã filled (lifecycle != not-set) | ✅ | ✅ | ✅ |
| Conditional skip ("if deployment=cloud, skip hardware") | ❌ | ✅ | ✅ |
| Auto-derive (Đ9 amount → group → authority) | ❌ | ❌ | ✅ |
| Resume mid-interview | ✅ (state file) | ✅ | ✅ |

P1 covers ~50% benefit của full DAG với 1.5x effort của linear interview. Sau khi P1 stable + có user data, sẽ extend P2/P3.

---

## Workflow

### Step 1 — Bootstrap

```
1. Read docs/intel/_meta.json → identify project context
2. Run: python ~/.claude/scripts/intel/validate.py docs/intel/ --quick
3. Identify missing T3 artifacts (e.g. business-context.json absent)
4. Identify thin T3 artifacts (exist but fail validation)
5. Build interview manifest: which schemas to fill, which fields per schema
```

### Step 2 — Build DAG (P1 simple)

For each missing/thin field, declare:
- `required: true|false`
- `depends_on: [field_path, ...]` (other fields that must be answered first)

P1 dependency rules từ schema constraints:

| Field | Depends on | Rationale |
|---|---|---|
| `business-context.project.investment_group` | `project.investment_amount_vnd` | Group A/B/C derived from amount per Đ9 (P3 will auto-derive; P1 just enforces order) |
| `business-context.project.approving_authority` | `project.investment_group` | Authority depends on group |
| `business-context.objectives.specific[]` | `business-context.objectives.overall` | Specific objectives elaborate from overall |
| `infrastructure.hardware[]` | `infrastructure.deployment_model.type` | Only ask if on-premise (P2 will skip; P1 asks anyway with hint) |
| `cost-estimate.summary[]` | `business-context.project.investment_amount_vnd` | Sum should match approved amount |
| `cost-estimate.detailed.function_points[]` | `feature-catalog.features[]` | FP per feature |
| `project-plan.phases[]` | `business-context.objectives.specific[]` | Phases align to specific objectives |

Build topological sort. If cycle detected → STOP with error.

### Step 3 — Interactive interview

For each field in topological order:

```
[State indicator]
Current section: business-context (3/7 schemas to fill)
Progress: 12 fields complete / 28 total

[Field prompt]
Field: business-context.legal_basis[]
Type: array of {ref_code, title, issue_date, applicability}
Constraint: min 3 items (TKCS-stricter: ≥7 recommended)
Dependencies: none

[KB suggestion if available]
KB query "VN gov IT legal basis" returned candidates:
  1. Quyết định số 749/QĐ-TTg về CĐS quốc gia
  2. Chỉ thị số 34/CT-TTg về CĐS
  3. Nghị định số 45/2026/NĐ-CP về quản lý đầu tư UDCNTT
  ... (more)

[User options]
  [a] Use KB suggestions (select which apply)
  [b] Enter custom legal refs
  [c] Skip (mark as needs-attention — must be filled before generate-docs)
  [d] Save state + exit (resume later)
```

After each input:
- Validate value against schema constraint
- If fail → show error, ask retry
- If pass → write to intel artifact + update _meta.json + provenance
- Move to next field

### Step 4 — Save state + exit

State file at `docs/intel/_intel-fill-state.json`:

```json
{
  "session_id": "...",
  "started_at": "...",
  "current_section": "business-context",
  "completed_fields": [...],
  "remaining_fields": [...],
  "skipped_fields": [...]
}
```

User runs `/intel-fill --resume` → continue from `current_section`.

### Step 5 — Final validation

After all required fields filled:

```
Run: python ~/.claude/scripts/intel/validate.py docs/intel/ --strict
Expected: T3 schema errors = 0
If still T3 errors → display + offer fix
```

### Step 6 — Provenance update

For each filled field:

```json
{
  "field_path": "business-context.legal_basis[2]",
  "lifecycle": "human_authored",
  "confidence": "manual",
  "source": "interview:intel-fill@2026-04-29T10:00",
  "touched_by": "user",
  "session_id": "..."
}
```

Write to `docs/intel/_provenance.json` (D8 — provenance tracking, deferred to next iteration).

---

## Schema-to-question mapping

For each T3 schema, map fields to interview questions:

### business-context.json
- `project.name`: "Tên đầy đủ của dự án?"
- `project.owner.organization`: "Cơ quan chủ đầu tư (đơn vị quản lý dự án)?"
- `project.investment_amount_vnd`: "Tổng mức đầu tư (đơn vị VND, ví dụ 500000000000)?"
- `project.investment_group`: "Nhóm dự án A/B/C (P1: hỏi user; P3 sẽ tự suy ra)?"
- `legal_basis[]`: KB-driven multi-select
- `objectives.overall`: "Mục tiêu tổng quát (1 đoạn)?"
- `objectives.specific[]`: "Mục tiêu cụ thể (≥3 items với measurable target)?"
- `pain_points[]`: "Vấn đề hiện trạng (≥3 items với severity)?"
- `scope.in_scope[]`: "Phạm vi: hạng mục thuộc dự án?"
- `expected_benefits.economic[]`: "Hiệu quả kinh tế (estimate value/year)?"
- `expected_benefits.social[]`: "Hiệu quả xã hội (beneficiary group)?"

### nfr-catalog.json
- `items[]` (≥7): per item ask category, requirement, target, measurement_method, priority

### security-design.json
- `attt_level`: 1-5 picker với NĐ 85/2016 hint
- `attt_level_rationale`: "Tại sao chọn cấp độ này?"
- `ipv6_readiness`: enum picker
- `risk_analysis[]` (≥3): per threat ask category, likelihood, impact, mitigation
- `authentication.primary_scheme`: enum picker
- `encryption.at_rest.method`: free-text
- `encryption.in_transit.method`: free-text
- `logging_and_audit.retention_days`: number
- `incident_response.{rpo,rto}_minutes`: number

### infrastructure.json
- `deployment_model.type`: enum picker (P2 will conditional skip hardware if cloud)
- `hardware[]`: per-row ask item_type, name, spec, quantity, unit_price_vnd
- `network.zones[]`: per-zone ask name, cidr, purpose
- `environments[]`: dev/staging/uat/prod

### cost-estimate.json
- `basis.method`: enum picker
- `summary[]` (6 items I-VI): per row ask item_name, amount_vnd
- `detailed.function_points[]`: per feature ask fp_count + complexity_factor
- `funding.primary_source`: enum picker

### project-plan.json
- `phases[]`: per phase ask name, duration_months, deliverables
- `organization.owner`: org + responsibilities
- `organization.contractor`: TBD allowed at TKCS stage
- `risks[]`: per risk ask category, likelihood, impact, mitigation

### handover-plan.json
- `training[]`: per audience-role ask topics, hours, method
- `deliverables[]`: per type ask format, audience
- `warranty.period_months`: number
- `warranty.sla.support_hours`: enum picker

---

## Anti-skip protocol (mandatory per CLAUDE.md ST + AGI patterns)

For each interview step:

1. **Entry print**: "▶ Đang hỏi field {N/total}: {field_path}"
2. **State detection**: read current intel state, verify field thực sự thiếu (idempotent check)
3. **Question dispatch**: render prompt với context (constraints, KB suggestion if applicable)
4. **Wait response**: AskUserQuestion (max 4 options) hoặc free-text input
5. **Validate**: check against schema constraint
6. **Update intel + state**: write field + provenance
7. **Exit print**: "✅ Field {field_path} filled. Next: {N+1}/total"

Never skip silently. If user picks "skip" → mark `lifecycle: needs-attention` explicitly.

---

## Failure modes

| Failure | Action |
|---|---|
| Schema validation fail on user input | Show error inline, retry up to 3 times, then offer skip |
| Cycle detected in DAG | STOP, surface dependency loop |
| User force-quit mid-interview | State saved automatically; `/intel-fill --resume` continues |
| Field schema có changed since session start | Detect via schema sha256 mismatch in _meta; warn user |
| KB query fail (MCP down) | Fallback: free-text only, skip suggestion |

---

## Output

After session complete:
- T3 artifacts populated với content
- `_provenance.json` updated với field lifecycle
- `_meta.json` updated với produced_at + producer="intel-fill" + ttl per schema
- Summary report:
  ```
  ✅ Intel-fill session complete
  Filled: business-context (28/28), nfr-catalog (7/7), security-design (12/12)
  Skipped: cost-estimate (deferred — needs procurement quote)
  
  Next: /intel-validator để verify T3 cross-references
  Then: /generate-docs all
  ```

---

## Future P2/P3 (out-of-scope cho version này)

P2 (conditional skip):
- "if deployment=cloud, skip hardware questions"
- "if attt_level <= 2, skip advanced encryption questions"
- Implementation: add `condition` field per schema field declaration

P3 (auto-derive):
- "investment_amount + Đ9 → investment_group automatic"
- "FP count + complexity_factor + cost_per_fp → calculated_amount_vnd automatic"
- Implementation: deterministic computation rules per field

→ Version P1 này tập trung core: just-in-time questions với DAG ordering. Build thêm khi P1 stable + có user pain data.
