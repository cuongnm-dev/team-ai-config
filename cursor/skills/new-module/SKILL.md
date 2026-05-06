---
name: new-module
description: Khởi tạo module SDLC mới (M-NNN) qua interview. Skill auto-allocate ID + slug theo quy tắc canonical, không nhận tham số ID. Dedup-check hard-stop nếu trùng module có sẵn (suggest /update-module). Hand-off bằng cách suggest /resume-module sau khi user confirm. Trigger - thêm bounded context/domain mới; "tạo module mới"; mô tả nghiệp vụ chưa có domain phù hợp. Anti-trigger - module đã tồn tại in-progress thì /resume-module; module có sẵn cần mở rộng thì /update-module; thêm feature thì /new-feature. Example - "/new-module" (interactive, không tham số).
---

# New Module — Interview-first Entry Point

User-facing prompts: Vietnamese. Skill prose + dispatcher prompts: English.

## ⚠️ ai-kit CLI Enforcement (ADR-005)

**MUST call `Bash("ai-kit sdlc scaffold module ...")` for atomic create — only after Step G confirm.** Skill = thin entry point.

| Step | ai-kit CLI command |
|---|---|
| Dedup check | `ai-kit sdlc dedup-check --kind module --query "..."` (graceful fallback to @Codebase if unavailable) |
| Dependency suggest | `ai-kit sdlc deps-suggest --description "..."` (graceful fallback to heuristic) |
| ID allocation | `ai-kit sdlc allocate-id --kind module` (atomic; fallback to catalog max+1) |
| Atomic scaffold | `ai-kit sdlc scaffold module --id M-NNN --slug ... --depends-on ...` |
| Rollback | `ai-kit sdlc rollback --kind module --id M-NNN` (for Step I delete path) |

**Forbidden** per ADR-005 D3:
- ❌ Accept user-provided `module-id` argument (full auto per Q1=A)
- ❌ Accept user-provided `slug` argument
- ❌ Write `_state.md` / `module-brief.md` / `implementations.yaml` directly
- ❌ Direct edit of `module-catalog.json` / `module-map.yaml`
- ❌ Skip dedup check at Step 3 (HARD-STOP enforcement per Q3=A)

---

## ⚠️ SKILL ROLE — INTERVIEW + SCAFFOLD ONLY

This skill does NOT drive pipeline. It interviews user, validates uniqueness, scaffolds, then suggests `/resume-module {ID}`. PM dispatch is owned by `/resume-module`.

### Forbidden:
- ❌ Calling `Task(pm)` or `Task(specialist)` — pipeline driver is /resume-module
- ❌ Auto-spawning `/resume-module` — Q2 confirmed: skill ends with suggestion, user invokes
- ❌ Reading agent definitions and "doing work yourself"

### Required:
- ✅ Steps 0-7 = setup (interview, dedup, dependency, scaffold)
- ✅ Step 7 (post-scaffold) ends with suggestion `/resume-module {ID}`
- ✅ User invokes /resume-module manually in next turn

---

## Step 0 — Argument handling (Q1=A: ignore user-provided ID)

If user invokes `/new-module M-007` or `/new-module {anything}`:

```
Print Vietnamese:
  "ℹ Tham số đã được bỏ qua — /new-module luôn auto-allocate ID + slug theo quy tắc canonical
   (tránh skip số thứ tự). Tiếp tục interview…"
```

Discard arg. Continue Step 1.

## Step 1 — Read intel + freshness gate

Per LIFECYCLE.md P5 (stale-block):

```
1. Read docs/intel/_meta.json
   For each artifact in {actor-registry, sitemap, module-catalog, feature-catalog, data-model}:
     IF _meta.artifacts[file].stale == true:
       STOP with message:
         "⚠ Intel artifact `{file}` is stale (last fresh: {produced_at}).
          Run /intel-refresh before /new-module to avoid propagating bad data.
          next-action: /intel-refresh --tier T1"
       EXIT

2. Read intel files (cache in skill memory):
   docs/intel/module-catalog.json     -> existing modules (dedup + ID allocation)
   docs/intel/feature-catalog.json    -> existing features (cross-cutting linkage)
   docs/intel/actor-registry.json     -> roles[] (role_visibility)
   docs/intel/sitemap.json            -> modules + routes
   docs/intel/data-model.json         -> entities[] (dependency suggest)
   docs/intel/id-aliases.json         -> reserved IDs (avoid reuse)
```

If `module-catalog.json` empty (zero modules) then INFO: "No existing modules — first module in workspace."

## Step 2 — Pre-flight interview (load shared notepad)

Load `~/.cursor/skills/_shared/preflight-interview.md` and execute Step A (Description capture):
- 5 questions (problem, outcome, actors, scope, constraints)
- Validation rules (length, vague-input guard, 3-retry cap)

User abort then EXIT (no state mutation).

## Step 3 — Dedup check (HARD-STOP at strong match per Q3=A)

Execute Step B + C from shared notepad:

- B.1: Try `ai-kit sdlc dedup-check --kind module ...`
- B.2: Fallback to heuristic (token Jaccard + @Codebase) if CLI unavailable
- C: Triage decision tree

**HARD-STOP behavior** (max_score >= 0.85):

```
Print Vietnamese:
  "⚠ Trùng {ID} (similarity {score}, status {status}).
   Module này đã tồn tại trong catalog với business intent tương đồng:
     {matched_business_intent excerpt}
   -> Dùng `/update-module {ID}` để mở rộng module hiện có.
   -> Hoặc nếu chắc chắn cần module độc lập (vd. multi-tenant separation),
      re-run `/new-module --force-new` (sẽ log audit trail trong _meta.json)."

next-action: /update-module {ID}
EXIT (no scaffold, no state mutation)
```

`--force-new` flag (escape hatch): adds entry to `_meta.json.dedup-overrides[]` with rationale, then continues normal flow. Logged for audit.

## Step 4 — Dependency suggest

Execute Step D from shared notepad:

- D.1: Try `ai-kit sdlc deps-suggest --description ...`
- D.2: Fallback heuristic (entity match in data-model + sitemap)
- D.3: Display + user confirm/edit

For modules, populate suggested:
- `depends_on`: list of M-NNNs containing entities referenced in description
- `role_visibility`: not applicable at module level (defer to feature scaffold)

Validate:
- Each suggested `depends_on` M-NNN exists in module-catalog -> if not, drop from suggestion + warn
- DFS cycle check on proposed `depends_on`: build graph from module-catalog + new module -> run DFS -> if cycle would form, STOP with `MOD-CYCLE-001` and `next-action: edit depends_on selection`

## Step 5 — Risk path estimation

Execute Step E from shared notepad:

```
heuristic:
  S: scope=1-screen + <=2 actors + no integration + no PII
  M: scope=multi-flow + <=4 actors + <=1 integration + low PII
  L: scope=cross-system OR >=5 actors OR >=2 integrations OR auth/PII/payment

Print Vietnamese with rationale.
User: [enter] confirm | [s/m/l] override
```

Result determines `stages-queue` length post-scaffold (PM picks up at ba stage with this hint).

## Step 6 — Auto-allocate ID + slug

Execute Step F from shared notepad:

- F.1: Derive slug from name_en or transliterate Vietnamese name
- F.2: Atomic ID allocation via CLI (fallback catalog max+1)

Read-only display:
```
✓ ID allocated: M-{NNN}
✓ Slug: {slug}
```

User cannot edit (Q1=A).

## Step 7 — Confirm + scaffold + post-review

### 7a. Preview (Step G from shared notepad)

Display full SCAFFOLD PREVIEW block. User chooses:
- `[enter]` then proceed
- `[b]` then back to edit (allowed: business_goal, scope, actors, depends_on, risk_path; LOCKED: ID, slug)
- `[a]` then abort (no scaffold, no state mutation)

### 7b. Atomic scaffold

```
result = Bash("ai-kit sdlc scaffold module \
  --workspace . \
  --id {M-NNN} \
  --slug '{slug}' \
  --name '{name}' \
  --business-goal '{Q1+Q2 trimmed}' \
  --depends-on '{csv}' \
  --risk-path {S|M|L} \
  --primary-service '{primary_service or omit}' \
  --agent-flags '{json or omit}'")
parse stdout JSON
```

CLI atomically:
- Creates `docs/modules/M-NNN-{slug}/` with `_state.md`, `module-brief.md`, `implementations.yaml`
- Creates 7 stage subdirs (ba/sa/designer/security/tech-lead/qa/reviewer) with `.gitkeep`
- Updates `module-catalog.json`, `module-map.yaml`, `_meta.json`

On error then surface, no partial state (CLI atomic guarantee).

### 7c. Post-scaffold verify

```
result = Bash("ai-kit sdlc verify --workspace . \
  --scopes structure,cross_references \
  --strict warn")
```

If MEDIUM/HIGH findings then display warnings but proceed (followup polish, not blocker).

### 7d. Post-scaffold review (Step I from shared notepad)

Display result block + "Còn bổ sung gì?" prompt:
- `[enter]` then print suggestion `/resume-module M-NNN`, EXIT
- `[field]` then edit loop via `ai-kit sdlc state update --op field ...`
- `[d]` then rollback path: prompt "CONFIRM ROLLBACK" then `ai-kit sdlc rollback --kind module --id M-NNN` then EXIT

## Step 8 — Final guidance (Q2 confirmed)

When user picks `[enter]` at Step 7d:

```
Print Vietnamese:
  "✅ Module M-NNN-{slug} đã sẵn sàng.

   Để bắt đầu pipeline (ba -> sa -> … -> reviewer):
       /resume-module M-NNN

   Module hiện ở stage `ba`, queue được set theo risk_path={S|M|L}.

   Để thêm features cho module này, dùng:
       /new-feature                 # interactive, parent module sẽ chọn từ catalog"

EXIT.
```

---

## Edge cases

| Condition | Action |
|---|---|
| `module-catalog.json` empty (first module) | INFO "first module in workspace", proceed normal flow |
| User provides arg | Step 0 ignore + warn |
| Intel stale | STOP `next-action: /intel-refresh` |
| User abort during interview | EXIT no state mutation |
| Strong dedup >= 0.85 | HARD-STOP `next-action: /update-module {ID}` |
| Partial dedup 0.60-0.85 + user picks 'u' | EXIT, suggest `/update-module {ID}` |
| Partial dedup + user picks 'n' | Continue with `references: [{IDs}]` populated |
| `depends_on` cyclic | STOP `MOD-CYCLE-001` (mirror /resume-module 3c.1 logic) |
| `depends_on` references unknown M-NNN | Drop from suggestion + warn at Step 4 |
| Slug derivation invalid | STOP — manual intervention required |
| Slug collision | Auto-append `-2/-3...` increment |
| ai-kit CLI unavailable | Fallback heuristic + warn "dedup degraded" |
| User picks `[d]` rollback at Step 7d | Confirmation phrase + atomic reverse via CLI |
| `--force-new` flag (escape hatch) | Log to `_meta.json.dedup-overrides[]` + continue |
| MCP/CLI fails mid-scaffold | Atomic guarantee — no partial state; surface error to user |

---

## What's next

| Outcome | Next |
|---|---|
| Module created, user satisfied | `/resume-module M-NNN` to start ba stage pipeline |
| Module created, user wants to add features | `/new-feature` (interactive, parent = M-NNN selectable) |
| Strong dedup HARD-STOP | `/update-module {existing-ID}` |
| Rollback at post-scaffold | (no module created — re-run `/new-module` if needed) |

Reference: `D:\AI-Platform\maintainer-notes\adr\ADR-003-sdlc-2tier-module-feature.md` D8/D11 + `~/.cursor/skills/_shared/preflight-interview.md` + `plans/p0-mcp-tool-spec.md` §3.3 (scaffold_module).
