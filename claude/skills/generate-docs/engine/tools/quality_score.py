#!/usr/bin/env python3
"""
quality_score.py — Phase 3.5 Quality Gate scorer.

Runs 4 validation passes on content-data.json:
  1. Placeholder density (budget per section)
  2. Cross-reference (content-data vs code-facts)
  3. Prose specificity (numbers, entities, dates per 500 words)
  4. Banned prose phrases

Outputs: quality-report.json + score 0-100.

Usage:
  python quality_score.py \
    --content-data docs/generated/slug/output/content-data.json \
    --code-facts   docs/generated/slug/intel/code-facts.json \
    --output       docs/generated/slug/intel/quality-report.json
"""

import argparse
import json
import re
import sys
from pathlib import Path
from collections import Counter

PLACEHOLDER_BUDGET = {
    "overview": 2,
    "architecture": 3,
    "tkcs": 15,
    "tkct": 8,
    "services": 0,
    "test_cases": 0,
}

# F1 — Minimum word count per section path (hard floor)
SECTION_MIN_WORDS = {
    "overview.purpose": 200,
    "overview.scope": 200,
    "overview.system_description": 300,
    "overview.conventions": 150,
    "tkcs.legal_basis": 400,
    "tkcs.current_state": 800,
    "tkcs.necessity": 500,
    "tkcs.objectives": 400,
    "tkcs.architecture_compliance": 300,
    "tkcs.technology_rationale": 600,
    "tkcs.functional_design": 1000,
    "tkcs.db_design_summary": 400,
    "tkcs.integration_design_summary": 400,
    "tkcs.security_plan": 500,
    "tkcs.operations_plan": 400,
    "tkcs.timeline": 300,
    "architecture.system_overview": 400,
    "architecture.scope_description": 300,
    "architecture.business_overview": 500,
    "architecture.design_principles": 400,
    "architecture.logical_description": 400,
    "architecture.data_description": 300,
    "architecture.integration_description": 400,
    "architecture.deployment_description": 400,
    "architecture.security_description": 500,
    "architecture.auth_description": 300,
    "architecture.data_protection": 300,
    "tkct.system_description": 400,
    "tkct.db_description": 300,
    "tkct.api_description": 300,
}

BANNED_PHRASES_STRICT = [
    "tương đối", "khá", "hơi", "cực kỳ",
    "đa số", "hầu hết", "phần lớn",
    "hiện đại", "tiên tiến", "lạc hậu", "lỗi thời",
    "đồng bộ", "toàn diện", "đầy đủ",
    "thời gian tới", "thời gian qua", "trong thời gian gần đây",
    "từng bước", "dần dần",
    "cần tiếp tục nghiên cứu", "có thể xem xét",
    "mạnh mẽ", "yếu kém",
]

STRICT_SECTIONS = [
    "tkcs.current_state", "tkcs.necessity", "tkcs.technology_rationale",
    "tkcs.functional_design", "architecture.system_overview",
    "architecture.security_description", "architecture.logical_description",
]


def walk_strings(obj, path=""):
    """Yield (path, value) for all strings in JSON tree."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_strings(v, f"{path}.{k}" if path else k)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            yield from walk_strings(item, f"{path}[{i}]")
    elif isinstance(obj, str):
        yield path, obj


def count_placeholders(data, section_key):
    section = data.get(section_key)
    if section is None: return 0
    count = 0
    for _, val in walk_strings(section):
        count += val.count("[CẦN BỔ SUNG")
    return count


def count_specificity(text):
    words = len(text.split())
    numbers = len(re.findall(r"\b\d+(?:[.,]\d+)?\b", text))
    capitalized = len(re.findall(r"\b[A-ZÀ-Ỹ][a-zà-ỹ]{2,}(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)*\b", text))
    dates = len(re.findall(r"\b\d{1,2}/\d{1,2}/\d{2,4}|\d{4}|Q[1-4]/\d{4}\b", text))
    versions = len(re.findall(r"\bv?\d+\.\d+(?:\.\d+)?\b", text))
    citations = len(re.findall(r"\b(NĐ|QĐ|TT|CT|Luật)\s*(số)?\s*\d+", text))
    return {
        "words": words, "numbers": numbers, "capitalized": capitalized,
        "dates": dates, "versions": versions, "citations": citations
    }


def check_banned_phrases(data):
    violations = []
    for path, val in walk_strings(data):
        if not isinstance(val, str) or len(val) < 20:
            continue
        val_lower = val.lower()
        is_strict = any(path.startswith(s) for s in STRICT_SECTIONS)
        for phrase in BANNED_PHRASES_STRICT:
            occurrences = val_lower.count(phrase)
            if occurrences > 0:
                violations.append({
                    "path": path,
                    "phrase": phrase,
                    "occurrences": occurrences,
                    "severity": "major" if is_strict else "minor",
                    "excerpt": val[:200]
                })
    return violations


def check_cross_reference(data, code_facts):
    violations = []
    if not code_facts: return violations

    # Tech stack versions
    data_stack = data.get("architecture", {}).get("tech_stack", [])
    code_stack = {f["name"]: f.get("version") for f in code_facts.get("tech_stack", [])}
    for ts in data_stack:
        name = ts.get("technology", "")
        data_v = ts.get("version", "")
        code_v = code_stack.get(name) or code_stack.get(name.lower())
        if code_v and data_v and data_v.strip("^~") != code_v.strip("^~"):
            violations.append({
                "type": "version_mismatch",
                "field": f"tech_stack.{name}",
                "data_says": data_v, "code_says": code_v,
                "severity": "minor"
            })

    # Entity coverage
    data_ents = {e.get("name", "") for e in data.get("architecture", {}).get("data_entities", [])}
    code_ents = {e.get("name", "") for e in code_facts.get("entities", [])}
    missing = code_ents - data_ents
    if missing:
        violations.append({
            "type": "missing_entities", "in_code_not_data": sorted(missing),
            "severity": "major" if len(missing) > 2 else "minor"
        })

    # API coverage
    data_apis = {(a.get("method", ""), a.get("path", "")) for a in data.get("architecture", {}).get("apis", [])}
    code_apis = {(r.get("method", ""), r.get("path", "")) for r in code_facts.get("routes", [])}
    if code_apis:
        coverage = 1 - (len(code_apis - data_apis) / len(code_apis))
        if coverage < 0.5:
            violations.append({"type": "api_coverage_low", "coverage": round(coverage, 2), "severity": "blocker"})
        elif coverage < 0.8:
            violations.append({"type": "api_coverage_low", "coverage": round(coverage, 2), "severity": "major"})

    return violations


def check_specificity(data):
    weak = []
    for path, val in walk_strings(data):
        if not isinstance(val, str) or len(val) < 200:
            continue
        # Only prose fields
        if not any(path.startswith(s) for s in STRICT_SECTIONS + ["tkcs.", "architecture."]):
            continue
        metrics = count_specificity(val)
        ratio = metrics["words"] / 500
        required = 5 * ratio
        if metrics["numbers"] < required * 0.7:
            weak.append({
                "path": path,
                "numbers": metrics["numbers"],
                "required": round(required, 1),
                "gap_percent": round(100 * (1 - metrics["numbers"] / max(required, 1)), 0),
                "excerpt": val[:200]
            })
    return weak


def get_by_path(data, path):
    """path='tkcs.current_state' → data['tkcs']['current_state']"""
    cur = data
    for part in path.split("."):
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            return None
    return cur


def check_section_word_counts(data):
    """F1 Pass 5: check min word count per section."""
    violations = []
    for path, min_words in SECTION_MIN_WORDS.items():
        val = get_by_path(data, path)
        if val is None:
            continue
        if isinstance(val, dict) and "value" in val:
            val = val["value"]
        if not isinstance(val, str):
            continue
        words = len(val.split())
        if words < min_words:
            violations.append({
                "path": path,
                "current_words": words,
                "required": min_words,
                "gap_percent": round(100 * (1 - words / min_words), 0),
                "severity": "blocker" if words < min_words * 0.5 else "major" if words < min_words * 0.7 else "minor"
            })
    return violations


def check_tc_scaling(data):
    """F2 Pass 6: data-driven TC count check."""
    violations = []
    services = data.get("services", [])
    test_cases_ui = data.get("test_cases", {}).get("ui", [])

    # Count TCs per feature_id
    tc_by_feature = {}
    for tc in test_cases_ui:
        if isinstance(tc, dict):
            fid = tc.get("feature_id")
            if fid:
                tc_by_feature[fid] = tc_by_feature.get(fid, 0) + 1

    for svc in services:
        for feature in svc.get("features", []):
            fid = feature.get("id")
            actors = feature.get("actors", [])
            error_cases = feature.get("error_cases", [])
            ui_elements = feature.get("ui_elements", [])

            # Estimate validations from ui_elements rules (best-effort)
            validations = sum(
                1 for ui in ui_elements
                if isinstance(ui, dict) and "rules" in ui and ui["rules"]
            )

            expected = 1 + len(actors) * 2 + validations * 3 + len(error_cases) + 3
            actual = tc_by_feature.get(fid, 0)

            if actual < expected * 0.5:
                severity = "blocker"
            elif actual < expected * 0.7:
                severity = "major"
            elif actual < expected * 0.9:
                severity = "minor"
            else:
                continue

            violations.append({
                "feature_id": fid,
                "expected_tc": expected,
                "actual_tc": actual,
                "gap_percent": round(100 * (1 - actual / expected), 0),
                "severity": severity,
                "breakdown": {
                    "happy": 1, "permission": len(actors) * 2,
                    "boundary": validations * 3, "error_cases": len(error_cases),
                    "edge": 3
                }
            })
    return violations


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--content-data", required=True)
    ap.add_argument("--code-facts", default=None)
    ap.add_argument("--output", required=True)
    args = ap.parse_args()

    data = json.load(open(args.content_data, encoding="utf-8"))
    code_facts = json.load(open(args.code_facts, encoding="utf-8")) if args.code_facts and Path(args.code_facts).exists() else None

    # Pass 1: Placeholder
    pass_1 = {}
    overshoot_total = 0
    for section, budget in PLACEHOLDER_BUDGET.items():
        count = count_placeholders(data, section)
        over = max(0, count - budget)
        overshoot_total += over
        pass_1[section] = {
            "count": count, "budget": budget,
            "status": "over" if over > 0 else "ok",
            "overshoot": over
        }

    # Pass 2: Cross-ref
    pass_2 = check_cross_reference(data, code_facts)
    cross_ref_fail = sum(1 for v in pass_2 if v.get("severity") in ("major", "blocker"))

    # Pass 3: Specificity
    pass_3 = check_specificity(data)

    # Pass 4: Banned prose
    pass_4 = check_banned_phrases(data)
    banned_major = sum(v["occurrences"] for v in pass_4 if v.get("severity") == "major")

    # Pass 5 (F1): Section word count
    pass_5 = check_section_word_counts(data)
    word_blockers = sum(1 for v in pass_5 if v["severity"] == "blocker")
    word_majors = sum(1 for v in pass_5 if v["severity"] == "major")

    # Pass 6 (F2): TC scaling
    pass_6 = check_tc_scaling(data)
    tc_blockers = sum(1 for v in pass_6 if v["severity"] == "blocker")
    tc_majors = sum(1 for v in pass_6 if v["severity"] == "major")

    # Score
    score = 100
    score -= 5 * overshoot_total
    score -= 10 * cross_ref_fail
    score -= 2 * len(pass_3)
    score -= 5 * banned_major
    score -= 15 * word_blockers + 5 * word_majors    # F1 weight heavy — substance critical
    score -= 10 * tc_blockers + 3 * tc_majors         # F2 weight — coverage critical
    score = max(0, score)

    verdict = "pass" if score >= 80 else "warn" if score >= 60 else "block"

    report = {
        "meta": {
            "score": score,
            "verdict": verdict,
            "threshold_pass": 80,
            "threshold_warn": 60,
        },
        "pass_1_placeholders": pass_1,
        "pass_2_cross_reference": pass_2,
        "pass_3_specificity_weak": pass_3,
        "pass_4_banned_prose": pass_4,
        "pass_5_word_count": pass_5,
        "pass_6_tc_scaling": pass_6,
        "recommendations": []
    }

    # Recommendations
    if overshoot_total > 0:
        over_sections = [s for s, v in pass_1.items() if v["status"] == "over"]
        report["recommendations"].append(f"Placeholder overshoot ở: {', '.join(over_sections)}. Expand Bậc 1+2 scan, apply placeholder-policy rule.")
    if cross_ref_fail > 0:
        report["recommendations"].append(f"{cross_ref_fail} cross-ref violations — update content-data từ code-facts (authoritative).")
    if pass_3:
        worst = sorted(pass_3, key=lambda x: x["gap_percent"], reverse=True)[:3]
        report["recommendations"].append(f"Prose hời hợt ở: {', '.join(w['path'] for w in worst)}. Inject numbers/dates/entities.")
    if banned_major > 0:
        report["recommendations"].append(f"{banned_major} banned phrases trong strict sections. Replace với specifics theo prose-quality rule.")
    if pass_5:
        short_sections = [v["path"] for v in pass_5 if v["severity"] in ("blocker", "major")]
        if short_sections:
            report["recommendations"].append(
                f"{len(short_sections)} sections dưới min word count: {', '.join(short_sections[:3])}. "
                f"Run Phase 3g Depth Pass để expand với more intel queries."
            )
    if pass_6:
        low_tc = sorted(pass_6, key=lambda v: v["gap_percent"], reverse=True)[:3]
        report["recommendations"].append(
            f"{len(pass_6)} features có TC count dưới expected. Top gaps: "
            + ", ".join(f"{v['feature_id']} ({v['actual_tc']}/{v['expected_tc']})" for v in low_tc)
        )

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"Quality score: {score}/100 ({verdict})")
    print(f"  Pass 1 Placeholders: {sum(v['count'] for v in pass_1.values())} total, {overshoot_total} overshoot")
    print(f"  Pass 2 Cross-ref violations: {len(pass_2)}")
    print(f"  Pass 3 Weak prose sections: {len(pass_3)}")
    print(f"  Pass 4 Banned phrases: {len(pass_4)} occurrences")
    print(f"  Pass 5 Section word count: {len(pass_5)} short ({word_blockers} blocker, {word_majors} major)")
    print(f"  Pass 6 TC scaling: {len(pass_6)} features under-tested ({tc_blockers} blocker, {tc_majors} major)")

    sys.exit(0 if verdict != "block" else 1)


if __name__ == "__main__":
    main()
