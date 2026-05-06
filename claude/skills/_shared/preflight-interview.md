# Pre-flight Interview Protocol (Claude port — Opus 4.7)

Loaded on demand by `/new-module`, `/new-feature` (Claude side) for interview-first scaffolding. Mirror of `~/.cursor/skills/_shared/preflight-interview.md` with Opus-specific enhancements.

User-facing prompts: Vietnamese. Internal logic + skill prose: English.

**Opus enhancement notes:**
- Vague-input guard: adaptive follow-up (Opus generates contextual probe questions, not fixed retry prompt)
- Dedup B.2 fallback: use `Agent(Explore)` parallel multi-pattern instead of Cursor `@Codebase`
- Dependency NER: Opus extracts entity refs directly without regex heuristic

---

## Step A — Description capture (max 5 minutes)

Ask user the 5 questions below. Validate non-empty, max 3 retries per question.

```
Vui lòng trả lời 5 câu sau (giúp hệ thống tránh trùng lặp + suy ra dependencies):

1. Vấn đề nghiệp vụ (problem) — 2-3 câu mô tả pain point hoặc gap
2. Kết quả mong đợi (outcome) — 1-2 câu kết quả đo được
3. Người dùng chính (actors) — list role (vd. hqdk, lanh-dao, taxpayer)
4. Phạm vi (scope) — chọn 1: [s] 1 màn hình | [m] đa luồng cùng module | [x] cross-system
5. Constraints — deadline / ngân sách / integration bắt buộc / "none"
```

**Validation rules**:
- Q1 >= 80 chars
- Q2 >= 30 chars
- Q3 >= 1 actor matching `actor-registry.roles[].slug` (else: warn + log low confidence)
- Q4 enum
- Q5 free text or "none"

**Vague-input guard (Opus adaptive)**: when Q1 is generic ("hệ thống cần tốt hơn", "fix bug", "improve performance"), generate **contextual follow-up** based on what dimension is missing:

- Missing actor specificity -> probe "Ai bị ảnh hưởng cụ thể? (role / persona)"
- Missing trigger condition -> probe "Vấn đề xảy ra khi nào? (workflow step / event)"
- Missing outcome metric -> probe "Kết quả mong đợi đo lường ra sao? (latency, throughput, completion rate)"

Example adaptive probe:

```
⚠ Mô tả "hệ thống cần tốt hơn" còn vague. Để giúp suy ra dependencies + dedup chính xác,
   cần specific:
   • Hệ thống nào? (module / service / page)
   • Bị "không tốt" ở khía cạnh nào? (chậm | lỗi | thiếu chức năng | UX confused)
   • Người dùng đang làm gì khi hit pain point này?
   Trả lời 2-3 câu rõ hơn:
```

After 3 retries (still vague) then STOP với `next-action: re-run với mô tả >=3 câu cụ thể, mention specific actor + trigger + outcome`.

---

## Step B — Dedup search

Input: concatenated prose from Step A (Q1+Q2+Q3).

### B.1 Primary path — ai-kit CLI (when available)

```
result = Bash("ai-kit sdlc dedup-check \
  --workspace . \
  --kind {module|feature} \
  --query '<concatenated prose>' \
  --threshold 0.60")
parse stdout JSON for { ok, data: { candidates: [...] } }
```

### B.2 Fallback — Agent(Explore) parallel search (Opus port)

When CLI unavailable, spawn `Agent(Explore)` for parallel multi-pattern search instead of single `@Codebase` call:

```
Spawn 3 Explore agents in parallel:
  agent_1: "Search docs/intel/{module|feature}-catalog.json for entries with name OR business_intent
            matching tokens: {Q1 key tokens}. Return top 5 with similarity rationale."
  agent_2: "Search docs/intel/{module|feature}-catalog.json for entries with flow_summary
            matching tokens: {Q2 + Q4 key tokens}. Return top 5."
  agent_3: "Search codebase for route handlers / page components implementing behavior described:
            {Q1 first sentence}. Return file paths + similarity verdict."

Aggregate results:
  - Take union of agent_1 + agent_2 catalog matches
  - Use agent_3 as auxiliary signal (boost similarity if both catalog entry AND code path match)
  - Synthesize candidates list with similarity scores

Surface: "ℹ ai-kit CLI unavailable — using Agent(Explore) parallel heuristic
         (3 agents, slightly slower but high precision per Opus reasoning)."
```

This is more precise than Cursor's `@Codebase` because Opus can read multi-file context end-to-end, not just snippets.

---

## Step C — Triage decision tree (HARD-STOP at >=0.85)

```
candidates = sorted by similarity desc, top 5
max_score = candidates[0].similarity if candidates else 0

IF max_score >= 0.85:
  Print Vietnamese:
    "⚠ Trùng {ID} (similarity {score}, status {status}).
     {match_rationale: shared tokens / fields}.
     -> Dùng `/update-{kind} {ID}` để update existing thay vì tạo mới.
     Nếu chắc chắn cần độc lập, re-run với --force-new (audit log)."
  next-action: /update-{kind} {ID}
  EXIT

ELIF 0.60 <= max_score < 0.85:
  Print Vietnamese:
    "Tìm thấy {N} ứng viên tương đồng:
       1. {ID} — {name} (similarity {score}, status {status})
       ...
     Lựa chọn:
       [u {ID}]  Update existing
       [n]       New anyway với references: [{IDs}]
       [c {ID}]  (feature only) Cross-cutting reuse
       [a]       Abort"

  Handle user choice (same as Cursor).

ELSE:
  Print Vietnamese: "✓ Không tìm thấy ứng viên trùng — tiếp tục tạo mới."
  Continue
```

Audit trail (when user picks `n`): write `_meta.json.dedup-overrides[]` entry with rationale.

---

## Step D — Dependency suggest (Opus enhancement)

### D.1 Primary — ai-kit CLI

```
result = Bash("ai-kit sdlc deps-suggest --workspace . --description '<Q1+Q2>'")
```

### D.2 Fallback — Opus direct entity extraction

Unlike Cursor heuristic (regex + stem matching), Opus extracts entity refs directly from prose:

```
Read docs/intel/{data-model.json, sitemap.json, actor-registry.json, permission-matrix.json}

Opus performs in-context analysis:
  1. Parse description (Q1+Q2) for noun phrases referring to business entities
  2. Match against data-model.entities[].name (semantic match, not just exact)
  3. For each matched entity:
     - Identify owner_module from data-model
     - If owner_module != current_module then suggest depends_on
  4. Detect verb patterns (CRUD operations) and match permission-matrix patterns
  5. Map actors (Q3) to actor-registry.roles[] (resolve aliases / synonyms)
  6. Generate role_visibility map with confidence scores
```

Opus can handle Vietnamese ↔ English entity name aliasing without explicit rule (e.g., "người nộp thuế" -> entity `Taxpayer`).

### D.3 Display + confirm

```
Print Vietnamese:
  "Dependencies suy ra từ mô tả:
     depends_on: [M-001 (entity 'Taxpayer'), M-003 (entity 'TaxForm')]
     consumed_by_modules: []
     role_visibility:
       hqdk:        full
       lanh-dao:    readonly
       taxpayer:    none

   Chỉnh sửa? [enter] confirm | [d] edit depends_on | [c] edit consumed_by | [r] edit role_visibility"
```

Loop until user `[enter]`.

---

## Step E — Risk path estimation / Path Selection

Same heuristic as Cursor:

| Heuristic | risk_path |
|---|---|
| scope=1-screen + <=2 actors + no integration + no PII | **S** |
| scope=multi-flow + <=4 actors + <=1 integration + low PII | **M** |
| scope=cross-system OR >=5 actors OR >=2 integrations OR auth/PII/payment | **L** |

For features: defer to PM Path Selection post-BA. Record `expected_pipeline_path` hint.

---

## Step F — Slug + ID auto-allocation

### F.1 Slug derivation

Same as Cursor: kebab-case from name_en or unidecode(name_vn). Validate <=40 chars, regex `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`. Auto-append `-2/-3...` on collision.

### F.2 ID allocation

```
Bash("ai-kit sdlc allocate-id --kind {module|feature}")

Fallback: read catalog + id-aliases.reservations[], compute max_num+1.
```

Read-only display (Q1=A locked).

---

## Step G — Confirm before scaffold

Display SCAFFOLD PREVIEW block. User chooses [enter] / [b] back / [a] abort.

`[b]` allows editing all fields except ID, slug, parent_module (locked).

---

## Step H — Atomic scaffold

Caller skill executes `ai-kit sdlc scaffold {kind} ...`.

---

## Step I — Post-scaffold review

```
Print Vietnamese:
  "✅ {ID} đã được tạo
   Folder: {path}
   Files: {N} updated atomically

   Bạn còn bổ sung gì không?
     [enter]  Hoàn tất — gõ /resume-{kind} {ID} để bắt đầu pipeline
     [field]  Sửa: business_goal | depends_on | consumed_by | role_visibility | risk_path
     [d]      Delete (rollback) — atomic reverse"
```

[d] rollback: prompt "CONFIRM ROLLBACK" then `ai-kit sdlc rollback --kind --id`.

[enter] guidance: print suggestion, EXIT (no auto-spawn per Q2).

---

## Skill caller integration

Same contract as Cursor version. Skill owns pre-conditions before A and final guidance after I.

This notepad is **stateless prose** — Opus can re-enter at any step on caller's behalf.
