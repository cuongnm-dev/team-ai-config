---
name: strategic-critique
description: Đóng vai cán bộ thẩm định (Bộ/Tỉnh/Sở) phản biện ngược lại Đề án Chuyển đổi số bạn vừa viết — bắt các lỗi thường gặp - câu chữ mơ hồ, thiếu số liệu cụ thể, viện dẫn pháp lý sai, mâu thuẫn nội bộ, bỏ sót dùng chung hệ thống có sẵn, đề xuất bất khả thi. Dùng để rà chất lượng trước khi nộp.
disable-model-invocation: true
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
  total-pages: 45
  sections:
    - number: "1"
      title: "Sự cần thiết và cơ sở xây dựng Đề án"
      start-line: 120
      end-line: 840
      word-count: 3200
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

→ Read `notepads/rubrics.md` for detailed rubric definitions, severity rules, and DEDUP catalog.

### Step 3 — Produce findings YAML

→ Read `notepads/output-templates.md` for the full schema (with sample F-001..F-004 entries) and produce `critique-findings.yaml`.

### Step 4 — Display results

Console output ranked by severity, plus 3 output files:
- `critique-findings.yaml` — machine-readable
- `critique-comments.md` — side-by-side excerpt + comment (researcher dễ scan)
- `critique-summary.md` — 1-page executive summary cho leadership

→ Read `notepads/output-templates.md` for exact console format and the `.md` templates.

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

Bundled rubrics trong `rubrics/` (sibling dir). Skill đọc từ `$HOME/.cursor/skills/strategic-critique/rubrics/`.

Không cần MCP, không cần container — pure LLM + file reading.

---

## What's next

Sau khi POC test:

1. Populate DEDUP catalog với real data NDXP/LGSP
2. Thêm rubric 8: **Risk register check** — Đề án có risk section không, risk có realistic không
3. Integrate với `generate-docs` TKCS/TKCT — cùng critique framework cho dự án investment
4. Corpus benchmark: build database Đề án đã duyệt → so sánh submission mới với baseline similar cấp
