# ref-thinking-templates.md — Thinking Bundle Templates

Templates cho các artifact trong `thinking-bundle/` directory.
strategy-orchestrator dùng templates này khi khởi tạo thinking artifacts.

---

## Template 1: `_strategy_state.md`

```markdown
---
project_name: "{Tên dự án}"
org_name: "{Tên đơn vị}"
doc_type: "de-an-cds"
pipeline: "strategic-thinking"
created: "{YYYY-MM-DD}"

# State Machine
current_spiral: "SPIRAL_1_SCOPE"
checkpoint_1: "pending"       # pending | approved | revision_requested
checkpoint_2: "pending"
checkpoint_3: "pending"
thinking_bundle: "draft"      # draft | frozen
outline_status: "mutable"    # mutable | locked

# Spiral Progress
spirals:
  scope:
    status: "not_started"     # not_started | in_progress | complete
    org_profile: false
    policy_landscape: false
  strategy:
    status: "not_started"
    gap_analysis: false
    strategic_framework: false
  solutions:
    status: "not_started"
    initiative_portfolio: false
    dedup_complete: false
    feasibility_check: false
  structure:
    status: "not_started"
    outline_proposed: false
    section_briefs: false
    dependencies_mapped: false

# Write Layer Progress
write_layer:
  dcb_generated: false
  waves_total: 0
  waves_complete: 0
  review_status: "pending"    # pending | in_progress | passed | needs_revision
  export_status: "pending"

# KPI
kpi:
  tokens_total: 0
  tokens_by_spiral:
    scope: 0
    strategy: 0
    solutions: 0
    structure: 0
    write: 0
  kb_entries_added: 0
  dedup_proposals_total: 0
  dedup_proposals_modified: 0
  interview_questions_asked: 0
---

# Strategy State: {Tên dự án}

## Current Status
{Auto-updated by orchestrator}

## Checkpoint History
| Checkpoint | Date | Verdict | Notes |
|---|---|---|---|
| | | | |

## Spiral Back Log
| From | To | Reason | Date |
|---|---|---|---|
| | | | |
```

---

## Template 2: `01-org-profile.md`

```markdown
---
type: org-profile
spiral: 1
status: draft
last_updated: "{YYYY-MM-DD}"
---

# Hồ sơ tổ chức: {Tên đơn vị}

## 1. Thông tin chung

| Field | Value |
|---|---|
| Tên đơn vị | |
| Cấp | Viện / Cục / Vụ / Sở / Bộ |
| Cơ quan chủ quản | |
| Lĩnh vực | |
| Đối tượng phục vụ | |
| Quy mô nhân sự | |
| Đơn vị trực thuộc | |
| Địa bàn | |

## 2. Hiện trạng CĐS

### 2.1. Tự đánh giá mức độ CĐS: _/5

### 2.2. Hệ thống CNTT đang vận hành
| STT | Hệ thống | Chức năng | Năm triển khai | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| | | | | | |

### 2.3. Hạ tầng
- TTDL: {mô tả}
- Mạng: {LAN/WAN}
- Cloud: {có/không, provider}

### 2.4. Nhân lực CNTT
- Số lượng chuyên trách: 
- Trình độ: 
- Đào tạo gần nhất:

### 2.5. An toàn thông tin
- Hệ thống ATTT: 
- Chứng nhận: 
- Sự cố:

## 3. Vấn đề chính (top 3)
1. 
2. 
3. 

## 4. Lịch sử CĐS
| Năm | Đề án/Kế hoạch | Kết quả | Bài học |
|---|---|---|---|
| | | | |

## 5. Tầm nhìn & Kỳ vọng
- Kỳ vọng lãnh đạo:
- Thời gian:
- Ngân sách khung:
- Ưu tiên cao nhất:

## 6. Ràng buộc
- Cấp phê duyệt:
- KPI từ cấp trên:
- Mẫu tham khảo:
- Yêu cầu đặc biệt:

## 7. Ghi chú phân tích
{strategy-analyst observations — không hiển thị trong document cuối}
```

---

## Template 3: `04-gap-analysis.md`

```markdown
---
type: gap-analysis
spiral: 2
status: draft
last_updated: "{YYYY-MM-DD}"
---

# Gap Analysis: {Tên đơn vị}

## Phương pháp
So sánh 3 chiều: Hiện trạng (Org Profile) ↔ Mục tiêu QĐ 749/CT 34 ↔ Kỳ vọng lãnh đạo

## Ma trận Gap

| Lĩnh vực | Hiện trạng | Mục tiêu QĐ 749 | Kỳ vọng LĐ | Gap | Mức độ |
|---|---|---|---|---|---|
| DVCTT mức 4 | _% | 100% | | | Critical/Major/Minor |
| Văn bản điện tử | _% | 90% | | | |
| CSDL kết nối LGSP | _% | 50% (2025) | | | |
| Hạ tầng | | | | | |
| Nhân lực CNTT | | | | | |
| ATTT | | | | | |
| ... | | | | | |

## SWOT

### Strengths (Điểm mạnh)
- 

### Weaknesses (Điểm yếu)
- 

### Opportunities (Cơ hội)
- 

### Threats (Thách thức)
- 

## Priority Gaps (input cho Strategic Framework)
1. **{Gap 1}** — Mức độ: Critical. Trụ cột liên quan: {X}
2. **{Gap 2}** — Mức độ: Major. Trụ cột liên quan: {Y}
3. ...
```

---

## Template 4: `05-strategic-framework.md`

```markdown
---
type: strategic-framework
spiral: 2
status: draft
last_updated: "{YYYY-MM-DD}"
checkpoint: 1
---

# Strategic Framework: Đề án CĐS {Tên đơn vị}

## Tầm nhìn
{1-2 câu tuyên bố tầm nhìn CĐS}

## Thời hạn
{N năm, chia M giai đoạn}

## Trụ cột chuyển đổi

### Trụ cột 1: {Tên}
- **Mục tiêu:** 
- **Gap hiện tại:** {from gap-analysis}
- **Hướng giải pháp (sơ bộ):**
- **KPI dự kiến:**
- **Align QĐ 749:** {section/KPI}

### Trụ cột 2: {Tên}
...

### Trụ cột N: {Tên}
...

## Ma trận ưu tiên (draft)

| Hướng giải pháp | Impact | Effort | Priority | Giai đoạn |
|---|---|---|---|---|
| | H/M/L | H/M/L | Quick-win/Short/Long | |

## Risk Map

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| | H/M/L | H/M/L | |

## Ngân sách khung (sơ bộ)
- Tổng: {range}
- Per trụ cột: {rough split}
- Nguồn: NSNN / ODA / PPP / Khác
```

---

## Template 5: `06-initiative-portfolio.md`

```markdown
---
type: initiative-portfolio
spiral: 3
status: draft
last_updated: "{YYYY-MM-DD}"
checkpoint: 2
dedup_status: "pending"    # pending | complete
---

# Initiative Portfolio: Đề án CĐS {Tên đơn vị}

## Tổng quan
- Số lượng dự án/nhiệm vụ: {N}
- Tổng kinh phí dự kiến: {X tỷ VNĐ}
- Thời gian: {Y năm, Z giai đoạn}
- Dedup: {M} modified, {V} rejected

## Danh mục theo trụ cột

### Trụ cột 1: {Tên}

#### DA-{NN}: {Tên dự án}
| Field | Value |
|---|---|
| Mô tả | |
| Mục tiêu | |
| Phạm vi | |
| Dedup verdict | UNIQUE / ADOPT / EXTEND / INTEG |
| Dedup note | {lý do, platform liên quan} |
| Ưu tiên | Quick-win / Short-term / Long-term |
| Giai đoạn | 1 / 2 / N |
| Kinh phí sơ bộ | {X tỷ} |
| Đơn vị chủ trì | |
| Kết quả dự kiến | |
| KPI | |

### Trụ cột 2: {Tên}
...

## Tổng hợp kinh phí

| Trụ cột | Số DA | Kinh phí | % tổng |
|---|---|---|---|
| | | | |
| **Tổng** | | | 100% |

## Tổng hợp theo giai đoạn

| Giai đoạn | Số DA | Kinh phí | DA ưu tiên |
|---|---|---|---|
| GĐ 1 (20XX-20XX) | | | |
| GĐ 2 (20XX-20XX) | | | |

## Tận dụng nền tảng sẵn có

| Nền tảng | Số DA tích hợp | DA liên quan |
|---|---|---|
| NDXP | | |
| LGSP | | |
| VNeID | | |
| CSDLQG | | |
```

---

## Template 6: Section Brief (per section)

```markdown
---
type: section-brief
section_id: "{X.Y}"
section_title: "{Tên section}"
spiral: 4
status: draft
---

# Section Brief: {X.Y} {Tên section}

## Key Arguments
1. {Argument 1}
2. {Argument 2}
3. ...

## Evidence

| Evidence | Source | Type |
|---|---|---|
| {Data point} | {Org Profile / Policy / KB / Interview} | Quantitative / Qualitative |
| | | |

## Dedup Context (nếu section liên quan giải pháp)

| Proposal | Verdict | Platform | Note |
|---|---|---|---|
| | | | |

## Tone
{urgency / opportunity / analytical / persuasive}

## Related Initiatives
{DA-XX, DA-YY}

## Policy References
- {QĐ/CT/NĐ — điều khoản cụ thể}

## Target Length
{N trang}

## Writing Notes
{Hướng dẫn cụ thể cho doc-writer:
  - Bắt đầu bằng...
  - Nhấn mạnh...
  - Kết thúc bằng...
  - Bảng/hình cần có: ...}
```

---

## Template 7: DCB (Document Context Brief — cho WRITE layer)

Generated từ Thinking Bundle, condensed ≤ 3000 tokens.

```markdown
---
type: dcb
generated_from: thinking-bundle
frozen: true
---

# Document Context Brief: Đề án CĐS {Tên đơn vị}

## Metadata
| Field | Value |
|---|---|
| Đơn vị | {tên} |
| Cấp | {viện/cục/sở/bộ} |
| Chủ quản | {bộ/ngành} |
| Ngân sách | {range} |
| Thời hạn | {N năm} |
| Cấp phê duyệt | {ai ký} |
| Outline version | {locked outline hash} |

## Strategic Summary (200 words max)
{Condensed từ strategic-framework}

## Pillars
1. {Tên trụ cột 1}: {1 câu mục tiêu}
2. {Tên trụ cột 2}: {1 câu mục tiêu}
...

## Key Dedup Decisions
- ADOPT: {platforms being adopted}
- EXTEND: {platforms being extended}
- INTEG: {systems being integrated}

## Writing Conventions
- Văn phong: Hành chính, trang trọng
- Viện dẫn: "Nghị định số XX/YYYY/NĐ-CP ngày dd tháng mm năm yyyy"
- Số: XXX.XXX.XXX đồng
- Ngày: dd/mm/yyyy
- Placeholder: [CẦN BỔ SUNG: mô tả]

## Cross-reference Map
{Section → Section dependencies}

## Terminology
{Key terms + definitions from glossary}
```
