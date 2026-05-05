---
title: Troubleshooting
order: 99
---

# Troubleshooting

## Bootstrap / Install

### `ai-kit: command not found`
PATH chưa load. Mở terminal MỚI hoặc:
```bash
# Mac/Linux
export PATH="$HOME/.ai-kit/bin:$PATH"
```
```powershell
# Windows — đóng và mở PowerShell mới
```

### `Docker daemon not running`
Mở Docker Desktop, đợi whale icon steady, retry.

### Windows: "running scripts is disabled"
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```
Hoặc bootstrap qua `.cmd` shim đã handle (`-ExecutionPolicy Bypass`).

### Mac: `xcrun: error: invalid active developer path`
```bash
xcode-select --install
```

### Permission denied trên `bootstrap.sh`
```bash
chmod +x bootstrap.sh
./bootstrap.sh
```

## ai-kit update

### `Local changes detected. Refusing to auto-merge`
Anh đã sửa file trong `~/.ai-kit/team-ai-config/` — mất khi `git pull`. Options:

```bash
# A) Discard hoàn toàn:
$env:AI_KIT_FORCE_CLEAN='1'   # Windows
export AI_KIT_FORCE_CLEAN=1   # Mac/Linux
ai-kit update

# B) Stash giữ lại sau:
cd ~/.ai-kit/team-ai-config
git stash push -u
ai-kit update
git stash pop      # nếu muốn restore

# C) Upstream changes nếu hữu ích cho team:
ai-kit publish "describe what you changed"
```

### `Docker pull` rate limit
Anonymous pull bị limit 100/6h. Login Docker Hub:
```bash
docker login
```

## MCP

### Container restart loop
```bash
ai-kit mcp logs | tail -50
```
Phổ biến:
- `Permission denied: /data` → Mac/Win Docker Desktop OK; Linux: `chmod 777 ~/.ai-kit/team-ai-config/mcp/etc-platform/data`
- Port 8001 đang dùng → sửa `.env`: `ETC_PLATFORM_PORT=8002`

### `no matching manifest for linux/arm64`
Image cũ chưa multi-arch. Maintainer rebuild với `release-mcp.ps1` (đã default buildx multi-arch). Tạm thời force amd64:
```bash
docker pull --platform linux/amd64 o0mrblack0o/etc-platform:v3.0.0
```
(Sẽ chậm trên Mac M1/M2 do Rosetta emulation.)

### healthz fail nhưng container "Up"
Đợi 30s (start_period). Hoặc check port:
```bash
curl -v http://localhost:8001/healthz
docker port etc-platform
```

## Cursor / Claude Code

### Skill không trigger
- Restart Cursor/Claude Code sau `ai-kit update`
- Verify deployed: `ai-kit status` → claude/cursor agents count
- Check `~/.cursor/mcp.json` có etc-platform URL

### Agent không thấy intel
- Verify `docs/intel/` ở project root
- Check `_meta.json.artifacts[file].stale` — nếu stale → `/intel-refresh`
- Verify path: agent đọc `docs/intel/` relative to project, không phải `~/.claude/`

### `intel-missing: <file>` STOP
Cursor agent từ chối chạy vì thiếu artifact. Run upstream:
- Missing `actor-registry.json` / `permission-matrix.json` / `sitemap.json` / `feature-catalog.json` → `/from-code` hoặc `/from-doc`
- Missing `test-accounts.json` → manual create

## Maintainer

### `ai-kit publish` báo "no machine-specific paths" nhưng vẫn lo
Verify thủ công:
```bash
ai-kit pack
grep -rE "C:/Users/[^/]+|D:/MCP Server" ~/.ai-kit/team-ai-config/{claude,cursor}
```

### release-mcp.ps1 fail "buildx not enabled"
```bash
docker buildx create --use
docker buildx inspect --bootstrap
```

### Push tag latest fail "insufficient_scope"
Token Docker Hub thiếu Delete scope. Tạo lại với `Read, Write, Delete`. Login:
```bash
docker login
```

## Backup / Rollback

### Khôi phục từ backup
```bash
ai-kit list-backups
ai-kit rollback         # newest
ai-kit rollback 3       # backup #3
```

### Restore manual
```bash
rm -rf ~/.claude ~/.cursor
cp -R ~/ai-config-backup-<timestamp>/.claude ~/.claude
cp -R ~/ai-config-backup-<timestamp>/.cursor ~/.cursor
```

### Disk đầy do quá nhiều backups
```bash
ai-kit clean --keep 1   # giữ 1 backup gần nhất + docker prune
```

## Workflow errors thường gặp

### `<tool_use_error>File has not been read yet. Read it first before writing to it.`
**Nguyên nhân**: Agent gọi Edit/Write nhưng chưa Read file mục tiêu trước. Chiếm ~10% workflow errors theo `ai-kit statistics`.

**Fix (từ 2026-05-02 — P3 Read-before-Edit rule)**:
- Rule mới đã inject vào `~/.cursor/rules/00-agent-behavior.mdc` § Execution Principles + `~/.claude/CLAUDE.md` § Tool Usage Discipline
- Nếu vẫn gặp: agent đang chạy với cache cũ → restart Cursor / Claude Code session
- Manual workaround: bảo agent "Read file trước khi Edit"

### `<tool_use_error>String to replace not found in file.`
**Nguyên nhân**: Edit `old_string` không match (có thể do whitespace, line endings, hoặc file đã đổi).

**Fix**:
- Read lại file để lấy bytes chính xác
- Dùng Grep tìm anchor unique hơn (≥ 3 dòng context)
- Nếu file > 2K dòng: dùng Grep + offset Read thay vì Read full

### Cost cao đột biến — `general-purpose` agent dispatch nhiều lần
**Nguyên nhân**: Claude Code main thread fallback `general-purpose` thay vì specialist (Explore/Plan/doc-writer/policy-researcher).

**Fix (từ 2026-05-02 — P4.1 Specialist-first dispatch)**:
- `~/.claude/CLAUDE.md` § Tool Usage Discipline đã có rule "Specialist-first dispatch"
- Trước khi gọi `Agent`, check xem có specialist phù hợp không
- `Explore` cho code lookup; `Plan` cho design; `doc-writer/doc-reviewer` cho admin docs; `tdoc-*` cho technical docs

---

## Workflow errors — `/from-idea` (Luồng C — greenfield brainstorm)

### "Phase 4.5 pre-mortem mandatory, không cho skip"
**Nguyên nhân**: Pre-mortem là mandatory by design (chống optimism bias).

**Fix**:
- Trả lời 3 failure modes + 3 success pathways (mỗi cái 1-2 câu là đủ)
- Nếu thực sự muốn skip: chạy với flag `--skip-premortem` — sẽ logged + audit + flag mọi feature `[CẦN BỔ SUNG: pre-mortem skipped]` trong `feature-catalog.features[].risks[]`
- Default behavior: KHÔNG skip — đó là cheapest critical-thinking pass break optimism bias

### "DEDUP REJECT verdict trên >50% deliverables"
**Nguyên nhân**: Spiral 2 Impact Mapping phát hiện phần lớn deliverables trùng với nền tảng dùng chung quốc gia (NDXP/LGSP/CSDLQG/VNeID hoặc industry SaaS).

**Fix**:
- Skill auto-STOP với recommend "scope quá overlap với shared platforms"
- 2 lựa chọn: (a) Rewrite scope — focus vào unique value-add; (b) Restart với scope hẹp hơn
- Tham khảo `_idea/dedup-report.md` để xem deliverables nào REJECT + ecosystem_ref nào trùng

### "Pre-mortem: > 50% failure modes unmitigated severity ≥ medium"
**Nguyên nhân**: Phase 4.5 pre-mortem cho thấy phần lớn failure modes không có mitigation đủ mạnh — kế hoạch quá optimistic.

**Fix**:
- Skill warn → user chọn: (a) Rewind to Spiral 4 (giảm scope MVP, exposure ít hơn); (b) Rewind to Spiral 2 (rethink deliverables); (c) Accept high-risk profile (logged trong `feature-catalog._meta.warnings`)
- Recommend (a) nếu MVP có nhiều must-have rủi ro
- Recommend (c) chỉ khi user thật sự đã chấp nhận risk + có plan mitigation post-MVP

### "[CẦN BỔ SUNG] > 30% fields"
**Nguyên nhân**: User chưa có đủ thông tin nền (chưa nói chuyện với stakeholder, chưa research market, chưa biết tech constraints).

**Fix**:
- Skill recommend offline clarification: pause `/from-idea`, gather data (user research, competitive analysis, stakeholder interview), resume sau
- State đã save trong `_pipeline-state.json` — Phase 0.0 Resume Detection sẽ tự detect lần sau
- KHÔNG nên cố push qua placeholders — output sẽ kém chất lượng

### "Iteration > 2 trong 1 spiral — stuck hoặc decision fatigue"
**Nguyên nhân**: User đã refine spiral N lần thứ 3 mà chưa converge.

**Fix**:
- Skill auto-trigger force-decision menu: (a) Confirm-with-gaps (accept current state với `[CẦN BỔ SUNG]` markers); (b) Cancel session (save state, resume sau khi nghĩ thêm); (c) Continue-with-warning (vòng N+1 nhưng cảnh báo kéo dài thường = câu hỏi sai / thiếu evidence / decision fatigue)
- Recommend (b) nếu cảm thấy mệt — brainstorm dài hơi cần break
- Recommend (a) nếu đã đủ chốt cho bước tiếp

### "Scope creep ratio > 3 (must_have / win_conditions)"
**Nguyên nhân**: PRFAQ định nghĩa N win conditions, story map có > 3N must-have features → MVP quá rộng.

**Fix**:
- Tại Gate G4 Spiral 4, skill cảnh báo: "MVP có vẻ rộng — confirm chứ?"
- 2 lựa chọn: (a) Demote bớt features từ must-have xuống should-have; (b) Accept với explicit rationale logged trong `_idea/coherence-log.md`
- Recommend (a) — MVP càng nhỏ càng dễ ship + validate vision

### "Coherence flag — feature/story conflicts với prior decision"
**Nguyên nhân**: Inter-spiral semantic compare (G3, G4) hoặc Phase 5 audit phát hiện mâu thuẫn (vd Spiral 4 feature contradicts Spiral 1 PRFAQ assumption A2).

**Fix**:
- Reconciliation menu 3 paths: (a) Edit Source A — rewind to prior spiral để fix; (b) Edit Source B — fix current spiral để align; (c) Accept conflict với explicit caveat trong `_idea/coherence-log.md`
- Caveat propagate vào `feature-catalog.features[].coherence_notes[]` cho traceability
- KHÔNG để conflict pass silently

### "Cursor SDLC ba/sa thiếu context dù đã đọc feature-brief.md"
**Nguyên nhân**: Feature-brief đã enrich (v0.27) nhưng có thể vẫn thiếu deep rationale cho 1 số case (vd dedup verdict đầy đủ, story-mapping priority history).

**Fix**:
- Stage agent có thể **lazy-read** `_idea/*.md` qua "Source Spirals" pointers trong feature-brief.md
- Vd ba muốn xem dedup verdict đầy đủ → đọc `_idea/dedup-report.md` § entry cho deliverable này
- Đó là explicit traversal (không default), tránh bloat token

### "Idea graveyard — muốn revive ý tưởng đã loại"
**Nguyên nhân**: Sau brainstorm context đổi, ý tưởng từng REJECTed có thể relevant lại.

**Fix**:
- Manual: `/from-idea --resurrect G-NNN`
- Auto-detect: nếu user mention idea name match graveyard entry, skill prompt confirm
- Lưu ý: nếu original verdict là DEDUP-REJECT → re-run DEDUP (verdict có thể đã đổi do KB updates)

### "Resume sau >7 ngày — không nhớ vision"
**Nguyên nhân**: Brainstorm dài hơi, user quay lại sau 1+ tuần thường mất context.

**Fix**:
- Phase 0.0 Resume Detection auto-trigger "vision-check" mode khi gap > 7 days
- Skill render full PRFAQ + decisions[].active + idea-graveyard count → ask "Bạn còn solid với vision không?"
- 3 lựa chọn: (a) Vẫn solid → Resume từ Spiral N; (b) Có điều chỉnh nhỏ → Rewind to Spiral 1 sửa PRFAQ; (c) Đổi ý hoàn toàn → Restart fresh (backup .bak/)

---

## Dọn dẹp hoàn toàn

```bash
ai-kit uninstall          # remove ~/.ai-kit + stop MCP
rm -rf ~/.claude ~/.cursor   # cleanup deployed configs (CAREFUL!)
docker system prune -a    # remove all docker images/containers
```

Re-install: chạy lại bootstrap one-liner.

## Liên quan

- ai-kit reference
- mcp-server reference
- README
