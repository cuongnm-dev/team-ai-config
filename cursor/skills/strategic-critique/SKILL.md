---
name: strategic-critique
description: Đóng vai cán bộ thẩm định (Bộ/Tỉnh/Sở) phản biện ngược lại Đề án Chuyển đổi số bạn vừa viết — bắt các lỗi thường gặp: câu chữ mơ hồ, thiếu số liệu cụ thể, viện dẫn pháp lý sai, mâu thuẫn nội bộ, bỏ sót dùng chung hệ thống có sẵn, đề xuất bất khả thi. Dùng để rà chất lượng trước khi nộp.
---

# Strategic Critique — Adversarial Reviewer

**Output language**: Vietnamese for findings. English for agent instructions.

**Role**: This agent role-plays as a **Ministry/Province-level reviewer** reading the researcher's draft Đề án, finding issues that real reviewers will raise. Goal: the researcher fixes issues before submission — the AI does NOT write the document for them.

---

## When to use

| Situation | Use `/strategic-critique`? |
|---|---|
| Researcher just finished drafting Đề án | ✅ Yes |
| Researcher has no draft and wants AI to write | ❌ No — use `/new-strategic-document` (but output will be filler; see that skill's warning) |
| Preparing for submission | ✅ Critical — run 1-2 times to catch issues |
| Reviewer feedback received; want to verify all fixes applied | ✅ Re-run |

---

## Invocation

```
/strategic-critique <file-path>                   # critique entire document
/strategic-critique <file-path> --section 3,5     # only those sections
/strategic-critique <file-path> --severity blocker,major  # only severe issues
/strategic-critique <file-path> --check dedup,legal,vague # only specific checks
```

**Input formats**: `.docx`, `.md`, `.pdf` — Cursor injects via `@Files <path>`; document content arrives as text in Composer context.

---

## Workflow

### Step 1 — Parse document

```
@Files <file-path>
```

- `.docx` → `@Files <path>` — Cursor parses headings + paragraphs + tables natively. For scanned/image-heavy docs use `python -m docx2txt <path>` via terminal then `@Files <output.txt>`.
- `.md` → `@Files <path>` directly.
- `.pdf` → `@Files <path>` for text PDFs; for scanned PDFs run `pdftotext` or Tesseract OCR via terminal subprocess, then `@Files <output.txt>`.
- All inputs end up in Composer context for review-gated critique.

Normalize into structure:
```yaml
document:
  total_pages: 45
  sections:
    - number: "1"
      title: "Sự cần thiết và cơ sở xây dựng Đề án"
      start_line: 120
      end_line: 840
      word_count: 3200
      subsections: [...]
```

### Step 2 — Run 7 checks

Each check loads its rubric and applies:

1. **Formal check** — outline per NĐ 30, section numbering, table/figure format
2. **Substantive check** — concrete numbers, named entities, dated milestones
3. **Coherence check** — objectives ↔ problems ↔ solutions ↔ budget consistent
4. **Alignment check** — fits QĐ 749 KPIs, CT 34 nine principles
5. **DEDUP check** — does solution duplicate existing NDXP / LGSP / CSDLQG / Gov Cloud capabilities?
6. **Feasibility check** — timeline realistic, budget realistic vs TT 04/2020
7. **Legal ref validity** — cited documents still in force, articles cited correctly

Rubric details in `rubrics/*.md`.

### Step 3 — Produce findings YAML

```yaml
critique:
  document: "De-an-CDS-So-X-v0.3.docx"
  total_findings: 47
  severity_distribution:
    blocker: 3
    major: 12
    minor: 24
    info: 8
  coverage:
    sections_reviewed: [1, 2, 3, 4, 5, 6, 7]
    checks_applied: [formal, substantive, coherence, alignment, dedup, feasibility, legal]

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
    why_blocker: |
      Section 3 (Hiện trạng) phải có số liệu deterministic để justify
      necessity. "Tương đối" không defensible khi challenge.
    fix_recommendation: |
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
    why_major: |
      Build lại = vi phạm nguyên tắc "dùng nền tảng dùng chung" (CT 34).
      Thẩm định sẽ yêu cầu reuse, có thể downgrade budget section này.
    fix_recommendation: |
      Đổi "xây dựng" → "tích hợp với Dịch vụ xác thực NDXP".
      Cite: CT 34/CT-TTg NT6, QĐ 749 về hạ tầng dùng chung.
      Reference: https://ndxp.gov.vn

  - id: F-003
    severity: major
    check: legal
    section: "2.1"
    excerpt: "Căn cứ Nghị định 73/2019/NĐ-CP..."
    issue: |
      NĐ 73/2019 ĐÃ BỊ THAY THẾ bởi NĐ 45/2026/NĐ-CP.
    why_major: |
      Legal ref invalid = Đề án base trên văn bản hết hiệu lực.
      Thẩm định reject automatically.
    fix_recommendation: |
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
    fix_recommendation: |
      "Triển khai theo 3 giai đoạn: Q1/2026 (pilot), Q2-Q3/2026 (rollout 50% đơn vị), Q4/2026 (100%)"

summary:
  strongest_sections: [6, 7]  # budget + roadmap có số liệu tốt
  weakest_sections: [3, 5]    # hiện trạng + giải pháp vague nhiều
  overall_verdict: |
    Đề án có structure đúng (outline NĐ 30 OK), legal framework cũ cần cập nhật
    (3 văn bản đã bị thay), phần substance còn nhiều "tương đối" - cần data thật.
    DEDUP missed 2 chỗ quan trọng (auth + report engine).
    Ước tính thẩm định sẽ raise 15-20 findings tương tự, cần 1-2 vòng sửa.
```

### Step 4 — Display results

**Console output** (ranked by severity):
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

**Output files**:
- `critique-findings.yaml` — machine-readable
- `critique-comments.md` — side-by-side excerpt + comment (researcher dễ scan)
- `critique-summary.md` — 1-page executive summary cho leadership

---

## 7 rubrics

### 1. Formal check

Rubric: `rubrics/01-formal.md`

Check:
- Outline section numbering đúng NĐ 30 (1, 1.1, 1.1.1, a), -)
- Bảng/Hình `Bảng X.Y: Title` / `Hình X.Y: Title`, reset sequence per chapter
- Font / spacing / margin (nếu có metadata)
- Header structure (bìa, mục lục, nội dung, phụ lục)
- Font legal citations format

Severity: mostly minor, đôi khi major (thiếu mục lục = major)

### 2. Substantive check

Rubric: `rubrics/02-substantive.md`

Check: mỗi claim có **số liệu / tên đơn vị / ngày tháng / nguồn** support không.

Patterns flag:
- "tương đối", "khá", "đa số", "một số", "một phần"
- "nhiều", "ít", "hầu hết" (không số)
- "hiện đại", "lạc hậu" (không metric)
- "thời gian tới", "giai đoạn trước" (không năm cụ thể)
- Adjective without data: "mạnh mẽ", "đồng bộ", "toàn diện"

Severity: **blocker** ở Section 3 (Hiện trạng) + Section 6 (Kinh phí). **Major** chỗ khác.

### 3. Coherence check

Rubric: `rubrics/03-coherence.md`

Cross-section logic:
- Mỗi **problem** (S3) → có ít nhất 1 **objective** (S4) address
- Mỗi **objective** (S4) → có ít nhất 1 **solution** (S5)
- Mỗi **solution** (S5) → có **budget line** (S6) + **timeline** (S7)
- Numbers cited consistently (total budget S6 = sum of components)

Severity: blocker nếu contradiction, major nếu orphan (objective không được address).

### 4. Alignment check

Rubric: `rubrics/04-alignment.md`

Check fit với:
- **QĐ 749/QĐ-TTg** — 3 trụ cột (Chính phủ số, Kinh tế số, Xã hội số)
- **CT 34/CT-TTg** — 9 nguyên tắc
- **QĐ 06/QĐ-TTg** — nếu liên quan dân cư
- **QĐ 292/QĐ-BKHCN (2025)** — Khung Kiến trúc CPĐT 4.0 (nếu dự án cấp Bộ)

Severity: major nếu claim alignment nhưng không có evidence.

### 5. DEDUP check (unique differentiator)

Rubric: `rubrics/05-dedup.md`

Catalog ecosystem có sẵn:
- **NDXP** (Nền tảng tích hợp chia sẻ dữ liệu quốc gia): 44 dịch vụ
- **LGSP** (Local Government Service Platform): auth, notification, payment
- **CSDLQG** (CSDL quốc gia): dân cư, đất đai, bảo hiểm, doanh nghiệp, tài chính
- **Gov Cloud** (VNPT/Viettel): compute, storage, database-as-a-service
- **SSO quốc gia**: VNeID, VNID

Pattern flag: nếu proposed solution có từ khóa trùng catalog → dedup miss.

Severity: major (vi phạm CT 34 NT6).

### 6. Feasibility check

Rubric: `rubrics/06-feasibility.md`

Check:
- Timeline có realistic không (vd. implement HRIS cho 1000 cán bộ trong 3 tháng → unrealistic)
- Budget vs TT 04/2020 formula (man-hours × rate)
- Capacity: đơn vị có team IT đủ không (N cán bộ CNTT làm X modules?)
- Dependencies: phụ thuộc bên ngoài nào không control được (vd. phải chờ NDXP update API)

Severity: major khi timeline/budget off > 50% baseline.

### 7. Legal ref validity

Rubric: `rubrics/07-legal.md`

Check mỗi văn bản cited:
- Còn hiệu lực không (vd. NĐ 73/2019 đã bị NĐ 45/2026 thay)
- Điều khoản cited có đúng không (vd. "Điều 13 Nghị định 45" phải đúng nội dung Điều 13)
- Date format chuẩn: "ngày dd tháng mm năm yyyy"

Reference list văn bản 2026 hiện hành trong `rubrics/07-legal.md`.

Severity: **blocker** nếu cite văn bản đã bị thay.

---

## Output templates

### `critique-findings.yaml` schema

Đã show ở Step 3 trên.

### `critique-comments.md` format

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

### `critique-summary.md` (cho leadership)

1 page:
- Verdict tổng (pass / conditional pass / major revision needed / reject)
- Top 3 risks
- Ước tính effort fix: X giờ / Y vòng
- Recommendation: nộp thẩm định được chưa, hay cần vòng nữa

---

## Loop: critique → fix → re-critique

```
Round 1: /strategic-critique draft-v0.1.docx
         → 47 findings
         → Researcher fix → draft-v0.2.docx

Round 2: /strategic-critique draft-v0.2.docx
         → 18 findings (30 fixed)
         → Researcher fix → draft-v0.3.docx

Round 3: /strategic-critique draft-v0.3.docx
         → 5 findings (all minor)
         → ✅ Ready to submit
```

Mỗi round ~5-10 phút AI processing, so với thẩm định thật 2-4 tuần feedback → save 80%+ time.

---

## Differences vs `doc-reviewer` (existing)

| Aspect | `doc-reviewer` | `strategic-critique` (new) |
|---|---|---|
| Role | Quality reviewer | Adversarial thẩm định |
| Input | Draft section từ doc-writer | Full finished Đề án |
| Output | Findings YAML về format/legal | Findings về substance + dedup + feasibility |
| When | Trong pipeline, per-section | Sau pipeline, full document |
| Goal | Ensure quality within writing | Simulate real thẩm định review |

`doc-reviewer` = **formatter QA**. `strategic-critique` = **adversarial thẩm định**. Hai role khác nhau, không trùng.

---

## Limitations (honest)

1. **DEDUP catalog cần populate** — POC này dùng list cứng (NDXP, LGSP, CSDLQG, Gov Cloud). Real review cần KB updated quarterly.
2. **Số liệu benchmark** — AI không biết "budget CNTT cấp Sở 2025 trung bình X tỷ" nếu không có corpus. POC check formula TT 04/2020, không check mức "reasonable".
3. **Political context** — Thẩm định thật có political judgment (lãnh đạo nào thích cái gì, tỉnh/bộ đang push gì) — AI không có.
4. **Hallucination risk** — AI có thể "phát hiện" issue không thực sự là issue. Researcher nên treat output as **checklist gợi ý**, không phải verdict cuối.

→ Skill value = **catch obvious issues nhanh**. Human reviewer vẫn cần.

---

## Setup

Bundled rubrics trong `rubrics/`. Skill đọc từ `$HOME/.cursor/skills/strategic-critique/rubrics/`.

Không cần MCP, không cần container — pure LLM + file reading.

---

## What's next

Sau khi POC test:

1. Populate DEDUP catalog với real data NDXP/LGSP
2. Thêm rubric 8: **Risk register check** — Đề án có risk section không, risk có realistic không
3. Integrate với `generate-docs` TKCS/TKCT — cùng critique framework cho dự án investment
4. Corpus benchmark: build database Đề án đã duyệt → so sánh submission mới với baseline similar cấp
