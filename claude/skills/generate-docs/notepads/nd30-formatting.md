# NĐ 30/2020/NĐ-CP — Formatting Rules

Reusable prompt chunk — standards cho tài liệu hành chính.

**Usage**: `@Notepads nd30-formatting` khi cần check formatting.

---

## Font + Layout

- Font: **Times New Roman 13pt**
- Line spacing: **1.5**
- Margins: Top/Bottom **20mm**, Left **30mm**, Right **15mm**
- Page numbers: **center bottom**
- Alignment: **Justify**

(Template ETC đã set sẵn — không cần override trong content-data.)

## Section numbering hierarchy

- Level 1: `1.` `2.` — **Bold**
- Level 2: `1.1.` `1.2.` — **Bold**
- Level 3: `1.1.1.` — Normal
- Level 4: `a)` `b)` — lowercase
- Level 5: `-` bullet

KHÔNG dùng `I./II./III.` (roman), `①②③` (symbols), `A./B./C.` (latin cap).

## Bảng / Hình đánh số

- Bảng: `Bảng {chapter}.{seq}: {title}` — vd `Bảng 3.2: Danh sách thành phần`
- Hình: `Hình {chapter}.{seq}: {title}` — vd `Hình 4.1: Sơ đồ kiến trúc`
- Reset `seq` mỗi top-level section (`chapter`)

## Citation format (văn bản pháp lý)

**Full** (lần đầu xuất hiện):
> Nghị định số 45/2026/NĐ-CP ngày dd tháng mm năm 2026 của Chính phủ về quản lý đầu tư ứng dụng công nghệ thông tin sử dụng ngân sách nhà nước...

**Short** (lần sau):
> Nghị định số 45/2026/NĐ-CP

**Article reference**:
> theo quy định tại khoản 2 Điều 13 Nghị định số 45/2026/NĐ-CP

**Luật**:
> Luật Đầu tư công số 58/2024/QH15 (lần đầu)
> Luật 58/2024/QH15 (lần sau)

**Quyết định**:
> Quyết định số 292/QĐ-BKHCN ngày dd tháng mm năm 2025 của Bộ Khoa học và Công nghệ về Khung Kiến trúc Chính phủ điện tử Việt Nam 4.0

## Trích dẫn bullets

Trong prose, khi liệt kê:

```
... bao gồm các nội dung sau:
a) Nội dung 1;
b) Nội dung 2;
c) Nội dung 3.
```

Kết thúc bằng dấu `;` sau mỗi bullet trừ cuối cùng `.`.

## Số liệu trong bảng

- Tiền: căn phải, `XXX.XXX.XXX`
- Phần trăm: căn phải, `XX,X%`
- Text: căn trái
- Ngày: `dd/mm/yyyy`, căn giữa

## Header tài liệu

Template đã pre-set các field:
- `project.display_name` — Tên hệ thống (trang bìa + header)
- `project.code` — Mã dự án (trang bìa + header)
- `project.client` — Tên chủ đầu tư (trang bìa)
- `dev_unit` — Đơn vị phát triển (trang bìa + ký)
- `meta.today` — Ngày phát hành (trang bìa)
- `meta.version` — Phiên bản tài liệu

## TOC + Cross-reference

- TOC auto-generate từ heading levels (Word Heading 1/2/3 styles)
- User mở .docx → F9 để refresh TOC sau khi render
- Cross-reference section: `xem Mục 3.2` hoặc `xem Bảng 4.1`
