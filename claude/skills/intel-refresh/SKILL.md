---
name: intel-refresh
description: Cập nhật lại các bản phân tích kiến trúc và tính năng sau khi code hoặc tài liệu thay đổi. Chỉ chạy lại đúng phần cần thiết (theo cờ drift do agent SDLC đặt) thay vì toàn bộ pipeline, tiết kiệm thời gian và token.
---

# Intel Refresh

Regenerate stale intel artifacts after code or doc changes. Tier-aware: refreshes Tier 1+2 only; Tier 3 is doc-only and managed via BA interview, not code workflow.

## When to invoke

| Trigger | Source |
|---|---|
| `_state.md.intel-drift: true` set by Cursor SDLC agent | Most common — code change touched role/route/RBAC/migration/integration/architecture |
| Manual user request | `/intel-refresh` to refresh after code edit outside SDLC |
| `close-feature` post-pipeline | Cursor `close-feature` invokes when intel-drift was set during pipeline |
| Scheduled (TTL expiry) | When `_meta.artifacts[file].stale=true` per TTL — surfaced by `intel-validator` |

## Tier scope

Per `~/.claude/schemas/intel/OUTLINE_COVERAGE.md` § 8.2:

| Tier | Action |
|---|---|
| **T1 (always refresh)** | actor-registry, permission-matrix, sitemap, feature-catalog, code-facts, system-inventory, test-accounts (if exists) |
| **T2 (refresh when relevant)** | data-model, api-spec, architecture, integrations |
| **T3 (NEVER refresh by this skill)** | business-context, nfr-catalog, security-design, infrastructure, cost-estimate, project-plan, handover-plan — these are doc-only, BA edits manually before `/generate-docs` |

## Flow

### Step 1 — Detect drift scope

Read `_state.md.intel-drift` if exists, else manual user prompt:

```
What changed?
[A] Code (auth/role/route/migration/integration/architecture)
[B] Documents (PDF/DOCX updated)
[C] Both
[D] Just verify staleness (read-only)
```

Read `_meta.json.artifacts[*].stale` to identify already-flagged stale artifacts.

### Step 2 — Selective regeneration

Based on drift scope:

| Drift scope | Refresh action |
|---|---|
| Code only | Run `from-code --resume` Phase 1-2 (T1 + T2 regen). Skip Phase 3-7 if architecture stable. |
| Docs only | Run `from-doc` Step 3 (doc-intel re-extract). Update T1 doc-side fields only. |
| Both | Run `from-code` Phase 1-2 → run `from-doc` Step 3 → run `intel-merger` to reconcile conflicts |
| Verify only | Skip regeneration; run `intel-validator` only |

### Step 3 — Conflict reconciliation (if both code + doc changed)

```
Agent(subagent_type="intel-merger", prompt="Reconcile T1+T2 artifacts after parallel from-code + from-doc updates.")
```

Per `~/.claude/schemas/intel/README.md` § Conflict Resolution Precedence:
- `actor.display`, `actor.display_en` ← from-doc wins
- `actor.auth.login_url`, `route.path` ← from-code wins
- `permission.evidence[kind=code]` ← from-code wins
- `permission.evidence[kind=doc]` ← from-doc wins
- `sitemap.menu_tree[].label` ← from-doc wins
- `sitemap.routes[].path`, `playwright_hints` ← from-code wins
- `feature.role_visibility[].level` ← union with severity max

User-locked fields (`_meta.artifacts[file].locked_fields[]`) ALWAYS win.

### Step 4 — Validation

```
Agent(subagent_type="intel-validator", prompt="Validate refreshed intel layer. Tier-aware: report T1 errors as BLOCK, T2 as WARN, T3 as INFO.")
```

If T1 violations remain → STOP. Surface to user. Do NOT proceed to consumers.

### Step 5 — Snapshot regen

```bash
python ~/.cursor/skills/intel-snapshot/generate.py --intel-path docs/intel/
```

Snapshot covers Tier 1 only per `OUTLINE_COVERAGE.md` § 8.4.

### Step 6 — Update _state.md

```yaml
intel-drift: false       # cleared
intel-refresh-at: {ISO8601}
intel-refresh-summary: |
  Refreshed: {list of artifacts regenerated}
  Conflicts resolved: {count via intel-merger}
  Validation: {green | warnings | errors}
```

### Step 7 — Notify downstream

If `_state.md.pipeline-type == sdlc` AND not `complete`: print suggestion to `/resume-feature {id}` to continue with fresh intel.
If user invoked manually: print summary + recommend `/generate-docs` if docs need regeneration.

## Tier 3 explicit no-op

If user requests Tier 3 refresh through this skill → REJECT with message:

```
⚠ Tier 3 artifacts (business-context, nfr-catalog, security-design, infrastructure,
  cost-estimate, project-plan, handover-plan) are doc-only.
  
  These are NOT regenerated from code or documents — they reflect BA decisions:
  - business-context: project metadata, legal basis, objectives, scope
  - nfr-catalog: NFR targets agreed with stakeholders
  - security-design: ATTT level, threat model
  - infrastructure: hardware list, deployment model
  - cost-estimate: TT 04/2020 calculations
  - project-plan: phases, timeline, organization
  - handover-plan: training, warranty
  
  To edit Tier 3:
  1. Edit `docs/intel/{tier3-artifact}.json` directly, OR
  2. Run `/new-document-workspace` for interview-driven completion
  
  Then run `/generate-docs` to render TKKT/TKCS/TKCT with updated content.
```

## Performance notes

- Reuse `_meta.checksum_sources` to skip artifacts whose source files unchanged (still T1/T2 sha256 match)
- Parallel-safe within tier: from-code + from-doc can run concurrently for different artifacts
- intel-merger is sequential after both producers complete
- intel-validator runs after merger
- intel-snapshot last (depends on validator OK)

## Failure modes

| Failure | Action |
|---|---|
| from-code Phase 1 fails | Restore previous artifact from `_meta.checksum_sources` baseline; surface error |
| from-doc Step 3 fails | Same — preserve last-known-good |
| intel-merger conflict unresolvable | Surface to user with `intel-merger.conflict-report.json`; ask manual resolution |
| intel-validator T1 errors | STOP; do NOT update `_state.md.intel-drift: false` |
| intel-snapshot generation fails | WARN but don't block (snapshot is optimization, not correctness) |

## Invocation

```
/intel-refresh                          # auto-detect drift from _state.md
/intel-refresh --code                   # force code-side only
/intel-refresh --doc                    # force doc-side only
/intel-refresh --verify                 # read-only, run validator
/intel-refresh --tier T2                # restrict to T2 (e.g. just data-model after migration)
```

## Bridge to consumers

After successful refresh:
- Cursor SDLC `/resume-feature {id}` reads fresh T1 (snapshot or canonical)
- Claude `/generate-docs` reads fresh T1+T2 + checks T3 (separate from this skill's scope)

Per CD-10 quy tắc 7: consumer skills MUST block when REQUIRED artifact missing → this skill's job is to make sure REQUIRED artifacts are NOT missing/stale before consumers are invoked again.
