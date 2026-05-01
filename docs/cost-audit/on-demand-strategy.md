---
parent: _state.md
research-source: B3 (Cursor 3 on-demand loading, 2026-05-01)
status: action-ready
---

# On-demand Loading Strategy — Cursor 3 (May 2026)

## Tin tốt

| Artifact | Loading behavior thực tế | Cost impact |
|---|---|---|
| **Skills** | **ĐÃ lazy** — chỉ name+description (~200B/skill) registered. Body load khi `/skill` invoke. | **Skill registry KHÔNG phải vấn đề** — 26 skills × 200B = 5KB harness |
| **Rules `alwaysApply: false` + globs** | Description only at idle. Body load khi file match. | Đã efficient |
| **Rules `alwaysApply: false` no globs** | Description only ("Apply Intelligently") | Agent đọc description rồi mới pull body |
| **Rules `alwaysApply: true`** | FULL body mọi chat | **Cần audit** — chỉ giữ truly-global rules |
| **MCP plugins NOT in mcp.json** | **INERT** — không register | 10 plugins ufh-rfid mcps/ KHÔNG tốn nếu chưa configure |
| **Custom agents** | **ALL name+description registered** để Task(subagent_type=) chọn động. Body load khi spawn. | 🔴 **44 agents = 44 entries TRONG MOI HARNESS** |

## 🎯 ROOT CAUSE chính xác (sau B3)

**Custom agents directory** là source chính của harness inflation. Cursor 3:
- Scan `~/.cursor/agents/*.md` ở startup
- Register name + description của TẤT CẢ 44 agents vào parent harness
- Để parent có thể `Task(subagent_type="anything")` dynamically
- **Không có per-project allowlist** — phải physical prune

→ **38 agents không dùng ngày-nào = dead weight** trong mọi Task() spawn.

## 🎯 Action plan FINAL (post-B3)

### 🟢 Phase 1A — Physical prune agents (BIGGEST WIN)

Move 13+ unused agents khỏi `~/.cursor/agents/` sang `~/.cursor/agents-archive/`:

**Confirmed-unused (doc-gen đã chuyển Claude/MCP)**:
- `doc-arch-writer.md`, `doc-catalog-writer.md`, `doc-exporter.md`, `doc-intel.md`
- `doc-manual-writer.md`, `doc-researcher.md`, `doc-test-runner.md`
- `doc-testcase-writer.md`, `doc-tkcs-writer.md`
- `tdoc-data-writer.md`, `tdoc-exporter.md`, `tdoc-researcher.md`, `tdoc-test-runner.md`

= **13 agents removed** (~95KB / ~24K tokens registry savings)

**Possibly-unused (user confirm)**:
- `data-governance.md` — chỉ cần nếu PII / cross-system data
- `release-manager.md` — chỉ cần multi-service deploy
- `sre-observability.md` — chỉ cần production monitoring
- `telemetry.md` — đo cost only, có thể inline thay vì agent

= +4 candidates (~25KB / ~6K tokens)

### 🟢 Phase 1B — `disable-model-invocation: true` cho optional skills

Skills sau auto-invocation OFF (chỉ chạy qua `/skill`):
- adr, arch-review, audit, cache-lint, hotfix, incident, intel-snapshot
- release, runbook, strategic-critique, ui-catalog, zip-disk

= **12 skills made slash-only** — tránh model auto-route nhầm.

Cần edit từng `SKILL.md` thêm frontmatter:
```yaml
---
name: ...
description: ...
disable-model-invocation: true   # NEW
---
```

### 🟢 Phase 1C — MCP audit

**Verify**: project ufh-rfid `mcp.json` chỉ có playwright + etc-platform.
- 12 plugins trong `~/.cursor/projects/.../mcps/` là **filesystem cache**, KHÔNG register nếu không có trong mcp.json
- → KHÔNG cần xóa filesystem; an toàn để đó

**Per-tool pruning** (nếu Cursor expose UI):
- etc-platform có ~24 tools — SDLC pipeline chỉ dùng vài cái
- Settings → MCP → tắt từng tool không cần

### 🟢 Phase 1D — Rules audit

`alwaysApply: true` rules:
- `~/.cursor/rules/00-agent-behavior.mdc` (5,741B / ~1.5K tok) — **đang load mọi chat**
- Project `.cursor/rules/00-agent-behavior.mdc` (5,741B / ~1.5K tok) — duplicate?

Action:
- Verify duplicate (user vs project rules) — nếu trùng nội dung thì 1× thôi
- Slim 00-agent-behavior.mdc xuống ≤500 tokens — chỉ truly-universal guardrails (NGÔN NGỮ, format, blocked behaviors)
- Move chi tiết pipeline routing sang `90-delivery-pipeline.mdc` (alwaysApply: false)

### 🟡 Phase 2 — Force composer-2 (per user agreement)

**Cách enforce** (research B1 + B3):
- Skill `resume-feature` Step 7: `Task(dispatcher, prompt, model="composer-2")` thay vì default
- Dispatcher gọi specialists: `Task(subagent_type=X, prompt, model="composer-2")`

NHƯNG có Cursor 3 bug "subagent inheritance" (forum 151917): subagent có thể ignore model parameter. Cần test.

Backup: settings UI → Default model → composer-2.

### 🟡 Phase 3 — Fix bundle inlining

Skill Step 6.5 hiện chỉ describe — convert thành executable:

Thay vì:
```
"Read file content. If file > 30KB AND not _state.md → truncate..."
```

Viết:
```
**Action steps (mandatory):**
1. **Determine bundle file list** — for `current-stage`, list paths from matrix.
2. **For each path** (in order):
   a. Use `Read` tool with file_path={path}.
   b. Receive content as string `c{i}`.
   c. If len(c{i}) > 30000 AND filename != "_state.md", truncate to first 25000 chars + append marker.
3. **Concatenate** as: `bundle = "## Active Context Bundle\n\n" + "\n\n".join(f"### File: {path}\n{content}" for path,content in pairs)`
4. **Validate**: assert `len(bundle) > 100` chars (i.e. at least one file inlined). If not → STOP with error.
5. **Compose final prompt**: `prompt = FROZEN_HEADER + "\n\n" + DYNAMIC_SUFFIX_with_bundle_inlined`
6. **Log telemetry**: `{"event":"bundle-built","stage":...,"files":[...],"bundle_chars":len(bundle),"bundle_tokens_est":len(bundle)//4}` — bundle_chars MUST be > 0.
7. **Invoke**: `Task(subagent_type=..., prompt=prompt, model="composer-2")`.
```

### Phase 4 — F-004 spike (validation)

Sau Phase 1+2+3:
- Tạo F-004 same complexity as F-003 (1 endpoint, Path S)
- Run pipeline
- Compare:
  - Cache_read floor per Task() (target: <100K, was 261-993K)
  - Total cost (target: <$2, was $4.88)
  - Bundle_chars in telemetry > 0 (was 0)

## Expected savings — sau Phase 1+2+3

| Fix | Saving |
|---|---|
| 13 unused agents removed | -95KB registry / per-Task() ~24K tok |
| Force composer-2 (no thinking) | -60% per-token cost (avg event $0.41 → $0.16) |
| Bundle inlining real | -30K visible reads/Task() |
| Slim alwaysApply rule | -1K tok harness |
| Optional skills slash-only | minor (already lazy) |

**Combined**: F-003-equivalent feature **$4.88 → ~$1.50-2** (60-70% reduction).

50 features × Path M sau optimization: **~$80-100/tháng/user** (vs current $285).

## Confidence levels

| Action | Confidence saving works | Risk |
|---|---|---|
| Remove unused agents | HIGH | Low — git track |
| disable-model-invocation skills | HIGH | Low — reversible |
| Force composer-2 | MEDIUM | Quality drop possible |
| Bundle inlining fix | HIGH | Skill rewrite needs test |
| Slim alwaysApply rule | MEDIUM | Behavioral drift possible |

## UNKNOWN cần verify empirical

- [ ] Project `.cursor/agents/` có shadow/merge với `~/.cursor/agents/` không?
- [ ] Mới remove agent có cần Cursor restart không?
- [ ] Subagent model parameter có bị ignore (forum bug 151917) không — F-004 spike sẽ confirm.
