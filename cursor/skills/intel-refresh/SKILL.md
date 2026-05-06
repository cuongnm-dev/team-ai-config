---
name: intel-refresh
description: Cập nhật lại các bản phân tích kiến trúc và tính năng sau khi code hoặc tài liệu thay đổi. Chỉ chạy lại đúng phần cần thiết (theo cờ drift do agent SDLC đặt) thay vì toàn bộ pipeline, tiết kiệm thời gian và token. Trigger - _state.md.intel-drift=true sau code change auth/role/route; manual sau edit code ngoài SDLC. Anti-trigger - lần đầu khởi tạo project thì /from-code hoặc /from-doc; chỉ thêm 1 feature thì /new-feature.
---

# Intel Refresh — Cursor

Selectively regenerate stale intel artifacts after code/doc changes. Tier-aware: refreshes Tier 1+2 only; Tier 3 (business-context, NFR, ATTT, infrastructure, cost, plan, handover) is doc-only.

User-facing: Vietnamese. Internal flow: English.

## When to invoke

| Trigger | Source |
|---|---|
| `_state.md.intel-drift: true` | Most common — code change touched role/route/RBAC/migration |
| Manual `/intel-refresh` | After code edit outside SDLC pipeline |
| `close-feature` post-pipeline | Auto-call when intel-drift was set during pipeline (CD-10 #21 prep) |
| TTL expiry | `_meta.artifacts[file].stale=true` per TTL — surfaced by intel-validator |

## Tier scope (per `~/.claude/schemas/intel/OUTLINE_COVERAGE.md` § 8.2)

| Tier | Action |
|---|---|
| **T1** (always refresh) | actor-registry, permission-matrix, sitemap, feature-catalog, code-facts, system-inventory, test-accounts |
| **T2** (refresh when relevant) | data-model, api-spec, architecture, integrations |
| **T3** (NEVER touched here) | business-context, nfr-catalog, security-design, infrastructure, cost-estimate, project-plan, handover-plan — doc-only, BA edits manually |

---

## Step 1 — Detect drift scope

Read `_state.md.intel-drift` if exists, else prompt user:

```
Cái gì đã thay đổi?
[A] Code (auth / role / route / migration / integration / architecture)
[B] Documents (PDF/DOCX cập nhật)
[C] Cả hai
[D] Chỉ kiểm tra staleness (read-only)
```

Read `docs/intel/_meta.json.artifacts[*].stale` để identify artifact đã flag stale.

## Step 2 — Selective regeneration

| Drift scope | Action |
|---|---|
| Code only | Re-run subset of `/from-code` Phase 1-2 (T1 + T2 regen). Skip Phase 3-7 nếu architecture stable. |
| Docs only | Re-run `/from-doc` doc-intel step (T1 doc-side fields only). |
| Both | Re-run cả 2 producers → reconcile via precedence rules (Step 3). |
| Verify only | Skip regen; run validator only. |

### Cursor-native invocation

```
@from-code {repo-path}        # Code drift — re-runs full extract; idempotent on intel layer
@from-doc {doc-paths}         # Doc drift — re-extracts doc-intel
```

Flag `--resume --phases X,Y` / `--step doc-intel` để skip Phase 0 và chỉ re-run subset là **future enhancement**, hiện tại chưa support. Hệ quả: full skill chạy lại, overhead nhỏ vì Phase 1 harvest dùng `_meta.checksum_sources` bỏ qua file unchanged. Idempotent: re-write artifact với cùng nội dung không gây drift.

## Step 3 — Conflict reconciliation (Both)

Khi both producers chạy → phải reconcile theo precedence (`~/.claude/schemas/intel/README.md` § Conflict Resolution):

| Field | Winner |
|---|---|
| `actor.display`, `actor.display_en` | from-doc |
| `actor.auth.login_url`, `route.path` | from-code |
| `permission.evidence[kind=code]` | from-code |
| `permission.evidence[kind=doc]` | from-doc |
| `sitemap.menu_tree[].label` | from-doc |
| `sitemap.routes[].path`, `playwright_hints` | from-code |
| `feature.role_visibility[].level` | union, severity max |

**User-locked fields** (`_meta.artifacts[file].locked_fields[]`) ALWAYS win — never overwritten.

Heavy reconcile (5+ field conflicts) → escalate sang Claude Code:
```
⚠ Reconcile phức tạp ({N} conflicts). Recommend chạy Claude Code:
  cd {repo} && claude /intel-refresh
```

## Step 4 — Validation

```bash
python ~/.claude/scripts/intel/validate.py --intel-path docs/intel
```

T1 errors → STOP, surface user. Không update `intel-drift: false`. T2 warnings → log but continue. T3 ignored.

```
For each artifact unchanged (passed freshness check, checksum_sources match):
  Print: "♻ {file}: still fresh, no regeneration needed"
```

(Per CD-10 #9 reuse-first mandate — emit user-visible reuse summary so user can see exactly which intel artifacts were skipped because they are still fresh.)

## Step 5 — Snapshot regen (MANDATORY per CD-10 #21)

```bash
python ~/.cursor/skills/intel-snapshot/generate.py --intel-path docs/intel
python ~/.cursor/skills/intel-snapshot/generate.py --intel-path docs/intel --check
```

Snapshot covers Tier 1 only. Block nếu `--check` returns 1.

## Step 6 — Update `_state.md`

```yaml
intel-drift: false                # cleared
intel-refresh-at: {YYYY-MM-DDTHH:mm:ss}
intel-refresh-summary: |
  Refreshed: {list artifacts regenerated}
  Conflicts resolved: {count}
  Validation: {green | warnings | errors}
```

Update `_meta.json` producer chain:
```bash
python ~/.claude/scripts/intel/meta_helper.py update docs/intel/ {file} --producer intel-refresh
```

## Step 7 — Notify downstream

| Pipeline state | Suggestion |
|---|---|
| sdlc + not complete | `/resume-feature {id}` để tiếp tục với intel mới |
| sdlc complete + drift cleared | `/close-feature {id}` nếu chưa close |
| Manual user invoke | `/generate-docs` nếu cần regen tài liệu |

## Tier 3 explicit no-op

Nếu user request refresh T3 → REJECT:

```
⚠ Tier 3 artifacts là doc-only, KHÔNG regen từ code/doc:
  business-context, nfr-catalog, security-design, infrastructure,
  cost-estimate, project-plan, handover-plan

Các file này phản ánh quyết định nghiệp vụ của BA. Để chỉnh sửa:
  1. Edit `docs/intel/{tier3-artifact}.json` trực tiếp, HOẶC
  2. Chạy `/new-document-workspace` để interview-driven completion

Sau đó chạy `/generate-docs` để render TKKT/TKCS/TKCT với content mới.
```

## Failure modes

| Failure | Action |
|---|---|
| from-code phase fails | Restore previous artifact từ `_meta.checksum_sources` baseline; surface error |
| from-doc step fails | Same — preserve last-known-good |
| Conflict unresolvable | Surface user với conflict report; ask manual resolution |
| Validator T1 errors | STOP; do NOT clear `intel-drift` |
| Snapshot regen fails | WARN nhưng không block (snapshot là optimization, not correctness) |
| **MCP server unreachable** | **BLOCK pipeline** (CD-8 v3) — hard-stop with: "Run `docker compose up -d` in `~/.ai-kit/team-ai-config/mcp/etc-platform/` then retry." Do NOT clear `intel-drift: true`. NO silent local fallback. |

## When to escalate to Claude Code

Cursor inline mode đủ cho most drift scenarios. Escalate khi:
- Reconcile có 5+ field conflicts.
- Multi-stack monorepo (Cursor inline không có parallel adapter).
- T2 architecture đại tu (cần intel-merger sub-agent).

```
cd {repo-path} && claude /intel-refresh
```

## Anti-patterns

- ❌ Skip Step 5 snapshot regen → vi phạm CD-10 #21, base-tier agents fall back canonical.
- ❌ Clear `intel-drift: false` khi validator còn T1 errors → drift propagate downstream.
- ❌ Touch Tier 3 trong skill này → vi phạm tier scope, gây chồng lấp với BA workflow.
- ❌ Bịa role/route khi reconcile không rõ → set `confidence: low` + `[CẦN BỔ SUNG]`.

## What's next

| Goal | Skill |
|---|---|
| Tiếp tục pipeline đang dở | `/resume-feature {id}` |
| Sinh tài liệu | `/generate-docs` |
| Audit toàn bộ intel | Claude Code `/intel-validator` (chưa có Cursor port) |
