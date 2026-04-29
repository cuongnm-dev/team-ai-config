#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Add architecture + tkcs blocks to existing stress-content-data.json."""
import json
from pathlib import Path

BASE = Path(__file__).parent / "stress-content-data.json"
data = json.loads(BASE.read_text(encoding="utf-8"))

# Architecture block
data["architecture"] = {
    "purpose": "Tài liệu thiết kế kiến trúc mô tả các quyết định kiến trúc, cấu trúc thành phần và nguyên tắc thiết kế áp dụng cho hệ thống Quản lý Tác nghiệp.",
    "scope": "Áp dụng cho phiên bản 1.0, bao gồm toàn bộ các phân hệ và dịch vụ hỗ trợ. Đối tượng đọc: kiến trúc sư, lập trình viên, quản trị hệ thống, đội vận hành.",
    "system_overview": "Hệ thống Quản lý Tác nghiệp là nền tảng web 3 lớp (web - api - db), thiết kế microservice với 3 phân hệ độc lập giao tiếp qua REST API, dùng chung hạ tầng xác thực JWT và cache Redis.",
    "scope_description": "Kiến trúc bao gồm 3 services (api, web, worker), 1 DB PostgreSQL, 1 cache Redis, reverse proxy Nginx và stack giám sát Prometheus.",
    "tech_stack": [
        {"layer": "Frontend", "technology": "Next.js", "version": "15.x", "role": "Server components + App Router"},
        {"layer": "Backend", "technology": "NestJS", "version": "10.x", "role": "REST API + validation + DI"},
        {"layer": "Database", "technology": "PostgreSQL", "version": "16", "role": "Primary OLTP store"},
        {"layer": "Cache", "technology": "Redis", "version": "7", "role": "Session + rate limit"},
        {"layer": "Reverse Proxy", "technology": "Nginx", "version": "1.25", "role": "Ingress + TLS termination"},
        {"layer": "Monitoring", "technology": "Prometheus + Grafana", "version": "-", "role": "Metrics + dashboards"},
    ],
    "logical_description": "Kiến trúc chia 3 lớp: Presentation (Next.js), Application (NestJS REST), Data (PostgreSQL). Các controller tuân thủ mô hình Controller→Service→Repository.",
    "components": [
        {"name": "auth-service", "type": "NestJS module", "description": "Xác thực JWT, refresh token, rate limiting"},
        {"name": "tacnghiep-service", "type": "NestJS module", "description": "Nghiệp vụ tạo + phê duyệt yêu cầu tác nghiệp"},
        {"name": "vanthu-service", "type": "NestJS module", "description": "Quản lý văn bản đến/đi, ký số"},
        {"name": "quantri-service", "type": "NestJS module", "description": "Quản lý người dùng, vai trò, cấu hình"},
        {"name": "web-ui", "type": "Next.js app", "description": "Giao diện web cho người dùng cuối"},
        {"name": "notification-worker", "type": "Background job", "description": "Gửi email + push notification qua queue"},
    ],
    "interaction_description": "Web UI → Nginx → API NestJS (JWT check) → Service layer → Repository → PostgreSQL. Redis cache user session + rate-limit counter. Background worker tiêu thụ queue BullMQ để gửi thông báo.",
    "data_description": "Mô hình dữ liệu trực tiếp (không event sourcing), chuẩn hóa 3NF. Soft-delete cho audit trail. Timestamps audit (created_at, updated_at, deleted_at) cho mọi bảng chính.",
    "data_entities": [
        {"name": "users", "purpose": "Tài khoản người dùng + profile", "storage_type": "PostgreSQL"},
        {"name": "roles + permissions", "purpose": "RBAC định nghĩa vai trò và quyền hạn", "storage_type": "PostgreSQL"},
        {"name": "tac_nghiep_requests", "purpose": "Yêu cầu tác nghiệp với trạng thái workflow", "storage_type": "PostgreSQL"},
        {"name": "van_ban", "purpose": "Văn bản đến/đi, đính kèm file", "storage_type": "PostgreSQL"},
        {"name": "audit_logs", "purpose": "Nhật ký hoạt động người dùng", "storage_type": "PostgreSQL (partitioned monthly)"},
        {"name": "session cache", "purpose": "Active session + JWT blacklist", "storage_type": "Redis"},
    ],
    "integration_description": "REST API là giao diện chính giữa client và server. JWT Bearer cho xác thực. Content-Type: application/json. API versioning qua URL prefix /api/v1.",
    "apis": [
        {"path": "/api/v1/auth/login", "method": "POST", "description": "Đăng nhập, trả về access + refresh token", "auth": "Không"},
        {"path": "/api/v1/auth/refresh", "method": "POST", "description": "Làm mới access token", "auth": "Refresh token"},
        {"path": "/api/v1/requests", "method": "GET", "description": "Lấy danh sách yêu cầu theo phân quyền", "auth": "JWT"},
        {"path": "/api/v1/requests", "method": "POST", "description": "Tạo yêu cầu mới", "auth": "JWT + role:user"},
        {"path": "/api/v1/requests/:id/approve", "method": "POST", "description": "Phê duyệt yêu cầu", "auth": "JWT + role:manager"},
        {"path": "/api/v1/vanban", "method": "GET", "description": "Danh sách văn bản", "auth": "JWT"},
        {"path": "/api/v1/users", "method": "GET", "description": "Quản lý người dùng (admin)", "auth": "JWT + role:admin"},
    ],
    "external_integrations": [
        {"system": "LGSP", "protocol": "SOAP/REST qua WSO2", "purpose": "Gửi văn bản liên thông quốc gia"},
        {"system": "SMTP Server", "protocol": "SMTP over TLS", "purpose": "Gửi email thông báo"},
        {"system": "HSM Hardware", "protocol": "PKCS#11", "purpose": "Ký số văn bản điện tử"},
    ],
    "deployment_description": "Triển khai Docker Compose cho dev, Kubernetes cho production. Mỗi service là 1 image, dùng volume cho DB data + uploaded files.",
    "environments": [
        {"name": "Development", "infrastructure": "Docker Compose trên máy dev", "purpose": "Local testing"},
        {"name": "Staging", "infrastructure": "Kubernetes (1 node)", "purpose": "UAT + integration testing"},
        {"name": "Production", "infrastructure": "Kubernetes cluster (3 nodes)", "purpose": "Môi trường vận hành chính thức"},
    ],
    "containers": [
        {"name": "api", "image": "qltn/api:1.0", "port": "3000", "depends_on": ["db", "cache"]},
        {"name": "web", "image": "qltn/web:1.0", "port": "80", "depends_on": ["api"]},
        {"name": "worker", "image": "qltn/worker:1.0", "port": None, "depends_on": ["cache", "db"]},
        {"name": "db", "image": "postgres:16-alpine", "port": "5432", "depends_on": []},
        {"name": "cache", "image": "redis:7-alpine", "port": "6379", "depends_on": []},
        {"name": "nginx", "image": "nginx:1.25-alpine", "port": "80/443", "depends_on": ["api", "web"]},
    ],
    "security_description": "Thiết kế bảo mật theo chiều sâu (defense in depth): TLS termination tại Nginx, JWT với short TTL + refresh rotation, RBAC chi tiết cho mỗi endpoint, audit log mọi hành động nghiệp vụ.",
    "auth_description": "Xác thực qua JWT Bearer token, access token TTL 15 phút, refresh token TTL 7 ngày. Phân quyền RBAC 3 cấp: Admin → Manager → User. Mỗi endpoint có decorator @Roles(...) để kiểm tra.",
    "data_protection": "Dữ liệu nhạy cảm (mật khẩu, token) hash bằng Argon2id. TLS 1.3 cho mọi kết nối HTTPS. Backup DB hàng ngày, retention 30 ngày. Tuân thủ NĐ 13/2023 về bảo vệ dữ liệu cá nhân.",
    "nfr": [
        {"criterion": "Hiệu năng", "requirement": "API p95 < 500ms cho 100 concurrent users", "solution": "Redis cache + DB index tối ưu"},
        {"criterion": "Tính sẵn sàng", "requirement": "Uptime 99.5% trong giờ hành chính", "solution": "Kubernetes + health check + auto-restart"},
        {"criterion": "Khả năng mở rộng", "requirement": "Scale horizontal 2x trong 5 phút", "solution": "Stateless services + K8s HPA"},
        {"criterion": "Bảo mật", "requirement": "ATTT cấp độ 3 theo TT 03/2017/TT-BTTTT", "solution": "JWT + RBAC + audit log + WAF"},
        {"criterion": "Khả năng phục hồi", "requirement": "RPO ≤ 24h, RTO ≤ 4h", "solution": "Daily backup + disaster recovery site"},
    ],
}

# TKCS block
data["tkcs"] = {
    "technology_rationale": (
        "Hệ thống chọn stack Next.js + NestJS + PostgreSQL dựa trên: "
        "(1) Đội ngũ ETC có kinh nghiệm >3 năm với Node.js ecosystem; "
        "(2) Next.js hỗ trợ SSR + SEO tốt cho module công khai; "
        "(3) NestJS kiến trúc modular, dễ maintain cho hệ thống ≥30 chức năng; "
        "(4) PostgreSQL open-source, ACID, hỗ trợ tốt JSON + full-text search. "
        "So sánh với Java/Spring: Node.js cho developer productivity cao hơn. "
        "So sánh với .NET: chi phí license thấp hơn, đáp ứng tiêu chí OSS ưu tiên."
    ),
    "detailed_design_summary": (
        "Thiết kế chi tiết tham chiếu Tài liệu Thiết kế Kiến trúc "
        "(thiet-ke-kien-truc.docx) sinh cùng lần chạy này. Bao gồm: 3 phân hệ "
        "(Tác nghiệp, Văn thư, Quản trị) với tổng 30 chức năng, 6 API endpoints chính, "
        "6 thành phần kiến trúc (auth, tacnghiep, vanthu, quantri, web-ui, worker)."
    ),
}

BASE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Extended {BASE}")
print(f"  Architecture components: {len(data['architecture']['components'])}")
print(f"  APIs: {len(data['architecture']['apis'])}")
print(f"  NFR criteria: {len(data['architecture']['nfr'])}")
print(f"  Tech stack layers: {len(data['architecture']['tech_stack'])}")
