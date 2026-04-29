# Rubric 04 — Alignment Check (National strategy)

**Goal**: Đề án align với chiến lược quốc gia — không self-serving, không orphan.

---

## Khung đối chiếu

### 1. QĐ 749/QĐ-TTg — Chương trình CĐS quốc gia

**3 trụ cột** cần align:
- **Chính phủ số** — dịch vụ công, điều hành số, CSDLQG
- **Kinh tế số** — doanh nghiệp số, thương mại điện tử, fintech
- **Xã hội số** — công dân số, giáo dục số, y tế số

**KPI targets đến 2025**:
- 80% DVC mức 4
- 90% hồ sơ công việc cấp Bộ, 80% cấp Tỉnh, 60% cấp Huyện xử lý trên môi trường mạng
- 100% cán bộ, công chức có danh tính điện tử
- ...

**Check**: Đề án có cite KPI mình đang contribute không? Contribution realistic không?

**Auto-flag major**: Claim "contribute 20% to KPI X" without showing how → unverified claim.

### 2. CT 34/CT-TTg — 9 nguyên tắc

| NT | Nội dung | Check Đề án |
|---|---|---|
| 1 | Người dân làm trung tâm | User research, citizen journey có không? |
| 2 | Dữ liệu phục vụ người dân | Data sharing policy có không? |
| 3 | Nền tảng số quốc gia là trụ cột | Có tích hợp NDXP/CSDLQG không? |
| 4 | ATTT xuyên suốt | Có security design theo TCVN 11930 không? |
| 5 | Nguồn lực + sáng tạo | Có plan nâng cao năng lực cán bộ? |
| 6 | **DEDUP — dùng nền tảng chung** | → Rubric 05 |
| 7 | Thí điểm → nhân rộng | Roadmap có pilot phase không? |
| 8 | Hợp tác công-tư | PPP có explore không? |
| 9 | Quản trị dựa trên dữ liệu | Data governance, KPI monitoring? |

**Auto-flag**: Đề án không mention nguyên tắc nào → lack of alignment.

### 3. QĐ 292/QĐ-BKHCN (2025) — Khung KT CPĐT 4.0

Nếu dự án cấp **Bộ/Tỉnh**, phải đối chiếu 4 view:
- Business Architecture
- Data Architecture  
- Application Architecture
- Technology Architecture

**Auto-flag major**: Cấp Bộ không reference Khung 4.0 → serious gap.

### 4. QĐ 06/QĐ-TTg (Đề án 06)

Nếu dự án liên quan **dân cư / tài khoản định danh / DVC**:
- Phải tích hợp CSDLQG Dân cư (C06)
- Phải dùng VNeID
- Phải expose ra Cổng DVC quốc gia

**Auto-flag blocker**: Dự án DVC không integrate với Đề án 06.

### 5. QĐ 942/QĐ-TTg — Chiến lược Chính phủ số

Roadmap đến 2030: "Việt Nam thuộc nhóm 50 nước dẫn đầu UN E-Gov Index".

**Auto-flag**: Đề án timeline 2026-2030 không reference QĐ 942 → miss alignment.

---

## Alignment matrix (agent generate)

Output table:
```yaml
alignment-matrix:
  "QĐ 749":
    cited-in-sections: [1.2, 4.1]
    kpi-contribution-claimed: true
    kpi-contribution-verifiable: false  # no data support
    severity: major
  "CT 34":
    principles-addressed: [1, 3, 4]
    principles-missed: [2, 5, 6, 7, 8, 9]
    severity: major   # only 3/9 addressed
  "QĐ 292":
    cited: false
    required-for-scope: true  # cấp Bộ
    severity: major
  "QĐ 06":
    applicable: true  # DVC scope
    integration-planned: true
    severity: info
  "QĐ 942":
    cited: false
    applicable: true
    severity: minor
```

---

## Finding format

```yaml
- id: F-NNN
  severity: major | minor
  check: alignment
  framework: "CT 34"
  issue: |
    Đề án chỉ address 3/9 nguyên tắc CT 34.
    Thiếu: NT6 (DEDUP), NT7 (pilot→nhân rộng), NT9 (data governance).
  fix-recommendation: |
    Bổ sung trong Section 1.2 (cơ sở chính trị):
    - NT6: show DEDUP với NDXP/LGSP (xem findings DEDUP)
    - NT7: roadmap chia pilot phase (3-6 tháng) trước rollout
    - NT9: KPI monitoring dashboard + data governance policy
```
