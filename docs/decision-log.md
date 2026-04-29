---
title: Decision Log — Architectural decisions
order: 92
---

# Decision Log (ADRs)

Các quyết định kiến trúc lớn của team-ai-config. Mỗi mục: bối cảnh → quyết định → hệ quả → trạng thái.

Format theo [ADR](https://github.com/joelparkerhenderson/architecture-decision-record) tinh giản.

---

## ADR-001: Single source of truth qua `ai-kit` CLI

**Ngày**: 2026-04-25 · **Trạng thái**: ✅ Adopted

**Bối cảnh**: Team có ~6 người, mỗi người tự sửa `~/.claude` + `~/.cursor` — drift mạnh, không reproducible.

**Quyết định**: Mọi config (agents, skills, MCP image) đi qua repo `team-ai-config`. CLI `ai-kit` là cách duy nhất để deploy/update. Sửa local sẽ bị overwrite ở lần update tiếp theo.

**Hệ quả**:
- ✅ Mọi người có cùng phiên bản, debug dễ
- ✅ Onboarding 1 lệnh
- ❌ Không sửa nhanh local được → buộc PR

---

## ADR-002: Node.js + Ink cho ai-kit CLI

**Ngày**: 2026-04-29 · **Trạng thái**: ✅ Adopted (replaces ADR-002a: bash + PowerShell)

**Bối cảnh**: Phiên bản đầu tiên là 2 file song song (`ai-kit` bash + `ai-kit.ps1`). Đau đầu với BOM, codepage, native errors, version drift giữa 2 platform. Gemini CLI cho thấy Node + Ink cho TUI đẹp & nhất quán cross-platform.

**Quyết định**: Rewrite CLI sang Node.js + [Ink](https://github.com/vadimdemedes/ink). Yêu cầu Node ≥ 18. Bash/PowerShell wrapper chỉ là thin shim gọi `node ai-kit.mjs`. Legacy bash/PS giữ lại làm fallback (`ai-kit.legacy*`).

**Hệ quả**:
- ✅ 1 codebase, behavior nhất quán
- ✅ Render đẹp (border, color, spinner)
- ✅ Xử lý async (docker, fetch healthz) sạch sẽ
- ❌ Thêm dependency Node 18+ (bootstrap auto-install)
- ❌ ~120 packages trong `node_modules` (~30MB)

---

## ADR-003: Docker Hub multi-arch image cho MCP

**Ngày**: 2026-04-26 · **Trạng thái**: ✅ Adopted

**Bối cảnh**: Team dùng cả Mac M1/M2 (arm64), Mac Intel (amd64), Windows (amd64), Linux (mixed). Image only-amd64 chạy emulation chậm trên M1.

**Quyết định**: Build qua `docker buildx build --platform linux/amd64,linux/arm64 --push`. Image public ở `o0mrblack0o/etc-platform`. Maintainer chạy `release-mcp.{ps1,sh}` để rollout.

**Hệ quả**:
- ✅ M1/M2 chạy native, fast
- ❌ Build time gấp đôi
- ❌ Phải kỷ luật cleanup repo cũ (Docker Hub free tier giới hạn)

---

## ADR-004: Bind mount `./data:/data` thay vì named volume

**Ngày**: 2026-04-26 · **Trạng thái**: ✅ Adopted

**Bối cảnh**: Image chạy non-root user (`docgen` UID 1000). Named volume mặc định ownership root → permission denied.

**Quyết định**: Compose dùng `./data:/data`. Docker Desktop xử lý permission tự động trên Mac/Win. Linux user có thể cần `chown 1000:1000 data/` lần đầu.

**Hệ quả**:
- ✅ Hoạt động trên Mac/Win không cần sudo
- ❌ Linux có thể cần adjustment lần đầu (documented in troubleshooting)

---

## ADR-005: LIFECYCLE contract cho mọi agent/skill

**Ngày**: 2026-04-27 · **Trạng thái**: ✅ Adopted

**Bối cảnh**: Khi 1 feature đi qua `from-doc → resume-feature → close-feature → generate-docs`, mỗi skill có thể read/write canonical intel. Không có contract → silent drift, race condition, agent re-discover thay vì reuse.

**Quyết định**: Mọi agent/skill có 1 "contract box" với 8 trường: ROLE, READ-GATES, OWN-WRITE, ENRICH, FORBID, EXIT-GATES, FAILURE, TOKEN-BUDGET. Class A/B/C/D phân loại agent. PR vi phạm contract bị block.

**Hệ quả**:
- ✅ Single-writer per field — không silent override
- ✅ Read-validate-write — phát hiện stale sớm
- ✅ Token economy
- ❌ Phải maintain LIFECYCLE.md + sync mọi agent file (~640 dòng)

→ Tham khảo `~/.claude/schemas/intel/LIFECYCLE.md` (bản canonical).

---

## ADR-006: Canonical ID `F-NNN` (mini-repo) / `{service}-F-NNN` (monorepo)

**Ngày**: 2026-04-28 · **Trạng thái**: ✅ Adopted

**Bối cảnh**: `from-doc` phát ID `BOTP-YYYYMMDD-NNN`, `from-code` phát `F-NNN`, `new-feature` phát ID khác → shape mismatch trong `_state.md`, không match được features cùng dự án.

**Quyết định**: 1 format duy nhất. ID immutable sau commit. Producer đầu tiên phát ID, các producer sau lookup qua feature-catalog + `id-aliases.json`.

**Hệ quả**:
- ✅ resume-feature consumer không cần biết producer
- ❌ Migration: các feature legacy phải có entry trong `id-aliases.json`

---

## ADR-007: English-only cho agent/skill prompts (CD-9)

**Ngày**: 2026-04-20 · **Trạng thái**: ✅ Adopted

**Bối cảnh**: Prompt tiếng Việt tốn nhiều token hơn (Vietnamese encoding ~2x). Skills lớn `/from-code` đọc 100K+ token prompt.

**Quyết định**: Mọi agent/skill **body** + **frontmatter description** viết bằng tiếng Anh. Tiếng Việt chỉ cho:
- Output examples (cho LLM bắt chước style)
- User-facing CLI strings
- Schema `description` JSON fields

**Hệ quả**:
- ✅ Tiết kiệm ~30% token prefix
- ❌ Maintainer phải skill tiếng Anh

---

## ADR-008: Co-production atomic — TC + Playwright + Screenshots

**Ngày**: 2026-04-28 · **Trạng thái**: ✅ Adopted (CD-10 quy tắc 16)

**Bối cảnh**: Trước đây: `generate-docs` re-synthesize TC tại doc-time, re-capture screenshots. Tốn token, dễ drift với reality.

**Quyết định**: QA agent của Cursor phải produce 3 artifact cùng lúc:
1. `test-evidence/{id}.json.test_cases[]` — prose, executed
2. `playwright/{id}.spec.ts` — re-runnable
3. `screenshots/{id}-step-NN-{state}.png` — capture trong khi Playwright chạy

`generate-docs` chỉ là consumer — assembly, không synthesize. Fallback (legacy projects) có discipline riêng.

**Hệ quả**:
- ✅ Healthy project: zero re-synthesis, zero re-capture
- ✅ Screenshots khớp reality
- ❌ QA phải nghiêm túc, không skip

---

## Đề xuất ADR mới

Khi thay đổi kiến trúc lớn:

1. Mở PR thêm section vào file này
2. Format: bối cảnh → quyết định → hệ quả → trạng thái
3. Trạng thái: `Proposed` | `Adopted` | `Deprecated` | `Superseded by ADR-XXX`
4. Reviewer + maintainer phê duyệt
