# Phase 6 — Handoff

Final phase: present user-facing summary in Vietnamese, point to next-step (Cursor SDLC), optional MCP cache contribute.

## Step 6.1 — Render summary

Compute summary numbers from `_pipeline-state.json` + intel artifacts:

```python
n_features = len(feature_catalog.features)
n_must_have = len([f for f in features if f.priority == "must-have"])
n_should_have = len([f for f in features if f.priority == "should-have"])
n_nice = len([f for f in features if f.priority == "nice-to-have"])
n_roles = len(actor_registry.roles)
n_permissions = len(permission_matrix.permissions)
n_tc_seeds_total = sum(len(tc_file.test_cases) for tc_file in test_evidence_files)
n_dedup_unique = len([d for d in dedup_report if d.verdict == "UNIQUE"])
n_dedup_reuse = len([d for d in dedup_report if d.verdict in ["ADOPT", "EXTEND", "INTEG"]])
n_risks_high = len([r for r in all_features.risks if r.severity == "high"])
n_assumptions = len([d for d in decisions if d.topic == "assumption" and d.status == "active"])
n_graveyard = idea_graveyard_count
n_gaps = count_placeholders("[CẦN BỔ SUNG]") in all artifacts
n_low_conf = count features/decisions with confidence_pct < 50
```

Render to user (Vietnamese):

```
🎉 Brainstorm hoàn tất! Sẵn sàng chuyển cho team SDLC.

📊 Kết quả tổng hợp:

  Vision (PRFAQ):     "{prfaq.headline}"
  Win condition:      "{prfaq.success_metric}" (target: {threshold})
  
  Features tổng:      {n_features}
    ▣ Must-have:      {n_must_have} (MVP slice)
    ▢ Should-have:    {n_should_have} (next release)
    ◇ Nice-to-have:   {n_nice} (backlog)
  
  Actors:             {n_roles}
  Permissions seed:   {n_permissions} (proposed, sa enriches)
  TC seeds:           {n_tc_seeds_total} (tổng across {n_must_have} must-have features)
  
  DEDUP:              UNIQUE {n_dedup_unique} | Reuse-NDXP/LGSP/CSDLQG {n_dedup_reuse}
  Risks (Phase 4.5):  {n_risks_high} high-severity unmitigated
  Assumptions:        {n_assumptions} critical
  
  Idea graveyard:     {n_graveyard} ý tưởng đã loại (xem _idea/idea-graveyard.md để resurrect)

⚠️  Gaps cần follow-up:
  [CẦN BỔ SUNG]:      {n_gaps} chỗ
  [NEEDS-VALIDATION]: {n_low_conf} chỗ (confidence < 50%)
```

## Step 6.2 — Print next-step pointer

Identify first must-have feature ID (sorted by priority then created_at):

```
🚀 Bước tiếp theo (Cursor SDLC):

  1. Mở Cursor trong workspace này
  2. Chạy:  /resume-feature {first-must-have-id}
     → Cursor sẽ đọc {features-root}/{id}/_state.md
     → Dispatch BA stage (ba agent đọc feature-brief.md)
     → Tiếp tục SDLC: ba → sa → dev → qa → reviewer → close-feature

📋 Danh sách features must-have (theo thứ tự đề xuất ưu tiên):

  • {F-001}: {name} (story-points: M, risks: low)
  • {F-002}: {name} (story-points: S, risks: medium)
  • ...

📁 Artifact paths:
  • Workshop docs:    {features-root}/_idea/{idea-brief, impact-map, event-storming, story-map, pre-mortem, dedup-report}.md
  • Idea graveyard:   {features-root}/_idea/idea-graveyard.md
  • Coherence log:    {features-root}/_idea/coherence-log.md
  • Feature folders:  {features-root}/F-*/
  • Intel layer:      docs/intel/*.json
  • Pipeline state:   docs/intel/_pipeline-state.json
```

## Step 6.3 — Optional MCP cache contribute (consent gate)

If MCP `etc-platform` available AND user not opted out:

Ask:

*"Bạn có muốn contribute actor-pattern + feature-archetype về MCP intel-cache để project tương tự sau benefit từ warm-start không? Payload sẽ qua anonymization filter (server-side default-deny PII/customer names). Chỉ canonical role names + feature archetype categories được gửi."*

If YES:

```python
# Pre-redact (mandatory before send)
sanitized_payload = {
    "role_archetypes": [r.slug for r in actor_registry.roles],  # canonical only
    "feature_archetypes": [classify(f.business_intent) for f in features],  # categorical
    # NEVER send: customer names (Bộ/Tỉnh/Sở), PII, project_id with org info
}

mcp__etc-platform__intel_cache_contribute(
    project_id=workspace_slug_hashed,
    project_signature=build_signature_from_p0(...),
    artifact_kind="actor-pattern",
    payload=sanitized_payload,
    contributor_consent=True
)

mcp__etc-platform__intel_cache_contribute(
    project_id=workspace_slug_hashed,
    project_signature=...,
    artifact_kind="feature-archetype",
    payload=...,
    contributor_consent=True
)
```

Server rejects payload if PII/customer-hint detected (default-deny). Surface acceptance/rejection to user.

If NO → skip silently.

If MCP unavailable → skip silently, log `mcp-contribute: unavailable`.

## Step 6.4 — Mark Phase 6 complete

```python
state["steps"]["6"]["status"] = "completed"
state["steps"]["6"]["completed_at"] = ISO_NOW
state["steps"]["6"]["mcp_contribute"] = "yes" | "no" | "unavailable"
state["last_active_at"] = ISO_NOW
```

Append to `recap_ledger[]`:

```json
{
  "at_spiral": "6",
  "captured_at": "{ISO}",
  "snapshot": "Pipeline complete. {n_features} features crystallized. First must-have: {first-id}. Ready for /resume-feature."
}
```

## Step 6.5 — Closing message

```
✨ /from-idea hoàn tất.

State đã lưu: docs/intel/_pipeline-state.json
Resume sau (chạy lại /from-idea): sẽ enter "completed" state, hỏi user muốn re-open spiral nào nếu cần refine.

Cảm ơn bạn đã brainstorm — chúc dự án thành công! 🚀
```

## Re-entry behavior (if /from-idea invoked again after Phase 6 complete)

If `_pipeline-state.json#steps.6.status == "completed"`:

Phase 0.0 Resume Detection presents different menu:

```
Pipeline đã hoàn tất ngày {steps.6.completed_at}.

Bạn muốn:
  (a) View digest (xem lại kết quả, không thay đổi)
  (b) Re-open Spiral X để refine (cascade refresh áp dụng)
  (c) Add new feature (chạy /new-feature từ Cursor — recommended)
  (d) Replace toàn bộ (Restart fresh — backup + reset)
  (e) Cancel
```

Default recommendation: (c) — for adding features after pipeline completion, `/new-feature` (Cursor) is cleaner than re-opening from-idea spirals.

## Failure modes

- MCP contribute fails (network, server reject) → log, do not block Phase 6 completion.
- User answers "no" to MCP contribute → respect, do not push.
- Snapshot regen still failing from Phase 5 → surface warning in summary, suggest manual `intel-snapshot/generate.py` re-run.
