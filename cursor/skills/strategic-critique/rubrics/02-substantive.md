# Rubric 02 — Substantive Check

**Goal**: Mỗi claim trong Đề án phải có **số liệu / tên đơn vị / ngày tháng / nguồn** support. Thẩm định sẽ challenge mọi đánh giá không có data.

---

## Vague language patterns (auto-flag)

### Tier 1 — BLOCKER (Section 3 Hiện trạng, Section 6 Kinh phí)

Quantifier không có số:
- `tương đối`, `khá`, `hơi`, `rất`, `cực kỳ`
- `đa số`, `một số`, `hầu hết`, `nhiều`, `ít`, `vài`, `phần lớn`
- `không nhỏ`, `đáng kể`, `đáng chú ý`

Adjective không có metric:
- `hiện đại`, `tiên tiến`, `lạc hậu`, `lỗi thời`
- `mạnh mẽ`, `yếu kém`, `đồng bộ`, `thiếu đồng bộ`
- `đầy đủ`, `thiếu`, `toàn diện`, `chưa toàn diện`

Time không có năm:
- `thời gian tới`, `thời gian qua`, `trong thời gian gần đây`
- `trước đây`, `hiện nay`, `sắp tới`
- `giai đoạn trước`, `giai đoạn sau`

### Tier 2 — MAJOR (các section khác)

Process không có step:
- `từng bước`, `dần dần`, `dần hoàn thiện`
- `đi vào chiều sâu`, `tiến tới`, `hướng tới`

Non-committal phrases:
- `cần tiếp tục nghiên cứu`
- `có thể xem xét`
- `dự kiến sẽ`, `kế hoạch sẽ`
- `nếu có điều kiện`

### Tier 3 — MINOR (acceptable in mở đầu / kết luận)

- `nhằm`, `góp phần`, `đóng góp`, `thúc đẩy` (OK ở mục đích/kết quả kỳ vọng, không OK ở hiện trạng/giải pháp)

---

## Detection pattern (agent logic)

Với mỗi section, count vague density:

```
vague_density = count(tier1+tier2 patterns) / total_sentences

Section 3 (Hiện trạng):
  density < 5%   → OK
  density 5-15%  → major finding (needs more specifics)
  density > 15%  → blocker (section not defensible)

Section 5 (Giải pháp):
  density < 10%  → OK
  density > 10%  → major

Section 1 (Mở đầu):
  density < 20%  → OK (mở đầu thường có language mềm)
```

---

## Good patterns (agent whitelist)

Câu có data cụ thể:
- Số + đơn vị: "1.500 cán bộ", "150GB database", "uptime 94.2%"
- Năm + sự kiện: "năm 2014", "Q4/2025", "2020-2025"
- Tên đơn vị: "Sở Tài chính", "UBND huyện X", "Trung tâm CNTT Bộ Y"
- Metric benchmark: "p95 < 500ms", "5000 users concurrent", "TCO giảm 30%"
- Source cite: "(theo Báo cáo X năm 2024)", "(khảo sát Q3/2025, N=523)"

---

## Fix template cho researcher

Khi AI report vague → suggest fix pattern:

```
BEFORE: "Hệ thống hiện tại tương đối lạc hậu"
AFTER:  "Hệ thống A triển khai từ [năm Y] ([N] năm tuổi), chạy trên [tech stack version], 
         uptime [X]%, không hỗ trợ [capability Z] trong khi [M]% use case hiện tại cần Z."
```

```
BEFORE: "Sẽ triển khai từng bước"
AFTER:  "Triển khai 3 giai đoạn: [Q1/YYYY pilot với N đơn vị] → 
         [Q2-Q3/YYYY rollout 50% đơn vị] → [Q4/YYYY 100%]"
```

```
BEFORE: "Giải pháp mang lại hiệu quả toàn diện"
AFTER:  "Giải pháp giảm [time-to-process] từ X phút xuống Y phút (giảm Z%), 
         tiết kiệm [N] giờ công/năm, tương đương [M] triệu đồng/năm."
```

---

## Finding emission format

```yaml
- id: F-NNN
  severity: blocker | major | minor
  check: substantive
  section: "3.2"
  excerpt: "..."                  # full sentence/paragraph
  vague_terms: ["tương đối", "lạc hậu"]  # specific words detected
  issue: |
    <explanation why vague — include tier context>
  why_severity: |
    <why this tier — reference thẩm định lens>
  fix_recommendation: |
    <BEFORE/AFTER template>
```
