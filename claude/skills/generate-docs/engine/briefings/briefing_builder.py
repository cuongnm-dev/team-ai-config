"""Build per-audience briefing.md from intel + skill profile.

CLI:
    python -m briefings.briefing_builder \
        --audience hdsd \
        --intel-dir D:/Projects/foo/docs/intel \
        --out      D:/Projects/foo/docs/intel/_briefings/hdsd.md \
        --profile-dir ~/.claude/skills/generate-docs/audience-profiles

Stage 0 implementation — mechanical only (no LLM distillation). Stage 1 adds
Haiku distillation pre-pass. Stage 2 adds richer trope DSL.

The output briefing.md has 5 sections:
    1. Audience & rules     (persona, vocabulary, banned regex)
    2. Pre-computed metrics (orchestrator-aggregated stats — inline)
    3. Per-section data sources (precise file:field allow/deny pointers)
    4. Tropes (BAD → GOOD transformations)
    5. Few-shot examples

Writer reads this file as its ONLY context source for that audience —
NEVER @Files raw intel. If a fact is missing, writer emits [CẦN BỔ SUNG].
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError as exc:
    raise SystemExit(
        "PyYAML not installed. Install: pip install pyyaml"
    ) from exc

from canonical_facts import field_at, load_canonical_facts


# ─────────────────────────── Profile loader ───────────────────────────


def load_profile(profile_dir: Path, audience: str) -> dict:
    path = profile_dir / f"{audience}.yaml"
    if not path.exists():
        raise FileNotFoundError(
            f"Audience profile not found: {path}\n"
            f"Available profiles: {sorted(p.stem for p in profile_dir.glob('*.yaml'))}"
        )
    with path.open(encoding="utf-8") as fp:
        return yaml.safe_load(fp)


# ─────────────────────────── Metric computers ───────────────────────────


def compute_metrics(profile: dict, facts: dict) -> dict[str, Any]:
    """Resolve `compute:` formulas into concrete values.

    Stage 0 supports a small DSL of common patterns rather than `eval`-ing
    arbitrary strings (security + clarity). Each pattern maps to a Python
    helper. Unknown formulas are reported as [CẦN BỔ SUNG] so writers see
    the gap rather than hallucinating a number.
    """
    out: dict[str, Any] = {}
    metric_specs = profile.get("precomputed_metrics", []) or []

    for spec in metric_specs:
        mid = spec.get("id")
        formula = spec.get("compute", "")
        try:
            out[mid] = _resolve_formula(formula, facts)
        except Exception as exc:  # noqa: BLE001
            out[mid] = f"[CẦN BỔ SUNG: không tính được — {type(exc).__name__}: {exc}]"
    return out


def _resolve_formula(formula: str, facts: dict) -> Any:
    f = formula.strip()

    # len(unique(feature.module WHERE status='done'))
    if m := re.fullmatch(r"len\(unique\(feature\.([\w_]+)(?:\s+WHERE\s+(.+))?\)\)", f):
        field, where = m.group(1), m.group(2)
        return len(_unique_feature_field(facts, field, where))

    # unique(feature.module WHERE status='done')
    if m := re.fullmatch(r"unique\(feature\.([\w_]+)(?:\s+WHERE\s+(.+))?\)", f):
        field, where = m.group(1), m.group(2)
        return _unique_feature_field(facts, field, where)

    # len(feature_catalog.features WHERE status='done')
    if m := re.fullmatch(r"len\(feature_catalog\.features(?:\s+WHERE\s+(.+))?\)", f):
        where = m.group(1)
        return _count_features_with_where(facts, where)

    # len(<dotted_path>) — generic length over a list at an intel path
    if m := re.fullmatch(r"len\(([\w_.]+(?:\[\d+\])?)\)", f):
        path = m.group(1)
        val = field_at(facts, path)
        return len(val) if val is not None else 0

    # sum(len(flow.screenshots) FOR flow IN screenshot_map.flows)
    if "screenshot_map.flows" in f and "screenshots" in f:
        flows = field_at(facts, "screenshot_map.flows") or []
        return sum(len(flow.get("screenshots") or []) for flow in flows if isinstance(flow, dict))

    # actor_registry.roles WHERE slug != 'system'
    if m := re.fullmatch(r"actor_registry\.roles\s+WHERE\s+(.+)", f):
        where = m.group(1)
        roles = field_at(facts, "actor_registry.roles") or []
        return [r for r in roles if isinstance(r, dict) and _eval_where(r, where)]

    # group_by(feature_catalog.features, 'module')
    if m := re.fullmatch(r"group_by\(feature_catalog\.features,\s*'([^']+)'\)", f):
        key = m.group(1)
        feats = field_at(facts, "feature_catalog.features") or []
        grouped: dict[str, list] = defaultdict(list)
        for fe in feats:
            if isinstance(fe, dict) and key in fe:
                grouped[fe[key]].append(fe)
        return {k: len(v) for k, v in grouped.items()}

    # group_by(routes, 'module') — routes is a list
    if m := re.fullmatch(r"group_by\(routes,\s*'([^']+)'\)", f):
        key = m.group(1)
        rts = field_at(facts, "routes") or facts.get("routes") or []
        if isinstance(rts, dict):
            rts = rts.get("routes") or []
        grouped: dict[str, int] = Counter()
        for rt in rts:
            if isinstance(rt, dict) and key in rt:
                grouped[rt[key]] += 1
        return dict(grouped)

    # integrations.external_systems[]
    if f == "integrations.external_systems[]":
        ext = field_at(facts, "integrations.external_systems") or []
        return [
            {"name": e.get("name"), "purpose": e.get("purpose"), "type": e.get("integration_type")}
            for e in ext
            if isinstance(e, dict)
        ]

    # Direct dotted path lookup
    if re.fullmatch(r"[\w_.\[\]]+", f):
        return field_at(facts, f)

    raise ValueError(f"Formula not supported: {formula!r}")


def _unique_feature_field(facts: dict, field: str, where: str | None) -> list:
    feats = field_at(facts, "feature_catalog.features") or []
    seen: list = []
    for fe in feats:
        if not isinstance(fe, dict):
            continue
        if where and not _eval_where(fe, where):
            continue
        v = fe.get(field)
        if v is not None and v not in seen:
            seen.append(v)
    return seen


def _count_features_with_where(facts: dict, where: str | None) -> int:
    feats = field_at(facts, "feature_catalog.features") or []
    if not where:
        return len(feats)
    return sum(1 for fe in feats if isinstance(fe, dict) and _eval_where(fe, where))


_WHERE_RE = re.compile(r"(\w+)\s*([!=]=?)\s*['\"]?([^'\"]+)['\"]?")


def _eval_where(item: dict, where: str) -> bool:
    """Evaluate a tiny WHERE clause: 'status=done', 'status != done'.

    Supports = and != (also == and !=). Multi-clause AND via 'and'.
    Deliberately tiny — avoids `eval()` on profile strings.
    """
    parts = re.split(r"\s+and\s+", where.strip(), flags=re.IGNORECASE)
    for part in parts:
        m = _WHERE_RE.fullmatch(part.strip())
        if not m:
            return False
        key, op, val = m.group(1), m.group(2), m.group(3)
        actual = item.get(key)
        if op in ("=", "=="):
            if str(actual) != val:
                return False
        elif op == "!=":
            if str(actual) == val:
                return False
    return True


# ─────────────────────────── Domain merge ───────────────────────────


def merge_proper_nouns(profile: dict, facts: dict) -> list[str]:
    """Skill baseline + project-specific external integration names."""
    baseline = profile.get("vocabulary", {}).get("allowed_proper_nouns_baseline", []) or []
    project = []
    bc_ext = field_at(facts, "business_context.external_integrations") or []
    for ext in bc_ext:
        if isinstance(ext, dict) and ext.get("name"):
            project.append(ext["name"])
    # Dedup, preserve order: baseline first.
    seen, merged = set(), []
    for n in [*baseline, *project]:
        if n and n not in seen:
            seen.add(n)
            merged.append(n)
    return merged


def project_module_lexicon(facts: dict) -> dict[str, str]:
    """Lookup map: module_id → human-readable label (project-supplied)."""
    return field_at(facts, "business_context.module_lexicon") or {}


# ─────────────────────────── Briefing renderer ───────────────────────────


def render_briefing(audience: str, profile: dict, facts: dict, metrics: dict) -> str:
    """Produce the briefing.md content."""
    persona = profile.get("persona", {}) or {}
    vocab = profile.get("vocabulary", {}) or {}
    banned = profile.get("vocabulary_banned", {}) or {}
    sources = profile.get("intel_sources", {}) or {}
    tropes = profile.get("tropes", []) or []
    fewshot = profile.get("fewshot_examples", []) or []
    validation = profile.get("validation", {}) or {}
    schema = profile.get("writer_output_schema", {}) or {}

    proper_nouns = merge_proper_nouns(profile, facts)
    module_lexicon = project_module_lexicon(facts)

    out = []
    out.append(f"# Writer Briefing — {profile.get('display_name', audience)}\n")
    out.append(f"<!-- Generated by briefing_builder. DO NOT EDIT — regenerate from intel + profile. -->\n")
    out.append(f"<!-- Audience: {audience} | Intel dir: {facts['_meta']['intel_dir']} -->\n\n")

    # ─── 1. Audience & rules ───
    out.append("## 1. Audience & writing rules\n\n")
    out.append(f"**Người đọc**: {persona.get('reader','-')}\n")
    if persona.get("level"):    out.append(f"**Cấp**: {persona['level']}\n")
    if persona.get("technical_familiarity"):
        out.append(f"**Mức kỹ thuật**: {persona['technical_familiarity']}\n")
    if persona.get("reading_purpose"):
        out.append(f"**Mục đích đọc**: {persona['reading_purpose']}\n")
    out.append("\n")

    out.append("**Văn phong / Voice**: " + str(vocab.get("required_voice", "-")) + "\n\n")

    if vocab.get("preferred_terms"):
        out.append("**Thuật ngữ ưu tiên**:\n")
        for t in vocab["preferred_terms"]:
            out.append(f"  - {t}\n")
        out.append("\n")

    if proper_nouns:
        out.append("**Tên riêng được phép** (merged: skill baseline + project intel):\n")
        out.append(f"  {', '.join(proper_nouns)}\n\n")

    if banned.get("literal"):
        out.append("**Cấm xuất hiện (literal)**:\n")
        for b in banned["literal"]:
            out.append(f"  - `{b}`\n")
        out.append("\n")

    if banned.get("regex"):
        out.append("**Cấm xuất hiện (regex pattern)**:\n")
        for r in banned["regex"]:
            out.append(f"  - `{r}`\n")
        out.append("\n")

    # ─── 2. Pre-computed metrics ───
    out.append("## 2. Pre-computed metrics (đã tổng hợp — KHÔNG TÍNH LẠI)\n\n")
    if metrics:
        for mid, val in metrics.items():
            display = _format_metric_value(val)
            out.append(f"- **{mid}**: {display}\n")
    else:
        out.append("_(không có metrics declared trong profile)_\n")
    out.append("\n")

    if module_lexicon:
        out.append("**Module lexicon** (từ điển tên module — project-supplied):\n\n")
        out.append("| Module ID | Tên hiển thị (VN) |\n|---|---|\n")
        for mid, label in module_lexicon.items():
            out.append(f"| `{mid}` | {label} |\n")
        out.append("\n")

    # ─── 3. Intel data source pointers ───
    out.append("## 3. Nguồn dữ liệu (precise file:field pointers)\n\n")
    out.append("Bạn được phép đọc CHỈ các file + field dưới đây.\n")
    out.append("KHÔNG được @Files các intel file khác. Field nào không trong allow_fields → coi như không tồn tại.\n\n")

    for src_name, src_spec in sources.items():
        if not isinstance(src_spec, dict):
            continue
        file = src_spec.get("file", "?")
        out.append(f"### `{src_name}` — `{file}`\n\n")
        if src_spec.get("filter"):
            out.append(f"**Filter**: `{json.dumps(src_spec['filter'], ensure_ascii=False)}`\n\n")
        if src_spec.get("path"):
            out.append(f"**Path**: `{src_spec['path']}`\n\n")
        allow = src_spec.get("allow_fields", []) or []
        deny = src_spec.get("deny_fields", []) or []
        if allow:
            out.append("**ALLOW** (chỉ đọc các field này):\n")
            for fld in allow:
                out.append(f"  - `{fld}`\n")
            out.append("\n")
        if deny:
            out.append("**DENY** (KHÔNG được đọc dù có trong file):\n")
            for fld in deny:
                out.append(f"  - `{fld}`\n")
            out.append("\n")
        if src_spec.get("reason"):
            out.append(f"**Lý do**: {src_spec['reason']}\n\n")
        if src_spec.get("rendering_rule"):
            out.append(f"**Quy tắc hiển thị**:\n{src_spec['rendering_rule']}\n\n")

    # ─── 4. Tropes ───
    if tropes:
        out.append("## 4. Tropes — chuyển hóa từ kỹ thuật sang ngôn ngữ audience\n\n")
        out.append("Khi gặp pattern bên trái, **PHẢI dùng** form bên phải (orchestrator đã apply một số,\n")
        out.append("nhưng writer phải kiểm tra prose trước khi commit).\n\n")
        out.append("| Pattern | Output |\n|---|---|\n")
        for t in tropes:
            ptype = t.get("pattern_type", "?")
            pat = t.get("pattern", "?")
            output = t.get("output") or t.get("output_template", "?")
            enf = t.get("enforcement", "")
            enf_mark = " 🔴" if enf == "hard_block" else ""
            out.append(f"| `[{ptype}] {pat}` | `{output}`{enf_mark} |\n")
        out.append("\n🔴 = hard_block: nếu xuất hiện trong output → render bị từ chối.\n\n")

    # ─── 5. Few-shot ───
    if fewshot:
        out.append("## 5. Few-shot examples (BAD → GOOD)\n\n")
        for i, ex in enumerate(fewshot, 1):
            out.append(f"### Example {i}\n\n")
            out.append("**❌ BAD** (KHÔNG được làm):\n```\n")
            out.append((ex.get("bad", "") or "").rstrip())
            out.append("\n```\n\n")
            out.append("**✅ GOOD** (chuẩn):\n```\n")
            out.append((ex.get("good", "") or "").rstrip())
            out.append("\n```\n\n")

    # ─── 6. Validation gates ───
    if validation:
        out.append("## 6. Validation gates (server enforce)\n\n")
        for k, v in validation.items():
            out.append(f"- **{k}**: `{v}`\n")
        out.append("\n")

    # ─── 7. Output schema reminder ───
    if schema:
        out.append("## 7. Expected output schema\n\n")
        out.append(f"**Block to fill**: `{schema.get('block', '?')}`\n\n")
        if schema.get("required_fields"):
            out.append("**Required fields**:\n")
            for f in schema["required_fields"]:
                out.append(f"  - {f}\n")
            out.append("\n")

    # ─── 8. Footer guardrail ───
    out.append("---\n\n")
    out.append("## Hard rules (BẮT BUỘC)\n\n")
    out.append("1. CHỈ đọc files trong Section 3 với fields trong **ALLOW** list.\n")
    out.append("2. KHÔNG @Files các intel file khác (kể cả khi nghĩ có liên quan).\n")
    out.append("3. KHÔNG suy đoán fact không có. Thiếu data → emit `[CẦN BỔ SUNG: <câu hỏi cụ thể>]`.\n")
    out.append("4. KHÔNG dùng vocabulary trong **Cấm** list (Section 1).\n")
    out.append("5. Khi gặp pattern technical (route, framework name, HTTP code) → áp tropes (Section 4).\n")
    out.append("6. Nếu intel cần thiết MISSING → return `status: blocked` với reason cụ thể.\n")

    return "".join(out)


def _format_metric_value(val: Any) -> str:
    if val is None:
        return "_(null)_"
    if isinstance(val, list):
        if not val:
            return "_(empty list)_"
        if len(val) <= 8 and all(isinstance(x, (str, int)) for x in val):
            return f"`{val}`"
        if all(isinstance(x, dict) for x in val):
            return f"_(list of {len(val)} entries)_"
        return f"_(list × {len(val)})_"
    if isinstance(val, dict):
        items = list(val.items())[:5]
        preview = ", ".join(f"{k}={v}" for k, v in items)
        more = f" … +{len(val)-5} more" if len(val) > 5 else ""
        return f"`{{{preview}{more}}}`"
    return f"`{val}`"


# ─────────────────────────── CLI ───────────────────────────


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Build writer briefing per audience")
    p.add_argument("--audience", required=True, help="audience id (hdsd|tkkt|tkcs|tkct|xlsx)")
    p.add_argument("--intel-dir", required=True, help="path to docs/intel/")
    p.add_argument("--out", required=True, help="output briefing.md path")
    p.add_argument("--profile-dir", help="directory with audience-profiles/*.yaml",
                   default=str(Path(__file__).resolve().parents[2] / "audience-profiles"))
    args = p.parse_args(argv)

    profile_dir = Path(args.profile_dir)
    intel_dir = Path(args.intel_dir)
    out_path = Path(args.out)

    profile = load_profile(profile_dir, args.audience)
    facts = load_canonical_facts(intel_dir)
    metrics = compute_metrics(profile, facts)
    content = render_briefing(args.audience, profile, facts, metrics)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(content, encoding="utf-8")

    # Concise console report
    sys.stdout.reconfigure(encoding="utf-8") if hasattr(sys.stdout, "reconfigure") else None
    print(f"✓ Briefing written: {out_path}")
    print(f"  Audience:        {args.audience}")
    print(f"  Intel files OK:  {len(facts['_meta']['files_loaded'])}")
    print(f"  Intel files MISSING: {facts['_meta']['files_missing']}")
    print(f"  Metrics computed: {len(metrics)}")
    failed = [k for k, v in metrics.items() if isinstance(v, str) and v.startswith("[CẦN BỔ SUNG:")]
    if failed:
        print(f"  ⚠ Metric formulas failed: {failed}")
    print(f"  Briefing size:   {len(content)} chars (≈ {len(content)//4} tokens)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
