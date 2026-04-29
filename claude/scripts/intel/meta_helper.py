"""
Intel Layer meta helper.

Single utility for producers/consumers to interact with docs/intel/_meta.json
deterministically (no LLM judgment required for routine ops).

Usage (CLI):
    python meta_helper.py init <intel_dir> <workspace_slug>
    python meta_helper.py update <intel_dir> <artifact> --producer X --ttl 90 --sources file1 file2
    python meta_helper.py is-fresh <intel_dir> <artifact>
    python meta_helper.py mark-stale <intel_dir> <artifact> --reason "..."
    python meta_helper.py checksum <files...>

Exit codes: 0 OK, 1 not-fresh / stale, 2 missing, 3 error.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = "1.0"
# TTL defaults per ~/.claude/schemas/intel/README.md § TTL Defaults.
# Tier classification per OUTLINE_COVERAGE.md § 8.2.
DEFAULT_TTL = {
    # Tier 1 — mandatory cross-stage
    "code-facts.json": 7,
    "system-inventory.json": 30,
    "feature-catalog.json": 30,
    "sitemap.json": 30,
    "permission-matrix.json": 60,
    "actor-registry.json": 90,
    "test-accounts.json": 90,
    # Tier 2 — optional cross-stage
    "api-spec.json": 14,
    "data-model.json": 30,
    "architecture.json": 60,
    "integrations.json": 30,
    # Tier 3 — doc-only
    "business-context.json": 180,
    "nfr-catalog.json": 90,
    "security-design.json": 90,
    "infrastructure.json": 90,
    "cost-estimate.json": 30,
    "project-plan.json": 30,
    "handover-plan.json": 90,
    # Legacy / supporting (kept for back-compat)
    "domain-skeleton.json": 60,
    "flow-report.json": 30,
}


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sha256_files(paths: list[str], base_dir: Path | None = None) -> str:
    """Compute combined sha256 of paths.

    Relative paths are resolved against base_dir (workspace root). When base_dir
    is None, paths are resolved against current cwd. Missing files contribute an
    explicit '<missing>' marker so renames/deletions cause a checksum diff
    instead of being silently absorbed.
    """
    h = hashlib.sha256()
    for p in sorted(paths):
        full = Path(p)
        if not full.is_absolute() and base_dir is not None:
            full = (base_dir / p).resolve()
        if not full.exists():
            h.update(f"<missing:{p}>".encode("utf-8"))
            continue
        with open(full, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
    return f"sha256:{h.hexdigest()}"


def workspace_root(intel_dir: Path) -> Path:
    """Workspace root is the directory containing docs/intel/. We accept either
    {workspace}/docs/intel or {workspace}/intel layouts."""
    intel_dir = intel_dir.resolve()
    if intel_dir.name == "intel" and intel_dir.parent.name == "docs":
        return intel_dir.parent.parent
    return intel_dir.parent


def load_meta(intel_dir: Path) -> dict:
    meta_path = intel_dir / "_meta.json"
    if not meta_path.exists():
        return {}
    return json.loads(meta_path.read_text(encoding="utf-8"))


def save_meta(intel_dir: Path, meta: dict) -> None:
    meta_path = intel_dir / "_meta.json"
    tmp = meta_path.with_suffix(".tmp")
    tmp.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(meta_path)


def cmd_init(args) -> int:
    intel_dir = Path(args.intel_dir)
    intel_dir.mkdir(parents=True, exist_ok=True)
    meta = {
        "schema_version": SCHEMA_VERSION,
        "workspace_slug": args.workspace_slug,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "artifacts": {},
        "reuse_policy": {
            "from_doc_to_generate_docs": "reuse_if_fresh",
            "from_code_to_generate_docs": "reuse_if_fresh",
            "generate_docs_to_from_doc": "reuse_with_verify",
            "generate_docs_to_from_code": "reuse_with_verify",
            "from_doc_from_code_merge": "merge",
        },
    }
    save_meta(intel_dir, meta)
    print(f"Initialized {intel_dir}/_meta.json")
    return 0


def cmd_update(args) -> int:
    intel_dir = Path(args.intel_dir)
    meta = load_meta(intel_dir)
    if not meta:
        print("ERROR: _meta.json not initialized; run 'init' first", file=sys.stderr)
        return 3
    artifact = args.artifact
    ttl = args.ttl or DEFAULT_TTL.get(artifact, 30)
    sources = args.sources or []
    entry = meta.setdefault("artifacts", {}).get(artifact, {})
    base = workspace_root(intel_dir)
    entry.update({
        "producer": args.producer,
        "produced_at": now_iso(),
        "ttl_days": ttl,
        "checksum_sources": sha256_files(sources, base) if sources else entry.get("checksum_sources", ""),
        "source_evidence": sources or entry.get("source_evidence", []),
        "stale": False,
    })
    # remove stale fields if present
    entry.pop("stale_reason", None)
    entry.pop("stale_since", None)
    # track multi-producer
    merged = set(entry.get("merged_from", []))
    merged.add(args.producer)
    entry["merged_from"] = sorted(merged)
    meta["artifacts"][artifact] = entry
    meta["updated_at"] = now_iso()
    save_meta(intel_dir, meta)
    print(f"Updated meta for {artifact} (producer={args.producer}, ttl={ttl}d)")
    return 0


def cmd_is_fresh(args) -> int:
    intel_dir = Path(args.intel_dir)
    meta = load_meta(intel_dir)
    artifact = args.artifact
    entry = meta.get("artifacts", {}).get(artifact)
    if not entry:
        print(f"MISSING: {artifact}")
        return 2
    if entry.get("stale"):
        print(f"STALE: {entry.get('stale_reason', 'unknown')}")
        return 1
    produced = datetime.strptime(entry["produced_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    age_days = (datetime.now(timezone.utc) - produced).days
    if age_days > entry.get("ttl_days", 30):
        print(f"EXPIRED: age={age_days}d > ttl={entry['ttl_days']}d")
        return 1
    sources = entry.get("source_evidence", [])
    if sources and entry.get("checksum_sources"):
        current = sha256_files(sources, workspace_root(intel_dir))
        if current != entry["checksum_sources"]:
            print(f"CHECKSUM_DIFF: sources changed since produce-time")
            return 1
    print(f"FRESH: age={age_days}d, ttl={entry['ttl_days']}d")
    return 0


def cmd_mark_stale(args) -> int:
    intel_dir = Path(args.intel_dir)
    meta = load_meta(intel_dir)
    entry = meta.get("artifacts", {}).get(args.artifact)
    if not entry:
        print(f"ERROR: artifact {args.artifact} not in meta", file=sys.stderr)
        return 2
    entry["stale"] = True
    entry["stale_reason"] = args.reason
    entry["stale_since"] = now_iso()
    meta["updated_at"] = now_iso()
    save_meta(intel_dir, meta)
    print(f"Marked {args.artifact} stale: {args.reason}")
    return 0


def cmd_checksum(args) -> int:
    base = Path(args.base).resolve() if args.base else None
    print(sha256_files(args.files, base))
    return 0


def main():
    ap = argparse.ArgumentParser(description="Intel Layer meta helper")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_init = sub.add_parser("init")
    p_init.add_argument("intel_dir")
    p_init.add_argument("workspace_slug")
    p_init.set_defaults(func=cmd_init)

    p_update = sub.add_parser("update")
    p_update.add_argument("intel_dir")
    p_update.add_argument("artifact")
    p_update.add_argument("--producer", required=True)
    # Accept both --ttl (canonical) and --ttl-days (used in some skill SKILL.md docs)
    p_update.add_argument("--ttl", "--ttl-days", dest="ttl", type=int)
    # Accept both --sources (canonical) and --source-evidence (used in some skill SKILL.md docs)
    p_update.add_argument("--sources", "--source-evidence", dest="sources", nargs="*")
    p_update.set_defaults(func=cmd_update)

    p_fresh = sub.add_parser("is-fresh")
    p_fresh.add_argument("intel_dir")
    p_fresh.add_argument("artifact")
    p_fresh.set_defaults(func=cmd_is_fresh)

    p_stale = sub.add_parser("mark-stale")
    p_stale.add_argument("intel_dir")
    p_stale.add_argument("artifact")
    p_stale.add_argument("--reason", required=True)
    p_stale.set_defaults(func=cmd_mark_stale)

    p_chk = sub.add_parser("checksum")
    p_chk.add_argument("files", nargs="+")
    p_chk.add_argument("--base", help="Resolve relative paths against this directory (workspace root).")
    p_chk.set_defaults(func=cmd_checksum)

    args = ap.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
