---
name: from-code
description: Đọc mã nguồn của dự án (bất kỳ ngôn ngữ nào) để tự động trích xuất danh sách tính năng, dựng lại sơ đồ kiến trúc và sinh hồ sơ trạng thái cho từng tính năng. Kết quả ghép nối được với /generate-docs để sinh tài liệu kỹ thuật. Dùng khi đã có code nhưng chưa có tài liệu. Output - docs/intel/{system-inventory, code-brief, arch-brief, actor-registry, permission-matrix, sitemap, feature-catalog, data-model, integrations}.json + 1 _state.md mỗi feature (status implemented). Trigger - codebase đã chạy production cần sinh tài liệu nghiệm thu; onboard team mới repo legacy. Anti-trigger - chưa có code mà có SRS/BRD thì /from-doc; chỉ thêm 1 feature thì /new-feature. Example - "/from-code D:/Projects/be-portal" (auto-detect stack + monorepo).
---

# From Code to Features + Docs — Contract & Dual-Producer

Two producers, same architecture, same output. Mirrors `/from-doc` design (CD-10 producer-agnostic intel layer).

- **Cursor** (this skill, inline): PoC / simple / fallback — single Composer session, no sub-agent parallelism.
- **Claude Code** (`~/.claude/skills/from-code/SKILL.md`): Production / complex — 7-phase pipeline, parallel sub-agents, framework adapters (`dotnet-aspnetcore`, `angular`, `nestjs`, `fastapi`).

Consumer (`/resume-feature` → `dispatcher`, `/generate-docs`) is producer-agnostic.

## Decision tree — Which producer

```
q1: Codebase size?
  ≤10 files, single stack, mini-repo → Cursor inline (this skill)
  Monorepo, >50 files, multi-stack    → Claude Code (parallel adapters)

q2: Production-critical OR audit-grade docs needed?
  YES → Claude Code (Opus 4.7 insights, full LIFECYCLE compliance)
  NO  → Cursor inline acceptable (~70% quality, fast)

q3: Claude quota exhausted?
  → Cursor inline fallback (output ~70% quality, re-run in Claude when available)
```

## Output contract (CD-10 Intel Layer)

Both producers emit IDENTICAL structure at `{repo-path}/docs/intel/`:

| Artifact | Purpose | Schema |
|---|---|---|
| `system-inventory.json` | Stack, services, deployment topology | `~/.claude/schemas/intel/system-inventory.schema.json` |
| `code-brief.md` | Human-readable system summary | (markdown) |
| `arch-brief.md` | C4 Context + Containers narrative | (markdown) |
| `actor-registry.json` | Roles, auth mode, RBAC mode | `actor-registry.schema.json` |
| `permission-matrix.json` | Role × Resource × Action | `permission-matrix.schema.json` |
| `sitemap.json` | Routes, modules, navigation | `sitemap.schema.json` |
| `feature-catalog.json` | Features extracted from routes/handlers | `feature-catalog.schema.json` |
| `data-model.json` | Entities, relations | (Tier 2, optional) |
| `integrations.json` | External services, webhooks | (Tier 2, optional) |
| `_meta.json` | Provenance, TTL, staleness | `_meta.schema.json` |
| `_snapshot.md` | Compressed view (regen via intel-snapshot/generate.py) | — |

Plus 1 `_state.md` per feature at `{features-root}/{feature-id}/_state.md`, status `implemented`, frontmatter shape identical to `/from-doc` and `/new-feature` (CD-10 Quy tắc 20).

---

## Cursor inline mode — phases

User-facing: Vietnamese. Internal phases: English.

### Phase 0 — Pre-flight

1. **Resolve `repo-path`**: arg path > cwd. Verify dir exists + has `.git/` or `package.json`/`Cargo.toml`/`go.mod`/etc.
2. **Read `~/.cursor/AGENTS.md`** for `repo-type` + Docs-Path Formula. If missing → `/new-workspace` or `/configure-workspace` first.
3. **Stack detect**: lockfiles + manifest globs:
   - `package.json` → Node (Next.js / NestJS / Express / Vue / React)
   - `pyproject.toml` / `requirements.txt` → Python (FastAPI / Django / Flask)
   - `*.csproj` / `*.sln` → .NET
   - `go.mod` → Go
   - `Cargo.toml` → Rust
   - `pubspec.yaml` → Flutter/Dart
   - Multi-stack monorepo → list all detected.
4. **Intel cache warm-start** (if MCP up):
   ```
   sig = build_signature_from_p0(repo)
   mcp__etc-platform__intel_cache_lookup(project_signature=sig, kinds=["actor-pattern", "feature-archetype"])
   ```
   Use exact `actor-pattern` matches to seed Phase 2; otherwise fall through.

### Phase 1 — Static harvest (universal extractors)

Glob + Grep, no LLM:
- **Routes**: framework-specific patterns (Next.js `app/**/page.tsx`, FastAPI `@app.get`/`@router.*`, Express `app.get/post`, NestJS `@Controller/@Get`, ASP.NET `[Route]`/`[HttpGet]`).
- **Auth/RBAC**: decorators (`@Roles`, `@PreAuthorize`, `@RequirePermission`), middleware (Express `requireAuth`), policy classes.
- **DB schema**: ORM models (Prisma `schema.prisma`, TypeORM `@Entity`, SQLAlchemy `class X(Base)`, EF Core `DbContext`), migrations.
- **Integrations**: env var consumption (Stripe, Twilio, S3 SDK imports), HTTP clients pointing to external hosts.

Write incremental harvest to `docs/intel/_harvest.json` (working scratch, not final).

### Phase 1.5 — Actor enumeration

From auth/RBAC patterns + role enum/constant declarations:
- Extract canonical role list (e.g., `enum Role { ADMIN, MANAGER, STAFF }`).
- Detect auth mode: JWT / session / OAuth.
- Detect RBAC mode: NIST 800-162 (RBAC / ABAC / hybrid).
- Write `actor-registry.json` per schema. Each role gets `confidence: high|medium|low` per CD-10 Quy tắc 13.
- Validate: `python ~/.claude/scripts/intel/validate.py --schema actor-registry`.

### Phase 2 — Feature synthesis

Group routes + handlers + UI pages into features (1 feature ≈ 1 user-visible capability).
- **Heuristic**: route prefix + auth role union + DB table touched = feature seed.
- **ID assignment**: canonical `F-NNN` (mini) or `{service}-F-NNN` (mono) per CD-10 Quy tắc 19. Reuse existing `feature-map.yaml` IDs if present; else issue fresh.
- **Status**: `implemented` (since code exists). Set `confidence: medium` baseline; `high` if route + handler + tests all present.
- Write `feature-catalog.json` + `sitemap.json`.
- Optional intel-cache contribute (with consent + PII scan).

### Phase 3 — Permission matrix

Cross-join `actor-registry.roles[]` × `feature-catalog.features[].routes[]` × HTTP verbs. Mark `allowed`/`denied`/`conditional` from RBAC decorators harvested. Write `permission-matrix.json`.

### Phase 4 — Per-feature `_state.md`

For each feature in catalog:
- Resolve `features-root` per AGENTS.md Docs-Path Formula.
- Create `{features-root}/{feature-id}/_state.md` with frontmatter:
  - `pipeline-type: sdlc`
  - `status: done` (code exists, working)
  - `current-stage: closed`
  - `source-type: code-reverse-engineered`
  - `feature-req.canonical-fallback: docs/intel/feature-catalog.json#features[id={id}]`
  - 21-field schema per from-doc/SKILL.md §5f.
- Append entry to `docs/feature-map.yaml`.

### Phase 5 — Bridge artifacts + snapshot

- Generate `code-brief.md` (system summary, ≤2 pages) and `arch-brief.md` (C4 narrative).
- Update `_meta.json` (producer: `from-code`, ttl_days, checksum_sources).
- **MANDATORY**: Regenerate snapshot:
  ```bash
  python ~/.cursor/skills/intel-snapshot/generate.py --intel-path docs/intel
  python ~/.cursor/skills/intel-snapshot/generate.py --intel-path docs/intel --check
  ```
  Block if `--check` returns 1.

### Phase 6 — Validate

```bash
python ~/.claude/scripts/intel/validate.py --intel-path docs/intel
```

Reject any feature with `description < 200 chars`, `business_intent < 100`, or `acceptance_criteria < 3` per CD-10 Quy tắc 11 (block downstream consumers if too thin).

### Phase 7 — Report to user (Vietnamese)

```
✅ /from-code hoàn tất
- Stack: {detected}
- Features: {N} ({implemented:N, partial:M})
- Roles: {N}
- Routes: {N}
- Snapshot: {path} ({size}KB ~ {tokens} tokens)
Next: /generate-docs để sinh TKKT/TKCS/TKCT/HDSD, hoặc /new-feature {id} cho feature mới.
```

---

## When to escalate to Claude Code

Skill prints recommendation và STOPs (không tự dispatch sang Claude) khi:
- Codebase > 50 files OR > 5 services in monorepo.
- Stack không nằm trong universal extractor list (Phase 1 fails majority).
- Auth/RBAC mode unclear (multiple patterns mixed; Phase 1.5 confidence median = low).
- User explicitly needs audit-grade documentation (regulated domain).

Recommendation message:
```
⚠ Codebase phức tạp — recommend chuyển sang Claude Code:
  cd {repo-path} && claude /from-code
Reason: {one-line}
```

## Anti-patterns

- ❌ Bịa role/route khi không tìm thấy trong code → set `confidence: low` + `[CẦN BỔ SUNG]`, KHÔNG fabricate.
- ❌ Skip Phase 4 (`_state.md` per feature) → resume-feature/generate-docs sẽ thiếu input.
- ❌ Skip Phase 5 snapshot regen → vi phạm CD-10 Quy tắc 21, base-tier agents fall back canonical (lose 95% saving).
- ❌ Re-issue feature ID đã có trong feature-map.yaml → vi phạm CD-10 Quy tắc 19 (immutable IDs).

## What's next

| Goal | Skill |
|---|---|
| Sinh tài liệu kỹ thuật | `/generate-docs` |
| Thêm feature mới | `/new-feature` |
| Tiếp tục pipeline đang dở | `/resume-feature {id}` |
| Audit drift sau code change | `/intel-refresh` |
