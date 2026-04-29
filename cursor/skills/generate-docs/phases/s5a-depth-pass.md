# Stage 5a — Depth Pass (Audit + Escalate, NOT Pad)

**Stage**: 5 QUALITY, sub-step 5a
**Trigger**: After Stage 4 specialists merged. Before Stage 5b quality gate.
**Purpose**: Audit each section for **substantive depth**. When data is sparse → emit `[CẦN BỔ SUNG]` for user, NEVER pad with filler.

---

## ★ Core principle — Anti-padding rule

> Word count is a **proxy** for depth, NOT depth itself. Padding satisfies validators but produces vapid prose that hurts reviewer experience.

**FORBIDDEN** (this is what reviewers spot immediately):

```
❌ "Hệ thống được thiết kế đáp ứng các yêu cầu, đảm bảo tính linh hoạt
    và khả năng mở rộng, phù hợp với xu hướng công nghệ hiện đại..."
```

**REQUIRED** path khi section ngắn:

```
1. Re-scan intel artifacts (actor-registry, feature-catalog, sitemap, code-facts)
   → có thêm data thực không? Yes → expand với specifics + citations
2. Re-scan source docs (doc-brief.md, raw-extract.md)
   → có nội dung từ BA chưa extract? Yes → extract + cite
3. Section vẫn sparse sau (1)+(2) → emit [CẦN BỔ SUNG: <gap cụ thể>]
   → log to intel/expansion-gaps.md
   → reviewer/BA điền sau

NEVER:
   ❌ Pad với formulaic prose để hit word target
   ❌ Lặp ý đã viết với synonyms
   ❌ Thêm câu chuyển tiếp dài để câu giờ
```

---

## Audit metrics (replace word floors)

Mỗi section được audit qua 3 metric, KHÔNG dùng word count làm gate:

### M1 — Specificity density

```python
per_500_words:
  numbers     >= 5    # versions, counts, sizes, percentages, dates
  named_entities >= 3 # specific tech, NĐ refs, system names, role names
  citations   >= 1    # source: "intel/<file>#<section>" or "doc-brief.md#§N"
```

Section có word count đủ NHƯNG specificity thấp → **flagged as padding suspect** → re-dispatch specialist với hint "remove filler, add specifics".

### M2 — Banned filler patterns (zero tolerance)

Detected via regex:

```yaml
banned_patterns:
  - "đảm bảo tính linh hoạt"
  - "phù hợp xu hướng (công nghệ|hiện đại)"
  - "đáp ứng nhu cầu thực tiễn"
  - "linh động và (mở rộng|hiệu quả)"
  - "tối ưu hóa hiệu suất"  # without metrics
  - "công nghệ tiên tiến"
  - "giải pháp toàn diện"
  - "hiệu quả cao và bền vững"
  - "đảm bảo (tính sẵn sàng|độ tin cậy) cao"  # without uptime number
  # Cấu trúc lặp: "X đảm bảo Y, đáp ứng Z, phù hợp W"
  - "đảm bảo .{1,40}, đáp ứng .{1,40}, phù hợp"
```

Detect → reject → re-write without filler. KHÔNG tự pad replacement.

### M3 — Structural completeness (object counts, NOT prose length)

| Block | Required structures |
|---|---|
| `overview` | ≥ 10 terms in glossary, ≥ 5 references |
| `tkcs.legal_basis` | ≥ 7 legal refs với `(số NĐ, năm, điều)` đầy đủ |
| `tkcs.current_state` | ≥ 10 numeric data points (server count, user count, EOL year, ...) |
| `tkcs.security_plan` | ≥ 5 ATTT groups + cấp độ N citation (TCVN 11930) |
| `architecture.business_overview` | 5 CPĐT 4.0 layers all named |
| `architecture.nfr` | ≥ 5 NFRs with measurable targets (number + unit) |
| `architecture.design_principles` | ≥ 3 ADR citations |
| Per feature (HDSD) | ≥ 5 ui_elements, ≥ 3 steps, ≥ 2 error_cases, ≥ 1 dialog (if delete/confirm) |
| `tkct.modules[].business_rules` | ≥ 3 BR-NNN với điều kiện cụ thể |

Structural floor là **countable objects** — khó fake hơn prose length.

---

## Protocol

### Step 1 — Scan: identify suspect sections

```bash
python "$SKILL_DIR/../engine/tools/quality_score.py" \
  --content-data "{DOCS_PATH}/output/content-data.json" \
  --intel-dir    "{DOCS_PATH}/intel" \
  --output       "{DOCS_PATH}/intel/pre-depth-audit.json" \
  --check        specificity,filler,structural
```

Output classifies sections as:
- `OK` — passes M1 + M2 + M3
- `SHORT_BUT_HONEST` — sparse but no filler, no structure violation → check intel for more data
- `PADDING_SUSPECT` — has word count but low specificity OR banned patterns → re-write
- `STRUCTURAL_GAP` — missing required objects (e.g., 5 ATTT groups) → fill from intel or escalate

### Step 2 — Per suspect section: expand from intel, NOT generate

```python
for section in suspect_sections:
    # 2a. Re-scan ALL relevant intel artifacts
    intel_data = load([
        "intel/actor-registry.json",
        "intel/feature-catalog.json",
        "intel/data-model.json",
        "intel/sitemap.json",
        "intel/code-facts.json",
        "intel/doc-brief.md",  # if Path A
    ])
    
    # 2b. Extract candidate data with citations
    candidates = extract_relevant_for(section, intel_data)
    
    # 2c. If candidates non-empty: re-write section using ONLY candidate data + citations
    if candidates:
        new_content = rewrite_with_specifics(section, candidates)
        # New content MUST include citations: source: "intel/feature-catalog.json#F-007"
    
    # 2d. If candidates empty: emit placeholder, escalate to user
    else:
        new_content = f"[CẦN BỔ SUNG: {specific_gap_description}]"
        log_expansion_gap(section, gap_description)
```

### Step 3 — TC expansion (data-driven, không phải word count)

Same formula as before — TCs scaled by structural complexity (validations × 3, dialogs × 2, etc.) — NOT by word count target. Already correct in s4f-write-xlsx.

### Step 4 — Re-merge + validate

```python
mcp__etc-platform__merge_content(data_path, partial=expanded_block)
v = mcp__etc-platform__validate(data_path)

# Loop until: errors=[] AND no PADDING_SUSPECT flags AND structural gaps resolved
# Max 2 iterations per section. After 2: escalate to user.
```

---

## Escalation: `intel/expansion-gaps.md`

When section truly cannot be expanded (intel lacks data + no docs source):

```markdown
# Expansion Gaps — Stage 5a

## tkcs.pm_method
- audit_result: SHORT_BUT_HONEST
- intel_checked: [feature-catalog, doc-brief.md §12, code-facts]
- gap: "BA spec không mô tả phương pháp QLDA cụ thể"
- placeholder: "[CẦN BỔ SUNG: phương pháp quản lý dự án (PMI/Agile/Hybrid), vai trò PM, cơ chế báo cáo]"
- ba_action: "Fill section in content-data.json before final export"
- whitelist_for_stage5b: true

## architecture.deployment_description
- audit_result: STRUCTURAL_GAP
- intel_checked: [code-facts.docker_services, system-inventory]
- gap: "Production environment specs (CPU/RAM/disk) chưa có trong code-facts"
- placeholder: "[CẦN BỔ SUNG: cấu hình môi trường Production: CPU cores, RAM, disk, network bandwidth]"
- ba_action: "Provide deployment topology diagram + server specs"
- whitelist_for_stage5b: true
```

Stage 5b reads này → skip word-count penalty cho sections có entry hợp lệ. Reviewer thấy `[CẦN BỔ SUNG]` rõ ràng — biết chỗ nào cần fill, không bị misled bởi filler.

---

## Anti-patterns (what depth pass MUST NOT do)

| ❌ Sai | ✅ Đúng |
|---|---|
| Add formulaic transition sentences để hit word floor | Re-extract from intel; if dry → `[CẦN BỔ SUNG]` |
| Lặp lại nội dung với synonyms để dài thêm | Cut redundancy; reduce to dense info |
| "Hệ thống đảm bảo... đáp ứng... phù hợp..." | Specific numbers + system names + citations |
| Skip `[CẦN BỔ SUNG]` vì sợ nhìn xấu | `[CẦN BỔ SUNG]` is honest signal — keep it |
| Loop indefinitely until word count hit | Max 2 iter, then escalate |
| Trust LLM to "fill in" missing data | Only expand from existing intel sources |

---

## Integration

```
Stage 4 specialists merge → content-data.json initial
   ↓
Stage 5a (THIS) — audit specificity + filler + structure
   For each suspect section:
     - intel rich  → expand with citations
     - intel dry   → emit [CẦN BỔ SUNG] + log gap
   Loop until: no PADDING_SUSPECT, no STRUCTURAL_GAP, gaps logged
   ↓
Stage 5b — Quality gate (validate + filler regex check + 6 passes)
   ↓
Stage 6 — Delivery
```

---

## Completion report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DEPTH AUDIT COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Sections scanned:        47
  OK (no action):          31
  Expanded from intel:     12 (with citations)
  Filler removed:           2 (re-written from real data)
  Escalated to BA/PM:       2 — [tkcs.pm_method, architecture.deployment_description]

  Specificity gains:
    Numbers per 500w avg:    3.2 → 6.8
    Named entities avg:      2.1 → 4.5
    Banned phrases removed: 14

  Honest placeholders:       2 entries in intel/expansion-gaps.md

  Next: Stage 5b Quality Gate
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
