# 7 Rubrics — Strategic Critique

Loaded on demand by `strategic-critique/SKILL.md` Step 2.

Each check loads its rubric and applies. Detailed rubrics in `rubrics/*.md` (sibling dir to this notepad).

---

## 1. Formal check

rubric: `rubrics/01-formal.md`

check:
- Outline section numbering đúng NĐ 30 (1, 1.1, 1.1.1, a), -)
- Bảng/Hình `Bảng X.Y: Title` / `Hình X.Y: Title`, reset sequence per chapter
- Font / spacing / margin (nếu có metadata)
- Header structure (bìa, mục lục, nội dung, phụ lục)
- Font legal citations format

severity: mostly minor, đôi khi major (thiếu mục lục = major)

## 2. Substantive check

rubric: `rubrics/02-substantive.md`

check: mỗi claim có **số liệu / tên đơn vị / ngày tháng / nguồn** support không.

Patterns flag:
- "tương đối", "khá", "đa số", "một số", "một phần"
- "nhiều", "ít", "hầu hết" (không số)
- "hiện đại", "lạc hậu" (không metric)
- "thời gian tới", "giai đoạn trước" (không năm cụ thể)
- Adjective without data: "mạnh mẽ", "đồng bộ", "toàn diện"

severity: **blocker** ở Section 3 (Hiện trạng) + Section 6 (Kinh phí). **Major** chỗ khác.

## 3. Coherence check

rubric: `rubrics/03-coherence.md`

Cross-section logic:
- Mỗi **problem** (S3) → có ít nhất 1 **objective** (S4) address
- Mỗi **objective** (S4) → có ít nhất 1 **solution** (S5)
- Mỗi **solution** (S5) → có **budget line** (S6) + **timeline** (S7)
- Numbers cited consistently (total budget S6 = sum of components)

severity: blocker nếu contradiction, major nếu orphan (objective không được address).

## 4. Alignment check

rubric: `rubrics/04-alignment.md`

Check fit với:
- **QĐ 749/QĐ-TTg** — 3 trụ cột (Chính phủ số, Kinh tế số, Xã hội số)
- **CT 34/CT-TTg** — 9 nguyên tắc
- **QĐ 06/QĐ-TTg** — nếu liên quan dân cư
- **QĐ 292/QĐ-BKHCN (2025)** — Khung Kiến trúc CPĐT 4.0 (nếu dự án cấp Bộ)

severity: major nếu claim alignment nhưng không có evidence.

## 5. DEDUP check (unique differentiator)

rubric: `rubrics/05-dedup.md`

Catalog ecosystem có sẵn:
- **NDXP** (Nền tảng tích hợp chia sẻ dữ liệu quốc gia): 44 dịch vụ
- **LGSP** (Local Government Service Platform): auth, notification, payment
- **CSDLQG** (CSDL quốc gia): dân cư, đất đai, bảo hiểm, doanh nghiệp, tài chính
- **Gov Cloud** (VNPT/Viettel): compute, storage, database-as-a-service
- **SSO quốc gia**: VNeID, VNID

Pattern flag: nếu proposed solution có từ khóa trùng catalog → dedup miss.

severity: major (vi phạm CT 34 NT6).

## 6. Feasibility check

rubric: `rubrics/06-feasibility.md`

check:
- Timeline có realistic không (vd. implement HRIS cho 1000 cán bộ trong 3 tháng → unrealistic)
- Budget vs TT 04/2020 formula (man-hours × rate)
- Capacity: đơn vị có team IT đủ không (N cán bộ CNTT làm X modules?)
- Dependencies: phụ thuộc bên ngoài nào không control được (vd. phải chờ NDXP update API)

severity: major khi timeline/budget off > 50% baseline.

## 7. Legal ref validity

rubric: `rubrics/07-legal.md`

Check mỗi văn bản cited:
- Còn hiệu lực không (vd. NĐ 73/2019 đã bị NĐ 45/2026 thay)
- Điều khoản cited có đúng không (vd. "Điều 13 Nghị định 45" phải đúng nội dung Điều 13)
- Date format chuẩn: "ngày dd tháng mm năm yyyy"

Reference list văn bản 2026 hiện hành trong `rubrics/07-legal.md`.

severity: **blocker** nếu cite văn bản đã bị thay.
