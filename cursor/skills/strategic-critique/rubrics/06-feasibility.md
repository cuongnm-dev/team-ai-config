# Rubric 06 — Feasibility Check

**Goal**: Timeline + budget + capacity có realistic không?

---

## Timeline feasibility

### Rule of thumb (từ TT 04/2020 + industry practice)

| Scope | Duration realistic |
|---|---|
| Module đơn giản (CRUD 5-10 tables) | 3-4 tháng (research → dev → UAT) |
| Hệ thống nghiệp vụ 1 domain (HR, Finance) | 9-12 tháng |
| Hệ thống multi-domain (ERP, DVC Portal) | 18-24 tháng |
| Tích hợp CSDLQG + LGSP | +3-6 tháng mỗi tích hợp |
| Triển khai ra 1000+ users | +3 tháng (change management + training) |

**Auto-flag major** nếu Đề án propose:
- HRIS 1000 cán bộ trong 3 tháng
- ERP đa module trong 6 tháng
- 10 modules trong 12 tháng (>1 module/tháng không realistic)

### Dependency risks

**Auto-flag** nếu timeline phụ thuộc:
- Công bố API của NDXP sắp ra (uncertain)
- Phê duyệt cấp trên (uncertain timeline)
- Nhà thầu chưa chốt (no commitment)

---

## Budget feasibility

### TT 04/2020 formula check

Budget phần mềm = **man-months × unit cost × complexity coefficient**

**Unit cost** (2026 reference):
- Senior dev: 30-50 triệu/tháng
- Mid dev: 20-30 triệu/tháng
- Analyst: 25-35 triệu/tháng
- PM: 35-50 triệu/tháng

**Complexity coefficient**:
- Simple CRUD: 1.0
- Business logic: 1.5-2.0
- Integration heavy: 2.0-3.0
- AI/ML: 2.5-4.0

**Auto-flag**:
- Budget < industry baseline 50% → **major** (under-estimated, risk cắt corners)
- Budget > industry baseline 200% → **major** (over-estimated, khó defend)

### Hardware/infra budget

- Datacenter on-prem: 5-10 tỷ cho 1 rack
- Gov Cloud equivalent: 300-800 triệu/năm (OPEX)

**Auto-flag**: Đề án propose on-prem DC mà workload < 20 VMs → over-provisioning, nên Gov Cloud.

### Reference benchmark

| Project scope | Budget range (2026) |
|---|---|
| DVC Portal 1 tỉnh | 3-8 tỷ |
| ERP cấp Sở (500 users) | 5-15 tỷ |
| HRIS cấp Bộ (10K users) | 15-40 tỷ |
| CSDLQG cấp ngành | 50-200 tỷ |
| Smart City cấp tỉnh | 100-500 tỷ |

**Auto-flag major** nếu budget lệch 50%+ so với range.

---

## Capacity feasibility

### Team size check

Đề án mention số lượng cán bộ CNTT của đơn vị. Check:
- Scope vs team: 3 cán bộ IT triển khai 10 modules → unrealistic (cần outsource)
- Outsource mention? Procurement plan có không?

**Auto-flag**: Scope lớn + team nhỏ + không mention outsource → hidden risk.

### Skill gap

- Project dùng tech mới (AI, blockchain, IoT) → đơn vị có skill không?
- Training plan có không?
- Knowledge transfer từ vendor có plan không?

---

## Risk register check

Đề án tốt phải có **Risk register** (minimum):
- Technical risk (tech choice, integration)
- Timeline risk (dependency, scope creep)
- Budget risk (exchange rate, inflation, scope change)
- Organizational risk (leadership change, resistance)
- Legal/compliance risk (new regulation during implementation)

**Auto-flag major** nếu thiếu risk section hoặc < 5 risks identified.

---

## Finding format

```yaml
- id: F-NNN
  severity: major
  check: feasibility
  category: "timeline" | "budget" | "capacity" | "risk"
  section: "7.1"
  claim: "Triển khai HRIS cho 1000 cán bộ trong 3 tháng (Q1/2026)"
  benchmark: "Industry practice: 9-12 tháng cho scope tương tự"
  gap-analysis: |
    Proposed timeline 3 tháng vs realistic 9-12 tháng = shortfall 3-4x.
    Không có pilot phase, không có change management, không có training buffer.
  risks-if-unadjusted:
    - Quality issues (rushed testing)
    - User adoption low (thiếu training)
    - Scope cut để meet deadline
  fix-recommendation: |
    Mở rộng timeline:
    - M1-M3: Setup + data migration + pilot 50 users
    - M4-M7: Rollout 50% đơn vị + training
    - M8-M10: Full rollout + change management
    - M11-M12: Post-launch support + iteration
    Tổng 12 tháng, match industry benchmark.
```
