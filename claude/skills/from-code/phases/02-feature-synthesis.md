# Phase 3 — Feature Synthesis

**Purpose**: Cluster routes into features (P3a), classify implementation status (P3b), derive feature names (P3c). LLM-heavy phase.

**Pre**: Gate 0 confirmed. `code-facts.json` validated.
**Tokens**: ~10K per service
**Gate**: none (Gate A after Phase 5)

## Step 3.0 — Entry print (MANDATORY)

```
Print: "▶️ Starting Phase 3: Feature Synthesis (cluster + status + naming)"
```

## Step 3.a — Cluster routes into features

### 3.a.1 Scoring algorithm (deterministic preprocessing before LLM)

For each pair of routes `(r1, r2)` in the same service, compute signals:

```python
def signals(r1, r2, facts):
    # 1. URL prefix match — longest common prefix / max(len)
    url_prefix = lcp_ratio(r1.path, r2.path)

    # 2. Entity overlap — Jaccard
    e1, e2 = set(r1.entities_touched), set(r2.entities_touched)
    entity_touched = jaccard(e1, e2) if (e1 or e2) else 0

    # 3. Auth scope match — exact set equality gets 1.0, subset 0.5, disjoint 0
    auth_scope = auth_match(r1.auth_scope, r2.auth_scope)

    # 4. i18n namespace — do handlers reference same i18n namespace?
    ns1, ns2 = infer_i18n_ns(r1, facts.i18n), infer_i18n_ns(r2, facts.i18n)
    i18n_ns = 1.0 if ns1 and ns1 == ns2 else 0

    # 5. Test describe overlap
    t1, t2 = tests_for(r1, facts.tests), tests_for(r2, facts.tests)
    test_describe = jaccard(t1, t2) if (t1 or t2) else 0

    # 6. Folder/module — same top-level dir under service
    folder = 1.0 if same_module_folder(r1.handler_file, r2.handler_file) else 0

    return { ... }

composite = sum(signal_i * weight_i)  # weights from schema
```

Build affinity matrix → run connected components with edges where `composite >= 0.6`.

Each connected component = 1 candidate feature.

### 3.a.2 Dispatch LLM for cluster refinement + naming proposal

```
Agent(
  subagent_type: code-intel,
  prompt: |
    ## Agent Brief
    role: code-intel
    task: cluster-refine

    ## Project Conventions
    vn-business-language: true
    cluster-threshold: 0.6
    weights: {from schema}

    ## Feature Context
    service_id: {svc}
    total_routes: {N}
    preliminary_clusters: {clusters}

    ## Inputs
    code_facts_path: docs/intel/code-facts.json
    action: |
      1. Review each preliminary cluster.
      2. Flag clusters with entity_count > 5 OR auth mix as split candidates.
      3. Flag cluster pairs sharing > 4/6 signals as merge candidates.
      4. Propose Vietnamese name per cluster (priority: i18n key > test describe > folder name > LLM).
      5. Output feature-candidates.json per schema.
)
```

Write `docs/intel/feature-candidates-{svc}.json` (validate against schema).

### 3.a.3 Orphan routes

Routes not in any cluster (composite < threshold with all others) → `orphan_routes[]`.
These become singleton feature candidates with lower confidence (0.4–0.6).

## Step 3.b — Classify status

### 3.b.1 Compute signal scores per feature (deterministic, Python)

For each candidate, collect all routes' handler files + associated tests. Compute 6 signals:

```python
def compute_status_score(feature, facts):
    handler_files = [r.handler_file for r in feature.routes]
    scope_loc = sum(r.handler_loc for r in feature.routes)
    scope_todos = count_markers_in_files(handler_files, facts.markers)

    # 1. handler_completeness
    stub_count = sum(1 for r in feature.routes if r.is_stub)
    hc = 1 - (stub_count / len(feature.routes))
    # Penalty for low avg LOC
    avg_loc = scope_loc / len(feature.routes)
    if avg_loc < 5: hc *= 0.5

    # 2. test_coverage
    handlers_with_tests = count_handlers_having_tests(feature.routes, facts.tests)
    test_ratio = handlers_with_tests / len(feature.routes)
    # Adjust by skip ratio
    skip_ratio = overall_skipped / overall_tests if overall_tests else 0
    tc = test_ratio * (1 - skip_ratio)

    # 3. error_path_coverage
    try_catch = count_try_catch(handler_files)
    error_returns = count_error_status_returns(handler_files)
    ep = min((try_catch + error_returns) / (len(feature.routes) * 1.5), 1.0)

    # 4. feature_flag_state
    flags = flags_guarding_feature(feature, facts.configs.feature_flags)
    if not flags:
        ff = 1.0   # no flag = assumed active
    else:
        ff = 1.0 if all(f.default_state for f in flags) else 0.3

    # 5. entity_integrity
    referenced = feature.entity_ids
    resolved = [e for e in referenced if e in facts.entities_ids]
    ei = len(resolved) / len(referenced) if referenced else 1.0

    # 6. todo_density_inverse
    density = scope_todos / max(scope_loc / 100, 1)   # TODOs per 100 LOC
    tdi = 1 - min(density / 10, 1.0)

    weighted = (hc*0.25 + tc*0.25 + ep*0.15 + ff*0.10 + ei*0.15 + tdi*0.10)

    # Assemble evidence
    return StatusEvidence(
        feature_id=feature.id,
        score=weighted,
        status=bucket(weighted),
        signals={...},
        gaps_to_done=derive_gaps(feature, signals)
    )
```

### 3.b.2 Derive gaps_to_done

```python
def derive_gaps(feature, signals):
    gaps = []
    if signals.test_coverage.value < 0.7:
        for r in feature.routes without tests:
            gaps.append({type: "missing-tests", file: r.handler_file, line: r.handler_line,
                         priority: "P1", estimated_effort: "S"})
    if signals.handler_completeness.stub_handlers > 0:
        for r in feature.routes where is_stub:
            gaps.append({type: "stub-handler", file: r.handler_file, priority: "P0", effort: "M"})
    if signals.entity_integrity.dangling:
        for d in dangling:
            gaps.append({type: "dangling-entity-ref", description: d.reason, priority: "P0"})
    if signals.feature_flag_state.value < 1.0:
        gaps.append({type: "feature-flag-off", description: ...})
    if signals.error_path_coverage.value < 0.5:
        gaps.append({type: "unhandled-error-path", priority: "P2"})
    if signals.todo_density_inverse.value < 0.5:
        gaps.append({type: "open-todo", priority: "P2", effort: "S"})
    return gaps
```

Write `docs/intel/status-evidence-{svc}.json` (validate).

### 3.b.3 Status distribution sanity check

```
counts = count_by_bucket(status_evidence)
total = sum(counts)

IF counts.done / total > 0.9:
  Warning: "Suspiciously high 'done' ratio. Review scoring weights or add P0 TODOs."
IF counts.stubbed / total > 0.5:
  Warning: "Most features stubbed. Repo may be very early stage or tests missing."
```

## Step 3.c — Name features (Vietnamese business language)

### 3.c.1 Priority chain

For each candidate:
```
name_candidates = []

# Priority 1: i18n namespace title
if feature.evidence.i18n_namespace:
    title_key = find_title_key(feature.i18n_namespace)  # e.g. orders.list.title
    if title_key in vi_locale:
        name_candidates.append((vi_locale[title_key], "i18n", 0.9))

# Priority 2: Test describe block
if feature.evidence.test_describe.describe_texts:
    vn_describes = [d for d in describes if has_vietnamese_chars(d)]
    if vn_describes:
        name_candidates.append((normalize(vn_describes[0]), "test-describe", 0.85))

# Priority 3: Folder name translation
folder = feature.evidence.folder_module.folder
translation = lookup_folder_to_vn(folder)  # "orders" → "Đơn hàng"
if translation:
    name_candidates.append((f"Quản lý {translation}", "folder-name", 0.7))

# Priority 4: LLM proposal from handler signatures + entities
else:
    name_candidates.append((llm_propose_name(feature), "llm-proposal", 0.6))

feature.proposed_name = name_candidates[0][0]
feature.name_source = name_candidates[0][1]
```

### 3.c.2 Generate feature IDs

```
PREFIX = derive_prefix(service_name or system_name, max 6 chars, no diacritics)
# e.g. system "Quản lý đơn hàng" → "QLDH"

features[i].feature_id = f"{PREFIX}-{date:YYYYMMDD}-{sequence:03d}"
```

### 3.c.3 Write features.json

```
features = [
  {
    feature_id: "QLDH-20260425-001",
    name: "Quản lý đơn hàng",
    name_source: "i18n",
    confidence: 0.87,
    service_id: "api",
    route_ids: [R-005, R-006, ..., R-012],
    entity_ids: [Order, OrderItem],
    status: "done",                # from status-evidence
    status_score: 0.82,
    candidate_ref: "FC-001"
  },
  ...
]
```

Write `docs/intel/features-{svc}.json`.

## Step 2.d — MC-2 Micro-checkpoint (absorbs old Interview R2)

See [_micro-checkpoint.md](_micro-checkpoint.md).

```
═══════════════════════════════════════════════════
 ✅ Phase 2 complete — {N} features synthesized
═══════════════════════════════════════════════════

Per service:
  api:  12 features  (done: 8, in-progress: 3, stubbed: 1, planned: 0)
  web:  10 features  (done: 6, in-progress: 3, stubbed: 1, planned: 0)

Top features preview (by priority × active status):
  1. "Quản lý đơn hàng"  — done    (8 routes, 2 entities, 0.85 score)
  2. "Đăng nhập"         — done    (3 routes, 1 entity,  0.91 score)
  3. "Thanh toán Stripe" — in-prog (4 routes, 2 entities, 0.55 score)
  ...

Orphan routes: {O}  Avg naming confidence: {X}

Before Phase 3 (Validation), any of these?

AskUserQuestion (max 4):
  1. "▶️ Continue — features look right"
  2. "✏️ Rename features / override names (batch)"
  3. "🔄 Override status for specific features (bug in prod → downgrade done→in-progress)"
  4. "➕ Add 'planned' features (known but no code yet) + business value notes"
```

### Edit handlers

- **Rename batch**: for each feature with `confidence < 0.7`, offer: keep / rename / merge-with-other / split. Batch 10 per AskUserQuestion round.
- **Status override**: show features list, pick one(s); for each, collect new status + reason → update `status-evidence.json` with `status_source: user-override`.
- **Add planned features**: collect name + scope + expected routes (optional) per feature → append to `features.json` with `status: planned, status_source: interview-only, confidence: 1.0`.

All edits update `features.json` + `status-evidence.json` atomically, then re-display summary.

Iteration bound: 2.

### Business-value micro-collect (optional)

If any feature has `confidence < 0.7` OR `status ∈ [in-progress, stubbed]`, offer free-text prompt (batch up to 5) to save into `state.config.interview_context.feature_notes[{id}].business_value`.

## Step 2.e — State update + exit print

```
state.steps["2"].completed_at = now
state.steps["2"].mini_gate = { iterations: N, forward_context_keys: [...] }
state.current_step = "3"
Flush state

Print: "✅ Phase 2 complete. ▶️ Next: Phase 3 Validation"
```
