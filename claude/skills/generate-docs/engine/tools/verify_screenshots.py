#!/usr/bin/env python3
"""
verify_screenshots.py — Phase 2.5 screenshot coverage validator.

Usage:
  python verify_screenshots.py \
    --intel-dir docs/generated/slug/intel \
    --screenshots-dir docs/generated/slug/screenshots \
    --output docs/generated/slug/intel/screenshot-validation.json \
    --threshold 95
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

def parse_feature_id_from_filename(filename):
    """F-001-step-02-filled.png → ('F-001', 2, 'filled')"""
    m = re.match(r"(F-\d+)-step-(\d+)-(\w+)\.(png|jpg|jpeg)$", filename, re.I)
    if m: return m.group(1), int(m.group(2)), m.group(3)
    m = re.match(r"(F-\d+)-error-(\d+)\.(png|jpg|jpeg)$", filename, re.I)
    if m: return m.group(1), None, f"error-{m.group(2)}"
    return None, None, None


def check_blank(path):
    """Return True if image is likely blank (low stddev)."""
    try:
        from PIL import Image, ImageStat
        img = Image.open(path)
        stat = ImageStat.Stat(img)
        stddev = sum(stat.stddev) / len(stat.stddev)
        return stddev < 3
    except ImportError:
        return False
    except Exception:
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--intel-dir", required=True)
    ap.add_argument("--screenshots-dir", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--threshold", type=float, default=95.0)
    args = ap.parse_args()

    intel_dir = Path(args.intel_dir)
    screenshots_dir = Path(args.screenshots_dir)

    # Load intel — try doc-intel first, fallback flow-report
    intel = None
    for candidate in ["doc-intel.json", "flow-report.json"]:
        p = intel_dir / candidate
        if p.exists():
            intel = json.load(open(p, encoding="utf-8"))
            break
    if not intel:
        print("ERROR: no intel file found", file=sys.stderr)
        sys.exit(2)

    # Build expected set
    features = []
    if "features_from_docs" in intel:
        features = intel["features_from_docs"]
    elif "services" in intel:
        for svc in intel["services"]:
            features.extend(svc.get("features", []))

    expected = []
    for f in features:
        fid = f.get("id")
        if not fid: continue
        # Mandatory initial
        expected.append(f"{fid}-step-01-initial.png")
        # Per step
        for step in f.get("steps", []):
            state = step.get("state", "filled")
            no = step.get("no", 1)
            expected.append(f"{fid}-step-{no:02d}-{state}.png")
        # Error cases
        for i in range(1, len(f.get("error_cases", [])) + 1):
            expected.append(f"{fid}-error-{i:02d}.png")

    # Verify
    found_valid = []
    missing = []
    blank = []
    wrong_size = []
    by_feature = {}

    for expected_file in expected:
        fid, _, _ = parse_feature_id_from_filename(expected_file)
        if fid not in by_feature:
            by_feature[fid] = {"expected": 0, "found": 0, "missing_list": [], "status": "pending"}
        by_feature[fid]["expected"] += 1

        path = screenshots_dir / expected_file
        if not path.exists():
            missing.append(expected_file)
            by_feature[fid]["missing_list"].append(expected_file)
            continue

        size = path.stat().st_size
        if size < 2000:
            wrong_size.append({"file": expected_file, "size_bytes": size})
            continue

        if check_blank(path):
            blank.append(expected_file)
            continue

        found_valid.append(expected_file)
        by_feature[fid]["found"] += 1

    # Assign status per feature
    for fid, stats in by_feature.items():
        if stats["found"] == stats["expected"]:
            stats["status"] = "complete"
        elif stats["found"] > 0:
            stats["status"] = "partial"
        else:
            stats["status"] = "failed"

    total_expected = len(expected)
    total_valid = len(found_valid)
    coverage_pct = (100.0 * total_valid / total_expected) if total_expected > 0 else 0.0

    result = {
        "meta": {
            "total_expected": total_expected,
            "found_valid": total_valid,
            "missing": len(missing),
            "blank": len(blank),
            "wrong_size": len(wrong_size),
            "coverage_percent": round(coverage_pct, 1),
            "threshold_percent": args.threshold,
            "passed": coverage_pct >= args.threshold
        },
        "missing": missing,
        "blank_detected": blank,
        "wrong_size": wrong_size,
        "by_feature": by_feature
    }

    # Write output
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    # Console summary
    print(f"Screenshot coverage: {coverage_pct:.1f}% ({total_valid}/{total_expected})")
    if missing:
        print(f"  Missing: {len(missing)} (first 5): {missing[:5]}")
    if blank:
        print(f"  Blank: {len(blank)}")
    if wrong_size:
        print(f"  Wrong size: {len(wrong_size)}")

    sys.exit(0 if result["meta"]["passed"] else 1)


if __name__ == "__main__":
    main()
