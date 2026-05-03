# Dispatcher Loop — resume-feature variant (DEPRECATED REFERENCE — content inlined into SKILL.md 2026-05-04)

> **⚠️ DEPRECATED 2026-05-04**: The critical loop logic (Step 6 + Step 7) has been INLINED into `resume-feature/SKILL.md` Section 6.1-6.7 because Cursor sometimes fails to load this notepad relative-path (observed F-007 spike: "Không có .cursor/notepads/dispatcher-loop.md trong workspace") which caused composer-2 to fall back to "do work yourself" mode, breaking the entire orchestration.
>
> **The authoritative loop is now in `SKILL.md` itself.** This file is kept as supplementary reference for cache-discipline edge cases and history of the Active Context Bundle revert (2026-05-01).
>
> If you are reading this file because SKILL.md said to: STOP. You should be reading SKILL.md Section 6 directly.

Loaded on demand by `resume-feature/SKILL.md` after `_state.md` is parsed and validated (skill Steps 1-5).

---

## Step 6 — Build dispatcher prompt (cache-aware)

Compute **FROZEN_HEADER once** before the loop — identical bytes every iteration = cache hit.
Append **DYNAMIC_SUFFIX** per iteration — only the parts that actually change.

**FROZEN_HEADER** (computed once before loop — never re-read, never mutated; STATIC bytes only — never inject stage-specific or iter-specific values here, otherwise cache breaks):
```
## Pipeline Context
pipeline-type: {sdlc|doc-generation}
feature-id: {feature-id}          # sdlc only — OMIT this line entirely for doc-generation (do not include with empty value)
docs-path: {docs-path}
repo-path: {repo-path}             # sdlc only — OMIT entirely for doc-generation
output-mode: {output-mode}         # sdlc only — OMIT entirely for doc-generation
stages-total: {N}                  # captured once at loop init = len(initial stages-queue) + len(completed-stages); never re-read from _state.md
intel-path: {intel-path}           # sdlc: {repo-path}/docs/intel/  | doc-generation: {docs-path}/intel/  — captured once, static within run
intel-contract: |
  Canonical intel artifacts at {intel-path}: actor-registry.json, permission-matrix.json, sitemap.json, feature-catalog.json, test-accounts.json (optional).
  Sub-agent rules:
  1. Read intel BEFORE planning/coding — role slugs, route paths, permission decorators are CANONICAL (use exact strings; do not rename/translate).
  2. Required artifact missing OR _meta.artifacts[file].stale=true → STOP with verdict "intel-missing: {file}". Do NOT guess values.
  3. Code change touching auth/role enum/routes/RBAC decorators → set _state.md field `intel-drift: true` so /intel-refresh runs at pipeline end.
  4. Never ground role/permission decisions on prose alone (feature-brief.md) — JSON is source of truth.
  5. QA stage MUST co-produce 3 artifacts atomically (CD-10 Quy tắc 16):
     - test-evidence/{feature-id}.json    (TC prose with execution.status set)
     - playwright/{feature-id}.spec.ts    (executable script, naming 1:1 with TC IDs)
     - screenshots/{feature-id}-step-NN-{state}.png  (CD-4 naming, captured DURING Playwright run)
     Single capture pass = dual-purpose evidence: regression run-back + doc illustration.
     QA stage verdict MUST include {test_cases_count, passed_count, screenshot_count, playwright_path}.
     Missing any one of 3 → block close-feature (handled in /close-feature gate).
  6. Intel read tiers (CD-10 Quy tắc 14 — token economy): base-tier agents (dev, fe-dev, qa, reviewer) MUST Read({intel-path}/_snapshot.md) FIRST — compressed view ~5-7K tokens covers 95% of orientation needs. Fall back to canonical JSON ONLY when (a) snapshot missing → STOP "intel-snapshot-missing", (b) snapshot stale (sources_sha256 mismatch in _snapshot.meta.json) → read single canonical file then warn, (c) qa needs test-accounts.json (excluded from snapshot by design), or (d) dev needs specific code-facts.json section. Pro-tier agents (sa, sa-pro, reviewer-pro, ba-pro) bypass snapshot — Read canonical JSON directly because judgment requires full detail.
```

**Why this fits cache:** `intel-path` resolves to a constant string at loop init; the `intel-contract` block is fully static text identical across all iterations and stages. FROZEN_HEADER bytes remain identical, preserving prefix-cache hits for Cursor's Task() context.

**DYNAMIC_SUFFIX** (rebuilt each iteration — keep minimal):
```
## Current State
current-stage: {current-stage}
iter: {iter}
last-verdict: {last-verdict}       # "none" on iter=1; result.verdict on iter>1
```

First iteration only: append `session-context: |` block under `## Current State` if distilled content exists (Step 5). Do NOT include in iter > 1.

### History note: Active Context Bundle removed (2026-05-01)

An "Active Context Bundle" feature was added on 2026-05-01 to pre-inline artifacts into Task() prompts (intent: reduce subagent re-reads). F-005 spike measured net negative effect: bundle changes per stage break Cursor cache prefix, adding fresh input cost (~$3/feature) that exceeded the redundant-Read savings. Subagents now Read files normally (cheap when project is small + properly scoped tech-lead-plan).

If revisiting: bundle would only pay off if (a) bundle content is IDENTICAL across stages (same prefix bytes for cache hit) OR (b) Cursor exposes explicit cache_control breakpoints. Neither is true today.

---

## Step 7 — Dispatcher loop (cost-fix 2026-05-01)

**⚠️⚠️⚠️ CRITICAL — RUN FULL PIPELINE IN ONE SESSION**:

Each `/resume-feature` invocation = 1 fresh skill execution = pays cache_write tax (~$0.30-0.50). Multiple invocations per feature = multiple cache writes = duplicated cost. **You MUST loop until `status=done` or hard `blocked`** unless user explicitly aborts.

**DO NOT EXIT just because:**
- ❌ A wave boundary completed (more stages remain)
- ❌ A stage transitioned (queue not empty)
- ❌ A PM resolved (skill should resume immediately)
- ❌ Long output / Cursor "Continue?" prompt (auto-continue if possible)
- ❌ "Pipeline looks paused" — re-call dispatcher anyway, it will re-read _state and progress

**ONLY EXIT when:**
- ✅ `status=done` (stages-queue empty AND status field set to done)
- ✅ `status=blocked` with explicit blocker requiring user input
- ✅ `iter >= max_iterations` (200)
- ✅ Hard error (exception after 2 retries)

**Loop:**
```
iter = 0; pm_count = 0; last_hash = null; last_verdict = "none"
FROZEN_HEADER = build_frozen_header().rstrip("\n")
# PM_FROZEN = 4-block escalation template defined verbatim in ~/.cursor/agents/pm.md § "Escalation Prompt Template"
# Order: ## Agent Brief → ## Project Conventions → ## Feature Context → ## Inputs (pm-trigger + pm-context).
# Build by copying that template, filling placeholders from _state.md; rstrip("\n") for cache stability.
PM_FROZEN = build_pm_frozen().rstrip("\n")

WHILE iter < 200:                                     # bumped 50→200 (cost-fix 2026-05-01)
  iter++
  DYNAMIC_SUFFIX = "## Current State\ncurrent-stage: {current-stage}\niter: {iter}\nlast-verdict: {last_verdict}"
  IF iter == 1 AND session_context exists: DYNAMIC_SUFFIX += "\nsession-context: |\n  {session_context}"
  prompt = FROZEN_HEADER + "\n\n" + DYNAMIC_SUFFIX

  result = Task(dispatcher, prompt)  # MODEL-AUTO; retry 1× on crash, else STOP

  # Intel gate (sdlc, stages that touch code)
  # Pre-stage: if current-stage starts implementing AND intel-path missing required artifacts → STOP with "intel-missing: {file}".
  # Post-stage: if result.verdict carries `intel-drift: true` → persist to _state.md.intel-drift.

  # Robust status handling — be LENIENT (cost-fix 2026-05-01):
  # If result has no `status` field OR status is unknown: TREAT AS continuing (default behaviour).
  # Only stop on EXPLICIT done/blocked/pm-required.
  status = result.get("status") or "continuing"        # default to continuing if missing

  CASE status:
    "continuing":
      last_verdict = result.verdict or "in-progress"
      print "[{stage}] ✓ {verdict}" (dots after iter>10)
      checkpoint_if_wave_boundary()                    # see notepads/checkpoints.md
      loop  # ← CRITICAL: do NOT exit even if verdict says "wave done", "stage advanced", etc.

    "done":
      # SAFETY CHECK: verify stages-queue actually empty before honoring done.
      reread _state.md
      IF stages-queue is non-empty:
        print "⚠ Dispatcher returned done but stages-queue not empty — treating as continuing"
        last_verdict = "auto-continue"
        loop                                             # do NOT exit
      ELSE:
        report final summary
        release lock
        exit

    "blocked":
      # Distinguish HARD blockers (user input needed) from TRANSIENT blockers (try once more)
      IF result.blockers contains any of: PARSE-001, NO-INVOKE-001:
        # Transient — retry once
        IF transient_retry_count < 1:
          transient_retry_count++
          continue                                       # retry same iter
      surface blockers, release lock, stop

    "pm-required":
      pm_count++
      IF pm_count > 5: STOP (possible stuck)
      curr_hash = hash(_state.md)
      IF curr_hash == last_hash AND pm_count > 1: STOP (no-op loop)
      pm_ctx = truncate(result.pm-context, 8K)
      pm_result = Task(pm, PM_FROZEN + "\n\n" + pm_ctx)  # retry 1× on crash
      IF invalid JSON or no `resume`: STOP
      IF resume=true: last_hash = curr_hash; last_verdict = "pm-resolved"; loop
      else: surface message, STOP

    default ("other"):
      # NEVER silently STOP. Log + treat as continuing.
      print "⚠ Unknown status '{status}' from dispatcher — treating as continuing (cost-fix 2026-05-01)"
      last_verdict = result.verdict or "unknown-status"
      loop
```

**All STOP paths release lock. All paths preserve `_state.md`.**

**Cost rationale (2026-05-01)**: Each early exit forces user to invoke `/resume-feature` again = NEW skill session = cache_write tax (1.25× input rate on system prompt + agent.md). Measured: ~$0.30-0.50 per re-invocation. Pipeline of 4 stages re-invoked 4× = ~$1.50 wasted on cold-cache tax alone. Strict rule: **loop until pipeline genuinely complete or hard-blocked**.

---

## Token budget per iteration (approximate)

- FROZEN_HEADER: ~150 tokens (was ~80; +70 for intel-path + intel-contract) — stable prefix, may benefit from Cursor's prompt cache if Task() shares prefix within session
- DYNAMIC_SUFFIX: ~30 tokens — billed each iteration regardless
- Net: each iteration costs ~30 tokens input beyond the first call
- Note: Cursor Task() spawns independent contexts — prefix cache hit depends on Cursor's internal implementation; do not rely on it as guaranteed

⚠️ Cache-preservation rules:
1. **NEVER inject stage-specific, iter-specific, or runtime-resolved values into FROZEN_HEADER.** New static fields = OK; dynamic fields belong in DYNAMIC_SUFFIX.
2. **APPEND-ONLY when adding fields to FROZEN_HEADER.** New fields go at END of block. Reordering existing fields breaks ALL existing cache entries (byte-mismatch on prefix). The current order is intentionally stable — preserve it.
3. **Field naming: kebab-case, lowercase.** Match existing pattern (`intel-path`, `repo-path`). Inconsistency breaks scanning + cache key stability.
4. **Whitespace discipline.** Trailing spaces / different newline counts produce different bytes. Builder uses `.rstrip("\n")` then `+ "\n\n" +` exactly — don't add `\r\n` or extra spaces.
5. **No ASCII art / emoji at the very top.** Visual changes are tempting; they're cache-killers when prefix bytes are sensitive.

---

## Completion Report

**sdlc done:**
```
✅ Pipeline hoàn tất — {feature-name}
reviewer: {verdict}
▶ /close-feature
```

**doc-generation done:**
```
✅ Generate docs hoàn tất
📁 {docs-path}/output/
⚠️ Checklist: verify dates, screenshots, test coverage, placeholders
```

**Max iterations hit:**
```
⚠️ Hit max iterations. State preserved at {current-stage}.
Re-run /resume-feature {id} nếu healthy. Else check /feature-status.
```

## Why pipelines sometimes stop mid-run

Cursor main-chat has context/turn limits. Long pipelines (Path L + reworks) may exit at safe checkpoint — this is Cursor protection, not bug. `_state.md` is always current; re-run to continue. Minimize by: `output-mode: lean`, lower `risk_score`, split large features into dependent smaller ones.
