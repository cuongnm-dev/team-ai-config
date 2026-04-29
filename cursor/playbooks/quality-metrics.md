# Sổ tay: Chỉ số chất lượng & Sức khỏe hệ thống

**Mục đích:** Cách đo xem hệ thống agent có hoạt động tốt không, nơi nào suy giảm và cần khắc phục gì.

---

## Khối KPI

Mỗi agent thêm hai khối JSON vào cuối phản hồi:

```json
{
  "ticket_id": "ISSUE-20260327-001",
  "agent": "qa",
  "verdict": "Pass with risks",
  "risk_score": "3",
  "risk_level": "medium"
}
```

```json
{
  "kpi": {
    "cycle_time_minutes": 45,
    "rework_count": 1,
    "retry_count": 0,
    "blocked_count": 0
  }
}
```

**Ý nghĩa từng KPI:**

| Trường               | Đo lường                  | Cờ đỏ                                             |
| -------------------- | ------------------------- | ------------------------------------------------- |
| `cycle_time_minutes` | Thời gian agent thực hiện | > 2× SLA mặc định cho vai trò đó                  |
| `rework_count`       | Số lần đầu ra được sửa    | > 1 cho bất kỳ agent đơn lẻ nào trong một feature |
| `retry_count`        | Số vòng làm rõ            | > 2 → nguyên nhân gốc là input mơ hồ              |
| `blocked_count`      | Số lần bị chặn            | > 0 → giai đoạn trước có khoảng trống chất lượng  |

---

## SLA mặc định (theo `quick-command-cheatsheet.md`)

| Agent                  | SLA mỗi vòng | Max vòng                |
| ---------------------- | ------------ | ----------------------- |
| BA làm rõ              | 30 phút      | 2                       |
| SA làm rõ              | 45 phút      | 2                       |
| Tech-lead lập kế hoạch | 45 phút      | 2                       |
| Dev triển khai         | 90 phút/wave | 2 lần sửa               |
| QA                     | 60 phút      | 2 chu kỳ retest         |
| Reviewer               | 45 phút      | 2 vòng yêu cầu thay đổi |

**Nếu agent vượt 2× SLA:** điều tra chất lượng bối cảnh — agent có input đủ không?

---

## Mục tiêu sức khỏe hệ thống

Theo Gói Kiểm tra Hội tụ (chạy hàng tuần với 10 scenario đại diện):

| Chỉ số                     | Mục tiêu | Ý nghĩa                                           |
| -------------------------- | -------- | ------------------------------------------------- |
| Tỷ lệ nhất quán verdict          | ≥ 95%      | Agent dùng đúng nhãn verdict                      |
| Tính hợp lệ handoff JSON         | 100%       | Mỗi phản hồi có khối JSON parse được              |
| `token_usage` hiện diện          | 100%       | Mỗi handoff JSON có block `token_usage`           |
| Vi phạm ranh giới vai trò        | 0          | Không agent làm công việc của vai trò khác        |
| Escaped-defect proxy             | < 5%       | Tỷ lệ yêu cầu thay đổi sau Approved              |
| BA `rework_count`/feature        | ≤ 1        | Yêu cầu đủ rõ từ lần đầu                         |
| Dev AC coverage                  | 100%       | Mỗi AC có trạng thái rõ trong Requirement Mapping |
| QA executed evidence ratio       | ≥ 70%      | ≥ 70% test case có bằng chứng runtime            |
| Token/pipeline (Path S)          | < 80k      | Feature đơn giản không đốt quá nhiều token       |
| Token/pipeline (Path M)          | < 200k     | Feature trung bình                                |
| Token/pipeline (Path L)          | < 500k     | Feature phức tạp với nhiều agent mở rộng         |

---

## Cách chạy Gói Kiểm tra Hội tụ

**Hàng tuần (15 phút):**

1. Chọn 10 phản hồi agent gần nhất trong tuần
2. Kiểm tra từng phản hồi với thẻ điểm:

```
Với mỗi phản hồi:
[ ] Có handoff JSON hợp lệ (parse được, nhãn đúng)
[ ] Có khối KPI
[ ] Giữ trong ranh giới vai trò (không hành động cấm)
[ ] Độ sâu output phù hợp độ phức tạp feature (không quá/thiếu)
[ ] Có tóm tắt bàn giao (dưới 300 từ)
[ ] Có block "## ▶ What's next?" với skill routing rõ ràng
[ ] Bằng chứng runtime (không chỉ "build passes") — chỉ dev/qa
[ ] Mapping AC hoàn chỉnh — chỉ dev
[ ] Test case tham chiếu AC IDs — chỉ qa
[ ] Checklist bảo mật chạy — chỉ reviewer
[ ] reviewer suggest /close-feature khi Approved — chỉ reviewer
[ ] tech-lead suggest /spike khi có unknown — chỉ tech-lead
```

3. Tính toán:
   - `verdict_consistency = (responses with valid verdict label) / 10`
   - `json_validity = (responses with parseable JSON) / 10`
   - `role_violations = count of forbidden actions observed`
   - `evidence_quality = (responses with runtime evidence) / (dev+qa responses)`

4. Nếu metric thấp hơn mục tiêu → xác định agent và scenario gây ra.

---

## Đọc điểm rủi ro

| Điểm | Mức           | Hành động                                                                 |
| ---- | ------------- | ------------------------------------------------------------------------- |
| 1    | Không đáng kể | Không cần xử lý đặc biệt                                                  |
| 2    | Thấp          | Ghi vào `_state.md`, tiếp tục                                             |
| 3    | Trung bình    | Đánh giá agent điều kiện (security/sre/devops)                            |
| 4    | Cao           | **Phải** đánh giá agent điều kiện, ghi lý do                              |
| 5    | Nguy cấp      | Dừng pipeline, tăng cấp PO, không tiếp tục nếu không có phê duyệt rõ ràng |

**Rủi ro tổng hợp cho feature:**

- Nếu trung bình `risk_score` > 3 → xem lại role điều kiện đã được kích hoạt đúng chưa
- Nếu có agent trả `risk_score = 5` → coi là blocker ngay

---

## Chỉ số sức khỏe ở cấp feature

Sau khi mỗi feature hoàn thành, kiểm tra retrospective (`09-retrospective.md`) với:

| Chỉ số                  | Khỏe                            | Cảnh báo            |
| ----------------------- | ------------------------------- | ------------------- |
| Tổng thời gian vòng đời | ≤ ước tính (SLA × số giai đoạn) | > 1.5× ước tính     |
| Tổng rework count       | 0–2 toàn bộ agent               | > 4 toàn bộ agent   |
| Số giai đoạn bị block   | 0                               | > 2 giai đoạn       |
| Defect QA tìm           | 0–2 minor                       | Có blocker/critical |
| Reviewer must-fix       | 0                               | > 3 must-fix        |

---

## Mẫu suy giảm chất lượng phổ biến

**Mẫu 1: BA rework > 1**
→ Nguyên nhân: Yêu cầu PO chưa đủ rõ tại intake
→ Khắc phục: PM checklist intake — yêu cầu scope in/out trước khi gọi BA

**Mẫu 2: Dev rework > 1**
→ Nguyên nhân: Kế hoạch tech-lead quá mơ hồ, hoặc kiến trúc SA thiếu
→ Khắc phục: Kiểm tra `rework_count` của tech-lead — nếu > 0, SA là nguyên nhân gốc

**Mẫu 3: QA `executed` evidence < 50%**
→ Nguyên nhân: Môi trường test không có hoặc agent không chạy test
→ Khắc phục: Đảm bảo dev cung cấp hướng dẫn thiết lập môi trường trước giai đoạn QA

**Mẫu 4: Reviewer `Changes requested` liên tiếp**
→ Nguyên nhân: Dev thường xuyên không đạt bar chất lượng giống nhau
→ Khắc phục: Thêm phát hiện lặp lại vào `reviewer.md` như checklist rõ ràng

**Mẫu 5: `cycle_time_minutes` thường > 2× SLA cho một agent**
→ Nguyên nhân: Agent nhận bối cảnh từ PM không đủ
→ Khắc phục: Xem lại context bundle PM cho agent đó — đã truyền đúng artifact chưa?

**Mẫu 6: `tokens_total` vượt ngưỡng path**
→ Nguyên nhân: PM pass quá nhiều artifact không cần thiết, hoặc agent dùng full mode khi lean đủ
→ Khắc phục: Check `tokens_by_stage` — agent nào tiêu nhiều nhất → xem context bundle cho agent đó

---

## Phân tích token theo pipeline

Đọc `kpi.tokens_by_stage` từ `_state.md` hoặc `09-retrospective.md`:

**Benchmark tham khảo (ước tính):**

| Agent | Path S | Path M | Path L |
|---|---|---|---|
| ba (BA + domain) | — | ~8k | ~15k |
| sa | — | ~10k | ~18k |
| tech-lead | ~6k | ~10k | ~15k |
| dev (per wave) | ~5k | ~8k | ~10k |
| qa | ~4k | ~7k | ~10k |
| reviewer | ~5k | ~8k | ~12k |
| **Total (estimated)** | **~25–40k** | **~60–120k** | **~150–400k** |

**Cờ đỏ token:**
- Một agent > 30k tokens → context bundle quá lớn, cần trim
- `dev` > `tech-lead` × 3 → dev đang đọc toàn bộ artifacts thay vì chỉ task của mình
- `ba` > 15k → PO input quá verbose hoặc nhiều vòng clarification

---

## Đánh giá xu hướng hàng tháng (30 phút)

Mỗi tháng, thu retrospective của tất cả feature đã hoàn thành và trả lời:

1. **Giai đoạn nào gây nhiều rework nhất?** (Tổng `rework_count` theo agent)
2. **Giai đoạn nào gây nhiều block nhất?** (Tổng `blocked_count`)
3. **Điểm rủi ro tăng hay giảm?** (Trung bình `risk_score` theo tháng)
4. **Thời gian vòng đời có cải thiện không?** (Tổng `cycle_time_minutes` theo feature)
5. **Must-fix item phổ biến nhất từ reviewer là gì?** (phân tích mẫu)

Dùng kết quả để cập nhật file skill agent với anti-pattern hoặc nâng bar chất lượng mới.

---

## Lưu ý về token và playbooks

- **`rules/*.mdc`** có `alwaysApply: true` → load mỗi conversation → tốn token thường xuyên
- **`agents/*.md`** → load on-demand khi PM invoke subagent → tốn token theo pipeline stage
- **`playbooks/`** → không bao giờ tự động load → **không tốn token** (chỉ dùng cho người đọc)
- **`skills/*/SKILL.md`** → load khi user gọi skill → tốn token một lần per invocation
- **`skills/*/ref-*.md`** → lazy load trong skill theo File Load Map → chỉ tốn khi cần
