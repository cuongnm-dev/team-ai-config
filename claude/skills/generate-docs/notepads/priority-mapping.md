# Test Case Priority Mapping

Reusable prompt chunk — cho `test_cases.*.priority` field.

**Usage**: `@Notepads priority-mapping` khi viết xlsx test cases.

---

## 4 values hợp lệ (VN enum)

```
"Rất cao"       → Critical  / P1 / Blocker
"Cao"           → Major     / P2 / High
"Trung bình"    → Normal    / P3 / Medium
"Thấp"          → Minor     / P4 / Low
```

**KHÔNG** dùng tiếng Anh hoặc P1/P2/P3/P4 trong content-data.json. Fill engine chỉ chấp nhận 4 VN strings trên.

## Decision matrix — chọn priority như thế nào

### "Rất cao" (Critical)

Áp dụng khi TC:
- Smoke test — blocker path, nếu fail thì không test được các TC khác
- Security — auth/authorization, SQL injection, XSS
- Data integrity — tạo/sửa/xóa dữ liệu cốt lõi
- Legal/compliance — PII, audit log, NĐ 13/2023

Ví dụ:
- `TC-001: Đăng nhập thành công với credentials hợp lệ`
- `TC-002: User thường KHÔNG truy cập được admin endpoints`
- `TC-003: Tạo hồ sơ với dữ liệu đầy đủ → lưu DB thành công`

### "Cao" (Major)

Áp dụng khi TC:
- Core feature flow — 80% users sẽ thực hiện
- Validation input (required, format, length)
- Happy path cho mỗi API endpoint
- Permission check cho role chính

Ví dụ:
- `TC-011: Tiêu đề rỗng → hiển thị error "Bắt buộc"`
- `TC-012: Email sai format → validation error`
- `TC-013: Manager phê duyệt yêu cầu → status = "Đã duyệt"`

### "Trung bình" (Normal)

Áp dụng khi TC:
- Alternate flow — 20-50% users thực hiện
- Boundary conditions (max length, special chars)
- Secondary features (notification, export, filter)
- UI interactions (sort, paginate, collapse)

Ví dụ:
- `TC-021: Filter list theo trạng thái "Chờ duyệt"`
- `TC-022: Export danh sách ra Excel`
- `TC-023: Title dài đúng 200 ký tự (boundary)`

### "Thấp" (Minor)

Áp dụng khi TC:
- Edge case (< 5% users)
- Cosmetic — UI alignment, font size, color
- Performance edge (1000+ items pagination)
- Accessibility (screen reader, keyboard nav)

Ví dụ:
- `TC-031: Tooltip hiển thị khi hover nút help`
- `TC-032: Responsive layout trên mobile 320px width`
- `TC-033: Dark mode hiển thị đúng`

## Coverage distribution target

Cho 1 feature có ~10 TCs:
- 20-30% `Rất cao` (2-3 TCs)
- 40-50% `Cao` (4-5 TCs)
- 20-30% `Trung bình` (2-3 TCs)
- 0-10% `Thấp` (0-1 TCs)

Nếu 1 feature có 100% Rất cao → nghĩa là chưa phân loại đúng, xem lại.

## Common mistakes

❌ `"priority": "Critical"` — tiếng Anh, engine default "Trung bình"
❌ `"priority": "Rat cao"` — sai dấu, engine default "Trung bình"
❌ `"priority": "P1"` — ký hiệu, không được
❌ `"priority": "Rất Cao"` — capitalize sai (chỉ cap chữ cái đầu từ đầu)
✅ `"priority": "Rất cao"` — đúng

## Check trước khi save

- [ ] Mọi TC đều có field `priority` (required)
- [ ] Value là 1 trong 4 VN strings chính xác
- [ ] Distribution reasonable (không 100% Rất cao)
- [ ] Mỗi feature có ≥ 1 TC Rất cao (smoke)
