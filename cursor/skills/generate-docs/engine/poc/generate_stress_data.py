#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate a stress-test content-data.json simulating a ~30-feature, 3-service project.

Target: produce a .docx of roughly 30-50 pages when filled, exercising:
  - long feature descriptions
  - many steps per feature
  - tables (UI elements, dialogs, error cases)
  - image placeholder paths (most will be missing → placeholder notes)
"""
import json
from pathlib import Path

SERVICES = [
    ("tac-nghiep", "Phân hệ Tác nghiệp",
     ["Tạo yêu cầu xử lý", "Xem danh sách yêu cầu", "Chi tiết yêu cầu",
      "Cập nhật yêu cầu", "Chuyển giao yêu cầu", "Phê duyệt yêu cầu",
      "Hủy yêu cầu", "Báo cáo tổng hợp yêu cầu", "Xuất Excel danh sách",
      "Lọc yêu cầu theo trạng thái"]),
    ("van-thu", "Phân hệ Văn thư",
     ["Tạo văn bản đến", "Danh sách văn bản đến", "Xem chi tiết văn bản",
      "Phân phối văn bản", "Tạo văn bản đi", "Ký số văn bản",
      "Gửi văn bản qua LGSP", "Tra cứu văn bản",
      "Báo cáo văn bản đi", "Báo cáo văn bản đến"]),
    ("quan-tri", "Phân hệ Quản trị",
     ["Quản lý người dùng", "Thêm người dùng mới", "Cập nhật người dùng",
      "Khóa/mở khóa tài khoản", "Phân quyền người dùng",
      "Quản lý vai trò", "Cấu hình hệ thống", "Nhật ký hệ thống",
      "Sao lưu dữ liệu", "Khôi phục dữ liệu"]),
]

ACTORS_POOL = [
    ["Cán bộ thụ lý"],
    ["Trưởng phòng", "Phó phòng"],
    ["Quản trị viên"],
    ["Cán bộ văn thư"],
]


def make_feature(fid: str, name: str, svc_slug: str, actor_idx: int) -> dict:
    actors = ACTORS_POOL[actor_idx % len(ACTORS_POOL)]
    return {
        "id": fid,
        "name": name,
        "description": (
            f"{name} cho phép người dùng thực hiện thao tác trực tiếp trên giao diện web. "
            f"Chức năng này là một phần của {svc_slug} và được thiết kế để đáp ứng nhu cầu "
            f"nghiệp vụ hàng ngày. Người dùng có thể truy cập qua menu chính hoặc đường dẫn "
            f"trực tiếp."
        ),
        "actors": actors,
        "preconditions": "Đã đăng nhập với quyền phù hợp",
        "ui_elements": [
            {"label": "Tiêu đề", "type": "Input (text)", "rules": "Bắt buộc, tối đa 200 ký tự"},
            {"label": "Mô tả", "type": "Textarea", "rules": "Tùy chọn, tối đa 1000 ký tự"},
            {"label": "Mức độ", "type": "Dropdown", "rules": "Bắt buộc, 4 giá trị: Thấp/TB/Cao/Khẩn"},
            {"label": "Ngày hết hạn", "type": "Date picker", "rules": "Phải lớn hơn ngày hiện tại"},
            {"label": "Nút Lưu", "type": "Button (primary)", "rules": "Enable khi form valid"},
            {"label": "Nút Hủy", "type": "Button (secondary)", "rules": "Luôn enable"},
        ],
        "steps": [
            {"no": 1, "action": f"Truy cập menu {svc_slug} > {name}",
             "screenshot": f"{fid}-step-01-initial.png",
             "expected": "Màn hình hiển thị đúng tiêu đề và form nhập liệu"},
            {"no": 2, "action": "Điền đầy đủ các trường bắt buộc",
             "screenshot": f"{fid}-step-02-filled.png",
             "expected": "Các trường nhận giá trị, không hiển thị lỗi validation"},
            {"no": 3, "action": "Click nút Lưu",
             "screenshot": f"{fid}-step-03-success.png",
             "expected": "Hiển thị toast thành công, chuyển hướng về danh sách"},
            {"no": 4, "action": "Kiểm tra bản ghi vừa tạo trong danh sách",
             "expected": "Bản ghi xuất hiện ở đầu danh sách với trạng thái mới"},
        ],
        "dialogs": [
            {
                "title": "Xác nhận lưu",
                "components": [
                    {"name": "Nút Đồng ý", "description": "Xác nhận lưu, gọi API, đóng dialog"},
                    {"name": "Nút Hủy bỏ", "description": "Đóng dialog, giữ form data"},
                ],
            }
        ],
        "error_cases": [
            {"trigger_step": 2, "condition": "Trường bắt buộc rỗng",
             "message": "Hệ thống hiển thị lỗi 'Trường này bắt buộc' dưới ô tương ứng"},
            {"trigger_step": 3, "condition": "Mất kết nối mạng",
             "message": "Toast đỏ 'Lỗi kết nối. Vui lòng thử lại sau'"},
            {"trigger_step": 3, "condition": "Không có quyền tạo",
             "message": "Toast đỏ '403 Forbidden'. Chuyển về trang danh sách"},
        ],
    }


def main():
    services = []
    feat_counter = 0
    for svc_idx, (slug, display_name, features) in enumerate(SERVICES):
        feat_objs = []
        for i, feat_name in enumerate(features):
            feat_counter += 1
            fid = f"F-{feat_counter:03d}"
            feat_objs.append(make_feature(fid, feat_name, display_name, svc_idx))
        services.append({
            "slug": slug,
            "display_name": display_name,
            "features": feat_objs,
        })

    data = {
        "project": {
            "display_name": "Hệ thống Quản lý Tác nghiệp",
            "code": "QLTN-2026",
            "client": "Bộ Tài Chính",
        },
        "dev_unit": "Công ty CP Hệ thống Công nghệ ETC",
        "meta": {
            "today": "18/04/2026",
            "version": "1.0",
        },
        "overview": {
            "purpose": (
                "Tài liệu này hướng dẫn chi tiết cách sử dụng các chức năng của hệ thống "
                "Quản lý Tác nghiệp. Nội dung trình bày theo trình tự từng chức năng với "
                "hình ảnh minh họa và các bước thực hiện cụ thể. Tài liệu áp dụng cho "
                "phiên bản 1.0 của phần mềm."
            ),
            "scope": (
                "Tài liệu này áp dụng cho hệ thống Quản lý Tác nghiệp với ba phân hệ chính: "
                "Phân hệ Tác nghiệp, Phân hệ Văn thư và Phân hệ Quản trị. Đối tượng sử dụng "
                "bao gồm cán bộ thụ lý, trưởng/phó phòng, cán bộ văn thư và quản trị viên "
                "hệ thống. Mỗi vai trò có quyền truy cập các chức năng theo phân quyền được "
                "quản trị viên cấu hình."
            ),
            "system_description": (
                "Hệ thống Quản lý Tác nghiệp là nền tảng số hóa quy trình tác nghiệp nội bộ, "
                "giúp nâng cao hiệu quả xử lý công việc, quản lý văn bản và phân quyền người dùng."
            ),
            "conventions": (
                "Các quy tắc hiển thị: Trường bắt buộc đánh dấu * đỏ. Thông báo lỗi hiển thị "
                "màu đỏ, thông báo thành công màu xanh. Định dạng ngày dd/mm/yyyy. "
                "Yêu cầu tối thiểu: trình duyệt Chrome/Firefox/Edge phiên bản mới nhất."
            ),
            "terms": [
                {"short": "HDSD", "full": "Hướng dẫn sử dụng",
                 "explanation": "Tài liệu mô tả cách thao tác phần mềm"},
                {"short": "UI", "full": "User Interface",
                 "explanation": "Giao diện người dùng"},
                {"short": "API", "full": "Application Programming Interface",
                 "explanation": "Giao diện lập trình ứng dụng"},
                {"short": "JWT", "full": "JSON Web Token",
                 "explanation": "Chuẩn mã thông báo truy cập"},
                {"short": "LGSP", "full": "Nền tảng Kết nối Liên thông",
                 "explanation": "Hạ tầng kết nối liên thông quốc gia"},
            ],
            "references": [
                {"stt": "1", "name": "Thiết kế cơ sở hệ thống", "ref": "TKCS-QLTN-v1.0"},
                {"stt": "2", "name": "Catalog chức năng", "ref": "CAT-QLTN-v1.0"},
                {"stt": "3", "name": "Bộ test case", "ref": "BTC-QLTN-v1.0"},
            ],
        },
        "services": services,
        "troubleshooting": [
            {"situation": "Không đăng nhập được",
             "cause": "Sai mật khẩu hoặc tài khoản bị khóa",
             "resolution": "Liên hệ QTV để reset mật khẩu hoặc mở khóa tài khoản"},
            {"situation": "Session hết hạn",
             "cause": "Token JWT đã expired sau 15 phút",
             "resolution": "Đăng nhập lại"},
            {"situation": "Không hiển thị dữ liệu",
             "cause": "Không có quyền truy cập hoặc filter chưa đúng",
             "resolution": "Kiểm tra vai trò người dùng và điều kiện lọc"},
            {"situation": "Lỗi 500 Internal Server",
             "cause": "Backend lỗi hoặc database không phản hồi",
             "resolution": "Thử lại sau 1 phút; nếu vẫn lỗi báo bộ phận CNTT"},
            {"situation": "File tải lên vượt quá dung lượng",
             "cause": "File > 10MB không được chấp nhận",
             "resolution": "Nén file hoặc chia nhỏ trước khi tải lên"},
        ],
    }

    out_path = Path(__file__).parent / "stress-content-data.json"
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    total_feats = sum(len(s["features"]) for s in services)
    print(f"Wrote {out_path}")
    print(f"  Services: {len(services)}, Features total: {total_feats}")
    print(f"  JSON size: {out_path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
