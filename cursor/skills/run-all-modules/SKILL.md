---
name: run-all-modules
description: Chạy batch /resume-module lần lượt cho TẤT CẢ modules theo thứ tự topological của module-catalog.json. Skill resumable — nếu interrupt giữa chừng, re-invoke đọc _batch-state.json để tiếp tục. Hỗ trợ filter status, --from M-NNN, policy on-error (stop|skip|continue), --dry-run preview, --max-modules giới hạn. Trigger - project có nhiều module cần chạy end-to-end qua đêm; "treo máy chạy hết". Anti-trigger - chỉ 1-2 module thì /resume-module thủ công; project chưa scaffold module thì /from-doc trước.
---

# Run All Modules — Batch Pipeline Execution

User-facing prompts: Vietnamese. Skill prose + dispatcher: English.

## ⚠️ SKILL ROLE — BATCH WRAPPER

This skill does NOT drive a pipeline directly. Role:
1. Read `module-catalog.json` and perform topological sort by `depends_on`
2. Loop: `Skill("resume-module", {id})` for each module in queue
3. Track progress in `docs/intel/_batch-state.json`
4. Final report

Pipeline driver remains `/resume-module` (PM Orchestrate Mode). This skill is pure orchestration + state management on top.

### Forbidden:
- ❌ Direct `Task(pm)` call — MUST use `Skill("resume-module")` to preserve resume-module's contract
- ❌ Skipping topological order — `depends_on` MUST be honored (M depending on M-Y runs AFTER M-Y)
- ❌ Bypassing `_batch-state.json` — skill MUST be resumable
- ❌ Overriding default policy — user configures via `--on-error` only

### Required:
- ✅ Step 0-2: load + topological sort + state init/resume
- ✅ Step 3: main loop with error handling per policy
- ✅ Step 4: clear final report (completed / failed / skipped / user-needed)
- ✅ State checkpoint after every module (interrupt-safe)

---

## Step 0 — Argument parsing

Recognized flags (mutually compatible):

| Flag | Tác dụng | Default |
|---|---|---|
| `--from M-NNN` | Bắt đầu từ M-NNN (skip modules trước trong topo order) | từ đầu |
| `--status proposed,in-progress,blocked` | Filter modules theo status (CSV) | tất cả status ≠ done |
| `--on-error stop\|skip\|continue` | Policy khi 1 module fail | `skip` |
| `--dry-run` | In thứ tự sẽ chạy + ước cost, không thực thi | (off) |
| `--resume` | Resume từ `_batch-state.json` (auto-detect nếu state file có) | (auto) |
| `--max-modules N` | Giới hạn số module mỗi run (auto-pause sau N) | unlimited |

Default behavior (no flags): chạy TẤT CẢ modules `status ∈ {proposed, in-progress, blocked}` theo topo order, skip on error.

## Step 1 — Validate prerequisites

```
1. Bash("ai-kit --version") → if fail → STOP
   "ai-kit không khả dụng. Chạy 'ai-kit reset && ai-kit update' trước."

2. Read docs/intel/_meta.json
   IF artifacts.module-catalog.stale == true → STOP
   "Module-catalog stale. Chạy /intel-refresh --tier T1 trước."

3. Read docs/intel/module-catalog.json
   IF modules[] empty → STOP
   "Catalog rỗng. Chạy /from-doc hoặc /from-code hoặc /from-idea trước để seed modules."

4. Verify resume-module skill khả dụng (registered trong ~/.cursor/skills/)
   IF NOT → STOP "skill resume-module không tìm thấy"
```

## Step 2 — Topological sort + filter

```
modules = read module-catalog.modules[]

# 2.1 Build dependency graph
graph = {}
for m in modules:
  graph[m.id] = m.depends_on || []

# 2.2 Topological sort (Kahn's algorithm)
sorted_ids = topological_sort(graph)
IF cycle detected → STOP MOD-CYCLE-001
  "Cyclic depends_on phát hiện: {cycle path}. Sửa module-catalog.json depends_on."

# 2.3 Filter theo status
filter_set = arg.status_csv.split(',') OR ['proposed', 'in-progress', 'blocked']
filtered = sorted_ids.filter(id => modules[id].status in filter_set)

# 2.4 Apply --from
IF arg.from:
  start_idx = filtered.indexOf(arg.from)
  IF start_idx == -1 → STOP "{arg.from} not in filtered queue"
  filtered = filtered[start_idx:]

# 2.5 Apply --max-modules
IF arg.max_modules:
  filtered = filtered.slice(0, arg.max_modules)

queue = filtered
IF queue empty:
  Print Vietnamese: "✓ Không có module nào cần chạy. Tất cả đã done hoặc bị filter loại."
  EXIT
```

## Step 3 — State init or resume

```
state_path = docs/intel/_batch-state.json

IF arg.resume OR exists(state_path):
  state = read state_path
  
  # Validate state
  IF state.queue != queue (mismatch — catalog đã thay đổi):
    Print Vietnamese:
      "⚠ Queue trong state cũ ({len_old}) khác queue hiện tại ({len_new}).
       Module-catalog có thể đã thay đổi.
       Lựa chọn:
         [r] Resume queue cũ (có thể thiếu modules mới)
         [n] New batch — backup state cũ → .bak.{ISO}, dùng queue mới
         [a] Abort"
    Apply user choice
  
  IF state.current_idx < state.queue.length:
    Print Vietnamese:
      "♻ Resume batch — {state.completed.length} done, {state.failed.length} failed, 
       {state.queue.length - state.current_idx} còn lại. Tiếp tục từ {state.queue[state.current_idx]}..."
  ELSE:
    Print Vietnamese: "♻ State có nhưng đã hoàn tất. Re-run hoặc --on-error retry."
    EXIT (or proceed to Step 6 final report)

ELSE:
  state = {
    started_at: ISO_now,
    queue: queue,
    current_idx: 0,
    completed: [],
    failed: [],
    skipped: [],
    user_needed: [],
    policy: {on_error: arg.on_error || 'skip'},
    total_tokens: 0,
    total_duration_min: 0
  }
  Write state_path

  Print Vietnamese:
    "▶ Bắt đầu batch run — {queue.length} modules theo topo order:
       {queue.join(' → ')}
     Policy on-error: {state.policy.on_error}"
```

## Step 4 — Dry-run preview (--dry-run)

```
IF arg.dry_run:
  # Estimate cost + time per module (heuristic theo risk_path)
  estimates = []
  for id in queue:
    m = modules[id]
    path = m.risk_path
    est = {
      S: {hours: 0.5, tokens_avg_k: 30},
      M: {hours: 1.5, tokens_avg_k: 80},
      L: {hours: 3.0, tokens_avg_k: 200},
    }[path] || {hours: 2, tokens_avg_k: 100}
    estimates.append({id, name: m.name, status: m.status, deps: m.depends_on, ...est})
  
  total_hours = sum(estimates.hours)
  total_tokens_k = sum(estimates.tokens_avg_k)
  cost_sonnet = total_tokens_k * 1000 * (0.003 + 0.015) / 2  # rough avg I/O
  cost_opus = cost_sonnet * 5  # rough multiplier

  Print Vietnamese:
    "═══════════════════════════════════════════════════
     DRY-RUN — không thực thi
     ═══════════════════════════════════════════════════
     Modules sẽ chạy ({queue.length}):
     
     #  | ID         | Status        | Path | Deps         | Est time | Est tokens
     ---|------------|---------------|------|--------------|----------|-----------
     1  | M-001      | in-progress   | L    | []           | 3.0h     | 200K
     2  | M-002      | proposed      | M    | [M-001]      | 1.5h     | 80K
     ...
     
     TỔNG: ~{total_hours} giờ wall-clock, ~{total_tokens_k}K tokens
     Ước cost: ~${cost_sonnet} (Sonnet) / ~${cost_opus} (Opus)
     
     Để chạy thật: re-invoke không có --dry-run.
     Để giới hạn: thêm --max-modules N."
  EXIT
```

## Step 5 — Main loop (resumable, checkpoint per module)

```
WHILE state.current_idx < state.queue.length:
  module_id = state.queue[state.current_idx]
  
  # 5.1 Re-check status từ catalog (có thể đã thay đổi từ run trước)
  catalog = read module-catalog.json
  current_module = catalog.modules.find(id == module_id)
  IF !current_module:
    state.skipped.append({id: module_id, reason: 'not-in-catalog (may have been renamed/removed)'})
    state.current_idx++; Write state; continue
  
  IF current_module.status == "done":
    state.skipped.append({id: module_id, reason: 'already-done'})
    state.current_idx++; Write state; continue
  
  # 5.2 Check depends_on satisfied
  unsatisfied_deps = current_module.depends_on.filter(d => catalog.modules.find(id==d)?.status != 'done')
  IF unsatisfied_deps non-empty:
    Print Vietnamese:
      "⚠ {module_id} có deps chưa done: {unsatisfied_deps}.
       Theo policy {state.policy.on_error}, action: {policy_action}"
    IF state.policy.on_error == 'stop':
      state.failed.append({id: module_id, reason: 'unsatisfied-deps', deps: unsatisfied_deps})
      Write state; EXIT
    ELSE:  # skip or continue
      state.skipped.append({id: module_id, reason: 'deps-not-done'})
      state.current_idx++; Write state; continue
  
  # 5.3 Print progress + invoke resume-module
  Print Vietnamese:
    "[{state.current_idx + 1}/{state.queue.length}] ▶ Đang chạy /resume-module {module_id}..."
    "    Name: {current_module.name}"
    "    Status: {current_module.status}, Path: {current_module.risk_path}"
  
  start_time = now
  
  # Invoke resume-module skill — đợi verdict trả về
  result = Skill("resume-module", args: module_id)
  
  duration_min = (now - start_time) / 60
  
  # 5.4 Parse verdict
  verdict_status = result.status  # done | blocked | user-needed | iter-cap
  
  IF verdict_status == "done":
    state.completed.append({
      id: module_id,
      name: current_module.name,
      duration_min: duration_min,
      tokens: result.pipeline_tokens_total || 0,
      final_verdict: result.final_verdict,
      completed_at: ISO_now
    })
    state.total_tokens += result.pipeline_tokens_total || 0
    state.total_duration_min += duration_min
    Print Vietnamese: "    ✅ Done ({duration_min.toFixed(1)} phút, {result.tokens || 0} tokens)"
  
  ELIF verdict_status == "blocked":
    state.failed.append({
      id: module_id,
      name: current_module.name,
      reason: result.blockers || 'unknown blocker',
      tokens_spent: result.tokens || 0,
      duration_min: duration_min,
      failed_at: ISO_now
    })
    Print Vietnamese: "    ❌ Failed: {result.blockers[0]?.description || 'unknown'}"
    
    IF state.policy.on_error == 'stop':
      Print Vietnamese: "    Policy=stop → EXIT. Re-invoke với --resume sau khi fix."
      Write state; EXIT
    # else 'skip' or 'continue' → fall through
  
  ELIF verdict_status == "user-needed":
    state.user_needed.append({
      id: module_id,
      name: current_module.name,
      clarification: result.clarification_notes,
      paused_at: ISO_now
    })
    Print Vietnamese: "    ⚠ User-needed: {result.clarification_notes}"
    Print Vietnamese: "    Skip + tiếp tục (xử lý clarification sau via /resume-module {id})"
  
  ELSE:  # iter-cap or unknown
    state.failed.append({
      id: module_id,
      reason: 'iter-cap or unknown verdict status: ' + verdict_status
    })
    IF state.policy.on_error == 'stop': Write state; EXIT
  
  # 5.5 Checkpoint — Save state sau MỖI module
  state.current_idx++
  Write state_path
  
  # 5.6 Brief pause (avoid rate-limit + give user time to read progress)
  Sleep 3s

# End of loop
Write state final + last_completed_at = ISO_now
```

## Step 6 — Final report

```
total_modules = state.queue.length
done_count = state.completed.length
failed_count = state.failed.length
skipped_count = state.skipped.length
user_needed_count = state.user_needed.length

Print Vietnamese:
  "═══════════════════════════════════════════════════
   ✅ Batch run hoàn tất
   ═══════════════════════════════════════════════════
   Started:      {state.started_at}
   Ended:        {ISO_now}
   Wall-clock:   {state.total_duration_min / 60} giờ
   
   Tổng modules trong queue: {total_modules}
     ✅ Completed:    {done_count}
     ❌ Failed:        {failed_count}
     ⏭ Skipped:       {skipped_count}
     ⚠ User-needed:   {user_needed_count}
   
   Tổng tokens (ước):  ~{state.total_tokens.toLocaleString()}
   "

# 6.1 Failed details
IF failed_count > 0:
  Print Vietnamese:
    "
     Modules cần fix:"
    for f in state.failed:
      Print "  - {f.id} ({f.name}): {f.reason}"

# 6.2 User-needed details
IF user_needed_count > 0:
  Print Vietnamese:
    "
     Modules cần user trả lời clarification:"
    for u in state.user_needed:
      Print "  - {u.id}: {u.clarification}"
      Print "    → Trả lời clarification rồi /resume-module {u.id}"

# 6.3 Bước kế tiếp
Print Vietnamese:
  "
   Bước kế tiếp:
     ✅ Modules done → /close-feature cho từng F-NNN trong module
     ❌ Modules failed → review _state.md.frontmatter.blocked-by, fix manual hoặc /update-module {id}
     ⚠ Modules user-needed → trả lời trong _state.md, re-invoke /resume-module {id}
     
     Re-run batch (chỉ failed + user-needed):
         /run-all-modules --status blocked,user-needed --resume
     
     Re-run từ module cụ thể:
         /run-all-modules --from M-NNN
   "

# 6.4 Archive state file (rename to .completed.{ISO} cho audit)
mv _batch-state.json _batch-state.completed.{ISO}.json
Print Vietnamese: "State file lưu trữ tại _batch-state.completed.{ISO}.json"
```

---

## Edge cases

| Tình huống | Action |
|---|---|
| `module-catalog.json` rỗng | STOP, suggest `/from-doc` / `/from-code` / `/from-idea` |
| Tất cả modules `status=done` | INFO "all done", EXIT (không tạo state file) |
| Cyclic `depends_on` | STOP `MOD-CYCLE-001` với cycle path |
| Module trong queue bị xoá khỏi catalog giữa run | Skip + log `not-in-catalog` |
| Skill `resume-module` dispatch fail | Treat as failed, áp policy on-error |
| Interrupt giữa loop (Ctrl+C / network drop) | State đã saved sau module gần nhất → `--resume` tiếp tục |
| `_batch-state.json` corrupted | Backup → `.corrupted.{ISO}`, prompt user new batch |
| `--max-modules N` đạt giới hạn | Pause với INFO, gợi ý `--resume` để tiếp |
| ai-kit CLI không khả dụng | STOP, suggest `ai-kit reset && ai-kit update` |
| Intel artifact stale | STOP, suggest `/intel-refresh` |
| Tất cả modules trong queue có `unsatisfied_deps` (không thể chạy gì) | STOP với deadlock warning |

---

## What's next

| Outcome | Next |
|---|---|
| All done | `/close-feature {F-NNN}` cho từng feature trong các module → `/generate-docs` |
| Some failed | Review từng `_state.md.blocked-by`, fix manual hoặc `/update-module {id}`, rồi `/run-all-modules --status blocked --resume` |
| Some user-needed | Trả lời clarification trong `_state.md`, rồi `/resume-module {id}` thủ công |
| Interrupted | `/run-all-modules --resume` |
| Want subset | `/run-all-modules --from M-NNN --max-modules 5` |

---

## Tham chiếu chéo

- FAQ § 14 (Batch run patterns + cost estimates)
- `~/.cursor/skills/resume-module/SKILL.md` (driver thực sự)
- `~/.cursor/agents/pm.md` (PM Orchestrate Mode)
- ADR-003 D8 (module-driven architecture rationale)
- CD-24 (cross-cutting feature dependency — depends_on enforcement)
