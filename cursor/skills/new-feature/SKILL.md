---
name: new-feature
description: Khởi tạo feature SDLC mới (F-NNN nested dưới M-NNN) qua interview. Skill auto-allocate ID + slug theo quy tắc canonical, không nhận tham số ID. Bắt buộc chọn parent module từ catalog. Dedup-check hard-stop nếu trùng feature có sẵn (suggest /update-feature). Hand-off bằng cách suggest /resume-module sau khi user confirm (post-ADR-003 — pipeline drive ở cấp module). Trigger - thêm tính năng mới vào module có sẵn; "thêm feature"; mô tả nghiệp vụ chưa có feature phù hợp. Anti-trigger - feature đã tồn tại in-progress thì /resume-module (parent) hoặc /resume-feature (legacy); feature có sẵn cần update thì /update-feature; chưa có module nào thì /new-module trước. Example - "/new-feature" (interactive, không tham số).
---

# New Feature — Interview-first Entry Point

User-facing prompts: Vietnamese. Skill prose + dispatcher prompts: English.

## ⚠️ ai-kit CLI Enforcement (ADR-005)

**MUST call `Bash("ai-kit sdlc scaffold feature ...")` for atomic create — only after Step G confirm.** Skill = thin entry point.

| Step | ai-kit CLI command |
|---|---|
| Dedup check | `ai-kit sdlc dedup-check --kind feature --query "..."` (graceful fallback to @Codebase + heuristic) |
| Dependency suggest | `ai-kit sdlc deps-suggest --description "..."` (graceful fallback to entity match) |
| Parent module list | Read `docs/intel/module-catalog.json` (no CLI needed) |
| ID allocation | `ai-kit sdlc allocate-id --kind feature` (atomic; fallback to catalog max+1) |
| Atomic scaffold | `ai-kit sdlc scaffold feature --module M-NNN --id F-NNN --slug ... --consumed-by ...` |
| Rollback | `ai-kit sdlc rollback --kind feature --id F-NNN` (for Step I delete path) |

**Forbidden** per ADR-005 D3:
- ❌ Accept user-provided `feature-id` argument (full auto per Q1=A)
- ❌ Accept user-provided `slug` argument
- ❌ Write `_state.md` / `_feature.md` / `feature-brief.md` directly
- ❌ Direct edit of `feature-catalog.json` / `feature-map.yaml` / `sitemap.json` / `permission-matrix.json`
- ❌ Skip dedup check at Step 3 (HARD-STOP enforcement per Q3=A)
- ❌ Allow scaffold without parent module selection (FK enforcement)

---

## ⚠️ SKILL ROLE — INTERVIEW + SCAFFOLD ONLY

This skill does NOT drive pipeline. It interviews user, validates uniqueness, scaffolds, then suggests `/resume-module {parent_M}`. PM dispatch is owned by `/resume-module` (post-ADR-003: feature nested under module — pipeline ở cấp module, feature là spec card).

### Forbidden:
- ❌ Calling `Task(pm)` or `Task(specialist)` — pipeline driver is /resume-module
- ❌ Auto-spawning `/resume-module` — Q2 confirmed: skill ends with suggestion, user invokes
- ❌ Reading agent definitions and "doing work yourself"

### Required:
- ✅ Steps 0-7 = setup (interview, dedup, parent select, dependency, scaffold)
- ✅ Step 8 ends with suggestion `/resume-module {parent_M}` (post-ADR-003) or `/resume-feature {ID}` (legacy detect)
- ✅ User invokes /resume-* manually in next turn

---

## Step 0 — Argument handling (Q1=A: ignore user-provided ID)

If user invokes `/new-feature F-099` or `/new-feature {anything}`:

```
Print Vietnamese:
  "ℹ Tham số đã được bỏ qua — /new-feature luôn auto-allocate ID + slug theo quy tắc canonical
   (tránh skip số thứ tự). Tiếp tục interview…"
```

Special case — if arg matches `^M-\d+$` pattern (user typed module ID):

```
Print Vietnamese:
  "ℹ Bạn vừa nhập '{arg}' (module ID). /new-feature là để tạo feature, parent module sẽ chọn ở Step 1.5.
   Nếu muốn tạo module mới: /new-module
   Nếu muốn tiếp tục pipeline module: /resume-module {arg}
   Tiếp tục new-feature interview…"
```

Discard arg. Continue Step 1.

## Step 1 — Read intel + freshness gate

Per LIFECYCLE.md P5 (stale-block):

```
1. Read docs/intel/_meta.json
   For each artifact in {actor-registry, sitemap, module-catalog, feature-catalog, data-model, permission-matrix}:
     IF _meta.artifacts[file].stale == true:
       STOP with message:
         "⚠ Intel artifact `{file}` is stale (last fresh: {produced_at}).
          Run /intel-refresh before /new-feature to avoid propagating bad data.
          next-action: /intel-refresh --tier T1"
       EXIT

2. Read intel files (cache in skill memory):
   docs/intel/module-catalog.json     -> existing modules (parent selection, FK)
   docs/intel/feature-catalog.json    -> existing features (dedup + ID allocation)
   docs/intel/actor-registry.json     -> roles[] (role_visibility)
   docs/intel/sitemap.json            -> modules + routes (route placeholder generation)
   docs/intel/data-model.json         -> entities[] (dependency suggest)
   docs/intel/permission-matrix.json  -> mode (RBAC/ABAC) + existing patterns
   docs/intel/id-aliases.json         -> reserved IDs (avoid reuse)
```

## Step 1.5 — Parent module selection (FK gate)

If `module-catalog.json` has zero entries:

```
Print Vietnamese:
  "⚠ Workspace chưa có module nào — feature phải nằm trong 1 module (post-ADR-003).
   Chạy /new-module trước, rồi quay lại /new-feature."
next-action: /new-module
EXIT
```

Else display modules with status filter:

```
Print Vietnamese:
  "Feature mới sẽ nest dưới module nào? (chỉ hiển thị module status ∈ {proposed, in-progress, blocked, done}):

     1. M-001-iam (Identity & Access — status: done, 12 features)
     2. M-002-taxpayer (Taxpayer Management — status: in-progress, 8 features)
     3. M-003-filing (Filing — status: in-progress, 5 features)
     ...

   Nhập số thứ tự (1-N) hoặc M-NNN trực tiếp:"
```

Validation:
- Selected module exists in catalog
- Selected module status != deprecated (if deprecated: warn, ask `[c]ontinue / [a]bort`)
- Selected module status = done: warn "module đã sealed — feature mới sẽ trigger module re-open ở /resume-module" + ask continue

Cache `parent_module_id` for downstream steps.

## Step 2 — Pre-flight interview (load shared notepad)

Load `~/.cursor/skills/_shared/preflight-interview.md` and execute Step A (Description capture):
- 5 questions (problem, outcome, actors, scope, constraints)
- Validation rules (length, vague-input guard, 3-retry cap)

Additional context: parent module's `business_goal` is shown to user before Q1, helping frame the feature within module scope:

```
Print Vietnamese:
  "Parent module: {parent_module_id} — {module_name}
   Business goal của module: {module.business_goal}

   Feature mới phải nằm trong scope module trên. Trả lời 5 câu sau:"
```

User abort then EXIT (no state mutation).

## Step 3 — Dedup check (HARD-STOP at strong match per Q3=A)

Execute Step B + C from shared notepad with **scope filter**:

- Search ENTIRE feature-catalog (not just within parent module — cross-cutting features may match)
- B.1: `ai-kit sdlc dedup-check --kind feature --query "..."`
- B.2: Fallback to heuristic (token Jaccard + @Codebase route handler search)
- C: Triage decision tree

**HARD-STOP behavior** (max_score >= 0.85):

```
Print Vietnamese:
  "⚠ Trùng {ID} (similarity {score}, status {status}, owner module {owner_M}).
   Feature này đã tồn tại với business intent tương đồng:
     {matched_business_intent excerpt}
   -> Dùng `/update-feature {ID}` để mở rộng feature hiện có.
   -> Nếu feature owner ở module khác và bạn cần consume nó:
      cân nhắc thêm `consumed_by_modules: [{parent_module}]` vào {ID} thay vì duplicate.
   -> Nếu chắc chắn cần feature độc lập, re-run `/new-feature --force-new`."

next-action: /update-feature {ID}
EXIT (no scaffold, no state mutation)
```

Partial match (0.60-0.85) — extra option compared to /new-module:

```
Print Vietnamese:
  "Tìm thấy {N} feature tương đồng:
     1. F-XXX — {name} (similarity 0.78, owner M-001, status implemented)
     ...
   Lựa chọn:
     [u F-XXX]  Update existing feature
     [c F-XXX]  Cross-cutting reuse — thêm parent_module vào F-XXX.consumed_by_modules thay vì tạo mới
     [n]        New anyway với references: [F-XXX]
     [a]        Abort"
```

`[c]` option triggers atomic update of existing F-XXX:
```
Bash("ai-kit sdlc state update --op field \
  --kind feature --id F-XXX \
  --path consumed_by_modules \
  --value '+= [\"{parent_module_id}\"]'")
```

Then EXIT, suggest `/resume-module {parent_module_id}` để parent module's pipeline pick up cross-cutting consumption.

## Step 4 — Dependency suggest

Execute Step D from shared notepad:

For features:
- `depends_on`: list of F-NNN feature-ids (within or across modules) — extracted from prose entity references
- `consumed_by_modules`: cross-reference (this feature owned by parent_module, but other modules may consume) — heuristic from description hints like "dùng cho cả X và Y"
- `role_visibility`: map from actors (Q3) to permission level (full/partial/readonly/none)

Validate:
- Each `depends_on` F-NNN exists in feature-catalog -> if not, drop + warn
- Each `consumed_by_modules` M-NNN exists in module-catalog -> if not, drop + warn
- `parent_module_id` MUST NOT appear in `consumed_by_modules` (would be redundant — parent owns the feature)
- `role_visibility` keys MUST exist in actor-registry.roles[].slug

Display + user confirm/edit per Step D.3 of shared notepad.

## Step 5 — Pipeline-path hint (deferred to PM)

Unlike modules (which fix risk_path at scaffold), features defer Path S/M/L selection to PM Path Selection Logic post-BA. At interview time, record hint only:

```
heuristic:
  S: scope=1-screen + <=2 actors + no integration
  M: scope=multi-flow + <=4 actors + <=1 integration
  L: scope=cross-system OR >=5 actors OR >=2 integrations OR auth/PII/payment

Print Vietnamese:
  "Pipeline-path đề xuất (PM có thể override sau BA): {S|M|L}
     Lý do: {rationale}
   [enter] confirm | [s/m/l] override"
```

Result stored as `feature-catalog.features[].expected_pipeline_path` hint. PM in /resume-module reads this when running BA stage; final pipeline-path written into module-level `_state.md` after BA completes.

## Step 6 — Auto-allocate ID + slug

Execute Step F from shared notepad:

- F.1: Slug from feature name (kebab-case, <=40 chars, transliterate VN if no English name)
- F.2: Atomic ID allocation `ai-kit sdlc allocate-id --kind feature` (or fallback feature-catalog max+1)

Read-only display:
```
✓ ID allocated: F-{NNN}
✓ Slug: {slug}
✓ Path: docs/modules/{parent_module_id}-{parent_slug}/features/F-{NNN}-{slug}/
```

User cannot edit ID/slug (Q1=A).

## Step 7 — Confirm + scaffold + post-review

### 7a. Preview (Step G from shared notepad)

Display full SCAFFOLD PREVIEW block including parent module context. User chooses:
- `[enter]` then proceed
- `[b]` then back to edit (allowed: business_intent, scope, actors, depends_on, consumed_by, role_visibility, expected_pipeline_path; LOCKED: parent_module, ID, slug)
- `[a]` then abort (no scaffold, no state mutation)

Note on `parent_module` lock: once Step 1.5 completed, parent_module is treated as immutable for this scaffold session. To change parent, user must `[a]` abort and re-run.

### 7b. Atomic scaffold (CLI flags strictly per `ai-kit sdlc scaffold feature --help`)

CLI accepts ONLY these flags (verify any time via `ai-kit sdlc scaffold feature --help`): workspace, module, id, name, slug, description, business-intent, flow-summary, acceptance-criteria, consumed-by, priority, expected-version. Fields `role_visibility` / `depends_on` / `expected_pipeline_path` / `references` are NOT scaffold inputs — populate post-scaffold via `state update`.

```
result = Bash("ai-kit sdlc scaffold feature \
  --workspace . \
  --module {parent_module_id} \
  --id {F-NNN} \
  --slug '{slug}' \
  --name '{feature_name}' \
  --business-intent '{Q1+Q2 trimmed, >=100 chars}' \
  --flow-summary '{Q1+Q4 derived, >=150 chars}' \
  --acceptance-criteria '{json array or "[]"}' \
  --consumed-by '{csv M-NNN list or empty}' \
  --priority {critical|high|medium|low}")
parse stdout JSON → if !ok: STOP with error
```

CLI atomically:
- Creates `docs/modules/{parent_module_id}-{slug}/features/F-NNN-{slug}/` with `_feature.md` (FeatureSpec per CD-23), `implementations.yaml`, `test-evidence.json`
- Updates `feature-catalog.json` (append entry with scaffold fields)
- Updates `sitemap.json` (placeholder route, status: planned, confidence: low)
- Updates `permission-matrix.json` (placeholder — empty until 7b.5 populates role_visibility)
- Updates `feature-map.yaml` (F-NNN -> parent_module + path)
- Updates `_meta.json` (versions bumped)

On error then surface, no partial state.

### 7b.5. Post-scaffold field population (fields NOT supported by scaffold CLI)

Per CLI design, 4 fields collected during interview MUST be set via `state update --op field` after scaffold succeeds. Skip individual call when value empty/null.

```
IF role_visibility map non-empty:
  Bash("ai-kit sdlc state update --op field \
    --kind feature --id {F-NNN} \
    --path role_visibility \
    --value '{JSON.stringify(role_visibility map)}'")

IF depends_on list non-empty:
  Bash("ai-kit sdlc state update --op field \
    --kind feature --id {F-NNN} \
    --path depends_on \
    --value '{JSON.stringify(depends_on F-NNN list)}'")

IF expected_pipeline_path set (S|M|L):
  Bash("ai-kit sdlc state update --op field \
    --kind feature --id {F-NNN} \
    --path expected_pipeline_path \
    --value '\"{S|M|L}\"'")

IF references non-empty (from partial dedup [n] choice):
  Bash("ai-kit sdlc state update --op field \
    --kind feature --id {F-NNN} \
    --path references \
    --value '{JSON.stringify(references F-NNN list)}'")
```

On any state update error → log warning but don't rollback scaffold (fields are enrichment, not core). User can re-set via Step 7d `[field]` edit loop.

### 7c. Post-scaffold verify

```
result = Bash("ai-kit sdlc verify --workspace . \
  --scopes structure,cross_references,id_uniqueness \
  --strict warn")
```

If MEDIUM/HIGH findings then display warnings but proceed.

### 7d. Post-scaffold review (Step I from shared notepad)

Display result block + "Còn bổ sung gì?" prompt:
- `[enter]` then print suggestion (Step 8 below), EXIT
- `[field]` then edit loop via `ai-kit sdlc state update --op field ...` (allowed: business_intent, depends_on, consumed_by_modules, role_visibility, priority, expected_pipeline_path; LOCKED: parent_module, id, slug)
- `[d]` then rollback path: prompt "CONFIRM ROLLBACK" then `ai-kit sdlc rollback --kind feature --id F-NNN` then EXIT

## Step 8 — Final guidance (Q2 confirmed) — schema variant aware

Skill detects which pipeline driver is appropriate based on workspace structure:

```
IF parent_module_id resolved AND scaffold path = docs/modules/M-NNN-*/features/F-NNN-*/:
  # Post-ADR-003 nested — pipeline ở cấp module
  Print Vietnamese:
    "✅ Feature F-NNN-{slug} đã được tạo nested dưới {parent_module_id}.

     Per ADR-003 (post-2026-05): F-NNN nested không có pipeline riêng —
     pipeline drive ở cấp module {parent_module_id}.

     Để bắt đầu / tiếp tục pipeline (sẽ pick up F-NNN trong dev-wave):
         /resume-module {parent_module_id}

     Stages-queue của module sẽ được PM re-evaluate khi thấy F-NNN mới
     (Path Selection Logic sau BA stage).

     Để xem status các features trong module:
         /feature-status --module {parent_module_id}"

ELSE (legacy F-NNN at docs/features/F-NNN/, KHÔNG khuyến khích cho new scaffolds):
  Print Vietnamese:
    "✅ Feature F-NNN-{slug} đã được tạo (legacy path docs/features/).

     Để bắt đầu pipeline:
         /resume-feature F-NNN"
```

EXIT.

---

## Edge cases

| Condition | Action |
|---|---|
| `module-catalog.json` empty | Step 1.5 STOP `next-action: /new-module first` |
| User provides arg | Step 0 ignore + warn (special-case M-NNN suggests /new-module or /resume-module) |
| Parent module status=deprecated | Warn + ask `[c]ontinue / [a]bort` |
| Parent module status=done (sealed) | Warn "module sẽ trigger re-open ở /resume-module" + ask continue |
| Intel stale | STOP `next-action: /intel-refresh` |
| User abort during interview | EXIT no state mutation |
| Strong dedup >= 0.85 | HARD-STOP `next-action: /update-feature {ID}` |
| Partial dedup + user picks `[c]` cross-cutting reuse | Update existing F-XXX.consumed_by_modules atomically; EXIT, suggest `/resume-module {parent}` |
| Partial dedup + user picks `[u]` | EXIT, suggest `/update-feature {ID}` |
| Partial dedup + user picks `[n]` | Continue with `references: [{IDs}]` populated |
| `depends_on` references unknown F-NNN | Drop from suggestion + warn at Step 4 |
| `consumed_by_modules` references unknown M-NNN | Drop + warn |
| `parent_module_id` appears in `consumed_by_modules` | Auto-strip + INFO "redundant — parent owns feature" |
| `role_visibility` key not in actor-registry | Drop + warn |
| Slug collision | Auto-append `-2/-3...` increment |
| ai-kit CLI unavailable | Fallback heuristic + warn "dedup degraded" |
| User picks `[d]` rollback at Step 7d | Confirmation phrase + atomic reverse via CLI |
| `--force-new` flag (escape hatch) | Log to `_meta.json.dedup-overrides[]` + continue |
| MCP/CLI fails mid-scaffold | Atomic guarantee — no partial state; surface error |

---

## What's next

| Outcome | Next |
|---|---|
| Feature created in active module (post-ADR-003) | `/resume-module {parent_M}` to drive module pipeline (PM picks up F-NNN in dev-wave) |
| Feature created in sealed module | `/resume-module {parent_M}` (will trigger re-open prompt) |
| Feature created legacy path | `/resume-feature {F-NNN}` |
| Strong dedup HARD-STOP | `/update-feature {existing-ID}` |
| Cross-cutting reuse selected | `/resume-module {parent_M}` (consumed_by updated atomically) |
| Rollback at post-scaffold | (no feature created — re-run `/new-feature` if needed) |

Reference: `D:\AI-Platform\maintainer-notes\adr\ADR-003-sdlc-2tier-module-feature.md` D8 (nested feature path) + `~/.cursor/skills/_shared/preflight-interview.md` + `plans/p0-mcp-tool-spec.md` §3.4 (scaffold_feature) + CD-22 + CD-23 (schema variants) + CD-24 (cross-cutting) in `~/.claude/CLAUDE.md`.
