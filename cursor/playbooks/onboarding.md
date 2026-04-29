# Sổ tay: Onboarding hệ thống

**Mục đích:** Giải thích toàn bộ hệ thống agent cho thành viên mới trong vòng 15 phút.

---

## Hệ thống này là gì?

Một **pipeline giao phần mềm do AI điều phối**, mỗi giai đoạn SDLC được xử lý bởi một agent AI chuyên biệt.

```
Bạn → /new-feature → Skill tạo _state.md → Dispatcher loop:
  [ba] → PM chọn path → [sa] → [tech-lead] → [dev] → [qa] → [reviewer]
                          ↑ PM được gọi khi cần judgment (exception, fail, blocked)
```

**Kiến trúc 4 tầng:**

| Tầng | Component | Vai trò |
|---|---|---|
| Entry | **Skill** (`/new-feature`, `/hotfix`, `/from-doc`) | Tạo `_state.md`, chạy dispatcher loop |
| Executor | **Dispatcher** (Composer 2 — rẻ, nhanh) | Gọi agent, cập nhật state, validate artifact. Khi cần judgment → gọi PM |
| Orchestrator | **PM** (Sonnet/Opus — thông minh) | Chọn path S/M/L, thêm extended roles, xử lý exception, escalate |
| Specialist | **Agents** (ba, sa, dev, qa...) | Làm việc chuyên môn, trả verdict |

**Khi nào PM được gọi?** Không phải mọi stage — chỉ khi:
- Sau BA (chọn path S/M/L)
- QA fail hoặc reviewer yêu cầu sửa (risk ≥ 3)
- Agent bị blocked
- Pipeline risk cao (≥ 4) → PM mỗi stage

**Khi nào dùng `@pm` trực tiếp?**
- Request mơ hồ, cần phân tích scope trước
- File drop vào `docs/input/`
- Hỏi về trạng thái pipeline

---

## Sơ đồ hệ thống

```
.cursor/
├── AGENTS.md               ← Quy ước chung: verdicts, traceability, output mode, paths
│
├── rules/                  ← Rules tự động load (alwaysApply: true hoặc glob match)
│   ├── agent-behavior.mdc  ← Routing, pipeline detection, skill list, guardrails
│   ├── delivery-pipeline.mdc ← Stage gates, artifact paths, skill routing format
│   ├── nx-workspace.mdc    ← NX CLI conventions (nếu dùng NX)
│   ├── project-knowledge.mdc ← Domain knowledge injection per agent
│   └── ui-template.mdc     ← UI template config (nếu dùng Figma)
│
├── agents/                 ← Hướng dẫn chuyên sâu, load on-demand bởi PM
│   ├── pm.md               ← Orchestrator — điều phối tất cả agent
│   ├── ba.md               ← Business analysis + domain modeling (merged)
│   ├── sa.md               ← Solution Architect
│   ├── tech-lead.md        ← Implementation planning
│   ├── dev.md              ← Backend/Fullstack Developer
│   ├── fe-dev.md           ← Frontend Developer
│   ├── qa.md               ← Quality Assurance
│   ├── reviewer.md         ← Final quality gate
│   ├── designer.md         ← UX/UI (điều kiện)
│   ├── security.md         ← Security review (điều kiện)
│   ├── devops.md           ← Infrastructure/deployment (điều kiện)
│   ├── release-manager.md  ← Release safety (điều kiện)
│   ├── sre-observability.md ← Reliability/SLO (điều kiện)
│   └── data-governance.md  ← Data compliance (điều kiện)
│
├── skills/                 ← Điểm vào workflow một lệnh (user-invoked)
│   │
│   ├── Workspace
│   │   ├── new-workspace/       → /new-workspace      — tạo workspace mới từ đầu
│   │   ├── new-project/         → /new-project        — thêm app/service vào monorepo
│   │   ├── configure-workspace/ → /configure-workspace — retrofit repo hiện có
│   │   ├── workspace-sync/      → /workspace-sync     — tổng hợp OVERVIEW.md + catalogs
│   │   └── ui-catalog/          → /ui-catalog         — quét Figma/template → component catalog
│   │
│   ├── Pipeline
│   │   ├── new-feature/         → /new-feature        — khởi động pipeline delivery
│   │   ├── update-feature/      → /update-feature     — sửa feature đã hoàn thành
│   │   ├── hotfix/              → /hotfix             — fast-track cho bug đã biết nguyên nhân
│   │   ├── resume-feature/     → /resume-feature    — tiếp tục sau khi gián đoạn
│   │   ├── feature-status/     → /feature-status    — standup (không arg) hoặc chi tiết (có feature-id)
│   │   ├── retrospective/       → /retrospective      — viết delivery retrospective
│   │   └── close-feature/      → /close-feature     — đóng pipeline, niêm phong _state.md
│   │
│   ├── Dev ad-hoc
│   │   ├── plan-feature/        → /plan-feature       — implementation plan trước khi code
│   │   ├── implement/           → /implement          — thực thi plan đã duyệt
│   │   ├── fix-bug/             → /fix-bug            — investigate + fix (nguyên nhân chưa biết)
│   │   ├── refactor-safe/       → /refactor-safe      — refactor không đổi behavior
│   │   └── breakdown/           → /breakdown          — URD/PRD → backlog kỹ thuật
│   │
│   ├── Planning
│   │   ├── estimate/            → /estimate           — ước tính effort/risk
│   │   ├── spike/               → /spike              — điều tra ẩn số kỹ thuật
│   │   ├── adr/                 → /adr                — ghi ADR (full hoặc quick mode)
│   │   ├── arch-review/         → /arch-review        — khảo sát kiến trúc codebase
│   │   └── health-check/        → /health-check       — dashboard KPI từ closed pipelines
│   │
│   ├── Release
│   │   ├── release/             → /release            — chuẩn bị release package
│   │   ├── go-nogo/             → /go-nogo            — pre-release gate check
│   │   ├── rollback/            → /rollback           — emergency rollback runbook
│   │   └── changelog/           → /changelog          — generate changelog từ closed pipelines
│   │
│   ├── Operations
│   │   ├── incident/            → /incident           — active incident coordination P0/P1
│   │   ├── postmortem/          → /postmortem         — blameless postmortem
│   │   └── runbook/             → /runbook            — operational runbook cho service
│   │
│   └── Quality
│       ├── gen-tests/           → /gen-tests          — sinh unit/integration tests
│       ├── review-pr/           → /review-pr          — code review ad-hoc
│       ├── tech-debt/           → /tech-debt          — audit nợ kỹ thuật
│       ├── dependency-audit/    → /dependency-audit   — check outdated/vulnerable deps
│       ├── security-scan/       → /security-scan      — OWASP security audit
│       └── compliance-check/    → /compliance-check   — GDPR/PCI/HIPAA compliance
│
└── playbooks/              ← Human reference guides (không tốn token agent)
    ├── quick-command-cheatsheet.md
    ├── incident-response.md
    ├── onboarding.md        ← file này
    └── quality-metrics.md
```

> **Lưu ý token:** `rules/*.mdc` được load tự động (tốn token). `agents/*.md` chỉ load khi PM invoke. `playbooks/` không bao giờ load tự động — chỉ dùng cho người đọc.

---

## Ba workflow khởi đầu

### Workspace mới (folder trống)
```
/new-workspace
```
Skill hỏi: tên, repo type (mini/mono), stack, preset (Starter/Standard/Custom), features.
Tự động tạo: source code, `.cursor/AGENTS.md`, docker-compose.yml, .env, ADRs, CLAUDE.md.
**Docker luôn được setup** — `docker compose up -d` để khởi động services.

### Thêm app/service vào monorepo có sẵn
```
/new-project
```
Hỏi: type (app/service/package), tên, stack.
Tự động: scaffold, Dockerfile, cập nhật docker-compose.yml + .env, cập nhật AGENTS.md.

### Repo có code nhưng thiếu `.cursor/` config
```
/configure-workspace
```
Auto-detect stack, gap-analyze, generate ONLY những file còn thiếu. Không động vào code hiện có.

---

## Bắt đầu tính năng mới

```
/new-feature
```
Skill sẽ hỏi: tên tính năng, mục tiêu kinh doanh, phạm vi (in/out), ràng buộc, độ ưu tiên.
Sau đó tự tạo `{docs_path}/{feature-id}/` và invoke `pm`.

**Feature ID format:** `{PREFIX-YYYYMMDD-NNN}` — prefix viết tắt tên project (2-6 chữ hoa)
Ví dụ: `SHOP-20260401-001`, `AUTH-20260415-003`

---

## Tiếp tục sau khi khởi động lại IDE

```
/resume-feature {feature-id}
```
Đọc `_state.md`, xác định stage hiện tại, tiếp tục từ checkpoint cuối cùng.

---

## Kiểm tra trạng thái

```
/feature-status             ← standup: tất cả pipelines đang active
/feature-status SHOP-20260401-001  ← chi tiết một pipeline
```

---

## Chỉnh sửa feature đã hoàn thành

```
/update-feature
```
Đọc artifacts hiện có làm baseline, triage giai đoạn nào cần chạy lại, giữ nguyên feature-id.

---

## Xử lý lỗi nghiêm trọng

```
/hotfix        ← nguyên nhân đã biết, skip BA + SA
/fix-bug       ← chưa biết nguyên nhân, cần điều tra
```

---

## Tổng quan pipeline stages

| Stage | Agent | Output |
|---|---|---|
| Intake | `pm` | Workflow decision, stage plan |
| Business analysis + domain modeling | `ba` | Requirements, user stories, ACs + bounded contexts, aggregates, domain events |
| Architecture | `sa` | Solution design, security model, trade-offs |
| Implementation plan | `tech-lead` | Wave plan, task breakdown, dev guidance |
| Implementation | `dev` / `fe-dev` | Code + tests + verification evidence |
| QA | `qa` | Test coverage matrix, defects, verdict |
| Review | `reviewer` | Approved / Changes-requested verdict |
| Retrospective | `pm` + `dev` | KPI summary, lessons learned |

**Agents điều kiện** (chỉ kích hoạt khi PM thấy cần):

| Agent | Khi nào |
|---|---|
| `designer` | BA flag UI/UX impact |
| `security` | Auth/PII/payment/secrets boundary change |
| `devops` | Infra/env vars/migration changes |
| `release-manager` | DB migration, multi-service deployment, rollback phức tạp |
| `sre-observability` | External integration, SLO-sensitive paths, high traffic |
| `data-governance` | Cross-system data, retention/compliance constraints |

---

## Artifact storage

```
{docs_path}/                     ← từ _state.md frontmatter, ví dụ:
                                   mini:    docs/features/{feature-id}/
                                   mono app: apps/{name}/docs/features/{feature-id}/
                                   mono svc: services/{name}/docs/features/{feature-id}/
├── _state.md                    ← pipeline tracker (PM quản lý)
├── ba/                          ← BA artifacts (lean: 1 file; full: 8 files)
├── domain-analyst/              ← DA artifacts
├── sa/                          ← SA artifacts
├── 02-designer-report.md        ← điều kiện
├── 04-tech-lead-plan.md
├── 05-dev-w{N}-{task}.md        ← một file/wave/task
├── 07-qa-report.md
├── 08-review-report.md
└── 09-retrospective.md
```

**docs_path** được xác định từ bảng `Docs-Path Formula` trong `.cursor/AGENTS.md` — agents không bao giờ tự đoán.

---

## Quy ước quan trọng

**Verdict labels** — dùng chính xác, không diễn đạt lại:

| Agent | Verdicts hợp lệ |
|---|---|
| `ba` | `Ready for solution architecture` / `Ready for Technical Lead planning` / `Need clarification` / `Blocked` |
| `sa` | `Ready for Technical Lead planning` / `Ready with known risks` / `Need clarification` / `Blocked` |
| `dev` | `Ready for QA` / `Ready with known risks` / `Need clarification` / `Blocked` |
| `qa` | `Pass` / `Pass with risks` / `Fail` / `Blocked` |
| `reviewer` | `Approved` / `Approved with follow-ups` / `Changes requested` / `Blocked` |

**Traceability** — AC IDs (AC-001, AC-002...) phải xuất hiện trong:
- Dev: Requirement Mapping table (mỗi AC có Status rõ ràng)
- QA: mỗi test case tham chiếu ít nhất một AC ID
- Reviewer: explicit AC coverage list

**Output mode:**
- `lean` (mặc định): 1 file dense per stage — tiết kiệm ~73% token
- `full`: đầy đủ narrative artifacts — dùng cho compliance, onboarding, high-risk features

**Ngôn ngữ:** Tất cả artifact và inter-agent communication bằng tiếng **Anh**.

---

## Sai lầm thường gặp

| Sai lầm | Hậu quả | Cách đúng |
|---|---|---|
| Gọi `/ba`, `/sa`, `/dev` trực tiếp | Vượt stage-gate, phá vỡ _state.md | Luôn đi qua `/new-feature` hoặc `/pm` |
| Dùng `/resume-feature` cho feature đã đóng | Hỏng trạng thái đã niêm phong | Dùng `/update-feature` |
| Chấp nhận "build passes" làm evidence QA | Static ≠ runtime behavior | Yêu cầu executed evidence cho AC quan trọng |
| Bỏ qua reviewer vì thay đổi "nhỏ" | Security/regression ẩn | Không bao giờ skip reviewer |
| Tiếp tục pipeline không đọc `_state.md` | Chạy lại stage đã hoàn thành | Luôn dùng `/resume-feature` |
| PM tự viết requirements | Vi phạm role scope | `/pm` → delegate BA → BA viết |
| Không chạy `docker compose up -d` trước | Services chưa ready | Docker là bắt buộc — start trước khi dev |

---

## Hỗ trợ & tham khảo

- **Pipeline bị kẹt?** → `playbooks/incident-response.md`
- **Đo chất lượng?** → `playbooks/quality-metrics.md`
- **Lệnh nhanh?** → `playbooks/quick-command-cheatsheet.md`
- **Hành vi agent không rõ?** → `agents/{role}.md`
- **Xung đột quy tắc?** → `rules/agent-behavior.mdc`
