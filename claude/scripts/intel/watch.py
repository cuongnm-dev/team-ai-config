"""
Intel Layer staleness watcher.

Compares current source-file checksums against checksums recorded in _meta.json
at produce-time. Marks artifacts stale when sources have changed. Does NOT
regenerate — only flags. Producers see the stale flag on next run.

Usage:
    python watch.py <intel_dir>            # one-shot probe
    python watch.py <intel_dir> --json     # JSON output
    python watch.py <intel_dir> --apply    # write stale flags into _meta.json

Exit codes: 0 all-fresh, 1 some-stale, 2 missing-meta, 3 error.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
from pathlib import Path

# Reuse helper for consistency
sys.path.insert(0, str(Path(__file__).parent))
from meta_helper import sha256_files, load_meta, save_meta, now_iso, workspace_root  # noqa: E402


def probe(intel_dir: Path) -> list[dict]:
    meta = load_meta(intel_dir)
    if not meta:
        print(f"ERROR: {intel_dir}/_meta.json missing", file=sys.stderr)
        sys.exit(2)

    base = workspace_root(intel_dir)
    results = []
    for artifact, entry in meta.get("artifacts", {}).items():
        sources = entry.get("source_evidence", [])
        recorded = entry.get("checksum_sources")
        if not sources or not recorded:
            results.append({"artifact": artifact, "status": "no-sources-tracked"})
            continue
        current = sha256_files(sources, base)
        if current == recorded:
            results.append({"artifact": artifact, "status": "fresh"})
        else:
            results.append({
                "artifact": artifact,
                "status": "stale",
                "reason": f"source files changed since {entry.get('produced_at')}",
            })
    return results


def apply_stale_flags(intel_dir: Path, results: list[dict]) -> int:
    meta = load_meta(intel_dir)
    changed = 0
    for r in results:
        if r["status"] != "stale":
            continue
        entry = meta["artifacts"][r["artifact"]]
        if not entry.get("stale"):
            entry["stale"] = True
            entry["stale_reason"] = r["reason"]
            entry["stale_since"] = now_iso()
            changed += 1
    if changed:
        meta["updated_at"] = now_iso()
        save_meta(intel_dir, meta)
    return changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("intel_dir")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    intel_dir = Path(args.intel_dir)
    results = probe(intel_dir)

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        for r in results:
            badge = {"fresh": "OK", "stale": "STALE", "no-sources-tracked": "n/a"}.get(r["status"], "?")
            line = f"[{badge}] {r['artifact']}"
            if r["status"] == "stale":
                line += f" — {r['reason']}"
            print(line)

    stale_count = sum(1 for r in results if r["status"] == "stale")
    if args.apply and stale_count:
        n = apply_stale_flags(intel_dir, results)
        print(f"Marked {n} artifact(s) stale in _meta.json")

    sys.exit(1 if stale_count else 0)


if __name__ == "__main__":
    main()
