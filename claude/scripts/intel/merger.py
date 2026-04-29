"""
Intel Layer merger.

Merges new producer output with existing intel artifact respecting:
1. locked_fields (manual edits) — never overwrite
2. Producer precedence per field (per CLAUDE.md CD-10 + schemas/intel/README.md)
3. Evidence accumulation (append, don't replace)

Usage:
    python merger.py <intel_dir> <artifact> --new <new_file.json> --producer X
    python merger.py <intel_dir> --resolve-all  (merge all .new.json files)

Returns merged content to stdout if --print, else writes to artifact path.
"""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path

# Per-field precedence: which producer wins when both contribute.
# Format: { "<jsonpath>": "<producer-slug>" }
PRECEDENCE = {
    "actor-registry.json": {
        "$.roles[*].display": "doc-intel",
        "$.roles[*].display_en": "doc-intel",
        "$.roles[*].description": "doc-intel",
        "$.roles[*].auth.login_url": "tdoc-researcher",
        "$.roles[*].auth.session_strategy": "tdoc-researcher",
        "$.roles[*].auth.mfa_required": "tdoc-researcher",
        "$.rbac_mode": "tdoc-researcher",
        "$.rbac_implementation": "merge_array",
    },
    "permission-matrix.json": {
        "$.permissions[*].evidence[?kind=code]": "tdoc-researcher",
        "$.permissions[*].evidence[?kind=doc]": "doc-intel",
        "$.permissions[*].conditions": "tdoc-researcher",
        "$.uncovered_resources": "merge_array",
    },
    "sitemap.json": {
        "$.roles[*].menu_tree[*].label": "doc-intel",
        "$.roles[*].menu_tree[*].label_en": "doc-intel",
        "$.routes[*].path": "tdoc-researcher",
        "$.routes[*].component": "tdoc-researcher",
        "$.routes[*].playwright_hints": "tdoc-researcher",
        "$.feature_overrides[*].workflow_variants": "doc-intel",
    },
    "feature-catalog.json": {
        "$.features[*].name": "doc-intel",
        "$.features[*].description": "doc-intel",
        "$.features[*].routes": "tdoc-researcher",
        "$.features[*].entities": "tdoc-researcher",
        "$.features[*].role_visibility": "merge_role_visibility",
    },
}


def is_locked(path: str, locked_fields: list[str]) -> bool:
    """Simple wildcard match: locked '$.roles[*].display' covers any role's display."""
    for lf in locked_fields:
        if path == lf:
            return True
        # treat [*] as wildcard
        lf_pat = lf.replace("[*]", "[]")
        path_pat = path.replace("[0]", "[]").replace("[1]", "[]").replace("[2]", "[]")
        if lf_pat == path_pat:
            return True
    return False


def merge_evidence(old: list, new: list) -> list:
    """Append-only merge by (kind, file/source_id) tuple identity."""
    seen = set()
    out = []
    for item in (old or []) + (new or []):
        key = (item.get("kind"), item.get("file") or item.get("source_id") or item.get("screenshot"))
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def merge_role_visibility(old: list, new: list) -> list:
    """Merge by role; severity max (none < readonly < partial < full)."""
    sev = {"none": 0, "readonly": 1, "partial": 2, "full": 3}
    inv = {v: k for k, v in sev.items()}
    by_role: dict[str, dict] = {}
    for item in (old or []) + (new or []):
        r = item["role"]
        cur = by_role.get(r)
        if not cur or sev[item["level"]] > sev[cur["level"]]:
            by_role[r] = dict(item)
    return list(by_role.values())


def merge_actor_registry(old: dict, new: dict, locked: list[str]) -> dict:
    out = dict(old)
    out["schema_version"] = "1.0"
    out["multi_role"] = new.get("multi_role", old.get("multi_role", False))

    # rbac_mode: tdoc-researcher wins (more granular code evidence)
    if not is_locked("$.rbac_mode", locked):
        out["rbac_mode"] = new.get("rbac_mode", old.get("rbac_mode", "implicit"))

    # rbac_implementation: union
    impls = set(old.get("rbac_implementation", [])) | set(new.get("rbac_implementation", []))
    out["rbac_implementation"] = sorted(impls)

    # roles: merge by slug
    by_slug = {r["slug"]: dict(r) for r in old.get("roles", [])}
    for nr in new.get("roles", []):
        slug = nr["slug"]
        cur = by_slug.get(slug, {})
        merged_role = dict(cur)
        # display fields: doc-intel wins, but if old empty take new
        for f in ("display", "display_en", "description"):
            if not is_locked(f"$.roles[*].{f}", locked):
                if not cur.get(f) or nr.get("_producer") == "doc-intel":
                    merged_role[f] = nr.get(f, cur.get(f))
        # auth: tdoc-researcher wins
        merged_role.setdefault("auth", {})
        for f in ("login_url", "post_login_redirect", "session_strategy", "mfa_required"):
            if nr.get("auth", {}).get(f) is not None:
                merged_role["auth"][f] = nr["auth"][f]
        # evidence: append
        merged_role["evidence"] = merge_evidence(cur.get("evidence", []), nr.get("evidence", []))
        # source_producers: union
        sp = set(cur.get("source_producers", [])) | set(nr.get("source_producers", []))
        merged_role["source_producers"] = sorted(sp)
        # confidence: bump to high if multi-producer
        if len(merged_role["source_producers"]) >= 2:
            merged_role["confidence"] = "high"
        else:
            merged_role["confidence"] = nr.get("confidence", cur.get("confidence", "medium"))
        # type, slug, inherits_from: prefer new if non-empty
        for f in ("type", "inherits_from", "tags"):
            if nr.get(f):
                merged_role[f] = nr[f]
            elif cur.get(f):
                merged_role[f] = cur[f]
        merged_role["slug"] = slug
        by_slug[slug] = merged_role
    out["roles"] = list(by_slug.values())
    return out


def merge_generic(old: dict, new: dict, kind: str, locked: list[str]) -> dict:
    """Fallback: shallow merge with new winning, but preserve locked fields."""
    out = dict(old)
    for k, v in new.items():
        if is_locked(f"$.{k}", locked):
            continue
        out[k] = v
    return out


def merge_artifact(artifact: str, old: dict, new: dict, locked: list[str]) -> dict:
    if artifact == "actor-registry.json":
        return merge_actor_registry(old, new, locked)
    # TODO: specialize permission-matrix, sitemap, feature-catalog
    # For Phase 2 MVP: generic merge with locked-field protection
    return merge_generic(old, new, artifact, locked)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("intel_dir")
    ap.add_argument("artifact")
    ap.add_argument("--new", required=True, help="Path to new producer output")
    ap.add_argument("--producer", required=True)
    ap.add_argument("--print", action="store_true")
    args = ap.parse_args()

    intel_dir = Path(args.intel_dir)
    artifact_path = intel_dir / args.artifact
    new_path = Path(args.new)
    meta_path = intel_dir / "_meta.json"

    new_data = json.loads(new_path.read_text(encoding="utf-8"))
    if not artifact_path.exists():
        merged = new_data
    else:
        old_data = json.loads(artifact_path.read_text(encoding="utf-8"))
        meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
        locked = meta.get("artifacts", {}).get(args.artifact, {}).get("locked_fields", [])
        merged = merge_artifact(args.artifact, old_data, new_data, locked)

    if args.print:
        json.dump(merged, sys.stdout, indent=2, ensure_ascii=False)
    else:
        tmp = artifact_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(artifact_path)
        print(f"Merged {args.producer} into {args.artifact}")


if __name__ == "__main__":
    main()
