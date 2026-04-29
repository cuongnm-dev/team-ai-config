# ref-kb-seed.md — Knowledge Base Seed Data

Khi scaffold workspace, tạo `knowledge-base/` directory với seed data dưới đây.
KB tích lũy qua mỗi dự án — seed data là điểm khởi đầu.

---

## File 1: `knowledge-base/_kb_index.md`

```markdown
# Knowledge Base Index

## Domains

| Domain | Path | Mô tả |
|---|---|---|
| Ecosystem | `ecosystem/` | Hệ sinh thái CNTT Chính phủ — nền tảng, hệ thống bộ/ngành |
| Precedent | `precedent/` | Phân tích Đề án mẫu — cấu trúc, patterns, anti-patterns |
| Policy | `policy/` | Chính sách, pháp lý — QĐ/CT/NĐ/Luật + KPI + deadline |
| Tech | `tech/` | Giải pháp công nghệ — patterns tích hợp, đơn giá, vendors |
| Glossary | `glossary/` | Thuật ngữ chuẩn |

## Usage Rules

1. **KB_READ trước mọi phân tích.** Agent phải đọc KB relevant trước khi bắt đầu.
2. **KB_WRITE khi phát hiện mới.** Ghi ngay, đừng để mất.
3. **KB_VERIFY cho entry > 90 ngày.** Chính sách thay đổi — verify trước khi dùng.
4. **KB_DEDUP bắt buộc.** Tra cứu ecosystem/ TRƯỚC MỌI đề xuất giải pháp.
5. **Frontmatter required.** Mỗi file KB phải có `last_verified`, `confidence`, `sources`.
```

---

## File 2: `knowledge-base/ecosystem/national-platforms.md`

```markdown
---
domain: ecosystem
last_verified: 2026-04-08
confidence: high
sources: ["mic.gov.vn", "dichvucong.gov.vn", "data.gov.vn"]
tags: ["NDXP", "LGSP", "VNeID", "CSDLQG", "nền tảng quốc gia"]
---

# Nền tảng số quốc gia

## 1. NDXP — Nền tảng tích hợp, chia sẻ dữ liệu quốc gia

- **Đơn vị quản lý:** Bộ TTTT (Cục CĐS quốc gia)
- **Chức năng chính:**
  - Cổng Dịch vụ công quốc gia (dichvucong.gov.vn)
  - Hệ thống thông tin giải quyết TTHC
  - Thanh toán trực tuyến (kết nối ngân hàng, ví điện tử)
  - Thông báo điện tử (SMS, email, app)
  - Xác thực tập trung (SSO)
- **Trạng thái:** Production — 63 tỉnh/thành + bộ/ngành kết nối
- **Dedup implication:** KHÔNG xây cổng DVC riêng → tích hợp NDXP. KHÔNG xây payment riêng → dùng NDXP payment.
- **Cách tích hợp:** API REST qua LGSP, SDK cho mobile

## 2. LGSP — Nền tảng tích hợp, chia sẻ dữ liệu

- **Hai cấp:**
  - LGSP quốc gia (Bộ TTTT vận hành)
  - LGSP bộ/ngành/tỉnh (mỗi đơn vị tự triển khai, kết nối về QG)
- **Chức năng:** ESB — kết nối hệ thống, chia sẻ dữ liệu, message queue
- **Trạng thái:** Production — 100% bộ/ngành, 63/63 tỉnh có LGSP
- **Dedup implication:** Mọi liên thông dữ liệu PHẢI qua LGSP. Không xây point-to-point.
- **Cách tích hợp:** SOAP/REST API đăng ký qua LGSP portal

## 3. VNeID — Ứng dụng định danh điện tử quốc gia

- **Đơn vị quản lý:** Bộ Công an (C06)
- **Chức năng:** eKYC, xác thực danh tính, chữ ký điện tử cá nhân
- **Trạng thái:** Production — 50M+ tài khoản
- **Dedup implication:** KHÔNG xây eKYC riêng cho DVC → dùng VNeID. Xác thực CBCC có thể dùng VNeID hoặc chữ ký số chuyên dùng.

## 4. CSDL quốc gia về dân cư

- **Đơn vị quản lý:** Bộ Công an
- **Chức năng:** Dữ liệu gốc về công dân (họ tên, ngày sinh, CCCD, địa chỉ...)
- **Trạng thái:** Production — 100M+ bản ghi
- **Dedup implication:** Không lưu trữ lại thông tin công dân → truy vấn CSDLQG qua LGSP.
- **QĐ 06:** Yêu cầu kết nối, khai thác CSDLQG dân cư

## 5. CSDL quốc gia về đăng ký doanh nghiệp

- **Đơn vị quản lý:** Bộ KH&ĐT
- **Trạng thái:** Production
- **Dedup implication:** Không xây CSDL doanh nghiệp riêng → truy vấn CSDLQG.

## 6. CSDL quốc gia về bảo hiểm

- **Đơn vị quản lý:** BHXH Việt Nam
- **Trạng thái:** Production
- **Dedup implication:** Xác minh BHXH → kết nối CSDLQG, không yêu cầu giấy tờ.

## 7. CSDL quốc gia về đất đai (đang xây dựng)

- **Đơn vị quản lý:** Bộ TN&MT
- **Trạng thái:** Đang triển khai
- **Dedup implication:** Nếu cần dữ liệu đất đai → theo dõi tiến độ, chuẩn bị kết nối.

## 8. Trục liên thông văn bản quốc gia

- **Chức năng:** Gửi/nhận văn bản điện tử giữa các CQNN
- **Trạng thái:** Production — 100% CQNN kết nối
- **Dedup implication:** Không xây hệ thống gửi văn bản riêng → kết nối trục LTVB.

## 9. Nền tảng dữ liệu mở quốc gia (data.gov.vn)

- **Chức năng:** Công bố dữ liệu mở của CQNN
- **Trạng thái:** Production
- **Dedup implication:** Dữ liệu mở → đăng trên data.gov.vn, không xây portal riêng.

## 10. Hệ thống thư điện tử Chính phủ

- **Chức năng:** Email công vụ (@xxx.gov.vn)
- **Trạng thái:** Production
- **Dedup implication:** Không xây email server riêng.
```

---

## File 3: `knowledge-base/ecosystem/shared-services.md`

```markdown
---
domain: ecosystem
last_verified: 2026-04-08
confidence: medium
sources: ["mic.gov.vn", "industry knowledge"]
tags: ["ký số", "thanh toán", "cloud", "shared services"]
---

# Dịch vụ dùng chung

## 1. Chữ ký số chuyên dùng Chính phủ
- **Đơn vị:** Ban Cơ yếu Chính phủ
- **Dùng cho:** Ký văn bản điện tử, xác thực CBCC
- **Tích hợp:** USB Token + middleware + API

## 2. Cloud cho Chính phủ
- **Mô hình:** Government Cloud (theo QĐ 749)
  - Private cloud: TTDL bộ/ngành/tỉnh
  - Community cloud: Dùng chung liên bộ
  - Public cloud (certified): Viettel, VNPT, FPT, CMC... (có chứng nhận ATTT)
- **Dedup implication:** Đánh giá trước khi xây TTDL riêng → có thể thuê cloud certified.

## 3. Hệ thống giám sát ATTT (SOC)
- **Cấp quốc gia:** Trung tâm VNCERT/CC (Bộ TTTT)
- **Cấp bộ/ngành:** Mỗi đơn vị phải có SOC hoặc thuê dịch vụ
- **Dedup implication:** Đánh giá thuê SOC-as-a-Service vs xây riêng.

## 4. Nền tảng họp trực tuyến
- **Zalo/VNPT/Viettel** đều có giải pháp cho CQNN
- **Dedup implication:** Không xây riêng trừ khi yêu cầu bảo mật đặc biệt.

## 5. Nền tảng học trực tuyến (LMS)
- **Nhiều bộ/ngành đã triển khai** (Bộ GD&ĐT, Học viện HC QG...)
- **Dedup implication:** Đánh giá tái sử dụng LMS hiện có vs xây mới.
```

---

## File 4: `knowledge-base/policy/_active-policies.md`

```markdown
---
domain: policy
last_verified: 2026-04-08
confidence: high
sources: ["vanban.chinhphu.vn"]
tags: ["chính sách", "pháp lý", "CĐS", "CNTT"]
---

# Chính sách CĐS hiện hành

## Cấp Đảng
| Văn bản | Nội dung | Ngày | Trạng thái |
|---|---|---|---|
| NQ 52-NQ/TW | Chủ trương về CMCN 4.0 | 27/09/2019 | Hiệu lực |

## Cấp Chính phủ / Thủ tướng
| Văn bản | Nội dung | Ngày | Trạng thái | File KB |
|---|---|---|---|---|
| QĐ 749/QĐ-TTg | CĐS quốc gia đến 2025, tầm nhìn 2030 | 03/06/2020 | Hiệu lực | qd-749.md |
| QĐ 06/QĐ-TTg | Phát triển ứng dụng dữ liệu dân cư | 06/01/2022 | Hiệu lực | qd-06.md |
| QĐ 942/QĐ-TTg | Chiến lược Chính phủ điện tử | 15/06/2021 | Hiệu lực | qd-942.md |
| CT 34/CT-TTg | 9 nguyên tắc CĐS | 2024 | Hiệu lực | ct-34.md |
| NĐ 45/2026/NĐ-CP | Quản lý ĐTƯDCNTT (thay NĐ 73/2019) | 2026 | Hiệu lực | nd-45-2026.md |
| Luật ĐTC 58/2024 | Luật Đầu tư công (sửa đổi) | 2024 | Hiệu lực | luat-dtc-58.md |
| NĐ 13/2023/NĐ-CP | Bảo vệ dữ liệu cá nhân | 17/04/2023 | Hiệu lực | nd-13-bvdlcn.md |

## Cấp Bộ TTTT
| Văn bản | Nội dung | Ngày | Trạng thái |
|---|---|---|---|
| TT 04/2020/TT-BTTTT | Dự toán chi phí phần mềm | 2020 | Hiệu lực |
| Bộ chỉ số CĐS | Đánh giá mức độ CĐS hàng năm | Annual | Hiệu lực |

## Sắp thay đổi / Lưu ý
- NĐ 73/2019 → đã được thay thế bởi NĐ 45/2026
- QĐ 749 targets nhiều KPI 2025 → kiểm tra KPI nào đã đạt/chưa
- Luật Giao dịch điện tử 2023 → ảnh hưởng chữ ký số, hợp đồng điện tử
```

---

## File 5: `knowledge-base/policy/qd-749.md`

```markdown
---
domain: policy
last_verified: 2026-04-08
confidence: high
sources: ["vanban.chinhphu.vn QĐ 749/QĐ-TTg ngày 03/06/2020"]
tags: ["QĐ 749", "CĐS quốc gia", "KPI", "trụ cột"]
---

# QĐ 749/QĐ-TTg — Chương trình CĐS quốc gia đến 2025, tầm nhìn 2030

## Tầm nhìn
Việt Nam trở thành quốc gia số, ổn định và thịnh vượng, tiên phong thử nghiệm các công nghệ mới.

## 6 trụ cột CĐS
1. Nhận thức số
2. Thể chế số
3. Hạ tầng số
4. Nhân lực số
5. An ninh mạng
6. Phát triển nền tảng số

## 3 trụ cột ứng dụng
1. Chính phủ số (Government)
2. Kinh tế số (Economy)
3. Xã hội số (Society)

## KPI chính (mục tiêu 2025)
| KPI | Mục tiêu 2025 | Ghi chú |
|---|---|---|
| DVCTT mức 4 | 100% đủ điều kiện | Tất cả TTHC đủ ĐK phải mức 4 |
| Tỷ lệ hồ sơ trực tuyến | 80% | Hồ sơ giải quyết qua DVC |
| Văn bản điện tử | 90% | Gửi/nhận qua trục LTVB |
| Báo cáo trực tuyến | 100% | Báo cáo Chính phủ qua HTTT |
| Dữ liệu mở | Tăng 30%/năm | Bộ dữ liệu trên data.gov.vn |
| CSDL chuyên ngành | 50% kết nối LGSP | Liên thông dữ liệu |
| Thanh toán trực tuyến | 50% giao dịch DVC | Qua NDXP payment |

## Mục tiêu 2030
| KPI | Mục tiêu 2030 |
|---|---|
| DVCTT mức 4 | 100% (toàn bộ) |
| Hồ sơ trực tuyến | 95% |
| CSDL kết nối LGSP | 100% |
| Kinh tế số / GDP | 30% |

## Áp dụng khi viết Đề án
- Mục 3 (Quan điểm/MT): align mục tiêu đề án với QĐ 749 KPIs
- Mục 5 (Nhiệm vụ/GP): map per trụ cột QĐ 749
- Phụ lục C: Ma trận KPI đề án ↔ KPI QĐ 749
```

---

## File 6: `knowledge-base/policy/ct-34.md`

```markdown
---
domain: policy
last_verified: 2026-04-08
confidence: high
sources: ["CT 34/CT-TTg"]
tags: ["CT 34", "9 nguyên tắc", "chính quyền số"]
---

# CT 34/CT-TTg — 9 Nguyên tắc Chuyển đổi số

## 9 Nguyên tắc

1. **Nhận thức số** — CĐS trước hết là chuyển đổi nhận thức. Lãnh đạo dẫn dắt.
2. **Người dân là trung tâm** — Mọi giải pháp phải phục vụ người dân, DN.
3. **Thể chế đi trước** — Hoàn thiện thể chế, quy trình TRƯỚC khi ứng dụng CNTT.
4. **Dữ liệu là tài nguyên** — Thu thập 1 lần, chia sẻ nhiều lần. Không yêu cầu giấy tờ khi đã có dữ liệu.
5. **Dữ liệu số đi trước** — Số hóa dữ liệu là ưu tiên hàng đầu, nền tảng cho mọi ứng dụng.
6. **Nền tảng số dùng chung** — Sử dụng nền tảng quốc gia (NDXP, LGSP...), KHÔNG xây lại.
7. **Bảo đảm an toàn thông tin** — An toàn thông tin đi kèm phát triển, không phải đối lập.
8. **Huy động nguồn lực** — Đa dạng: NSNN + PPP + xã hội hóa + hợp tác quốc tế.
9. **Đo lường, đánh giá** — Đặt KPI, đo lường thường xuyên, công khai kết quả.

## Áp dụng khi viết Đề án
- Mục 3.1 (Quan điểm): reference 3-5 nguyên tắc phù hợp nhất
- Mục 5 (Nhiệm vụ/GP): mỗi giải pháp phải align ≥ 1 nguyên tắc
- DEDUP: Nguyên tắc 6 = CƠ SỞ PHÁP LÝ cho dedup. "Dùng nền tảng quốc gia, không xây lại"
```

---

## File 7: `knowledge-base/precedent/_patterns.md`

```markdown
---
domain: precedent
last_verified: 2026-04-08
confidence: medium
sources: ["Phân tích 3 mẫu Đề án: VCLCSMT, BCA QĐ 422, ITS Quốc gia"]
tags: ["patterns", "anti-patterns", "cấu trúc", "best practices"]
---

# Patterns & Anti-patterns từ Đề án mẫu

## Patterns (nên làm)

### P1: Trụ cột rõ ràng
- BCA (QĐ 422): 6 nhóm nhiệm vụ rõ ràng, mỗi nhóm có chủ trì + phối hợp
- VCLCSMT: 7 trụ cột nhiệm vụ, mỗi trụ cột có danh mục dự án
- **Áp dụng:** Luôn tổ chức Section 5 theo trụ cột, không viết chung chung

### P2: Bảng danh mục dự án chi tiết
- BCA: Phụ lục 24 nhiệm vụ với cột Chủ trì | Phối hợp | Thời hạn
- ITS: Bảng chi tiết với kinh phí per hạng mục
- **Áp dụng:** Section 6 luôn có bảng, Phụ lục A luôn chi tiết hơn

### P3: Phân kỳ rõ ràng
- VCLCSMT: 2 giai đoạn (2024-2025, 2026-2030)
- ITS: Phân kỳ theo năm, kinh phí per năm
- **Áp dụng:** Section 8 phải có mốc thời gian cụ thể, không chung chung

### P4: Cơ sở pháp lý chi tiết
- ITS: 6 trang căn cứ pháp lý — RẤT kỹ
- **Áp dụng:** Section 1.2 phải liệt kê đầy đủ, policy-researcher chịu trách nhiệm

## Anti-patterns (tránh)

### A1: Giải pháp generic, không thực tiễn
- Viết "ứng dụng AI, blockchain, IoT" mà không có use case cụ thể
- **Tránh:** Mỗi giải pháp phải có: vấn đề cụ thể → giải pháp cụ thể → kết quả đo được

### A2: Trùng lặp nền tảng quốc gia
- Đề xuất xây Cổng DVC riêng khi NDXP đã có
- Đề xuất xây LGSP riêng khi đã có LGSP quốc gia
- **Tránh:** DEDUP bắt buộc. CT 34 Nguyên tắc 6.

### A3: Kinh phí không có cơ sở
- Ghi "kinh phí dự kiến 50 tỷ" không giải thích cách tính
- **Tránh:** Phải có phân bổ per hạng mục, tham chiếu đơn giá (TT 04/2020 cho PM)

### A4: Thiếu cơ chế giám sát
- Chỉ ghi "định kỳ báo cáo" mà không nêu KPI, tần suất, người chịu trách nhiệm
- **Tránh:** Section 10.4 phải có bảng KPI + tần suất + đơn vị giám sát

### A5: Copy-paste từ QĐ 749 không contextualize
- Trích nguyên văn QĐ 749 mà không map vào bối cảnh đơn vị
- **Tránh:** Mọi reference QĐ/CT phải kèm "áp dụng cho đơn vị này nghĩa là..."

## Scale Benchmarks (từ 3 mẫu)

| Cấp | Trang | Sections | Dự án/NV | Kinh phí | Thời hạn |
|---|---|---|---|---|---|
| Viện (VCLCSMT) | 15 | 7 | ~10 | 50-70 tỷ | 5 năm |
| Thủ tướng (BCA) | 23 | 6 + PL | 24 | [classified] | 5 năm |
| Bộ (ITS) | 91 | 9 + PL | ~15 hạng mục | 1.060 tỷ | 5 năm |
```

---

## File 8: `knowledge-base/tech/integration-patterns.md`

```markdown
---
domain: tech
last_verified: 2026-04-08
confidence: medium
sources: ["industry knowledge", "mic.gov.vn"]
tags: ["LGSP", "API", "tích hợp", "kiến trúc"]
---

# Patterns tích hợp CNTT Chính phủ

## 1. Tích hợp qua LGSP (bắt buộc cho liên thông)
- **Khi dùng:** Chia sẻ dữ liệu giữa hệ thống CQNN
- **Protocol:** SOAP hoặc REST API đăng ký trên LGSP
- **Chi phí:** Adapter development + testing + chứng nhận LGSP
- **Timeline:** 2-4 tháng per integration point

## 2. Tích hợp NDXP (cho DVC)
- **Khi dùng:** DVC trực tuyến, thanh toán, thông báo, xác thực
- **Protocol:** REST API + SDK
- **Chi phí:** Development + NDXP registration
- **Timeline:** 1-3 tháng

## 3. Kiến trúc microservices (cho hệ thống mới)
- **Khi dùng:** Xây hệ thống quy mô trung bình-lớn
- **Stack phổ biến CQNN:** Java Spring Boot, .NET Core, hoặc Node.js
- **Database:** PostgreSQL (ưu tiên), Oracle (legacy), SQL Server
- **Lưu ý:** Phải tuân thủ tiêu chuẩn ATTT CQNN

## 4. Data sharing patterns
- **One-time sync:** Export/import CSV/XML
- **Real-time:** API qua LGSP
- **Near-real-time:** Message queue (RabbitMQ, Kafka)
- **Batch:** ETL pipeline cho data warehouse/BI

## 5. Cloud deployment
- **On-premises:** TTDL bộ/ngành (dữ liệu mật, ATTT cao)
- **Government cloud:** Viettel/VNPT/FPT cloud (certified)
- **Hybrid:** On-prem cho core + cloud cho non-critical
```

---

## File 9: `knowledge-base/tech/cost-benchmarks.md`

```markdown
---
domain: tech
last_verified: 2026-04-08
confidence: low
sources: ["TT 04/2020", "industry estimates", "ITS sample"]
tags: ["đơn giá", "kinh phí", "benchmark"]
---

# Cost Benchmarks (Tham khảo)

**LƯU Ý:** Đây là ước tính sơ bộ để validate tính khả thi. Dự toán chính thức theo TT 04/2020.

## Phần mềm (theo TT 04/2020)

| Hạng mục | Đơn giá tham khảo | Ghi chú |
|---|---|---|
| Phần mềm nội bộ đơn giản | 500 tr - 2 tỷ | Quản lý văn bản, HR cơ bản |
| Phần mềm nội bộ trung bình | 2 - 8 tỷ | ERP, quản lý chuyên ngành |
| Cổng thông tin / Portal | 1 - 5 tỷ | Tùy quy mô + chức năng |
| Hệ thống DVC trực tuyến | 3 - 15 tỷ | Tùy số TTHC + tích hợp |
| CSDL chuyên ngành | 2 - 10 tỷ | Tùy quy mô dữ liệu |
| Tích hợp LGSP (per endpoint) | 200 - 800 tr | Development + testing |
| Mobile app | 1 - 5 tỷ | iOS + Android |
| BI / Data warehouse | 3 - 12 tỷ | Tùy nguồn dữ liệu |

## Hạ tầng

| Hạng mục | Đơn giá tham khảo | Ghi chú |
|---|---|---|
| TTDL nhỏ (1-2 rack) | 3 - 8 tỷ | Server + storage + network |
| TTDL trung bình (5-10 rack) | 15 - 50 tỷ | + cooling + UPS + DR |
| Cloud (thuê/năm) | 500 tr - 3 tỷ/năm | Tùy workload |
| Mạng LAN nâng cấp | 500 tr - 2 tỷ | Per tòa nhà/trụ sở |
| Thiết bị đầu cuối (batch) | 50 - 200 tr | Máy tính, scanner, printer |

## An toàn thông tin

| Hạng mục | Đơn giá tham khảo | Ghi chú |
|---|---|---|
| Firewall + IDS/IPS | 500 tr - 3 tỷ | Tùy throughput |
| SOC setup | 2 - 8 tỷ | Hoặc thuê 500 tr - 1.5 tỷ/năm |
| Đánh giá ATTT | 200 - 500 tr | Per hệ thống |
| Chứng nhận ATTT cấp 3 | 300 - 800 tr | Theo NĐ 85/2016 |

## Đào tạo

| Hạng mục | Đơn giá tham khảo | Ghi chú |
|---|---|---|
| Đào tạo CNTT cho CBCC | 50 - 200 tr/đợt | 30-50 người/đợt |
| Đào tạo chuyên sâu | 200 - 500 tr/đợt | Admin, developer |
| Đào tạo lãnh đạo CĐS | 100 - 300 tr/đợt | Nhận thức + chiến lược |
```

---

## File 10: `knowledge-base/glossary/vn-gov-it.md`

```markdown
---
domain: glossary
last_verified: 2026-04-08
confidence: high
sources: ["Official documents"]
tags: ["thuật ngữ", "viết tắt"]
---

# Thuật ngữ CNTT Chính phủ Việt Nam

| Viết tắt | Đầy đủ | English |
|---|---|---|
| CĐS | Chuyển đổi số | Digital Transformation |
| CNTT | Công nghệ thông tin | Information Technology |
| CQNN | Cơ quan nhà nước | Government Agency |
| CBCC | Cán bộ, công chức | Civil Servant |
| CBCCVC | Cán bộ, công chức, viên chức | Civil Servant & Public Employee |
| DVCTT | Dịch vụ công trực tuyến | Online Public Service |
| TTHC | Thủ tục hành chính | Administrative Procedure |
| NDXP | Nền tảng tích hợp, chia sẻ dữ liệu quốc gia | National Data Exchange Platform |
| LGSP | Nền tảng tích hợp, chia sẻ dữ liệu (cấp bộ/tỉnh) | Local Government Service Platform |
| CSDL | Cơ sở dữ liệu | Database |
| CSDLQG | Cơ sở dữ liệu quốc gia | National Database |
| HTTT | Hệ thống thông tin | Information System |
| ATTT | An toàn thông tin | Information Security |
| TTDL | Trung tâm dữ liệu | Data Center |
| NSNN | Ngân sách nhà nước | State Budget |
| ĐTC | Đầu tư công | Public Investment |
| NCKT | Nghiên cứu khả thi | Feasibility Study |
| TKCS | Thiết kế sơ bộ | Preliminary Design |
| TKCT | Thiết kế chi tiết | Detailed Design |
| HSMT | Hồ sơ mời thầu | Tender Invitation Documents |
| HSDT | Hồ sơ dự thầu | Tender Bid Documents |
| ĐXCTĐT | Đề xuất chủ trương đầu tư | Investment Policy Proposal |
| NĐ | Nghị định | Decree |
| TT | Thông tư | Circular |
| QĐ | Quyết định | Decision |
| CT | Chỉ thị | Directive |
| NQ | Nghị quyết | Resolution |
| PPP | Đối tác công tư | Public-Private Partnership |
| ODA | Viện trợ phát triển chính thức | Official Development Assistance |
| DR | Khôi phục thảm họa | Disaster Recovery |
| SOC | Trung tâm giám sát ATTT | Security Operations Center |
| ESB | Trục tích hợp dịch vụ | Enterprise Service Bus |
| eKYC | Xác thực danh tính điện tử | Electronic Know Your Customer |
| LTVB | Liên thông văn bản | Document Exchange |
```
