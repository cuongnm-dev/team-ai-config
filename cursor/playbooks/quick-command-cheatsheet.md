# Bảng Lệnh Nhanh

Mục đích: Chuẩn hóa các lệnh vận hành đa agent để giao hàng theo stage-gate nhất quán.

## Quy tắc cốt lõi

- Luôn chạy qua stage-gate: `pm → ba → [designer] → sa → tech-lead → dev → qa → reviewer`
- Các agent trong `[]` là điều kiện. PM chỉ điều phối; PM không triển khai mã.
- **Không bao giờ gọi agent trực tiếp** (`/ba`, `/sa`, `/dev`, v.v.) — điều này vượt qua stage-gate và phá vỡ tracking `_state.md`. Luôn dùng skill hoặc `/pm`.

---

## Khởi động workspace / dự án

```text
# Tạo workspace mới từ đầu (folder trống)
/new-workspace

# Thêm app/service mới vào monorepo đã có
/new-project

# Cấu hình .cursor/ cho repo có code nhưng chưa setup pipeline
/configure-workspace
```

---

## Vòng đời pipeline

```text
# Bắt đầu tính năng mới (toàn bộ SDLC)
/new-feature

# Sửa tính năng đã hoàn thành (thêm/xóa/sửa chức năng)
/update-feature

# Lỗi nghiêm trọng — nguyên nhân rõ, phạm vi ≤ 3 file
/hotfix

# Tiếp tục pipeline bị gián đoạn sau khởi động lại hoặc thảo luận
/resume-feature

# Kiểm tra trạng thái pipeline (không có arg = standup tất cả; có feature-id = chi tiết 1)
/feature-status
/feature-status {feature-id}

# Đóng pipeline hoàn thành, niêm phong trạng thái, xóa ngữ cảnh
/close-feature
```

---

## Phát triển ad-hoc (ngoài pipeline)

```text
/plan-feature    — khảo sát codebase, viết implementation plan trước khi code
/implement       — thực thi plan đã duyệt
/fix-bug         — điều tra nguyên nhân chưa biết, sửa, regression test
/refactor-safe   — refactor trong phạm vi giới hạn, không đổi behavior
/breakdown       — biến URD/BA spec/PRD thành backlog kỹ thuật
/spike           — điều tra kỹ thuật cho các ẩn số trước khi commit
```

---

## Lập kế hoạch & phân tích

```text
/estimate        — ước tính nỗ lực/rủi ro trước khi mở pipeline
/adr             — ghi nhận quyết định kiến trúc (full hoặc quick mode)
/arch-review     — khảo sát codebase, dựng dependency map, phát hiện anti-patterns
/health-check    — bảng điều khiển sức khỏe dự án (KPIs từ các pipeline đã đóng)
```

---

## Release & deployment

```text
/release         — chuẩn bị toàn bộ release package (notes + checklist)
/go-nogo         — pre-release gate check: build/migrations/env/rollback sẵn sàng?
/rollback        — lập kế hoạch và thực thi emergency rollback
/changelog       — generate changelog từ các pipeline đã đóng
```

---

## Operations & reliability

```text
/incident        — điều phối sự cố production P0/P1
/postmortem      — viết blameless postmortem sau sự cố
/runbook         — tạo operational runbook cho service đã deploy
```

---

## Quality & compliance

```text
/gen-tests       — sinh unit/integration tests theo pattern repo
/review-pr       — review PR/diff ad-hoc (không cần QA pass trước)
/tech-debt       — audit và đăng ký nợ kỹ thuật trong một module
/dependency-audit — check for outdated/vulnerable deps
/security-scan   — on-demand security audit (OWASP-aligned)
/compliance-check — GDPR/PCI/HIPAA/SOC2 compliance review
```

---

## Tăng cấp & điều phối qua PM

```text
/pm <yêu cầu>

# Ví dụ:
/pm Điều phối issue này theo stage-gate.
/pm Escalate to PO — <mô tả xung đột phạm vi>
/pm Pipeline is blocked at <stage> — <mô tả blocker>
```

---

## Skill routing block (output cuối mỗi skill)

Mỗi skill và agent phải kết thúc bằng:

```
## ▶ What's next?

→ Auto-invoking: /{skill} {args}     ← khi không có gì cần xem xét
  Reason: {một dòng}

→ Suggested: /{skill} {args}         ← khi cần user xem xét
  Reason: {một dòng}
  Run now? (yes / skip)

→ Stopped. Blocker: {description}    ← khi bị chặn
```

---

## Handoff JSON bắt buộc (tất cả agents)

```json
{
  "ticket_id": "<PREFIX-YYYYMMDD-###>",
  "agent": "<pm|ba|sa|tech-lead|dev|qa|reviewer>",
  "verdict": "<role-allowed-label>",
  "next_owner": "<role>",
  "missing_artifacts": ["<artifact>"],
  "blockers": ["<blocker>"],
  "risk_level": "<low|medium|high|critical>",
  "risk_score": "<1|2|3|4|5>",
  "evidence_refs": ["<path-or-id>"],
  "sla_due": "<ISO-8601>"
}
```

---

## KPI telemetry bắt buộc (tất cả agents)

```json
{
  "kpi": {
    "cycle_time_minutes": "<number>",
    "rework_count": "<int>",
    "retry_count": "<int>",
    "blocked_count": "<int>"
  }
}
```

---

## SLA mặc định

| Agent                  | SLA mỗi vòng | Max vòng               |
|------------------------|--------------|------------------------|
| BA làm rõ              | 30 phút      | 2                      |
| SA làm rõ              | 45 phút      | 2                      |
| Tech-lead lập kế hoạch | 45 phút      | 2                      |
| Dev triển khai         | 90 phút/wave | 2 lần sửa              |
| QA                     | 60 phút      | 2 chu kỳ retest        |
| Reviewer               | 45 phút      | 2 vòng changes-requested |

PM phải tăng cấp khi vượt giới hạn thử lại.

---

## Quy ước ID

| Loại | Format | Ví dụ |
|---|---|---|
| Feature ID | `{PREFIX-YYYYMMDD-NNN}` | `SHOP-20260401-001` |
| ticket_id trong JSON | `{PREFIX-YYYYMMDD-NNN}` | Giữ nguyên xuyên suốt pipeline |
| Prefix | 2-6 chữ hoa, viết tắt tên project | `SHOP`, `AUTH`, `CMS` |

---

## Thang điểm rủi ro (1–5)

| Điểm | Mức | Hành động |
|---|---|---|
| 1 | Không đáng kể | Không cần xử lý đặc biệt |
| 2 | Thấp | Ghi vào `_state.md`, tiếp tục |
| 3 | Trung bình | Đánh giá agent điều kiện (security/sre/devops) |
| 4 | Cao | **Phải** đánh giá agent điều kiện, ghi lý do |
| 5 | Nguy cấp | Dừng pipeline, tăng cấp PO |

---

## Ma trận kích hoạt vai trò mở rộng

| Điều kiện | Thêm vai trò | Giai đoạn |
|---|---|---|
| DB migration, backfill, rollback phức tạp | `release-manager` | Sau tech-lead |
| Auth/authz, PII, payment, secrets | `security` | Cùng SA (Path L) + cùng reviewer |
| External integration, timeout/retry/idempotency | `sre-observability` | Cùng SA + cùng QA |
| SLO-sensitive paths, high traffic | `sre-observability` | Từ tech-lead trở đi |
| Data ownership conflict, retention/compliance | `data-governance` | Cùng BA + cùng SA |

Max 2 vai trò mở rộng / pipeline. Nếu `risk_score ≥ 4`: PM phải ghi lý do kích hoạt.

---

## Cây quyết định nhanh PM (10 giây)

```
IF migration DB/backfill/rollback phức tạp → thêm release-manager
IF auth/PII/payment/secrets → thêm security
IF external integration / SLO-sensitive → thêm sre-observability
IF data ownership conflict / compliance → thêm data-governance
IF risk_score ≥ 4 VÀ chưa có agent mở rộng → Need clarification
IF > 2 agent mở rộng → yêu cầu lý do rõ
```

---

## Quy tắc cứng (tất cả vai trò)

- Ưu tiên: `Safety/Role constraints > Quality gates > Task request > Style`
- Không bỏ qua verdict, handoff JSON, hoặc evidence gates dù khẩn cấp
- Nếu yêu cầu mâu thuẫn ranh giới vai trò → từ chối và chuyển đúng vai trò
