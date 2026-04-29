# Phase 4 — Validation

**Purpose**: Catch silent failures before user sees results. Cross-check LLM claims against deterministic facts.

**Pre**: features-{svc}.json + status-evidence-{svc}.json written
**Tokens**: ~2K (validator mostly mechanical checks + LLM for severity judgment)
**Gate**: none

## Step 4.0 — Entry print

```
Print: "▶️ Starting Phase 4: Validation"
```

## Step 4.1 — Dispatch validator

```
Agent(
  subagent_type: code-intel-validator,
  prompt: |
    ## Agent Brief
    role: code-intel-validator
    strict: false

    ## Feature Context
    service_ids: [active services]

    ## Inputs
    code_facts: docs/intel/code-facts.json
    features: docs/intel/features-{svc}.json (per service)
    status_evidence: docs/intel/status-evidence-{svc}.json
    feature_candidates: docs/intel/feature-candidates-{svc}.json

    action: run all checks (see agents/code-intel-validator.md)
)
```

Validator produces `docs/intel/validation-report.json`:

```json
{
  "meta": { "generated_at": ..., "strict": false },
  "summary": { "HIGH": N, "MEDIUM": N, "LOW": N, "by_category": {...} },
  "metrics": {
    "routes_mapped_to_features": 0.95,
    "entities_coverage": 1.0,
    "features_without_tests": 3,
    "features_with_low_confidence": 2,
    "orphan_routes_ratio": 0.05,
    "status_distribution_sanity": "ok"
  },
  "issues": [
    {
      "id": "V-001",
      "severity": "HIGH",
      "category": "evidence-missing",
      "message": "Feature QLDH-20260425-007 claims entity 'Customer' not in code-facts.entities",
      "feature_id": "QLDH-20260425-007",
      "suggested_fix": "Remove Customer from entity_ids OR add to code-facts via adapter re-run"
    }
  ]
}
```

## Step 4.2 — Display summary + decide next

```
Print:
  "📊 Validation report:
     HIGH:   {N}
     MEDIUM: {N}
     LOW:    {N}

   Key metrics:
     - Routes mapped to features: {XX%}
     - Entity reference coverage: {XX%}
     - Features with tests:        {XX%}
     - Orphan routes ratio:        {X%}
     - Status distribution sanity: {ok|suspicious}"

IF summary.HIGH == 0 AND summary.MEDIUM == 0:
  Print: "✅ Clean. Proceeding to Phase 4."
  → Exit

IF summary.HIGH == 0 AND summary.MEDIUM > 0:
  Print: "⚠️ {M} MEDIUM issues. Acceptable, Phase 4 will surface them."
  → Exit

IF summary.HIGH > 0:
  Display top 5 HIGH issues
  AskUserQuestion (max 4):
    1. "🔧 Auto-fix (regenerate features + evidence with issues as input)"
    2. "👁️ Xem chi tiết tất cả HIGH issues"
    3. "⏭️ Bỏ qua warnings, tiếp tục Gate A"
    4. "❌ Hủy"

  IF "Auto-fix":
    Write issues → docs/intel/validator-fixes.md
    Re-dispatch code-intel with mode=fix, input=validator-fixes.md
    Re-run validator (max 2 iterations)
    IF still HIGH after 2 iter → force 2-option (proceed-with-warnings | cancel)

  IF "Xem chi tiết": display all, re-ask

  IF "Bỏ qua": mark state.steps["4"].warnings_accepted = true, proceed

  IF "Hủy": cleanup, STOP
```

## Step 3.3 — MC-3 Micro-checkpoint

The validation report + 4-option decision IS the micro-checkpoint. No additional forward-looking prompt needed (P4 architecture doesn't need extra hints beyond what's in validation-accepted state).

Forward context captured:
- `state.config.interview_context.validation_accepted_warnings = true` if user chose "Bỏ qua"
- Phase 4 will not re-raise accepted issues

## Step 3.4 — State update + exit print

```
state.steps["3"].completed_at = now
state.steps["3"].high_count = summary.HIGH
state.steps["3"].warnings_accepted = (true if user chose skip)
state.steps["3"].mini_gate = { iterations: N }
state.current_step = "4"
Flush state

Print: "✅ Phase 3 complete. HIGH={N}, MED={N}, LOW={N}
        ▶️ Next: Phase 4 Architecture"
```
