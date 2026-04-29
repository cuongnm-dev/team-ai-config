# ref-strategic-rules.md — Strategic Pipeline Rules

Rules cho Strategic Thinking Pipeline. Claude Code: đã gom vào `~/.claude/CLAUDE.md` (sections ST-1..ST-7, KB-1..KB-4).

---

## Rule 1: `50-strategic-thinking.mdc`

```markdown
---
description: "Guardrails cho Strategic Thinking Pipeline. Áp dụng khi agents làm việc với Đề án CĐS / tài liệu chiến lược. Enforces research-first, dedup-mandatory, KB-aware behavior."
alwaysApply: false
---

# Strategic Thinking Pipeline Rules

## ST-1: Research trước, viết sau

**Rule:** KHÔNG viết nội dung document (Section 1-10) khi Thinking Bundle chưa FROZEN.

**Why:** Đề án CĐS là sản phẩm nghiên cứu. Viết khi chưa nghiên cứu xong = viết sai → sửa tốn kém hơn nghiên cứu kỹ.

**Enforce:**
- strategy-orchestrator block WRITE_INIT nếu `thinking_bundle != frozen`
- doc-writer refuse dispatch nếu không có Section Brief

## ST-2: DEDUP bắt buộc

**Rule:** MỌI đề xuất giải pháp/dự án PHẢI qua Dedup Protocol. Không có exception.

**Why:** CT 34 Nguyên tắc 6: "Sử dụng nền tảng số dùng chung, KHÔNG xây lại." Trùng lặp = lãng phí NSNN + giảm chất lượng tư vấn.

**Enforce:**
- strategy-orchestrator block CHECKPOINT_2 nếu có proposal chưa dedup
- Proposal với verdict REJECT phải loại hoặc reframe trước checkpoint
- Dedup report bắt buộc trong Thinking Bundle

## ST-3: KB-first

**Rule:** Trước mỗi phân tích/đề xuất, agent PHẢI đọc KB relevant. Sau mỗi phát hiện mới, agent PHẢI ghi KB.

**Why:** KB tích lũy = chất lượng tăng theo thời gian. Không đọc KB = bỏ qua tri thức đã có. Không ghi KB = mất tri thức.

**Enforce:**
- Agent phải reference KB entry trong output (trích dẫn source)
- strategy-orchestrator track `kb_entries_added` trong KPI
- KB entry phải có `last_verified` date

## ST-4: Interview liên tục, không cứng nhắc

**Rule:** Interview KHÔNG giới hạn ở Spiral 1. Bất kỳ spiral nào thiếu thông tin → hỏi user. Không bịa thông tin.

**Why:** Tổ chức phức tạp hơn 14 câu hỏi. Thiếu info ở Spiral 3 mà không hỏi → giải pháp không thực tiễn.

**Enforce:**
- strategy-analyst có thể request interview ở bất kỳ spiral
- Thiếu info → placeholder `[CẦN THU THẬP: mô tả]`, KHÔNG bịa
- strategy-orchestrator log `interview_questions_asked` tổng cộng

## ST-5: Giải pháp thực tiễn

**Rule:** Mỗi giải pháp phải trả lời: (a) Vấn đề cụ thể nào? (b) Giải quyết thế nào? (c) Ai thực hiện? (d) Kinh phí bao nhiêu? (e) Kết quả đo được?

**Why:** Anti-pattern A1: "ứng dụng AI, blockchain" không có use case = Đề án treo. Tư vấn giá trị = giải pháp thực hiện được.

**Enforce:**
- Mỗi DA-XX trong Initiative Portfolio phải có 5 trường trên
- strategy-analyst refuse proposal thiếu trường
- Feasibility check trước Checkpoint 2

## ST-6: Spiral back cho phép

**Rule:** Pipeline cho phép quay lại spiral trước. KHÔNG ép đi linear khi thiếu cơ sở.

**Why:** Research không linear. Phát hiện mới ở Spiral 3 có thể thay đổi Strategic Framework (Spiral 2).

**Enforce:**
- strategy-orchestrator log spiral back trong `_strategy_state.md`
- Spiral back phải có lý do rõ ràng
- Max 2 spiral backs per checkpoint (tránh infinite loop)

## ST-7: Outline MUTABLE → LOCKED

**Rule:** Outline bắt đầu MUTABLE (structure-advisor customize). Sau Checkpoint 3 → LOCKED (bất biến cho WRITE layer).

**Why:** Outline cần flexible ở THINK layer (tùy tổ chức). Nhưng WRITE layer cần stable target. Thay outline khi đang viết = chaos.

**Enforce:**
- structure-advisor CHỈ modify outline khi `outline_status == mutable`
- Sau Checkpoint 3: `outline_status = locked`, không ai được sửa
- doc-writer follow locked outline giống pipeline hiện tại (IMMUTABLE)
```

---

## Rule 2: `51-kb-management.mdc`

```markdown
---
description: "Rules cho Knowledge Base management. Áp dụng khi agents đọc/ghi KB. Ensures data quality, freshness, và dedup integrity."
alwaysApply: false
---

# Knowledge Base Management Rules

## KB-1: Frontmatter bắt buộc

Mỗi file KB phải có:
```yaml
---
domain: ecosystem | precedent | policy | tech | glossary
last_verified: YYYY-MM-DD
confidence: high | medium | low
sources: ["source1", "source2"]
tags: ["tag1", "tag2"]
---
```

Thiếu frontmatter = agent phải bổ sung trước khi dùng.

## KB-2: Verify trước khi dùng

| Tuổi entry | Hành động |
|---|---|
| < 90 ngày | Dùng trực tiếp |
| 90-180 ngày | Dùng + flag `[VERIFY RECOMMENDED]` |
| > 180 ngày | PHẢI verify (web search/user confirm) trước khi dùng |

policy-researcher chịu trách nhiệm verify.

## KB-3: Write rules

| Loại | Ai được ghi | Review |
|---|---|---|
| ecosystem/ | policy-researcher, strategy-analyst | Orchestrator approve |
| precedent/ | strategy-analyst | Tự động (sau project complete) |
| policy/ | policy-researcher | Phải có source URL/document |
| tech/ | strategy-analyst | Flag confidence level |
| glossary/ | Bất kỳ agent | Tự động |

## KB-4: Không duplicate

Trước KB_WRITE, kiểm tra:
1. Entry tương tự đã tồn tại? → UPDATE thay vì tạo mới
2. Thông tin mâu thuẫn entry cũ? → UPDATE entry cũ + ghi lý do thay đổi

## KB-5: Không ghi thông tin ephemeral

KB chỉ ghi thông tin **có giá trị tái sử dụng**:
- Platform/hệ thống (persistent)
- Chính sách (semi-persistent)
- Patterns/benchmarks (persistent)

KHÔNG ghi:
- Thông tin dự án cụ thể (thuộc thinking-bundle, không phải KB)
- Nội dung interview (thuộc org-profile)
- Draft/work-in-progress

## KB-6: Index consistency

Sau mỗi KB_WRITE, cập nhật `_kb_index.md` nếu thêm file mới.
Không tạo orphan files (file KB không có trong index).

## KB-7: Dedup data integrity

ecosystem/ entries là nguồn truth cho DEDUP:
- Entry phải chính xác về chức năng, trạng thái, phạm vi
- Sai → dedup cho verdict sai → đề xuất sai
- Priority verify: ecosystem/ > policy/ > tech/ > precedent/
```
