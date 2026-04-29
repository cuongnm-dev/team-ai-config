# Rubric 01 — Formal Check (NĐ 30/2020 compliance)

Quick structural QA. Severity thường minor, đôi khi major.

---

## Checks

### Section numbering

- Level 1: `1.`, `2.` bold
- Level 2: `1.1.`, `1.2.` bold  
- Level 3: `1.1.1.` normal
- Level 4: `a)`, `b)` lowercase
- Level 5: `-` bullet

**Auto-flag**: I./II./III. (roman), A./B./C. (latin cap), ①②③ (symbols) → minor.

### Bảng / Hình

- `Bảng {chapter}.{seq}: {title}` — `Bảng 3.2: ...`
- `Hình {chapter}.{seq}: {title}`
- Reset seq per chapter
- Caption phải xuất hiện ngay trước/sau bảng/hình, không cách đoạn

**Auto-flag**: "Bảng 1", "Hình 5" (không có chapter), "Table 1" (tiếng Anh) → minor.

### Document structure

Đề án chuẩn phải có:
- Trang bìa (logo cơ quan, tên đề án, cấp phê duyệt, năm)
- Trang ký (thủ trưởng đơn vị + cơ quan phê duyệt)
- Mục lục (auto-generated)
- Nội dung
- Phụ lục (nếu có)

**Auto-flag major**: thiếu mục lục cho tài liệu > 20 trang.

### Font / margin (nếu có metadata)

- Times New Roman 13pt
- Line spacing 1.5
- Margin Top/Bottom 20mm, Left 30mm, Right 15mm

Nếu parse được từ docx — verify; nếu không — skip.

---

## Finding format

```yaml
- id: F-NNN
  severity: minor | major
  check: formal
  section: "2.1"
  issue: "Numbering dùng 'I.' thay vì '1.' — không chuẩn NĐ 30"
  fix: "Đổi 'I. CƠ SỞ PHÁP LÝ' → '2. Cơ sở pháp lý'"
```
