# doc-intel — LARGE Mode Workflow (Map-Reduce)

> **Load this file ONLY when** `Phase 0` strategy dispatch determines `strategy=LARGE`
> (typically: input >50 pages, OR >5 modules, OR >100 screenshots).
> Parent agent: `~/.claude/agents/doc-intel.md`

## LARGE Mode Workflow (Map-Reduce)

### PHASE A — Structure scan (run ONCE, before any deep analysis)

Goal: build module map WITHOUT doing full extraction.

```
1. Read each source file's TOC / first few pages / headings only
2. Identify modules by headings (I., II., Phần, etc.)
3. Tag each module with: page-range, estimated screenshot count by proximity
4. Extract embedded images from DOCX/PDF → save to {docs-path}/screens/ (same as SMALL)
5. Quick OCR of screenshots (batch 8) → tag each to nearest module by filename proximity or TOC reference
6. Write {docs-path}/structure-map.json
```

Schema:
```json
{
  "source-files": ["..."],
  "total-pages": N,
  "total-screenshots": N,
  "modules": [
    {
      "id": "M1",
      "name": "Quan ly he thong",
      "pages": [1, 2, 3, 4, 5],
      "screenshots": ["img-01.png", "img-02.png", "..."],
      "word-count-est": 3500,
      "status": "pending"
    }
  ],
  "cross-module-hints": {
    "shared-entities-candidates": ["DonVi", "NguoiDung"],
    "integration-hints": ["Luong → TCKT", "An chi → TCKT"]
  }
}
```

**Fallback** (when structure scan fails — no clear TOC):

Decision tree:
```
IF total_pages ≤ 30 AND total_screenshots ≤ 20:
  → Safe to degrade to SMALL (monolithic handles it)

ELIF total_pages > 30 OR total_screenshots > 20:
  → DO NOT degrade. Force artificial split:
    • Split by page ranges: every 20 pages = 1 synthetic module
    • Synthetic name: "Section pages-{start}-{end}"
    • Tag screenshots by page proximity
  → Continue LARGE mode with synthetic modules

ELIF semantic clustering available:
  → Cluster by shared actors/entities/verbs detected in quick scan
  → Each cluster = synthetic module
```

Log fallback reason in strategy.json:
```json
{ "fallback": "no-toc-detected", "strategy": "page-split-20", "synthetic-modules": N }
```

Update `status: "A-done"` in strategy.json.

### PHASE B — MAP (parallel sub-agents per module)

```
modules_pending = [m for m in structure-map.modules if m.status != "done"]

Batch dispatch (max 8 parallel per Claude Code limit):
  FOR batch in chunks(modules_pending, 8):
    Dispatch all in batch IN ONE MESSAGE (parallel):
      FOR m in batch:
        Agent(
          subagent_type: doc-intel-module,
          run_in_background: false,
          prompt: |
            ## Agent Brief
            role: doc-intel-module
            pipeline-phase: MAP
            output-mode: lean

            ## Feature Context
            docs-path: {docs-path}
            source-path: {workspace}/docs/source
            structure-map: {docs-path}/structure-map.json

            ## Inputs
            module-id: {m.id}
            module-name: {m.name}
            pages: {m.pages}
            screenshots: {m.screenshots}
            output-path: {docs-path}/modules/{m.id}.md
        )
    
    After batch returns:
      FOR m in batch:
        IF {docs-path}/modules/{m.id}.md exists + valid:
          update structure-map.modules[m].status = "done"
        ELSE:
          update status = "failed", retry 1× then mark blocked
      Save structure-map.json (checkpoint)
```

**Per-module state tracking** — prevents re-running completed modules on resume:
```json
"modules": [
  { "id": "M1", "status": "done", "completed-at": "..." },
  { "id": "M2", "status": "done", "completed-at": "..." },
  { "id": "M3", "status": "failed", "error": "...", "retry-count": 1 },
  { "id": "M4", "status": "pending" }
]
```

**Resume (Phase B partial)**: read structure-map.json → dispatch ONLY modules with `status != done`.

### Phase A cost preview (before dispatching any sub-agent)

After structure-map built, compute cost estimate and confirm with user:

```
sub_agent_count = len(modules_pending)
estimated_tokens_per_agent = (pages_per_module × 500) + (screenshots_per_module × 2000) + 20000  # analysis overhead
total_map_tokens = sub_agent_count × avg_estimated_tokens
reduce_tokens = sub_agent_count × 3000 + 30000  # module-briefs + thinking
total = total_map_tokens + reduce_tokens

Display to user:
  Phase A scan found {N} modules.
  Estimated cost:
    MAP (sub-agents): {N} × ~{K}K = ~{total_map}K tokens
    REDUCE:           ~{reduce}K tokens
    Total:            ~{total}K tokens
  
  Time estimate: ~{total_map / 8 parallelism}min for MAP + ~2min REDUCE

AskUserQuestion:
  1. "Tiếp tục với {N} modules" (default)
  2. "Consolidate (merge adjacent modules to {N/2})"
  3. "Chia workspace (split doc into smaller runs)"
  4. "Hủy"
```

**Hard limit**: if `len(modules_pending) > 20` → warn with cost, require explicit confirmation.

Update `status: "B-done"` in strategy.json when all modules status == "done".

### PHASE C — REDUCE (aggregate into doc-brief.md)

Main doc-intel agent (the one being invoked — NOT a sub-agent):

```
STEP 1: Read all module-briefs
  Read all {docs-path}/modules/*.md
  Context: ~30-60K (N module summaries)

STEP 2: Source-quote validation (catch hallucinations — per anti-hallucination rule)
  For each module-brief:
    Sample 20% of rules (random)
    For each sampled rule with source: "explicit":
      grep raw-extract.md for the quote
      IF not found → flag module-brief as suspect
    IF >30% of samples fail → mark module as "needs-rerun"
  
  Action if any module suspect:
    AskUserQuestion: "Module {M} có {X} rules không traceable. Re-run / Drop suspect rules / Ignore"

STEP 3: Canonicalization passes (fix I1-I4 semantic issues)

  3a. Actor canonicalization (fixes I1)
      Collect all actors across modules
      Fuzzy-match pairs:
        - Levenshtein distance ≤ 3 OR
        - Shared permissions ≥ 80% OR
        - Same context (same module group)
      Merge matches with canonical name + alias list:
        "Kế toán viên (aliases: Accountant, KTV)"
      Output: canonical actor list for doc-brief Section 3

  3b. Entity collision detection (fixes I2)
      For entities with same name across modules:
        Compare field sets between occurrences
        IF field_overlap ≥ 50% → same entity, merge
        IF field_overlap < 50% → COLLISION. Require qualifier:
          "User (admin)" vs "User (customer)"
          → rewrite references in all affected module-briefs

  3c. Feature granularity normalization (fixes I3)
      Count actions per feature (List, Create, Edit, Delete = 4 actions)
      Compute:
        min_actions = minimum feature actions across modules
        max_actions = maximum feature actions across modules
      IF max / min > 5:
        Inconsistent granularity. Normalize:
          - Fine-grained features (1 action): MERGE into CRUD bundle per entity
          - Coarse features (>6 actions): SPLIT into 2-3 coherent features
      Re-compute feature count after normalization

  3d. Business rule deduplication (fixes I4)
      Hash each rule text (normalize whitespace)
      Merge duplicates (count occurrences)
      IF rule appears in ≥2 modules:
        → Promote to Section "Cross-cutting rules"
        → Tag origin modules
      Remove from per-module rule lists

STEP 4: Cross-module analysis
  4a. Shared entities (use canonicalized names from 3b)
  4b. Integration flows (bipartite graph from module-briefs)
  4c. Common patterns (approval workflows, period controls, audit trails)

STEP 5: Assemble doc-brief.md using Phase 6.1 template with canonicalized data:
  - Section 1: Executive Summary (synthesize module purposes)
  - Section 2: Document Analysis (counts from structure-map)
  - Section 3: Actors (from 3a — canonicalized)
  - Section 4: Module & Feature Inventory (from normalized module-briefs)
  - Section 5: Business Rules (per-module + cross-cutting from 3d)
  - Section 6: Entities (from 3b — with qualifiers for collisions)
  - Section 7: UI Screens (UNION)
  - Section 8: Integrations (from 4b)
  - Section 9: NFR (UNION)
  - Section 10: Validation (run 4 lens checks on aggregated content)
  - Section 11: Ambiguities (UNION + cross-module gaps)
  - Section 12: Pipeline Config

STEP 6: Write doc-brief.md atomically
STEP 7: Write tech-brief.md
```

Update `status: "C-done"` in strategy.json when doc-brief.md written.

### Benefits table

| Metric | Monolithic | Map-Reduce |
|---|---|---|
| Peak context per agent | 400K+ | ~40K per sub-agent, ~70K for REDUCE |
| Parallel speedup | None | ~5-8x during MAP |
| Quality (LLM attention) | Diffuse | Focused per module |
| Crash recovery | Restart all | Re-run failed module only |
| Token cost total | 1x | ~1.2x (overhead) |

---
