# TKCS Legal References (2026 hiện hành)

Reusable prompt chunk — danh sách văn bản pháp lý dùng trong `tkcs.legal_basis`.

**Usage**: `@Notepads tkcs-legal-refs` khi viết Section 2 TKCS.

---

## CHÍNH — Quản lý đầu tư CNTT

- **Nghị định số 45/2026/NĐ-CP** — Quản lý đầu tư ứng dụng CNTT sử dụng NSNN (thay NĐ 73/2019)
  - Điều 9: Ngưỡng quy mô dự án
  - Điều 11: Báo cáo chủ trương
  - Điều 12: Nghiên cứu khả thi (NCKT)
  - **Điều 13: Thiết kế cơ sở (TKCS)** ← core reference cho TKCS
  - Điều 14: Thiết kế chi tiết (TKCT)
  - Điều 16: Dự toán
  - Điều 17: Thẩm định
  - Điều 22: Kiểm thử

## Chuyển đổi số quốc gia

- **Quyết định số 749/QĐ-TTg** — Chương trình CĐS quốc gia
- **Chỉ thị số 34/CT-TTg (2024)** — 9 nguyên tắc CĐS
  - Nguyên tắc 6: Dùng nền tảng dùng chung, không xây lại (DEDUP)
  - Nguyên tắc 9: An toàn thông tin

## Khung kiến trúc CPĐT

- **Quyết định số 292/QĐ-BKHCN (2025)** — Khung Kiến trúc CPĐT 4.0
- **Quyết định số 2568/QĐ-BTTTT (2024)** — Khung Kiến trúc 3.0 (legacy, nếu dự án bắt đầu trước 2025)

## Đầu tư công + Đấu thầu

- **Luật số 58/2024/QH15** — Luật Đầu tư công (sửa đổi)
- **Luật số 22/2023/QH15** — Luật Đấu thầu
- **Nghị định số 214/2025/NĐ-CP** — Hướng dẫn Luật Đấu thầu (hiệu lực 04/08/2025, thay NĐ 24/2024)

## Dự toán phần mềm

- **Thông tư số 04/2020/TT-BTTTT** — Xác định chi phí phát triển, nâng cấp phần mềm

## An toàn thông tin

- **Luật số 86/2015/QH13** — Luật An toàn thông tin mạng
- **Nghị định số 85/2016/NĐ-CP** — Bảo đảm ATTT theo cấp độ
- **Thông tư số 03/2017/TT-BTTTT** — Cấp độ ATTT hệ thống thông tin
- **TCVN 11930:2017** — Yêu cầu cơ bản ATTT cho HTTT cấp độ
- **ISO/IEC 27001** — Information Security Management

## Bảo vệ dữ liệu cá nhân

- **Luật số 91/2025/QH15** — Luật Bảo vệ dữ liệu cá nhân (hiệu lực 01/01/2026)
- **Nghị định số 13/2023/NĐ-CP** — Bảo vệ dữ liệu cá nhân (đang còn hiệu lực đến khi có NĐ hướng dẫn Luật mới)

## Văn bản hành chính

- **Nghị định số 30/2020/NĐ-CP** — Công tác văn thư

## Template legal_basis (điền trong `tkcs.legal_basis`)

```
Căn cứ Luật Đầu tư công số 58/2024/QH15;

Căn cứ Luật Đấu thầu số 22/2023/QH15;

Căn cứ Nghị định số 45/2026/NĐ-CP ngày dd tháng mm năm 2026 của Chính phủ về quản lý đầu tư ứng dụng công nghệ thông tin sử dụng ngân sách nhà nước;

Căn cứ Nghị định số 214/2025/NĐ-CP ngày dd tháng mm năm 2025 của Chính phủ quy định chi tiết một số điều của Luật Đấu thầu về lựa chọn nhà thầu;

Căn cứ Quyết định số 749/QĐ-TTg ngày 03 tháng 6 năm 2020 của Thủ tướng Chính phủ phê duyệt Chương trình Chuyển đổi số quốc gia đến năm 2025, định hướng đến năm 2030;

Căn cứ Quyết định số 292/QĐ-BKHCN ngày dd tháng mm năm 2025 của Bộ Khoa học và Công nghệ về Khung Kiến trúc Chính phủ điện tử Việt Nam 4.0;

Căn cứ Thông tư số 04/2020/TT-BTTTT ngày 24 tháng 02 năm 2020 của Bộ trưởng Bộ Thông tin và Truyền thông quy định về lập và quản lý chi phí dự án đầu tư ứng dụng công nghệ thông tin;

[Bổ sung văn bản pháp lý chuyên ngành của dự án]
```

## CHECK trước khi save

- [ ] KHÔNG reference NĐ 73/2019 (đã bị thay)
- [ ] KHÔNG reference NĐ 24/2024 (đã bị thay bởi NĐ 214/2025)
- [ ] Ngày ban hành + cơ quan ban hành đầy đủ
- [ ] Thứ tự: Luật → NĐ → QĐ → TT (cao xuống thấp)
