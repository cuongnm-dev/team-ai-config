# Phase 0.0 — Resume Detection

Triggered automatically at every `/from-idea` invocation, BEFORE Phase 0 Bootstrap. Detects whether user has an in-flight session and presents continuity options.

## Detection logic

```
1. Look for: {workspace}/docs/intel/_pipeline-state.json
2. If file exists AND skill == "from-idea" AND steps[6].status != "completed":
     → Enter Resume Detection flow (this notepad)
3. Else:
     → Proceed to Phase 0 (fresh start)
```

If a state file exists but `skill != "from-idea"` (e.g. left over from from-doc or from-code), surface warning and ask: *"Phát hiện workspace đang có pipeline `{other-skill}` chưa hoàn tất. Bạn muốn (a) bỏ qua + chạy /from-idea song song, (b) hủy /from-idea, (c) cleanup state cũ trước?"* — never silently overwrite.

## Time-aware recap routing

Compute `time_gap = now - last_active_at`:

| Gap | Recap mode | Behavior |
|---|---|---|
| < 30 min | `none` | "Tiếp tục từ Spiral N iteration M, không cần recap" |
| 30 min – 24h | `light` | Show 3-bullet status (last spiral name, current iteration, last decision committed) |
| 24h – 7d | `full` | Read `recap_ledger[-1].snapshot` + render summary of `decisions[].status="active"`; user must confirm "tỉnh táo" before proceed |
| > 7d | `vision-check` | Mandatory: re-read `_idea/idea-brief.md` (PRFAQ vision). Ask: "Đã hơn 1 tuần. Bạn còn solid với vision này không? Có thay đổi quan điểm nào sau khi nghĩ thêm?" — if yes → suggest Rewind to Spiral 1 |

Persist `recap_mode` in `_pipeline-state.json#steps.0.0.recap_mode`.

## 4-option menu

After recap rendered, present user 4 options:

```
🟢 Tiếp tục (Resume)
   → Vào thẳng Spiral N iteration M+1, giữ tất cả decisions[] active
   → Phù hợp khi: bạn vẫn rõ context, chỉ tạm dừng, không đổi ý

🔄 Bắt đầu lại (Restart fresh)
   → Backup _pipeline-state.json → .bak.{ISO}
   → Backup _idea/*.md → _idea/.bak.{ISO}/
   → Reset state về Phase 0
   → Phù hợp khi: ý tưởng đã thay đổi căn bản, hoặc muốn thử hướng khác hoàn toàn

⏮ Rewind to Spiral X (X = 1..4)
   → Mark Spiral X..4 as "rerun-needed"
   → Preserve original artifacts in _idea/.history/{spiral-N}-{ISO}.md (zero data loss)
   → decisions[] sau Spiral X marked status="rolled-back"
   → Cascade refresh: subsequent spirals must re-derive from new Spiral X output
   → Phù hợp khi: phát hiện sai/đổi ý ở 1 spiral cụ thể nhưng giữ được context tổng

📜 Xem digest (View digest)
   → Render full state without changing it: PRFAQ, all decisions[] active, idea-graveyard count, pre-mortem risks if Phase 4.5 done
   → Sau digest → quay lại 4-option menu này
   → Phù hợp khi: bạn không nhớ đã làm gì, muốn xem trước khi quyết định
```

## Output recap formats

### Light recap template (< 24h gap)
```
🕒 Bạn quay lại sau {gap}. 

Đang dở: Spiral {N} ({spiral-name}), iteration {M}.
Decision gần nhất (D-{NNN}): "{value}" — confidence {pct}%.

Tiếp tục từ đây?
```

### Full recap template (24h–7d gap)
```
🕒 Bạn quay lại sau {gap}.

📌 Vision (PRFAQ): "{idea-brief.headline}"
🎯 Win condition: "{idea-brief.win_condition}"

Đã chốt:
  • {decision[].topic}: {decision[].value} (D-{id}, {confidence}%)
  • ...

Đang dở: Spiral {N} ({spiral-name}), iteration {M}.
{ledger snapshot}

Bạn còn rõ context chứ? (Y/N — N sẽ chuyển sang vision-check)
```

### Vision-check template (> 7d gap)
```
🕒 Bạn quay lại sau {gap} — đã hơn 1 tuần.

Mình đã đọc lại PRFAQ:
  Headline: "{headline}"
  Target user: {target_users}
  Win condition: "{win_condition}"
  Top 3 features dự kiến: {top_3 from impact-map deliverables}

🤔 Câu hỏi quan trọng: 
  Sau khi nghĩ thêm 1 tuần, bạn còn solid với vision + win condition này không?
  
  (a) Vẫn solid → Resume từ Spiral N
  (b) Có điều chỉnh nhỏ → Rewind to Spiral 1, sửa PRFAQ
  (c) Đổi ý hoàn toàn → Restart fresh
```

## Idea-graveyard surfacing during recap

If `idea_graveyard_count > 0`, append to recap:
```
💀 Idea graveyard: {N} ý tưởng đã bị loại trong các spiral trước. 
   Xem: _idea/idea-graveyard.md
   Resurrect: /from-idea --resurrect <graveyard-id>
```

## Rewind cascade behavior

When user picks "Rewind to Spiral X":

1. Confirm: *"Rewind sẽ đánh dấu Spiral X..4 cần rerun. Decisions sau Spiral X sẽ được mark `rolled-back` (không xóa). Preserve `_idea/{spiral}.md` cũ ở `_idea/.history/`. Đồng ý?"*
2. On Y:
   - `_pipeline-state.json#steps.s{X..4}.status = "rerun-needed"`
   - `_pipeline-state.json#steps.s{X..4}.iterations = 0` (reset)
   - For each decision `d` in `decisions[]` where `d.spiral` is `s{X+1..4}` or `4.5`:
     - Set `d.status = "rolled-back"`
   - Move `_idea/spiral-{X..4}-output.md` files → `_idea/.history/{spiral}-{ISO}.md`
   - Clear `recap_ledger[]` entries with `at_spiral` after the rewind point
3. Append entry to `decisions[]`:
   ```json
   {
     "id": "D-rewind-{ISO}",
     "spiral": "0.0",
     "topic": "rewind",
     "value": "Rewound to Spiral X at {ISO}",
     "why": "{user-supplied reason or 'no reason given'}",
     "considered_alternatives": [],
     "confidence_pct": null,
     "assumptions": [],
     "status": "active",
     "timestamp": "{ISO}"
   }
   ```
4. Log to `_idea/coherence-log.md` with note: "Rewind decision — context shifted, reason: {reason}".
5. Continue execution from Spiral X.

## Restart cascade behavior

When user picks "Restart fresh":

1. Confirm: *"Restart sẽ backup ALL state + workshop docs vào `.bak.{ISO}` rồi reset về Phase 0. Bạn có thể recover qua restore manual nếu cần. Đồng ý?"*
2. On Y:
   - Backup `_pipeline-state.json` → `_pipeline-state.json.bak.{ISO}`
   - Backup `_idea/*.md` → `_idea/.bak.{ISO}/`
   - Init fresh `_pipeline-state.json` template
   - Set `current_step: "0"`
3. Continue execution from Phase 0.

**Note:** Restart does NOT touch `docs/intel/{actor-registry,permission-matrix,sitemap,feature-catalog,test-evidence}.json` — those are owned by Phase 5 crystallize. If user previously crystallized → those files persist and Phase 5 will offer Replace/Append decision again.

## Resume after MCP timeout

If `intel_cache_lookup` was attempted in Phase 0 of prior session and timed out (`mcp_warmstart: "timeout"` in state):
- On Resume, retry once silently
- If timeout again → log + continue cold (no warm-start)
- Do not block resume on MCP availability

## Failure modes

- `_pipeline-state.json` corrupt JSON → STOP, surface error, suggest manual fix or Restart
- `last_active_at` in future (clock skew) → treat as `now` for recap routing, log warning
- `decisions[]` with status="active" but referenced in artifact that no longer exists → flag in coherence_flags[], surface during recap
- User picks "Rewind to Spiral X" where X > current_step (i.e. forward) → reject, explain "Rewind chỉ về spiral đã hoàn tất"
