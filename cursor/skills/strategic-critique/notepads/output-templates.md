# Output templates — findings YAML + comments md + summary

Loaded on demand by `strategic-critique/SKILL.md` Step 3-4.

---

## `critique-findings.yaml` schema (machine-readable)

```yaml
critique:
  document: "De-an-CDS-So-X-v0.3.docx"
  total-findings: 47
  severity-distribution:
    blocker: 3
    major: 12
    minor: 24
    info: 8
  coverage:
    sections-reviewed: [1, 2, 3, 4, 5, 6, 7]
    checks-applied: [formal, substantive, coherence, alignment, dedup, feasibility, legal]

findings:
  - id: F-001
    severity: blocker
    check: substantive
    section: "3.2"
    excerpt: "Hệ thống hiện tại tương đối lạc hậu, cần được nâng cấp toàn diện..."
    issue: |
      Vague — "tương đối lạc hậu" không phải đánh giá có số liệu.
      Thẩm định sẽ hỏi: lạc hậu ở điểm nào? bao nhiêu năm tuổi?
      performance metric cụ thể?
    why-blocker: |
      Section 3 (Hiện trạng) phải có số liệu deterministic để justify
      necessity. "Tương đối" không defensible khi challenge.
    fix-recommendation: |
      Thay bằng số liệu cụ thể:
      - "Hệ thống A triển khai từ 2014, xuống cấp X% uptime năm 2025"
      - "Chức năng B không support mobile (50% requests hiện tại)"
      - "Database C 150GB, query p95 > 3s"

  - id: F-002
    severity: major
    check: dedup
    section: "5.3"
    excerpt: "Xây dựng Hệ thống xác thực tập trung..."
    issue: |
      Đề án đề xuất build authentication service.
      Trong khi đó NDXP đã có Dịch vụ xác thực điện tử quốc gia
      (VNeID/VNID + SSO), bắt buộc tích hợp theo CT 34 NT6.
    why-major: |
      Build lại = vi phạm nguyên tắc "dùng nền tảng dùng chung" (CT 34).
      Thẩm định sẽ yêu cầu reuse, có thể downgrade budget section này.
    fix-recommendation: |
      Đổi "xây dựng" → "tích hợp với Dịch vụ xác thực NDXP".
      cite: CT 34/CT-TTg NT6, QĐ 749 về hạ tầng dùng chung.
      reference: https://ndxp.gov.vn

  - id: F-003
    severity: major
    check: legal
    section: "2.1"
    excerpt: "Căn cứ Nghị định 73/2019/NĐ-CP..."
    issue: |
      NĐ 73/2019 ĐÃ BỊ THAY THẾ bởi NĐ 45/2026/NĐ-CP.
    why-major: |
      Legal ref invalid = Đề án base trên văn bản hết hiệu lực.
      Thẩm định reject automatically.
    fix-recommendation: |
      Thay bằng: "Căn cứ Nghị định số 45/2026/NĐ-CP ngày... của Chính phủ
      về quản lý đầu tư ứng dụng CNTT sử dụng NSNN".

  - id: F-004
    severity: minor
    check: vague
    section: "4.1"
    excerpt: "...sẽ được triển khai từng bước trong thời gian tới..."
    issue: |
      "Từng bước" + "thời gian tới" = hai vague phrase cạnh nhau.
      Không commit timeline cụ thể.
    fix-recommendation: |
      "Triển khai theo 3 giai đoạn: Q1/2026 (pilot), Q2-Q3/2026 (rollout 50% đơn vị), Q4/2026 (100%)"

summary:
  strongest-sections: [6, 7]
  weakest-sections: [3, 5]
  overall-verdict: |
    Đề án có structure đúng (outline NĐ 30 OK), legal framework cũ cần cập nhật
    (3 văn bản đã bị thay), phần substance còn nhiều "tương đối" - cần data thật.
    DEDUP missed 2 chỗ quan trọng (auth + report engine).
    Ước tính thẩm định sẽ raise 15-20 findings tương tự, cần 1-2 vòng sửa.
```

---

## `critique-comments.md` format (researcher-friendly side-by-side)

```markdown
# Critique Comments — {filename}

## Section 3.2 (line 245)

> Hệ thống hiện tại tương đối lạc hậu, cần được nâng cấp toàn diện để đáp ứng
> yêu cầu chuyển đổi số.

**🔴 BLOCKER — F-001 (substantive)**: "Tương đối lạc hậu" vague. Thẩm định sẽ hỏi:
lạc hậu thế nào? Metric cụ thể?

**Fix**:
> Hệ thống A được triển khai từ 2014 (12 năm tuổi), chạy trên .NET Framework 4.5
> (EOL 2026), uptime 2025 chỉ đạt 94.2%, không hỗ trợ mobile trong khi 50%
> request hiện tại đến từ mobile. Database Oracle 11g (EOL 2022) không còn
> được vendor hỗ trợ, query p95 > 3s tại giờ cao điểm.

---

## Section 5.3 (line 421)

> Xây dựng Hệ thống xác thực tập trung phục vụ nội bộ...

**🟠 MAJOR — F-002 (dedup)**: Build auth service trùng với Dịch vụ xác thực
quốc gia NDXP (VNeID). CT 34 NT6 yêu cầu reuse.

**Fix**:
> Tích hợp với Dịch vụ xác thực quốc gia NDXP (VNeID/VNID) theo CT 34/CT-TTg
> nguyên tắc 6. Liên hệ Trung tâm Dữ liệu quốc gia (C06 Bộ Công an) để đăng ký
> kết nối. Không xây dựng hệ thống xác thực riêng.
```

---

## `critique-summary.md` (cho leadership) — 1 page

- Verdict tổng (pass / conditional pass / major revision needed / reject)
- Top 3 risks
- Ước tính effort fix: X giờ / Y vòng
- Recommendation: nộp thẩm định được chưa, hay cần vòng nữa

---

## Console output format (Step 4 ranked summary)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔍 STRATEGIC CRITIQUE — De-an-CDS-So-X-v0.3.docx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  47 findings: 3 blocker | 12 major | 24 minor | 8 info

  Top 3 blockers:
  1. [F-001] Section 3.2 — Vague current-state assessment
  2. [F-003] Section 2.1 — NĐ 73/2019 hết hiệu lực
  3. [F-015] Section 6.2 — Budget mismatched với TT 04/2020 formula

  Top 3 major DEDUP misses:
  1. [F-002] 5.3 — Auth service đã có NDXP
  2. [F-011] 5.5 — Report engine đã có LGSP
  3. [F-018] 5.7 — OCR service đã có Gov Cloud

  Weakest sections: 3 (Hiện trạng), 5 (Giải pháp)
  Strongest sections: 6 (Kinh phí), 7 (Tiến độ)

  📄 Full findings: <output-path>/critique-findings.yaml
  📝 Inline comments: <output-path>/critique-comments.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
