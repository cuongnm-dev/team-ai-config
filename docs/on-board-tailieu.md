---
title: On-board 🅱 Tài liệu — Đề án CĐS, đấu thầu CNTT
order: 12
---

# On-board 🅱 — Luồng Tài liệu nhà nước

Tài liệu này dành cho **cán bộ soạn Đề án Chuyển đổi số, hồ sơ thầu CNTT, NCKT** cấp Bộ/Tỉnh/Sở. Nếu anh/chị đang code phần mềm, xem `on-board-sdlc.md` thay vì file này.

> Đọc xong tài liệu này, bạn sẽ biết:
> - 4 loại tài liệu chính: Đề án CĐS, NCKT, HSMT/HSDT, dự toán
> - Quy trình 4 spirals (nghiên cứu → DEDUP → outline → write)
> - Khi nào dùng skill nào, khi nào hỏi cán bộ chuyên môn
> - Vì sao Luồng B KHÔNG dùng chung skill với Luồng A

> Đầu vào: nhu cầu chiến lược + KB chính sách + DEDUP catalog (NDXP/LGSP/CSDLQG/Gov Cloud).
> Đầu ra: 1 tài liệu Word duy nhất, tuân thủ NĐ 45/2026 + CT 34 + QĐ 749 + TT 04/2020.

---

## 1. Phân biệt 4 loại tài liệu

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  Loại 1: ĐỀ ÁN CHUYỂN ĐỔI SỐ                                         │
│   ────────────────────────                                           │
│   - Tài liệu chiến lược cấp Bộ/Tỉnh/Sở                              │
│   - Trình lãnh đạo phê duyệt chủ trương                              │
│   - Phạm vi: 5-7 năm, đa dự án                                       │
│   - Skill: /new-strategic-document  (4 spirals)                      │
│                                                                      │
│  Loại 2: BÁO CÁO NGHIÊN CỨU KHẢ THI (NCKT)                           │
│   ────────────────────────────────────                               │
│   - Theo NĐ 45/2026 Điều 12 — 19 chương                              │
│   - 1 dự án CNTT cụ thể (đã có chủ trương)                          │
│   - Trình thẩm định trước khi quyết định đầu tư                      │
│   - Skill: /new-document-workspace → chọn nckt                       │
│                                                                      │
│  Loại 3: HỒ SƠ THẦU (HSMT/HSDT)                                      │
│   ───────────────────────────                                        │
│   - HSMT (Hồ sơ Mời thầu) — bên mời thầu phát hành                  │
│   - HSDT (Hồ sơ Dự thầu) — nhà thầu nộp                             │
│   - Theo Luật 22/2023/QH15 + NĐ 214/2025                             │
│   - Skill: /new-document-workspace → chọn hsmt/hsdt                  │
│                                                                      │
│  Loại 4: DỰ TOÁN PHẦN MỀM                                            │
│   ──────────────────────                                             │
│   - Theo TT 04/2020/TT-BTTTT — formula man-hours × rate             │
│   - Đính kèm NCKT hoặc HSMT                                          │
│   - Skill: /new-document-workspace → chọn du-toan                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

> Loại 5 (TKCS độc lập): Khi đấu thầu yêu cầu nộp Thiết kế Cơ sở rời (không phải bộ phần mềm SDLC), dùng `/new-document-workspace → tkcs`. Khác với TKCS phần mềm trong Luồng A — output là 1 file Word độc lập, không phải block trong content-data.json.

---

## 2. Quy trình 4 spirals — `/new-strategic-document`

Đề án CĐS là tài liệu phức tạp nhất Luồng B. Quy trình 4 vòng (spirals):

```
   Spiral 1: NGHIÊN CỨU (Research)
   ───────────────────────────────
   - Đọc văn bản chỉ đạo (QĐ 749, CT 34, QĐ 06...)
   - Phỏng vấn lãnh đạo: tầm nhìn + ưu tiên
   - Khảo sát hiện trạng: hệ thống, nhân sự, ngân sách
   - Output: KB updated (policy-researcher), interview-notes

   ▼

   Spiral 2: DEDUP (Bắt buộc theo CT 34 NT6)
   ─────────────────────────────────────────
   - Tra catalog ecosystem có sẵn:
       NDXP    : 44 dịch vụ (xác thực, chia sẻ dữ liệu, ...)
       LGSP    : auth, notification, payment
       CSDLQG  : dân cư, đất đai, bảo hiểm, doanh nghiệp
       Gov Cloud: compute, storage, DBaaS
       SSO     : VNeID, VNID
   - Mỗi giải pháp đề xuất → check trùng → BẮT BUỘC tích hợp thay vì xây mới
   - Output: dedup-report (nếu skip → /strategic-critique sẽ flag)

   ▼

   Spiral 3: OUTLINE (Cấu trúc)
   ────────────────────────────
   - structure-advisor đề xuất outline chuẩn:
       1. Sự cần thiết + cơ sở xây dựng
       2. Hiện trạng (số liệu cụ thể, KHÔNG vague)
       3. Mục tiêu + nguyên tắc
       4. Giải pháp + công nghệ (đã DEDUP)
       5. Lộ trình triển khai
       6. Kinh phí (per TT 04/2020 formula)
       7. Tổ chức thực hiện
       8. Đánh giá hiệu quả
   - User customize outline theo đặc thù tổ chức
   - LOCK outline trước khi vào Spiral 4

   ▼

   Spiral 4: WRITE (Soạn thảo)
   ───────────────────────────
   - doc-writer điền từng section
   - doc-reviewer rà soát NĐ 30/2020 (văn phong) + compliance
   - doc-diagram sinh sơ đồ PlantUML/Mermaid theo Khung CPĐT 4.0
   - Output: De-an-CDS-So-X-vN.docx

   ▼

   Adversarial review (tùy chọn):
   ──────────────────────────────
   /strategic-critique <draft.docx>
   - Role-play cán bộ thẩm định Bộ/Tỉnh/Sở
   - 7 checks: formal, substantive, coherence, alignment, dedup, feasibility, legal
   - Findings YAML + comments.md + summary.md cho lãnh đạo
   - Lặp critique → fix → re-critique 1-2 vòng trước khi nộp
```

---

## 3. Vì sao Luồng B KHÔNG dùng skill Luồng A?

| Skill Luồng A | Vì sao không dùng cho Luồng B |
|---|---|
| `/from-doc` | Kỳ vọng SRS/BRD phần mềm có acceptance criteria, role visibility — Đề án CĐS không có cấu trúc đó |
| `/from-code` | Đọc codebase → không áp dụng cho tài liệu thuần text chiến lược |
| `/generate-docs` | Output là bộ 5 file Office NGHIỆM THU phần mềm; Đề án/HSMT là 1 file Word độc lập |
| `/quality review` | Format reviewer cho code/PR; Đề án cần thẩm định adversarial → `/strategic-critique` |
| `/new-feature` | SDLC pipeline 6 stages — không phù hợp cho 1 tài liệu chiến lược |
| `/resume-feature` | Đọc `_state.md` SDLC — Luồng B dùng `_doc_state.md` hoặc `_strategy_state.md` |

| Skill Luồng B | Vì sao không dùng cho Luồng A |
|---|---|
| `/new-strategic-document` | Quy trình 4 spirals quá nặng cho 1 feature phần mềm |
| `/strategic-critique` | Catalog DEDUP NDXP/LGSP — không liên quan code review |
| `/new-document-workspace` | Wizard chọn loại tài liệu hành chính (TKCS/HSMT/HSDT/dự toán/NCKT) — không phải pipeline phần mềm |

---

## 4. Skills + agents Luồng B

### Skills (4)

| Skill | Khi nào | Output |
|---|---|---|
| `/new-strategic-document` | Soạn Đề án CĐS từ đầu | `De-an-CDS-{slug}-v0.1.docx` + state |
| `/new-document-workspace` | Tạo NCKT/HSMT/HSDT/dự toán/TKCS độc lập | 1 Word file theo loại + state |
| `/resume-document` | Tiếp tục soạn dở dang | Continue từ `_doc_state.md` hoặc `_strategy_state.md` |
| `/strategic-critique <draft>` | Adversarial review trước nộp | findings.yaml + comments.md + summary.md |

### Agents (8)

**Strategic** (Đề án CĐS):
- `strategy-analyst` — Bộ não chiến lược, dẫn 4 spirals interview
- `policy-researcher` — Nghiên cứu QĐ/CT/NĐ, map ecosystem NDXP/LGSP/CSDLQG
- `structure-advisor` — Đề xuất outline + customize theo tổ chức

**Doc-line** (NCKT/HSMT/HSDT/dự toán/TKCS độc lập):
- `doc-orchestrator` — Điều phối pipeline tài liệu hành chính, manage waves
- `doc-writer` — Soạn từng section, văn phong nghị định, có web research
- `doc-reviewer` — Rà soát NĐ 30/2020 + compliance pháp lý + cross-reference
- `doc-diagram` — Sinh sơ đồ PlantUML/Mermaid theo Khung CPĐT 4.0
- `tdoc-nckt-writer` — Specialist viết block nckt.* theo NĐ 45/2026 Điều 12 (19 chương)

> Lưu ý: `tdoc-tkcs-writer` và `tdoc-tkct-writer` xuất hiện ở cả 2 luồng. Khi dùng từ `/new-document-workspace` (Luồng B) → output 1 file Word độc lập. Khi dùng từ `/generate-docs` (Luồng A) → output 1 block trong content-data.json của bộ nghiệm thu phần mềm.

---

## 5. Văn bản pháp lý cần biết

| Văn bản | Phạm vi áp dụng |
|---|---|
| QĐ 749/QĐ-TTg | Chương trình CĐS quốc gia — base cho mọi Đề án CĐS |
| CT 34/CT-TTg | 9 nguyên tắc CĐS — đặc biệt NT6 (DEDUP bắt buộc) |
| QĐ 06/QĐ-TTg | Đề án 06 — nếu liên quan dân cư |
| QĐ 292/QĐ-BKHCN (2025) | Khung Kiến trúc CPĐT 4.0 — dự án cấp Bộ |
| NĐ 45/2026/NĐ-CP | Quản lý đầu tư UDCNTT (thay NĐ 73/2019) — Đ12 NCKT, Đ13 TKCS, Đ14 TKCT, Đ16 dự toán |
| NĐ 30/2020/NĐ-CP | Văn bản hành chính — outline, font, citation format |
| TT 04/2020/TT-BTTTT | Dự toán phần mềm — formula man-hours × rate |
| Luật 22/2023/QH15 + NĐ 214/2025 | Đấu thầu — HSMT/HSDT |
| NĐ 13/2023/NĐ-CP | Bảo vệ DLCN — section ATTT của NCKT |

KB chính sách trong ai-kit (cập nhật quarterly): `policy-researcher` agent đọc + verify trước khi cite.

---

## 6. State file — `_doc_state.md` vs `_strategy_state.md`

Luồng B có 2 loại state file (khác `_state.md` của SDLC):

| File | Skill tạo | Nội dung |
|---|---|---|
| `_doc_state.md` | `/new-document-workspace` | Tracking 1 tài liệu hành chính (NCKT/HSMT/HSDT/dự toán/TKCS độc lập) — outline section x.y, status, agent đang chạy |
| `_strategy_state.md` | `/new-strategic-document` | Tracking Đề án CĐS — 4 spirals, checkpoint mỗi vòng, KB updates, DEDUP findings |

`/resume-document` tự detect file nào tồn tại để tiếp tục.

---

## 7. Cảnh báo thường gặp

### "DEDUP catalog cần update"
- Skill `policy-researcher` cập nhật KB quarterly. Nếu lần cuối > 6 tháng → flag verify.
- DEDUP miss = lỗi NẶNG khi thẩm định (vi phạm CT 34 NT6).

### "Văn bản pháp lý cited đã hết hiệu lực"
- Vd: NĐ 73/2019 đã bị NĐ 45/2026 thay → `/strategic-critique` sẽ flag là blocker.
- Luôn check `policy-researcher` KB trước khi cite.

### "Số liệu hiện trạng vague"
- "Tương đối lạc hậu", "khá nhiều", "thời gian tới" → blocker khi thẩm định.
- Bắt buộc số liệu cụ thể: "Hệ thống A triển khai 2014, uptime 94.2% năm 2025".

### "Đề xuất bất khả thi"
- Timeline 3 tháng cho HRIS 1000 cán bộ → flag major.
- Budget không khớp formula TT 04/2020 → flag major.

---

## 8. Đọc tiếp

| Bạn cần | Đọc tiếp |
|---|---|
| Catalog skill 🅱 | `skills.md` § Decision matrix Luồng B |
| Agent details Luồng B | `agents.md` § Phân nhóm theo luồng |
| Workflow chi tiết Đề án CĐS | new-strategic-document SKILL.md |
| Workflow chi tiết HSMT/HSDT | new-document-workspace SKILL.md |
| Adversarial review | strategic-critique SKILL.md |
| Câu hỏi thường gặp | `faq.md` |
| Văn bản pháp lý + KB | reference/policy-kb.md (TBD) |

---

## 9. Khi nào hỏi cán bộ chuyên môn?

AI hỗ trợ ~70% công việc soạn Đề án/HSMT. 30% còn lại CHỈ con người biết:

| Lĩnh vực | Người trả lời |
|---|---|
| Tầm nhìn cụ thể của lãnh đạo | Lãnh đạo trực tiếp |
| Ưu tiên giai đoạn (Pilot/Rollout/100%) | PM dự án + lãnh đạo |
| Số liệu hiện trạng cụ thể (uptime, query p95, ...) | Đội vận hành |
| Mức ngân sách đã được phân bổ | Phòng Tài chính |
| Đối tác liên quan (NDXP, vendor) | Phòng QLDA |
| Political context (cấp trên đang push gì) | PM/lãnh đạo |

→ Skill `/intel-fill` (Luồng A) KHÔNG dùng cho Luồng B. Luồng B dùng `strategy-analyst` interview thủ công + lưu vào KB.
