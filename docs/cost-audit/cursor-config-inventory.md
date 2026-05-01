---
generated: 2026-05-01
project: D:\Projects\ufh-rfid
purpose: Audit Cursor harness inventory. User marks each item "keep" or "disable".
---

# Cursor Configuration Inventory

Mark each item with `[x] keep` or `[ ] disable` to drive the next cleanup pass.

## Summary

| Category | Total items | Total size | Total tokens (est) |
|---|---|---|---|
| Rules (.mdc) | 8 | 27,303B | ~6,825 |
| Skills (SKILL.md) | 26 | 240,196B | ~60,049 |
| Agents (.cursor/agents/*.md) | 31 | 475,667B | ~118,916 |
| MCP plugins discovered | 10 | 865B | ~216 |
| **TOTAL** | | **744,031B** | **~186,007** |

*Caveat: not all of this loads at every Task(). Confirm with empirical test.*

## Rules

Rules with `alwaysApply: true` load into EVERY Task() context. Glob-triggered load only when files match.

| Keep? | Always? | Tokens | Globs | File | Description |
|---|---|---|---|---|---|
| [x] | 🔴 YES | 1,483 | - | `user/00-agent-behavior.mdc` | Universal agent behavioral boundaries — pipeline routing, ex |
| [x] | glob/manual |   758 | - "nx.json" | `user/10-project-structure.mdc` | Generic NX monorepo structure template — directory layout, f |
| [x] | glob/manual |   546 | - "nx.json" | `user/11-nx-workspace.mdc` | NX workspace conventions — use NX CLI, project graph, module |
| [x] | glob/manual |   453 | ["**/*.tsx", "**/*.jsx"] | `user/12-metronic-component-workflow.mdc` | Metronic component mapping workflow for FE development. Auto |
| [x] | glob/manual |   421 | - | `user/30-ui-template.mdc` | UI template — project-specific config for designer and fe-de |
| [x] | glob/manual |   605 | [] | `user/40-project-knowledge.mdc` | Accumulated project knowledge from delivered features. PM re |
| [x] | glob/manual | 1,032 | - "src/**/*.{ts,tsx,js,jsx,py, | `user/50-sdlc-role-coding.mdc` | "SDLC role-aware coding rules — auto-attached when editing f |
| [x] | glob/manual | 1,525 | - | `user/90-delivery-pipeline.mdc` | "Delivery pipeline quick reference — stage order (Path S/M/L |

## Skills (~/.cursor/skills/)

Skills are user-invokable via slash commands. Cursor 3 may register all of them at startup.

**Mark essential = used in your daily SDLC pipeline. Optional = rarely used / project-specific.**

| Keep? | Tokens | Skill | Description |
|---|---|---|---|
| [?] | 1,044 | `adr` (optional — review) | Ghi chép lại một quyết định kiến trúc quan trọng (Architecture Decision Record). |
| [?] | 1,841 | `arch-review` (optional — review) | Khảo sát toàn bộ kiến trúc dự án và đăng ký nợ kỹ thuật. Có 2 chế độ: review (ph |
| [?] |   622 | `audit` (optional — review) | Kiểm toán dự án về 3 mặt khác nhau, chọn 1 chế độ khi chạy: security (lỗ hổng bả |
| [?] |   764 | `cache-lint` (optional — review) | Quét toàn bộ file cấu hình agent và skill để phát hiện vi phạm quy tắc tối ưu pr |
| [x] | 3,632 | `close-feature` (SDLC essential) | Đóng pipeline phát triển 1 tính năng đã hoàn thành. Kiểm tra đã có người duyệt c |
| [x] |   582 | `code-change` (SDLC essential) | Sửa lỗi hoặc tái cấu trúc code một cách an toàn. Có 2 chế độ: fix (điều tra nguy |
| [x] | 3,406 | `configure-workspace` (config — keep but rare) | Trang bị cấu hình pipeline `.cursor/` cho repo có sẵn, đồng thời đồng bộ phiên b |
| [x] | 1,292 | `feature-status` (SDLC essential) | Xem trạng thái pipeline đang chạy và sức khỏe tổng thể dự án. 4 chế độ: standup  |
| [x] | 1,965 | `from-doc` (SDLC essential) | Đọc tài liệu mô tả nghiệp vụ (PDF, Word, ảnh, file test case) để phân tích sâu,  |
| [ ] | 6,215 | `generate-docs` (doc-gen — đã chuyển sang Claude/MCP, có thể disable) | Sinh trọn bộ tài liệu kỹ thuật ETC từ mã nguồn dự án — gồm Thiết kế Kỹ thuật, Th |
| [?] | 1,788 | `hotfix` (optional — review) | Pipeline rút gọn dành riêng cho lỗi nghiêm trọng đã xác định rõ nguyên nhân. Bỏ  |
| [x] | 1,535 | `implement` (SDLC essential) | Triển khai code theo đúng kế hoạch đã được duyệt (từ /plan-feature hoặc tech-lea |
| [?] | 1,605 | `incident` (optional — review) | Điều phối xử lý sự cố mức P0/P1 và viết báo cáo postmortem sau đó. Có 2 chế độ:  |
| [?] | 1,044 | `intel-snapshot` (optional — review) | Sinh bản tóm tắt nén (Markdown ~3-5K token) từ các file intel JSON gốc (50K+ tok |
| [x] | 6,132 | `new-feature` (SDLC essential) | Khởi tạo pipeline cho 1 tính năng mới, tiếp tục pipeline đang dở, hoặc cập nhật  |
| [x] | 3,613 | `new-project` (config — keep but rare) | Thêm 1 app, service hoặc package mới vào workspace monorepo hiện tại. Đọc .curso |
| [x] | 4,249 | `new-workspace` (config — keep but rare) | Tạo workspace mới cho dự án — chọn giữa mini-repo (1 service đơn lẻ) hoặc monore |
| [x] |   641 | `plan` (SDLC essential) | Khảo sát phạm vi công việc, ước lượng effort, lập kế hoạch triển khai. 3 chế độ: |
| [x] |   503 | `quality` (SDLC essential) | Review code hoặc sinh test tự động. 2 chế độ: review (xem PR/diff để góp ý chất  |
| [?] |   660 | `release` (optional — review) | Quản lý phát hành phiên bản. 4 chế độ: prepare (chuẩn bị release — check list, v |
| [x] | 4,914 | `resume-feature` (SDLC essential) | Tiếp tục pipeline đang dở từ checkpoint cuối cùng. Hỗ trợ cả pipeline phát triển |
| [?] | 1,332 | `runbook` (optional — review) | Tạo runbook vận hành cho 1 tính năng hoặc service đã chạy production. SRE liệt k |
| [x] | 1,885 | `spike` (SDLC essential) | Điều tra kỹ thuật khi chưa rõ giải pháp — chạy trước khi mở pipeline triển khai  |
| [?] | 4,040 | `strategic-critique` (optional — review) | Đóng vai cán bộ thẩm định (Bộ/Tỉnh/Sở) phản biện ngược lại Đề án Chuyển đổi số b |
| [?] |   735 | `ui-catalog` (optional — review) | Tạo file docs/ui-library/component-catalog.md bằng cách quét Figma kit hoặc mã n |
| [?] | 4,000 | `zip-disk` (optional — review) | Đóng gói toàn bộ sản phẩm bàn giao thành 1 file ZIP để giao khách hàng hoặc ghi  |

## MCP Plugins

### Configured (mcp.json) — 2 servers

| Keep? | Server | Notes |
|---|---|---|
| [x] | `etc-platform` | (used by pipeline) |
| [x] | `playwright` | (used by pipeline) |

### Discovered in project mcps/ but NOT configured — 10

These plugins exist in your project's `~/.cursor/projects/<key>/mcps/` directory. Even though `mcp.json` doesn't reference them, Cursor 3 may auto-register their tool definitions.

| Keep? | Plugin | Tools | Note |
|---|---|---|---|
| [ ] | `plugin-context7-context7` | 0 | AUTO-INSTALLED — disable in Cursor settings |
| [ ] | `plugin-context7-plugin-context7` | 0 | AUTO-INSTALLED — disable in Cursor settings |
| [ ] | `plugin-figma-figma` | 0 | AUTO-INSTALLED — disable in Cursor settings |
| [ ] | `plugin-gitlab-GitLab` | 0 | AUTO-INSTALLED — disable in Cursor settings |
| [x] | `plugin-playwright-playwright` | 0 | configured |
| [ ] | `plugin-sentry-sentry` | 0 | AUTO-INSTALLED — disable in Cursor settings |
| [ ] | `plugin-supabase-supabase` | 0 | AUTO-INSTALLED — disable in Cursor settings |
| [x] | `user-etc-platform` | 0 | configured |
| [ ] | `user-nrwl.angular-console-extension-nx-mcp` | 0 | AUTO-INSTALLED — disable in Cursor settings |
| [x] | `user-playwright` | 0 | configured |

## Agents (~/.cursor/agents/)

Custom subagents invoked via `Task(subagent_type='X')`. Cursor 3 may pre-register all 44 files.

| Keep? | Tokens | Agent | Description |
|---|---|---|---|
| [x] | 5,220 | `ba-pro` (SDLC core) | [ESCALATION TIER — opus] "Phân tích nghiệp vụ + mô hình domain cho 1 feature. Us |
| [x] | 5,086 | `ba` (SDLC core) | Phân tích nghiệp vụ + mô hình domain cho 1 feature. User stories, AC, business r |
| [x] | 3,631 | `data-governance` (SDLC extended) | "Phân tích data ownership, PII, GDPR/PDPA compliance. Parallel với ba/sa khi fea |
| [x] | 4,372 | `designer` (SDLC core) | "Phân tích UI/UX flow, form behavior, empty/error/loading states. Chạy khi BA đá |
| [x] | 4,904 | `dev-pro` (SDLC core) | [ESCALATION TIER — opus] "Implement 1 task/wave từ tech-lead plan: code + tests  |
| [x] | 4,771 | `dev` (SDLC core) | "Implement 1 task/wave từ tech-lead plan: code + tests + validation + auth. Outp |
| [x] | 4,053 | `devops` (SDLC core) | "Pre-deploy readiness: env vars, schema migrations, CI/CD, Docker. Chạy khi tech |
| [x] | 7,515 | `dispatcher` (SDLC core) | "Pipeline executor: 1 invocation = 1 stage. Routes agents, validates artifacts,  |
| [x] | 5,748 | `fe-dev` (SDLC core) | "Implement frontend (React/Vue, pages, forms, a11y). Yêu cầu designer + tech-lea |
| [x] | 2,498 | `pm` (SDLC core) | "Delivery orchestrator: judgment calls (path selection, exceptions, extended rol |
| [x] | 6,143 | `qa-pro` (SDLC core) | [ESCALATION TIER — opus] "Test 1 feature: 3 atomic artifacts (TC prose + Playwri |
| [x] | 6,010 | `qa` (SDLC core) | "Test 1 feature: 3 atomic artifacts (TC prose + Playwright spec + screenshots).  |
| [x] | 3,911 | `ref-canonical-intel` (reference doc, agent loads on demand) |  |
| [x] | 1,109 | `ref-mcp-optional` (reference doc, agent loads on demand) |  |
| [x] | 1,255 | `ref-pm-dispatch` (reference doc, agent loads on demand) | Agent Dispatch Reference — when to invoke each agent, placement in pipeline, and |
| [x] | 1,115 | `ref-pm-exceptions` (reference doc, agent loads on demand) |  |
| [x] | 1,198 | `ref-pm-mcp` (reference doc, agent loads on demand) |  |
| [x] | 1,017 | `ref-pm-proactive` (reference doc, agent loads on demand) | PM proactive situation recognition tables — auto-trigger, post-close suggestions |
| [x] | 1,171 | `ref-pm-retrospective` (reference doc, agent loads on demand) |  |
| [x] | 2,405 | `ref-pm-rules` (reference doc, agent loads on demand) |  |
| [x] | 4,579 | `ref-pm-standards` (reference doc, agent loads on demand) |  |
| [x] | 2,093 | `ref-pm-templates` (reference doc, agent loads on demand) |  |
| [x] | 2,971 | `release-manager` (SDLC extended) | "Plan release sequencing + rollback verification. Chạy khi risk>=3 + DB migratio |
| [x] | 5,294 | `reviewer-pro` (SDLC core) | [ESCALATION TIER — opus] "Quality gate cuối: requirement + architecture + code q |
| [x] | 5,160 | `reviewer` (SDLC core) | "Quality gate cuối: requirement + architecture + code quality + security + test  |
| [x] | 6,038 | `sa-pro` (SDLC core) | [ESCALATION TIER — opus] "Thiết kế kiến trúc 1 feature: routes, entities, integr |
| [x] | 5,905 | `sa` (SDLC core) | "Thiết kế kiến trúc 1 feature: routes, entities, integrations, permission concre |
| [x] | 3,035 | `security` (SDLC core) | "Threat model + security findings. Chạy khi feature chạm auth/PII/payment hoặc s |
| [x] | 3,328 | `sre-observability` (SDLC extended) | "Resilience gap + SLO/SLI definition + monitoring. Chạy khi feature có integrati |
| [x] | 6,379 | `tech-lead` (SDLC core) | "Phân rã implementation thành tasks + execution waves (max 4 dev/wave). Chạy sau |
| [x] |   992 | `telemetry` (SDLC extended) | "Background recorder: token usage, cache hit, stage timing -> JSONL. Read-only _ |


## Suggested action — pre-filled

Based on your stated direction:
- **Doc-gen via Claude/MCP** (already migrated) → 9 legacy `doc-*` agents + `generate-docs` skill can DISABLE on Cursor
- **`tdoc-*` agents** also Claude-side → can DISABLE on Cursor
- **Plugins not used in PoC/MVP work** (figma, gitlab, prisma, sentry, supabase) → DISABLE in Cursor settings
- **Optional skills** (adr, arch-review, audit, cache-lint, hotfix, incident, intel-snapshot, release, runbook, strategic-critique, ui-catalog, zip-disk) → review and disable rarely-used ones

Estimated savings if 9 doc agents + 4 tdoc agents removed (or moved to ~/.cursor-archive/):
- 13 agent files × ~6K tokens avg = ~78K tokens removed from agent registry

Estimated if 5 unused MCP plugins disabled (figma, gitlab, prisma×2, sentry, supabase):
- Each plugin metadata + tool defs: ~5-15K tokens × 5-7 instances = ~30-100K tokens

Estimated if 8 optional skills disabled:
- 8 skills × ~2K tokens (frontmatter + body intro) = ~16K tokens

**Total expected harness reduction: ~120-200K tokens per Task()** = $0.04-0.06 per event × 12 events/day = **~$0.50-0.70/day saved per user just from disable cleanup.**

## Next steps after marking

1. User edits this file, marks `[ ]` next to items to disable.
2. Run `python apply-cursor-config-cleanup.py cursor-config-inventory.md` (will be created) to:
   a. Move disabled agent .md to `~/.cursor-archive/agents/`
   b. Move disabled skill dirs to `~/.cursor-archive/skills/`
   c. Remove disabled MCP plugins from `mcp.json` and project mcps/ folder
   d. Update rules `alwaysApply: false` if marked
3. Restart Cursor.
4. Run F-004 spike, measure new floor.
