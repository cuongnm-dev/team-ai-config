---
name: resume-feature
description: Tiếp tục pipeline đang dở từ checkpoint cuối cùng. Hỗ trợ cả pipeline phát triển tính năng (SDLC) và pipeline sinh tài liệu. Đọc _state.md để biết đang ở đâu, chạy dispatcher loop tự động giao việc cho đúng agent, có cơ chế PM escalation khi gặp blocker, hoàn thành tới checkpoint tiếp theo. Trigger - feature-id đang in-progress hoặc blocked; muốn advance qua stage tiếp theo. Anti-trigger - feature chưa tạo thì /new-feature; feature đã reviewer-Pass thì /close-feature; chỉ muốn readonly view thì /feature-status. Example - "/resume-feature F-001" (auto-loop tới done hoặc blocked).
---

# Resume Pipeline

User-facing: Vietnamese. Dispatcher prompts: English.

---

## Step 1 — Receive input

No arg → prompt user: `Nhập docs-path hoặc feature-id`.

## Step 2 — Locate `_state.md`

Arg detection:
- Ends with `_state.md` → strip filename, use dirname
- Contains `/` or `\` with existing dir → explicit path
- Partial path like `docs/features` (no feature-id) → reject: `cần feature-id cụ thể`
- Else → treat as feature-id

Resolution (stop on first match):
1. `{arg}/_state.md` (explicit path)
2. `docs/feature-map.yaml` → `features.{arg}.docs_path` → `{docs_path}/_state.md`
3. `docs/features/{arg}/_state.md`
4. `docs/hotfixes/{arg}/_state.md`
5. `docs/generated/{arg}/_state.md`
6. Glob `**/docs/features/{arg}/_state.md` (last resort — auto-update feature-map.yaml)

**Not found** with feature-map present: compute Levenshtein distance to all feature-ids, suggest top 3 matches with distance ≤ 3. Else: `Không tìm thấy. Dùng /new-feature hoặc /generate-docs.`

**File read safety:** On lock/access error → retry 2× (500ms delay). Still fail → tell user close other tabs.

**Advisory lock:** Check `{docs-path}/.resume-lock`:
- Exists, < 10min old → ask: wait or force takeover
- Create lock (session-id + timestamp) before proceed
- Delete lock on every exit path

## Step 3 — Parse + validate `_state.md`

**3.0 Validation:**
- YAML parse fails → STOP with error detail, suggest backup
- Missing required fields (`pipeline-type`, `status`, `docs-path`, `current-stage`, `repo-path`; sdlc adds `feature-id`, `output-mode`) → STOP
- `docs-path` dir missing → STOP with options (restore from git / cancel)
- **feature-req file resolution** (sdlc only):
  - Parse `feature-req.file:` (primary) and `canonical-fallback:`
  - Verify primary file exists AND size > 200 bytes
  - IF primary missing/corrupt → try fallback
  - IF both missing → STOP: "feature-brief.md and doc-brief.md both missing. Re-run /from-doc or restore from git."
  - IF only fallback available → warn user: "feature-brief missing, agents will use canonical doc-brief (slower)"
- **feature-brief staleness check** (if primary exists):
  - Read feature-brief frontmatter `canonical-hash`
  - Compute current sha256 of `{canonical-fallback}` (doc-brief)
  - IF mismatch → warn: "feature-brief stale (canonical edited). Regenerate? (yes/use-stale/use-canonical)"
  - IF user picks regenerate → invoke from-doc Step 5f.5 only (re-generate feature-brief from current doc-brief), then proceed

**3.1 Extract:** all frontmatter + `clarification-notes`, `pre-scaffold*`, `Active Blockers`

**3a. Reconcile with feature-map.yaml (if both exist):**
Mismatch on `status` or `current-stage` → ask user:
- A) Sync feature-map ← _state.md (default, recommended)
- B) Sync _state.md ← feature-map (backup first to `.pre-reconcile.bak`)
- C) Proceed with warning (set `sync-warning: true`)
- D) Cancel

**3b. Dependency check (if `depends-on` non-empty):**

feature-map parse fail → warn, offer skip.

**Cycle detection (DFS)** — if cycle found: STOP (hard block, user fixes config).

**Blocked deps:**
- Missing in map → STOP (config error)
- `status != done` → ask: wait / override / cancel

**3c. Pre-scaffold:** if `pre-scaffold: true` AND target dir now exists → ask move (yes/no), update paths.

## Step 4 — Display status

Mid-wave enrichment (sdlc + `current-stage` is `dev-wave-{N}` or `fe-dev-wave-{N}`):
- Read TL plan, glob `05-*-w{N}-*.md` → show `{done}/{total} tasks, còn lại: {ids}`

Format:
```
## Pipeline: {feature-name}
Feature ID: {id}
stage: {current-stage}  [{done}/{total} tasks if mid-wave]
Đã xong: {completed}
Còn: {queue}
blockers: {or "không có"}
```

### 4b. Clarification answer check

If `clarification-notes` non-empty AND no `User answer:` line:
```
⚠️ PM đã hỏi: {question}
options:
  A) Trả lời
  B) Dừng (/resume sau)
  C) Rollback stage
```
- **A**: ask answer, validate non-empty (3 retries), append `User answer: {text}`, save
- **B**: STOP, preserve state
- **C**: clear `clarification-notes`, pop last from `completed-stages` back to front of `stages-queue`, save, proceed

## Step 5 — Distill conversation (sdlc, optional)

Silent review for unpersisted decisions (scope changes, spike results, agreed directions). Skip if nothing relevant.

## Step 6 — Build dispatcher prompt + run loop

Read `notepads/dispatcher-loop.md` → follow FROZEN_HEADER + DYNAMIC_SUFFIX construction (Step 6) and the cost-fix dispatcher loop (Step 7).

After each iteration in the loop:
- Append checkpoint markers per `notepads/checkpoints.md` (on stage advance + wave-boundary snapshot)

---

## Edge cases

| Condition | Action |
|---|---|
| `_state.md` not found | Fuzzy suggest if feature-map exists, else "not found" |
| `status: done` | Refuse (corrupts sealed state) |
| `status: blocked` | Display blockers, ask user to resolve |
| `pipeline-type` missing | Infer (sdlc if `feature-id`, else `doc-generation`) or ask |
| Legacy no `stages-queue` | Reconstruct from path − completed |

---

## What's next

| Type | Outcome | Next |
|---|---|---|
| sdlc | Complete | `/close-feature` → `/retrospective` |
| sdlc | Blocker | `/feature-status` |
| doc-generation | Done | `/export-docs` |
| Any | Interrupted | Re-run `/resume-feature {id}` |
