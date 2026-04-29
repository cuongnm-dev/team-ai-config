# Rubric 05 — DEDUP Check (Unique Differentiator)

**Goal**: Detect đề xuất giải pháp trùng với **nền tảng dùng chung** quốc gia đã có. Vi phạm CT 34/CT-TTg nguyên tắc 6 = thẩm định downgrade.

---

## Catalog nền tảng quốc gia (2026 hiện hành)

### NDXP — Nền tảng tích hợp chia sẻ dữ liệu quốc gia

**Chủ quản**: Bộ Khoa học và Công nghệ (trước: Bộ TT&TT)

**Dịch vụ sẵn có (44 services, ví dụ):**
- `ndxp.auth` — Xác thực người dùng (thay thế build auth riêng)
- `ndxp.esign` — Ký số điện tử (thay thế build signature service)
- `ndxp.sms` — Gửi SMS OTP
- `ndxp.email` — Gửi email giao dịch
- `ndxp.payment` — Thanh toán điện tử (thay thế integrate VNPAY/ZaloPay riêng)
- `ndxp.notification` — Push notification
- `ndxp.workflow` — BPM engine
- `ndxp.forms` — Form builder
- `ndxp.report` — Report engine
- `ndxp.file-storage` — File storage với metadata
- ... (44 services, xem ndxp.gov.vn)

**DEDUP pattern**: Nếu Đề án đề xuất "xây dựng hệ thống X" mà X có trong catalog → major finding.

### CSDLQG — Cơ sở dữ liệu quốc gia

**6 CSDLQG chính:**
- CSDLQG về **Dân cư** (C06 Bộ Công an) — 100M+ records, VNeID, VNID
- CSDLQG về **Đất đai** (Bộ Tài nguyên & Môi trường)
- CSDLQG về **Bảo hiểm** (BHXH Việt Nam)
- CSDLQG về **Đăng ký doanh nghiệp** (Bộ Kế hoạch & Đầu tư)
- CSDLQG về **Tài chính** (Bộ Tài chính)
- CSDLQG về **Cán bộ, Công chức** (Bộ Nội vụ)

**DEDUP pattern**: Nếu đơn vị build DB dân cư/đất đai/BHYT/đăng ký DN riêng → reject, phải tích hợp CSDLQG.

### LGSP — Local Government Service Platform

**Dịch vụ cấp tỉnh/thành phố:**
- Auth service (SSO cấp tỉnh)
- Document management (văn thư điện tử)
- One-stop service (dịch vụ công một cửa)
- Citizen portal
- Integration gateway với NDXP

**DEDUP pattern**: Build document management / citizen portal mà tỉnh đã có LGSP → reject.

### Gov Cloud

**Providers chính:**
- **VNPT Gov Cloud** (approved 2020)
- **Viettel Gov Cloud** (approved 2021)
- **FPT Cloud for Gov** (approved 2023)
- **CMC Cloud** (approved 2024)

**Dịch vụ cloud:**
- Compute (VM, container)
- Object storage (S3-compat)
- Database-as-a-service (PostgreSQL, MySQL, MongoDB managed)
- Kubernetes managed
- Backup/DR

**DEDUP pattern**: Build datacenter riêng / on-premise cho workload không có yêu cầu data sovereignty đặc biệt → cost inefficient, thẩm định challenge.

### SSO / Identity

- **VNeID** — Ứng dụng định danh điện tử quốc gia (C06 Bộ Công an)
- **VNID** — Tài khoản định danh điện tử mức 1/2
- **SSO Chính phủ** — One-login cho CBCCVC
- **CCCD gắn chip** — QR code verify

**DEDUP pattern**: Bất kỳ đề xuất "hệ thống đăng nhập", "user management", "định danh người dùng" → phải integrate VNeID, không build riêng.

---

## Detection keywords (agent scan)

Agent scan Section 5 (Giải pháp) + Section 6 (Kinh phí) cho keywords sau. Mỗi match = candidate DEDUP miss.

### Build auth keywords
- "xây dựng hệ thống xác thực", "build authentication", "module đăng nhập"
- "quản lý người dùng", "user management system"
- "định danh điện tử", "digital identity"
- → DEDUP với **VNeID / VNID / NDXP auth**

### Build payment keywords
- "cổng thanh toán", "payment gateway"
- "tích hợp VNPAY/ZaloPay/Momo" (riêng lẻ thay vì qua NDXP)
- → DEDUP với **NDXP payment**

### Build signature keywords
- "ký số điện tử", "digital signature"
- "CA riêng", "build PKI"
- → DEDUP với **NDXP esign**

### Build storage keywords
- "file storage system", "hệ thống lưu trữ tài liệu"
- "DMS", "document management" (nếu cấp tỉnh đã có LGSP)
- → DEDUP với **LGSP DMS / NDXP file-storage**

### Build datacenter keywords
- "xây dựng datacenter", "trung tâm dữ liệu"
- "máy chủ vật lý", "on-premise infrastructure"
- → Check: data có sovereignty requirement không? Nếu không → DEDUP với **Gov Cloud**

### Build population DB keywords
- "CSDL dân cư đơn vị", "database công dân"
- "hồ sơ công dân"
- → **Hard block** — BẮT BUỘC tích hợp CSDLQG Dân cư (C06)

---

## Exception patterns (NOT DEDUP)

Không flag các case sau:

- **"Tích hợp với NDXP để..."** — đang reuse, OK
- **"Kế thừa hạ tầng LGSP tỉnh..."** — đang reuse, OK
- **"Build internal tool cho team IT..."** — không phải dịch vụ công, OK
- **Data đặc thù không có trong CSDLQG** — vd. data nghiệp vụ chuyên ngành (BHYT đặc thù ngoài CSDLQG BH), OK với justification

---

## Finding emission format

```yaml
- id: F-NNN
  severity: major
  check: dedup
  section: "5.3"
  excerpt: "Xây dựng Hệ thống xác thực tập trung..."
  detected-keyword: "hệ thống xác thực"
  dedup-candidate:
    platform: "NDXP"
    service: "ndxp.auth + VNeID"
    authority: "Bộ KHCN + C06"
    url: "https://ndxp.gov.vn/dichvu/xac-thuc"
  issue: |
    Proposed solution trùng với dịch vụ xác thực quốc gia NDXP/VNeID.
    CT 34/CT-TTg nguyên tắc 6 yêu cầu reuse nền tảng dùng chung.
  why-major: |
    Build auth riêng = vi phạm nguyên tắc dùng chung,
    thẩm định có thẩm quyền downgrade budget section này.
    Ngoài ra tạo redundancy maintain dài hạn.
  fix-recommendation: |
    Đổi "Xây dựng hệ thống xác thực" → "Tích hợp với Dịch vụ xác thực quốc gia
    NDXP và VNeID theo CT 34/CT-TTg nguyên tắc 6. Liên hệ Trung tâm
    Dữ liệu quốc gia để đăng ký kết nối (thời gian dự kiến [X tuần])."
    budget: giảm [Y triệu] cho auth module.
```

---

## Output: DEDUP summary table

Ngoài findings individual, emit summary:

```yaml
dedup-summary:
  total-solutions-proposed: 12
  dedup-misses: 4
  misses:
    - solution: "Xây dựng hệ thống xác thực"
      should-use: "VNeID + NDXP auth"
      budget-impact: "-500M VND"
    - solution: "Build payment gateway"
      should-use: "NDXP payment"
      budget-impact: "-300M VND"
    - solution: "Build file storage"
      should-use: "LGSP DMS"
      budget-impact: "-200M VND"
    - solution: "Datacenter on-premise"
      should-use: "VNPT Gov Cloud"
      budget-impact: "-1.5B VND (5-year TCO)"
  total-budget-impact-if-dedup: "-2.5B VND"
  ct34-principle-6-violations: 4
```

Budget impact give leadership concrete number → motivate fix.
