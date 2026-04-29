# Văn phong hành chính Việt Nam

Reusable prompt chunk khi viết prose fields trong content-data.json.

**Usage**: `@Notepads hanh-chinh-vn-rules` trong Composer khi cần reminder.

---

## Core principles

- **Câu bị động, vô nhân xưng** — không "tôi/mình/chúng ta/các bạn"
- **Trang trọng, chính xác** — không colloquial, không emoji, không slang
- **Danh ngữ rõ ràng** — mỗi câu có subject cụ thể, không mơ hồ "hệ thống này", "chức năng đó"
- **Tránh lặp ý** — mỗi section không duplicate content với section khác

## Section structure

Mỗi prose section có 3 phần:
1. **Mở**: Căn cứ pháp lý / bối cảnh (1-2 câu)
2. **Thân**: Nội dung chính (điểm 1, 2, 3... có thứ tự)
3. **Kết**: Tóm tắt / dẫn tiếp sang section sau (1 câu)

## Từ ngữ

**Ưu tiên tiếng Việt**:
- "máy chủ" thay "server"
- "cơ sở dữ liệu" thay "database"
- "giao diện" thay "interface"
- "chức năng" thay "feature"
- "yêu cầu" thay "request"
- "thành phần" thay "component"

**Giữ nguyên tiếng Anh** (tên riêng, chuẩn):
- Tên sản phẩm: PostgreSQL, Next.js, Redis, Docker
- Chuẩn: ISO 27001, OWASP, RFC 7519
- Đơn vị: GB, Mbps, MHz

## Cấu trúc mô tả

**Cho mỗi feature/function**:

> Chức năng [tên] cho phép [actor] thực hiện [mục đích]. Quy trình gồm [N] bước: (1)...; (2)...; (3)...

**Cho mỗi component**:

> Thành phần [tên] chịu trách nhiệm [nhiệm vụ chính], tương tác với [N components khác] thông qua [giao thức].

**Cho mỗi NFR**:

> Yêu cầu [tiêu chí] đòi hỏi [chỉ số cụ thể đo được]. Giải pháp kỹ thuật sử dụng [technology stack + pattern].

## Ví dụ

**Đúng**:
> Chức năng đăng nhập cho phép cán bộ xác thực danh tính bằng email và mật khẩu. Quy trình gồm 4 bước: (1) Truy cập trang đăng nhập; (2) Nhập email công vụ; (3) Nhập mật khẩu; (4) Xác nhận đăng nhập. Sau khi xác thực thành công, hệ thống cấp phiên làm việc (JWT token) có thời hạn 1 giờ.

**Sai**:
> Chỗ này là chỗ bạn đăng nhập. Bấm vào và enter thông tin rồi click submit là xong!

## Số liệu format

- Tiền: `XXX.XXX.XXX đồng` (dấu chấm phân tách hàng nghìn, hàng đơn vị là "đồng")
- Phần trăm: `XX,X%` (dấu phẩy thập phân)
- Ngày prose: `ngày dd tháng mm năm yyyy`
- Ngày trong bảng: `dd/mm/yyyy`
- Thời gian: `hh:mm:ss dd/mm/yyyy`
