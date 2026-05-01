---
name: resume-document
description: Tiếp tục soạn tài liệu đang dở dang. Tự đọc trạng thái lưu trong _doc_state.md hoặc _strategy_state.md, biết cần làm bước tiếp theo nào và giao việc cho đúng agent phụ trách. Dùng khi quay lại sau vài ngày, đóng session rồi mở lại, hoặc tạm dừng giữa chừng.
---

# Resume Document Pipeline

**Đọc state → xác định vị trí → tiếp tục tự động.**

## § Step 1 — Locate State

Tìm project dang dở:

```bash
# Tìm tất cả state files
find projects/ -name "_strategy_state.md" -o -name "_doc_state.md" 2>/dev/null
```

Nếu nhiều projects → hỏi user chọn:
```
Tìm thấy {N} projects dang dở:
  1. {project-1} — Đề án CĐS — Spiral 3 (Solutions)
  2. {project-2} — TKCS BCA — Wave 2 (Writing)

Tiếp tục project nào? [1/2]
```

Nếu 1 project → auto-select.

## § Step 1.5 — Advisory lock (mirror resume-feature pattern)

Trước khi parse state, kiểm tra advisory lock để tránh 2 sessions resume song song corrupt state:

```bash
LOCK="{project-path}/.resume-lock"
NOW=$(date +%s)
TTL=600   # 10 phút

if [ -f "$LOCK" ]; then
  AGE=$(( NOW - $(stat -c %Y "$LOCK" 2>/dev/null || stat -f %m "$LOCK") ))
  if [ "$AGE" -lt "$TTL" ]; then
    echo "⚠ Project đang được resume bởi session khác (lock $AGE giây trước)."
    echo "   [w]ait + retry trong 1 phút | [t]akeover (force) | [a]bort"
    read CHOICE
    if [ "$CHOICE" = "t" ]; then
      echo "{session-id}|{started-at}" > "$LOCK"  # take over
    elif [ "$CHOICE" = "a" ]; then
      exit 0
    else
      sleep 60 && exec "$0"
    fi
  else
    echo "Lock cũ (>10 phút) — overwrite + tiếp tục."
    echo "{session-id}|{started-at}" > "$LOCK"
  fi
else
  echo "{session-id}|{started-at}" > "$LOCK"
fi

# Cleanup on exit (mọi exit path — Step 6 Handoff PHẢI cleanup):
trap 'rm -f "$LOCK"' EXIT
```

Lock format: `{session-id}|{started-at-iso}`. TTL 10 phút (đủ cho normal resume; force takeover dành cho crashed session).

**Cleanup contract**: Step 6 Handoff hoặc bất kỳ exit path nào (error, user abort) PHẢI `rm -f "$LOCK"`. Nếu skill crash giữa chừng, lock sẽ stale → force-takeover sau 10 phút.

## § Step 2 — Parse State

### Nếu `_strategy_state.md` (Strategic Pipeline):

Extract từ frontmatter:
- `current-stage`: SPIRAL_1 → SPIRAL_4 → CHECKPOINT → WRITE → DONE
- `next-action`: mô tả bước tiếp theo
- `checkpoint-1/2/3`: pending | approved | revision
- `thinking-bundle-status`: draft | frozen
- `spirals.*.status`: per-spiral progress

### Nếu `_doc_state.md` (Document Pipeline):

Extract:
- `current-stage`: INIT → INTERVIEW → PLANNING → WAVE_N → REVIEW_N → EXPORT → DONE
- `next-action`: mô tả bước tiếp theo
- `current-wave` / `total-waves`
- `completion-pct`
- Section Tracker: sections nào done, nào pending

### Đọc `_workspace.md` (nếu có):

Extract: automation-mode, doc-types, ministry, export-format.

## § Step 3 — Status Report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📋 Resume: {project-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Type:      {Đề án CĐS | TKCS | HSMT | ...}
  Stage:     {current-stage}
  Progress:  {completion-pct}%
  
  Completed:
    ✓ {stage 1} — {verdict}
    ✓ {stage 2} — {verdict}
  
  Current:
    → {current-stage}: {next-action}
  
  Remaining:
    ○ {stage N}
    ○ {stage N+1}
  
  Blockers:  {blockers hoặc "none"}
  Mode:      {REVIEW | AUTOPILOT | STEP}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tiếp tục? (yes / đổi mode / xem chi tiết)
```

## § Step 4 — Distill Context

Nếu có conversation history trong session:
- Scan for: scope changes, new constraints, user decisions
- Extract structured bullet list (KHÔNG dump conversation)
- Include in agent handoff prompt

Nếu fresh session (no history): skip — state file đủ.

## § Step 5 — Route to Agent

### Strategic Pipeline routing:

| Current Stage | Route to | Action |
|---|---|---|
| SPIRAL_1_SCOPE | strategy-analyst (foreground) | Continue/start interview |
| SPIRAL_2_STRATEGY | strategy-analyst | Gap analysis + framework |
| CHECKPOINT_1 | (present to user) | Show framework, ask approve |
| SPIRAL_3_SOLUTIONS | strategy-analyst (foreground) + policy-researcher (background) | Portfolio + DEDUP |
| DEDUP_GATE | strategy-analyst | Verify all proposals deduped |
| CHECKPOINT_2 | (present to user) | Show portfolio, ask approve |
| SPIRAL_4_STRUCTURE | structure-advisor + strategy-analyst (both background) | Outline + briefs |
| CHECKPOINT_3 | (present to user) | Show outline, ask freeze |
| FREEZE | (auto) | Mark thinking-bundle frozen |
| WRITE_INIT | strategy-analyst | Generate DCB |
| WRITE_WAVE_N | doc-orchestrator | Continue wave writing |
| FINAL_REVIEW | doc-reviewer | Final review |
| EXPORT | (auto) | Pandoc for Đề án CĐS (no etc-docgen template) |

### Document Pipeline routing:

| Current Stage | Route to | Action |
|---|---|---|
| INIT | (auto) | Create project structure |
| INTERVIEW | (foreground) | Doc-type-specific interview |
| PLANNING | doc-orchestrator | Parse outline → wave plan |
| WAVE_N | doc-orchestrator | Dispatch writers for wave N |
| REVIEW_N | doc-reviewer | Review wave N |
| FINAL_REVIEW | doc-reviewer | Final review |
| EXPORT | (auto — see routing below) | Render final output |

### EXPORT Stage Routing:

```
Doc type in {tkcs, tkct, tkkt, hdsd, xlsx, nckt}?
  ├─ YES → etc-platform v2.0.0+ job-based pipeline:
  │        Bash: curl -F file=@projects/{slug}/content-data.json $ETC_URL/uploads → upload_id
  │        mcp__etc-platform__validate_uploaded(upload_id)
  │        mcp__etc-platform__export_async(upload_id, targets=[doc_type]) → job_id
  │        mcp__etc-platform__job_status(job_id) (poll until terminal)
  │        Bash: curl -o projects/{slug}/output/<file> $ETC_URL/jobs/<id>/files/<file>
  │        # NCKT-specific: specialist agent là tdoc-nckt-writer (118 sections,
  │        # outline IMMUTABLE = nghien-cuu-kha-thi/nd45-2026, NĐ 45/2026 Đ12)
  │
  └─ NO  → Pandoc pipeline:
           Bash("./export/export.ps1 -DocPath projects/{slug} -Open")
```

### Agent Prompt Template:

```
## Resume: {project-name}

Pipeline: {strategic | document}
Doc type: {de-an-cds | tkcs | hsmt | ...}
Renderer: {etc-docgen | pandoc}
Current stage: {stage}
Next action: {next-action}
Automation mode: {mode}

### State Summary
{condensed from state file: what's done, what's next}

### Renderer Info
{If etc-docgen: "Output = content-data.json → etc-docgen export. Use MCP tools: section_schema, field_map, merge_content, validate, export."}
{If pandoc: "Output = Markdown → export.ps1"}

### Blockers (if any)
{from state file}

### Context from prior session (if any)
{distilled from conversation — only decisions/changes}

### Instructions
Continue from {stage}. Read {specific files needed}.
Follow automation mode: {REVIEW | AUTOPILOT | STEP}.
Update _doc_state.md / _strategy_state.md after each stage completion.
```

## § Step 6 — Handoff

Dispatch appropriate agent using Agent tool.

**For strategic pipeline (foreground agents):**
```
Agent("strategy-analyst"):
  "{resume prompt template}"
```

**For document pipeline (orchestrator manages):**
```
Agent("doc-orchestrator"):
  "{resume prompt template}"
```

After handoff: agent reads state → continues → updates state → proceeds.

## § State Update Rules

Agents MUST update state files:

1. **At stage transition:** Update `current-stage` + `next-action` in frontmatter
2. **At stage completion:** Add row to Stage Progress table with verdict
3. **At wave completion:** Update wave counters + Section Tracker
4. **At blocker:** Add to Active Blockers table
5. **At error:** Increment stall-count, log in wave history

**State update = đầu tiên.** Agent update state TRƯỚC KHI báo user. Nếu session crash giữa chừng, state file vẫn phản ánh đúng progress.
