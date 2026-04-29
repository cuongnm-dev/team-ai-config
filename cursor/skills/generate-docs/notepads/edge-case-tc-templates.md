# Edge Case Test Templates (E6)

Reusable TC patterns cho common edge cases. Agent extend per feature.

**Usage**: `@Notepads edge-case-tc-templates` khi gen test cases.

---

## Auth & Permission

| TC template | Priority | Expected |
|---|---|---|
| Token hết hạn → access denied | Rất cao | 401 + "Phiên làm việc hết hạn" |
| Token không hợp lệ → reject | Rất cao | 401 + "Token không hợp lệ" |
| User role X access resource role Y → forbidden | Rất cao | 403 + "Không đủ quyền" |
| Concurrent login từ 2 devices → session policy | Cao | Per policy: invalidate-old / allow-both |
| Password brute force (5 fails) → account lock | Cao | Lock 15 phút + notify |
| SSO callback fail → graceful error | Cao | Redirect /login với error message |
| 2FA skip → block | Rất cao | Require 2FA code |

## Data Integrity

| TC template | Priority | Expected |
|---|---|---|
| Concurrent edit same record → optimistic lock | Cao | 409 Conflict + "Dữ liệu đã thay đổi" |
| Soft-delete visibility → filter out | Cao | Deleted records NOT in list |
| Audit trail on edit → log row inserted | Cao | audit_log có entry với user_id + diff |
| Cascade delete → dependent records handle | Cao | Per FK: CASCADE / RESTRICT / SET NULL |
| Unique constraint → conflict | Cao | 409 với field name |
| Empty required field → validation | Cao | 400 per field |
| Max length exceed → truncate or reject | Cao | Reject với "max N characters" |

## Network & Performance

| TC template | Priority | Expected |
|---|---|---|
| API timeout 30s → client abort | Trung bình | Graceful timeout message |
| Database connection lost → retry | Trung bình | Retry 3x, fallback error |
| Slow response 5s → loading indicator | Trung bình | Spinner visible during wait |
| Partial response → handle gracefully | Trung bình | Show partial + error for missing |
| 503 Service Unavailable → retry queue | Trung bình | Queue + notify |
| Large payload (10MB) → streaming | Trung bình | Handle via stream, no OOM |
| Rate limit exceed → throttle | Cao | 429 Too Many Requests + Retry-After |

## Localization & I18n

| TC template | Priority | Expected |
|---|---|---|
| Vietnamese diacritics input → store correctly | Cao | Database UTF-8, no mojibake |
| Copy-paste from Word → clean whitespace | Trung bình | Trim hidden chars |
| Long Vietnamese name (>100 chars) → wrap UI | Thấp | Text wrap không broken |
| Date input 31/02/2026 → validation | Cao | Reject invalid date |
| Currency amount 1,500,000 VND → parse | Cao | Parse thousands separator |
| Phone number formats (+84, 0, 084) → normalize | Cao | Store canonical format |

## Security

| TC template | Priority | Expected |
|---|---|---|
| SQL injection in input → sanitize | Rất cao | 400 hoặc parameterized OK |
| XSS script in text field → escape output | Rất cao | Render as text, not execute |
| File upload with script extension → reject | Rất cao | 415 + whitelist extensions |
| CSRF token missing → reject | Rất cao | 403 CSRF |
| Directory traversal in path → reject | Rất cao | 400 path validation |
| API key in URL → rewrite to header | Cao | Move to Authorization header |
| Sensitive data in logs → mask | Cao | password/token → *** in logs |

## Data Volume & Boundary

| TC template | Priority | Expected |
|---|---|---|
| Empty list → empty state UI | Cao | "Chưa có dữ liệu" message |
| 1 item → singular UI | Thấp | "1 kết quả" |
| 10,000 items → pagination works | Cao | Pages load < 1s |
| 1 million records → search indexed | Cao | Search p95 < 500ms |
| File 0 bytes → reject or handle | Trung bình | Error hoặc empty state |
| Text 0 chars → required validation | Cao | "Bắt buộc" |
| Text 10,000 chars → allow or truncate | Trung bình | Per business rule |

## Workflow & State

| TC template | Priority | Expected |
|---|---|---|
| State transition invalid (draft→done skip review) | Rất cao | 400 "Không thể chuyển trạng thái" |
| Concurrent state change → last-write-wins | Cao | Audit log có cả 2 attempts |
| Rollback state → records restored | Cao | Prior state + history preserved |
| Timer-based transition (pending→expired) → cron work | Cao | Scheduled job chạy đúng |
| Notification on transition → fire | Cao | Email/SMS sent within 1 phút |

## API Contract

| TC template | Priority | Expected |
|---|---|---|
| POST body empty → 400 | Cao | Error "Body bắt buộc" |
| Content-Type mismatch → 415 | Trung bình | "Unsupported media type" |
| Invalid JSON → 400 parse error | Cao | Error ngắn gọn, không stack trace |
| Unknown field in body → ignored or reject | Cao | Per policy: ignore (lenient) / 400 (strict) |
| Extra query param → ignored | Thấp | Không ảnh hưởng logic |
| Header X-Correlation-ID propagate → logs | Trung bình | Correlation trace qua logs |

---

## Usage guide

### Step 1 — Pick templates relevant to feature

Cho feature "Tạo yêu cầu":
- Auth: 2 TCs (token expired, insufficient permission)
- Data Integrity: 3 TCs (empty required, max length, unique title)
- Security: 1 TC (XSS in title field)
- Network: 1 TC (timeout handling)
- **Total**: 7 edge TCs + 3 happy path = 10 TCs cho feature

### Step 2 — Adapt placeholders

Replace `{feature-specific}` với:
- Endpoint path (from code-facts.routes)
- Field names (from DTO)
- Expected error messages (from i18n / backend code)

### Step 3 — Assign priority

Theo rubric trong `@Notepads priority-mapping`:
- Security + Auth → luôn "Rất cao"
- Core data integrity → "Cao"
- Boundary/format → "Cao" hoặc "Trung bình"
- Performance/i18n edge → "Trung bình" hoặc "Thấp"

---

## Avoid duplication

Nếu feature đã có TC cover 1 pattern, skip template đó. Ví dụ feature "Đăng ký" đã có "Email format validation" → không cần add template "Invalid email".

---

## Quality gate interaction

Phase 3.5 sẽ check:
- Min 5 UI TC / feature
- Min 3 API TC / endpoint

Nếu thiếu → gate block + suggest templates từ notepad này.
