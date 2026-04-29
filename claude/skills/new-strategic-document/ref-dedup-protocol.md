# ref-dedup-protocol.md — Dedup Protocol Definition

Dedup Protocol là cơ chế BẮT BUỘC chạy trước MỌI đề xuất giải pháp/dự án trong Đề án CĐS.
Mục đích: tránh trùng lặp với nền tảng quốc gia, dịch vụ dùng chung, và hệ thống bộ/ngành khác.

Cơ sở pháp lý: **CT 34/CT-TTg Nguyên tắc 6** — "Sử dụng nền tảng số dùng chung, KHÔNG xây lại."

## MCP-aware execution (Phase 3+ default per CLAUDE.md MCP-2)

Steps 1-2 dưới đây CÓ THỂ thực thi qua `etc-platform` MCP để team-wide registry tích lũy:
- **Step 1 KB Search** → `mcp__etc-platform__kb_query(domain="ecosystem", max_age_days=90)` thay vì local file scan
- **Step 3 Decision recording** → `mcp__etc-platform__dedup_register(proposal, decision, rationale, ecosystem_ref, project_id)` — registry tích lũy across projects
- **Step 0 Pre-check** (NEW): `mcp__etc-platform__dedup_check({problem, solution_summary})` đầu tiên — nếu prior project đã ra quyết định, reuse rationale (cite `proposal_hash` + `registered_at`)

Local file fallback nếu MCP unavailable.

---

## Protocol Flow

```
┌─────────────────────────────────────────────────────────┐
│              DEDUP PROTOCOL                              │
│                                                          │
│  Input: Đề xuất giải pháp / dự án                        │
│                                                          │
│  Step 1: KB Search (bắt buộc)                            │
│    a. ecosystem/national-platforms.md                     │
│    b. ecosystem/shared-services.md                        │
│    c. ecosystem/ministry-systems/{relevant}.md            │
│    d. precedent/_patterns.md (anti-pattern A2)            │
│                                                          │
│  Step 2: Web Research (nếu KB chưa đủ)                   │
│    a. Tìm triển khai hiện có                              │
│    b. Kiểm tra dự án đang triển khai ở nơi khác          │
│    c. Kiểm tra roadmap nền tảng quốc gia                 │
│                                                          │
│  Step 3: Classify Overlap                                │
│    a. Exact match → platform có đúng chức năng cần        │
│    b. Partial match → platform có 1 phần chức năng        │
│    c. Planned → platform sẽ có trong roadmap              │
│    d. None → chưa ai làm                                  │
│                                                          │
│  Step 4: Assign Verdict                                  │
│    UNIQUE | ADOPT | EXTEND | INTEG | REJECT              │
│                                                          │
│  Step 5: Modify Proposal (nếu không UNIQUE)              │
│    Rewrite proposal để tận dụng existing + fill gap       │
│                                                          │
│  Step 6: Log Result                                      │
│    Ghi vào dedup-report.md                               │
│                                                          │
│  Output: Validated proposal + verdict + reasoning         │
└─────────────────────────────────────────────────────────┘
```

---

## Verdict Definitions

| Verdict | Khi nào | Hành động |
|---|---|---|
| **UNIQUE** | Chưa có nền tảng/hệ thống nào cover chức năng này | Proceed — đề xuất nguyên bản |
| **ADOPT** | Nền tảng quốc gia/dùng chung đã có đầy đủ | Rewrite → "Triển khai/kết nối [platform]". Kinh phí = kết nối + đào tạo, KHÔNG phải xây mới |
| **EXTEND** | Nền tảng có một phần, cần mở rộng/bổ sung | Rewrite → "Tích hợp [platform] + xây bổ sung [gap]". Kinh phí = adapter + module bổ sung |
| **INTEG** | Bộ/ngành khác đã xây hệ thống tương tự | Rewrite → "Kết nối/trao đổi dữ liệu với [hệ thống X] qua LGSP". Không xây trùng |
| **REJECT** | Hoàn toàn trùng lặp, không có giá trị gia tăng | Loại bỏ khỏi portfolio. Giải thích lý do cho user |

---

## Dedup Checklist (per proposal)

Mỗi đề xuất phải trả lời 7 câu hỏi:

```markdown
### Dedup Check: {Tên đề xuất}

1. [ ] Chức năng này có trên NDXP không?
   → Nếu có: ADOPT — dùng NDXP module
   
2. [ ] Dữ liệu này có trong CSDLQG nào không?
   → Nếu có: ADOPT — truy vấn CSDLQG qua LGSP, không lưu trữ riêng
   
3. [ ] Có dịch vụ dùng chung (ký số, SOC, cloud, email) cover không?
   → Nếu có: ADOPT — dùng dịch vụ dùng chung
   
4. [ ] Bộ/ngành chủ quản hoặc bộ/ngành liên quan đã có hệ thống tương tự?
   → Nếu có: INTEG — kết nối qua LGSP
   
5. [ ] Nền tảng quốc gia có roadmap sắp triển khai chức năng này?
   → Nếu có: xem xét chờ + pilot adoption thay vì xây mới
   
6. [ ] Có open-source/platform dùng chung cho CQNN đã verified?
   → Nếu có: EXTEND — customize thay vì xây từ đầu
   
7. [ ] Chức năng thực sự UNIQUE cho đơn vị này?
   → Nếu có: UNIQUE — proceed nhưng phải giải thích tại sao unique
```

---

## Dedup Report Format

File `07-dedup-report.md` trong thinking-bundle/:

```markdown
---
type: dedup-report
total_proposals: N
verdicts:
  UNIQUE: X
  ADOPT: Y
  EXTEND: Z
  INTEG: W
  REJECT: V
---

# Dedup Report: Đề án CĐS {Tên đơn vị}

## Tổng quan
- Tổng đề xuất ban đầu: {N}
- Sau dedup: {M} (đã loại {V} trùng lặp)
- Tỉ lệ tận dụng nền tảng sẵn có: {(Y+Z+W)/N * 100}%

## Chi tiết per proposal

### DA-01: {Tên dự án}
| Field | Value |
|---|---|
| Đề xuất ban đầu | {mô tả ban đầu} |
| KB Search | ecosystem/national-platforms.md → {finding} |
| Web Research | {URL} → {finding} (nếu có) |
| Overlap | {exact/partial/planned/none} |
| **Verdict** | **{UNIQUE/ADOPT/EXTEND/INTEG/REJECT}** |
| Platform liên quan | {tên platform nếu có} |
| Đề xuất sau dedup | {mô tả đã modify} |
| Kinh phí impact | {tăng/giảm/giữ nguyên} + lý do |

### DA-02: {Tên dự án}
...

## Tổng hợp tận dụng nền tảng

| Nền tảng | Số lượng tích hợp | Dự án liên quan |
|---|---|---|
| NDXP | 3 | DA-02, DA-05, DA-08 |
| LGSP | 5 | DA-01, DA-03, DA-04, DA-06, DA-09 |
| VNeID | 1 | DA-02 |
| CSDLQG Dân cư | 2 | DA-02, DA-07 |

## Lessons Learned (KB_WRITE candidates)
- {Phát hiện mới nên ghi vào KB cho dự án sau}
```

---

## Common Dedup Examples

### Example 1: Cổng DVC

```
PROPOSED: "Xây dựng Cổng dịch vụ công trực tuyến đơn vị"
CHECK Q1: NDXP đã có Cổng DVC quốc gia + hệ thống giải quyết TTHC
VERDICT: ADOPT + EXTEND
MODIFIED: "Kết nối DVC đơn vị với Cổng DVC quốc gia qua NDXP.
           Xây hệ thống back-office xử lý hồ sơ nội bộ
           + API tích hợp cho nghiệp vụ đặc thù."
COST IMPACT: Giảm 60-70% (chỉ xây back-office, không xây portal)
```

### Example 2: CSDL cán bộ

```
PROPOSED: "Xây dựng CSDL quản lý cán bộ, công chức"
CHECK Q4: BNV đang triển khai CSDL CBCCVC quốc gia
VERDICT: INTEG
MODIFIED: "Đồng bộ dữ liệu nhân sự nền với CSDL CBCCVC (BNV) qua LGSP.
           Xây module quản lý bổ sung (đào tạo, đánh giá, quy hoạch)
           mà CSDL quốc gia chưa cover."
COST IMPACT: Giảm 40-50% (chỉ xây module bổ sung)
```

### Example 3: Hệ thống email

```
PROPOSED: "Triển khai hệ thống thư điện tử cho đơn vị"
CHECK Q3: Đã có hệ thống email Chính phủ (@xxx.gov.vn)
VERDICT: ADOPT
MODIFIED: "Đăng ký và triển khai sử dụng hệ thống thư điện tử Chính phủ.
           Đào tạo CBCC sử dụng."
COST IMPACT: Giảm 90%+ (chỉ còn đào tạo)
```

### Example 4: CSDL chuyên ngành (unique)

```
PROPOSED: "Xây dựng CSDL quản lý chiến lược, chính sách Mặt trận"
CHECK Q1-Q7: Không có nền tảng/hệ thống nào cover lĩnh vực CSMT
VERDICT: UNIQUE
KEPT: Giữ nguyên đề xuất.
NOTE: Thiết kế API để sẵn sàng kết nối LGSP khi cần chia sẻ.
```

### Example 5: Hệ thống BI/Dashboard

```
PROPOSED: "Xây dựng hệ thống Dashboard giám sát CĐS"
CHECK Q4: Bộ TTTT có hệ thống đánh giá CĐS hàng năm nhưng
          không cung cấp dashboard real-time cho từng đơn vị
VERDICT: EXTEND
MODIFIED: "Xây Dashboard nội bộ giám sát CĐS.
           Tích hợp data feed từ hệ thống đánh giá CĐS (Bộ TTTT)
           + dữ liệu nội bộ. Expose API cho báo cáo lên Bộ."
COST IMPACT: Giảm 20% (tận dụng data feed sẵn có)
```

---

## Dedup Gate Rule

strategy-orchestrator PHẢI block Spiral 3 → Checkpoint 2 nếu:
- Bất kỳ proposal nào chưa có dedup verdict
- Proposal có verdict REJECT chưa được loại hoặc reframe
- Proposal có verdict ADOPT/INTEG chưa được rewrite

Checkpoint 2 chỉ unlock khi 100% proposals đã validated.
