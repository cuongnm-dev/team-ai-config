# Sổ tay: Ứng phó sự cố pipeline

**Mục đích:** Khi pipeline giao hàng bị kẹt, bị chặn, hoặc xuất hiện kết quả không mong muốn — đây là các bước cần làm theo thứ tự.

---

## Triage trước (30 giây)

Đọc khối JSON bàn giao của agent để xác định chính xác vấn đề:

```json
{
  "verdict": "Blocked",
  "blockers": ["mô tả blocker cụ thể"],
  "missing_artifacts": ["cái gì đang thiếu"],
  "risk_level": "high"
}
```

Sau đó đối chiếu với một trong các tình huống dưới đây.

---

## Tình huống 1: Agent trả về `Blocked`

**Triệu chứng:** Agent không thể tiến tiếp — thứ gì đó ở giai đoạn trước thiếu hoặc không thể giải quyết.

**Cây quyết định:**

```
Blocker có phải là artifact bị thiếu từ giai đoạn trước?
  CÓ → Đọc artifact giai đoạn trước. Gọi lại agent trước
        với prompt tập trung để lấp khoảng trống. Không chạy toàn bộ lại.

Blocker có phải là quyết định kinh doanh (xung đột phạm vi, ưu tiên, tuân thủ)?
  CÓ → Tăng cấp cho Product Owner. Không cố tự giải quyết trong pipeline.
        Dùng: /pm Escalate to PO — {quyết định cụ thể cần}

Blocker có phải là ẩn số kỹ thuật (thư viện không hỗ trợ, hạ tầng không có)?
  CÓ → Gọi sa hoặc tech-lead với: "Điều tra {ẩn số cụ thể} và
        đề xuất phương án trước khi tiến tiếp."

Blocker không rõ hoặc mơ hồ?
  CÓ → Hỏi agent bị block: "Nêu rõ artifact hoặc quyết định
        cần để mở khóa, và vai trò nào phải cung cấp nó."
```

---

## Tình huống 2: `Changes requested` từ reviewer

**Triệu chứng:** Reviewer trả `Changes requested` kèm item cần sửa.

**Bước:**

1. Đọc `{docs-path}/08-review-report.md` — phần: Must-Fix Items
   (`docs-path` trong frontmatter `_state.md` — thử `docs/features/{id}/` rồi `docs/hotfixes/{id}/`)
2. Đối chiếu mỗi must-fix với AC ID (từ `{docs-path}/ba/03-acceptance-criteria.md`)
3. Dùng Rework Loop Protocol trong `agents/pm.md` tạo bối cảnh mục tiêu cho dev
4. Gọi dev: "Rework loop 1/2 — chỉ sửa những mục này: {danh sách}"
5. Sau dev hoàn thành → chuyển cho QA: "Xác minh chỉ các mục đã sửa"
6. QA pass → chuyển lại reviewer: "Đã giải quyết tất cả must-fix"

**Counter:** Theo dõi vòng rework. Nếu vòng 2 fail → dừng và tăng cấp PO.

---

## Tình huống 3: QA trả `Fail`

**Triệu chứng:** QA phát hiện defect chặn release.

**Bước:**

1. Đọc `{docs-path}/07-qa-report.md` — phần: Defects Found
2. Phân loại defect theo mức: Blocker / Critical / Major / Minor
3. Blocker/Critical: chuyển ngay cho dev với bước tái hiện cụ thể
4. Major: cùng tech-lead quyết định fix ngay hay lùi wave sau
5. Minor: ghi nhận rủi ro release, có thể chấp nhận với PM phê duyệt
6. Không chuyển reviewer cho tới khi tất cả Blocker/Critical đã được giải quyết

---

## Tình huống 4: QA thiếu bằng chứng runtime

**Triệu chứng:** Báo cáo QA chỉ chứa bằng chứng `Analytical` cho các AC quan trọng.

**Bước:**

1. Kiểm tra xem môi trường test có sẵn không
2. Nếu có → yêu cầu QA chạy lại với bằng chứng đã thực thi cho AC quan trọng
3. Nếu không có môi trường test → dev phải thiết lập môi trường rồi QA chạy lại
4. Không chấp nhận verdict `Pass` với 100% bằng chứng Analytical cho các feature P0

---

## Tình huống 5: Trạng thái pipeline không nhất quán (`_state.md` out of sync)

**Triệu chứng:** `_state.md` ghi stage X nhưng artifact stage X+1 đã tồn tại, hoặc ngược lại.

**Bước:**

1. Tìm `_state.md` — đọc `docs_path` từ `.cursor/AGENTS.md` (bảng Docs-Path Formula), không đoán path. Tìm: `{docs_path}/_state.md`. Fallback: `docs/features/{id}/_state.md` hoặc `docs/hotfixes/{id}/_state.md`.
2. Liệt kê tất cả file artifact trong `{docs_path}`
3. Đọc frontmatter mỗi artifact lấy `verdict`
4. Đối chiếu thủ công bảng Stage Progress của `_state.md` theo verdict thực tế
5. Tiếp tục từ giai đoạn cuối cùng có `Ready`/`Pass` hợp lệ
6. Dùng `/resume-feature {feature-id}` sau khi điều chỉnh

> Nếu `.cursor/AGENTS.md` không tồn tại: workspace chưa được cấu hình. Chạy `/configure-workspace` trước.

---

## Tình huống 6: Agent xuất ra vi phạm ranh giới vai trò

**Triệu chứng:** BA viết code, dev viết lại business rules, PM quyết kiến trúc.

**Bước:**

1. Loại bỏ output ngoài phạm vi (không dùng)
2. Gọi lại agent đúng với: "Bỏ qua output trước của {vai trò sai}. Công việc của bạn chỉ là {phạm vi vai trò đúng}."
3. Ghi chú vào `_state.md` về vi phạm vai trò để phân tích retrospective

---

## Tình huống 7: Vượt giới hạn vòng tinh chỉnh (> 2 vòng)

**Triệu chứng:** Cùng issue qua lại giữa hai agent quá hai lần.

**Hướng giải quyết:**

```
Loop BA ↔ SA → Tăng cấp PO: cần quyết định ràng buộc kinh doanh hoặc phạm vi
Loop SA ↔ tech-lead → Họp: xem quyết định kiến trúc với cả hai đầu ra
Loop dev ↔ QA → Nguyên nhân gốc: AC có mơ hồ không? Nếu có → trả về BA
Loop dev ↔ reviewer → Nguyên nhân gốc: kiến trúc có vấn đề? Nếu có → trả về SA
```

**Quy tắc:** Không cho vòng thứ ba nếu chưa giải quyết nguyên nhân gốc.

---

## Tình huống 8: Dev phát hiện kiến trúc không tương thích cơ bản

**Triệu chứng:** Dev trả `Blocked` với lý do kiến trúc đã phê duyệt không hỗ trợ yêu cầu — không phải lỗi code, là lỗi thiết kế.

**Đây KHÔNG phải vòng dev↔QA. Không thử dev lại. Kích hoạt Protocol 1 (Tăng cấp ngược không liền kề).**

**Bước:**

1. Đọc `{docs-path}/05-dev-w{N}-*.md` — xác định incompatibility cụ thể (1 câu)
2. Đọc `{docs-path}/sa/00-architecture-overview.md` — xác định quyết định SA nguồn gốc
3. Gọi lại `sa`: "Dev phát hiện incompatibility: {finding}. Ràng buộc là {SA decision}. Sửa kiến trúc để xử lý. Cập nhật artifact tại chỗ."
4. SA trả lại output sửa → gọi lại `tech-lead`: "SA đã sửa kiến trúc. Quy hoạch lại các wave bị ảnh hưởng. Đọc output SA sửa tại {path}."
5. Ghi `_state.md`: sự kiện replan, nguyên nhân gốc, giai đoạn ảnh hưởng
6. Tiếp tục pipeline từ kế hoạch tech-lead đã sửa
7. KHÔNG tăng cấp PO trừ khi sửa kiến trúc cần quyết định phạm vi kinh doanh

---

## Tình huống 9: Defect QA dính về BA spec, không phải code dev

**Triệu chứng:** QA `Fail` với ≥ 2 defect cùng nguyên nhân gốc: 1 AC bị thiếu, mâu thuẫn hoặc mơ hồ — không phải lỗi triển khai dev.

**Không chuyển dev. Nguyên nhân gốc nằm ở artifact BA.**

**Bước:**

1. Đọc `{docs-path}/07-qa-report.md` — liệt kê defect và tham chiếu AC
2. Đọc `{docs-path}/ba/03-acceptance-criteria.md` — xác định khoảng trống hoặc mâu thuẫn
3. Gọi lại `ba`: "QA tìm {N} defect dính tới khoảng trống AC này: {gap}. Sửa lại AC ảnh hưởng. Cập nhật artifact tại chỗ."
4. BA trả lại → kiểm tra SA có ảnh hưởng không: đọc `{docs-path}/sa/`
5. Nếu ảnh hưởng SA: gọi `sa` với AC sửa. Nếu không: gọi `tech-lead` với AC sửa để cập nhật hướng dẫn
6. Gọi lại `dev` với bối cảnh AC sửa và scope fix mục tiêu
7. Chạy lại `qa` chỉ các defect cụ thể — không regress toàn bộ

---

## Tình huống 10: Cần session hội tụ (vượt giới hạn vòng)

**Triệu chứng:** Hai agent liền kề đã 2 vòng tinh chỉnh mà vẫn chưa đồng ý. Tăng cấp PO là không đúng — xung đột thuộc kỹ thuật, không kinh doanh.

**Bước:**

1. Xác định xung đột chính xác bằng 1 câu: "Xung đột là liệu {X} nên {Y} hay {Z}"
2. Kiểm tra bảng Domain Authority trong `AGENTS.md` — có agent nào có thẩm quyền rõ ràng không?
   - **Nếu có**: quyết định của agent đó thắng. PM ghi quyết định vào `_state.md` và tiến.
   - **Nếu không**: khởi động session hội tụ:
3. Gọi lại Agent A: "Xung đột: {statement}. Quan điểm Agent B: {summary}. Trình bày quan điểm, lý do, và bằng chứng nào sẽ thay đổi.
4. Gọi lại Agent B với phản hồi của Agent A
5. PM tổng hợp và quyết định ràng buộc theo sứ mệnh chung
6. Ghi `_state.md`: xung đột, cả hai quan điểm, quyết định PM, lý do
7. Nếu quyết định PM đổi phạm vi hoặc yêu cầu kinh doanh → tăng cấp PO trước khi tiến

---

## Liên hệ tăng cấp

| Loại issue                   | Ai tăng cấp             | Cách                                              |
| ---------------------------- | ----------------------- | ------------------------------------------------- |
| Xung đột phạm vi             | Product Owner           | `/pm Escalate: {scope conflict description}`      |
| Mâu thuẫn quy tắc kinh doanh | Product Owner           | `/pm Escalate: {rule conflict description}`       |
| Quyết định tuân thủ/pháp lý  | Product Owner + pháp lý | Dừng pipeline, ghi blocker vào `_state.md`        |
| Không khả thi kỹ thuật       | Tech Lead + SA          | `/tech-lead Investigate options for {constraint}` |
| Lỗ hổng bảo mật (Critical)   | Security agent + PO     | `/security` + thông báo PO ngay lập tức           |

---

## Mục tiêu thời gian phục hồi

| Tình huống                       | Thời gian giải quyết mục tiêu |
| -------------------------------- | ----------------------------- |
| Thiếu artifact → gọi agent trước | < 30 phút                     |
| Changes requested → vòng rework  | < 2 giờ                       |
| QA fail → fix + retest           | < 4 giờ                       |
| Tăng cấp PO                      | Trả lời trong 1 ngày làm việc |
| Vượt hạn vòng tinh chỉnh         | Tăng cấp cùng ngày            |
