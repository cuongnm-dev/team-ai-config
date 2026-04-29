# Confidence Routing — Stage 4 + Stage 5b

> Loaded by Stage 4 specialists (`tdoc-tkkt-writer`, `tdoc-tkcs-writer`, `tdoc-tkct-writer`, `tdoc-data-writer`) and Stage 5b quality gate.
> Source: `confidence` field on intel entries (actor-registry, feature-catalog, sitemap).
> Schema enum: `high | medium | low | manual`.

## Decision matrix per consumer

| Consumer / Stage | High | Medium | Low | Manual |
|---|---|---|---|---|
| TKKT writer (s4b) — architecture facts | Use directly | Use + cite source | Emit `[CẦN BỔ SUNG: verify <field>]` if narrative depends on it | Use directly (treated as user-confirmed) |
| TKCS writer (s4c) — security/role claims | Use directly | Use directly | **BLOCK** if claim is normative (e.g. role gating) — escalate to user | Use directly |
| TKCT writer (s4d) — module/db facts | Use directly | Use + add caveat in NFR section | Emit `[CẦN BỔ SUNG]` placeholder | Use directly |
| HDSD writer (s4e) — user-facing steps | Use directly | Use directly (HDSD is descriptive — low risk) | Use + add `Lưu ý: chức năng này có thể thay đổi` warning | Use directly |
| xlsx writer (s4f) — test cases | Generate full TC set | Generate full TC set | Generate happy-path only + flag in priority `Thấp` | Generate full TC set |
| Stage 5b quality gate | No action | No action | If > 5% of features are low-confidence → escalate to user via Gate B | No action |

## Why `low` is rarely a hard-block

Block-on-low would freeze pipeline whenever code is novel. The right model:
1. **Inform the writer** — produce content but mark uncertainty
2. **Surface to reviewer** — `[CẦN BỔ SUNG]` markers + Stage 5b stats
3. **Escalate when normative** — security/permission claims at `low` ARE blocking (TKCS s4c)

## Producer responsibilities

When producer (`tdoc-researcher`, `doc-intel`, `intel-merger`) writes an entry, it MUST emit `confidence`:

| Signal | Tier |
|---|---|
| Code AND doc agree (multi-source merge) | `high` |
| Single producer, multiple corroborating evidences (≥ 2 file:line refs) | `high` |
| Single producer, single evidence | `medium` |
| Inferred from name/pattern (no direct evidence) | `low` |
| User answered via interview question | `manual` |
| Producer cannot determine | OMIT field (validator counts as `unset`) |

Never emit `high` without ≥ 2 evidence entries OR multi-producer agreement.

## Reader responsibilities (consumer agents)

Before acting on an entry, READ its `confidence` field. Branching pseudo-code:

```python
def use_feature(feat):
    c = feat.get("confidence", "unset")
    if c in {"high", "manual"}:
        return render_full(feat)
    elif c == "medium":
        return render_full(feat) + cite_source(feat.evidence)
    elif c == "low":
        if requires_normative_claim(feat):
            block_and_escalate(feat)
        else:
            return render_with_caveat(feat)
    else:  # unset
        log_warning(f"Feature {feat.id} missing confidence — producer should backfill")
        return render_full(feat)  # do not block on legacy entries
```

## Stage 5b additions

Pass 6 (confidence-aware quality check):
- Pull `validation-report.json.confidence_stats`
- Block exit if `low_confidence_critical[]` non-empty AND user has not whitelisted
- Add stats to TKKT NFR section: "Số liệu trong tài liệu này có {N} mục được suy luận (confidence=low) cần kiểm chứng — xem Phụ lục A."

## Backwards compatibility

Entries WITHOUT `confidence` field are treated as `unset` — pipeline does NOT block. Validator emits informational warning only. Producers should backfill on next regeneration via `--rerun-stage` flag.
