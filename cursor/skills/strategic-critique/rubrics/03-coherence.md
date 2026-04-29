# Rubric 03 — Coherence Check (Cross-section logic)

**Goal**: Problems → Objectives → Solutions → Budget → Timeline phải link với nhau 1-1.

---

## Required logical chains

### Chain 1: Problem → Objective

Mỗi **vấn đề** (S3 Hiện trạng) phải được address bởi ≥ 1 **mục tiêu** (S4).

**Auto-detect**: Extract nouns/pain-points từ S3, check có xuất hiện trong S4 "mục tiêu" không.

**Orphan problem** = S3 nêu vấn đề nhưng S4 không có mục tiêu giải quyết → **major**.

### Chain 2: Objective → Solution

Mỗi **mục tiêu** (S4) phải map ≥ 1 **giải pháp** (S5).

**Orphan objective** = mục tiêu không có solution → **major**.

### Chain 3: Solution → Budget

Mỗi **giải pháp** (S5) phải có **budget line** trong S6 (Kinh phí).

**Orphan solution** = giải pháp không có budget → **blocker** (không khả thi về funding).

### Chain 4: Solution → Timeline

Mỗi giải pháp phải xuất hiện trong **timeline** (S7 Tiến độ).

**Orphan solution in timeline** → **major**.

### Chain 5: Budget consistency

- **Total budget** S6 = sum of component budgets
- Budget per phase (S7) = sum of activities trong phase
- Nếu mismatch → **blocker**.

---

## Contradiction detection

### Numerical contradictions

Scan numbers mentioned multiple times, flag inconsistency:
- S3: "500 cán bộ" + S5: "phục vụ 300 cán bộ" → contradiction (major)
- S6: "Tổng 5 tỷ" + sum components = 5.8 tỷ → blocker

### Scope contradictions

- S1 "phạm vi Sở X" + S5 "triển khai toàn tỉnh" → contradiction
- S4 "mục tiêu 2027" + S7 timeline kết thúc 2028 → minor (có thể OK nếu có post-launch), major nếu không giải thích

### Authority contradictions

- Mục tiêu set vượt thẩm quyền đơn vị (vd. Sở đề ra mục tiêu cấp Tỉnh) → major

---

## Detection pattern

```
1. Parse each section, extract:
   - S3: list_of_problems[]
   - S4: list_of_objectives[]
   - S5: list_of_solutions[]
   - S6: budget_table {component → amount}
   - S7: timeline {phase → activities[]}

2. Build link matrix:
   problems × objectives × solutions × budget × timeline

3. Check:
   - Each row has ≥ 1 cell in every column
   - Numbers consistent across columns
```

---

## Finding format

```yaml
- id: F-NNN
  severity: blocker | major
  check: coherence
  affected-sections: ["S3", "S6"]
  issue: |
    Section 3 nêu vấn đề "hệ thống không mobile-responsive"
    nhưng Section 5 và 6 không có giải pháp / budget cho mobile.
  chain-broken: "problem → solution"
  fix-recommendation: |
    either: (A) bỏ vấn đề này khỏi S3 nếu scope không cover
            (B) thêm solution + budget cho mobile trong S5+S6
```
