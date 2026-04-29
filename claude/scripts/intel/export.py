"""
Intel Layer vendor export.

Exports docs/intel/ to vendor-specific formats so non-Claude IDEs and external
systems can consume the same role/permission/sitemap data.

Targets:
    cursor    -> .cursor/rules/intel-*.mdc
    windsurf  -> .windsurfrules
    generic   -> INTEL.md (markdown summary)
    openapi   -> patches an OpenAPI 3.x spec with x-roles + x-permissions

Usage:
    python export.py <intel_dir> --target cursor [--out .cursor/rules/]
    python export.py <intel_dir> --target windsurf [--out .windsurfrules]
    python export.py <intel_dir> --target generic [--out INTEL.md]
    python export.py <intel_dir> --target openapi --spec openapi.yml [--out openapi.augmented.yml]
"""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path


def load(intel_dir: Path, name: str) -> dict | None:
    p = intel_dir / name
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def fmt_role_table(actor_registry: dict) -> str:
    out = ["| Slug | Display | Type | Login URL |", "|---|---|---|---|"]
    for r in actor_registry.get("roles", []):
        out.append(f"| `{r['slug']}` | {r.get('display','')} | {r.get('type','')} | {r.get('auth',{}).get('login_url','')} |")
    return "\n".join(out)


def fmt_permission_table(matrix: dict) -> str:
    if not matrix:
        return "_No permission matrix available._"
    out = ["| Role | Resource | Actions | Effect |", "|---|---|---|---|"]
    for p in matrix.get("permissions", []):
        actions = p["actions"] if isinstance(p["actions"], str) else ", ".join(p["actions"])
        out.append(f"| `{p['role']}` | `{p['resource']}` | {actions} | {p.get('effect','allow')} |")
    return "\n".join(out)


def fmt_sitemap_brief(sitemap: dict) -> str:
    if not sitemap:
        return "_No sitemap available._"
    lines = []
    for r in sitemap.get("roles", []):
        lines.append(f"### Role `{r['role']}` — entry: `{r.get('entry_url','/')}`")
        for m in r.get("menu_tree", []):
            lines.append(f"- {m.get('label')} (`{m.get('url','')}`) → feature `{m.get('feature_id','')}`")
    return "\n".join(lines)


def export_generic(intel_dir: Path, out_path: Path) -> int:
    ar = load(intel_dir, "actor-registry.json") or {}
    pm = load(intel_dir, "permission-matrix.json") or {}
    sm = load(intel_dir, "sitemap.json") or {}
    fc = load(intel_dir, "feature-catalog.json") or {}

    md = f"""# Intel Layer Summary

> Auto-generated from `docs/intel/` — do NOT edit by hand. Regenerate via `intel-export --target generic`.

## Roles

RBAC mode: **{ar.get('rbac_mode','unknown')}** ({', '.join(ar.get('rbac_implementation', []))})
Multi-role: **{ar.get('multi_role', False)}**

{fmt_role_table(ar)}

## Permissions

{fmt_permission_table(pm)}

## Sitemap

{fmt_sitemap_brief(sm)}

## Features ({len(fc.get('features', []))})

| ID | Name | Status | Roles |
|---|---|---|---|
""" + "\n".join(
        f"| `{f['id']}` | {f.get('name','')} | {f.get('status','')} | {', '.join(rv['role'] for rv in f.get('role_visibility', []))} |"
        for f in fc.get("features", [])
    )

    out_path.write_text(md, encoding="utf-8")
    print(f"Wrote {out_path}")
    return 0


def export_cursor(intel_dir: Path, out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    ar = load(intel_dir, "actor-registry.json") or {}
    pm = load(intel_dir, "permission-matrix.json") or {}

    roles_md = f"""---
description: System roles and RBAC contract — auto-generated from docs/intel/actor-registry.json
globs:
  - "**/*"
alwaysApply: true
---
# Roles

RBAC mode: {ar.get('rbac_mode', 'unknown')}

{fmt_role_table(ar)}

When writing code that handles authorization, use the `slug` values above as the canonical identifier. Do not invent new role names.
"""

    perms_md = f"""---
description: Permission matrix — auto-generated from docs/intel/permission-matrix.json
globs:
  - "**/*.{{ts,js,py,go,java}}"
alwaysApply: false
---
# Permissions

{fmt_permission_table(pm)}

When implementing authorization checks, reference these tuples. If a check is missing here, surface it in code review — do not silently invent permissions.
"""

    (out_dir / "intel-roles.mdc").write_text(roles_md, encoding="utf-8")
    (out_dir / "intel-permissions.mdc").write_text(perms_md, encoding="utf-8")
    print(f"Wrote {out_dir}/intel-roles.mdc and intel-permissions.mdc")
    return 0


def export_windsurf(intel_dir: Path, out_path: Path) -> int:
    ar = load(intel_dir, "actor-registry.json") or {}
    pm = load(intel_dir, "permission-matrix.json") or {}

    content = f"""# Windsurf Rules — Intel Layer
# Auto-generated. Do not edit by hand.

## System roles
{fmt_role_table(ar)}

## Permission contract
{fmt_permission_table(pm)}

## Constraints
- Use the role slugs above as canonical identifiers.
- Do not introduce new roles or permissions without first updating docs/intel/.
"""
    out_path.write_text(content, encoding="utf-8")
    print(f"Wrote {out_path}")
    return 0


def export_openapi(intel_dir: Path, spec_path: Path, out_path: Path) -> int:
    try:
        import yaml  # type: ignore
    except ImportError:
        print("ERROR: PyYAML required for openapi target. pip install pyyaml", file=sys.stderr)
        return 3

    ar = load(intel_dir, "actor-registry.json") or {}
    pm = load(intel_dir, "permission-matrix.json") or {}
    sm = load(intel_dir, "sitemap.json") or {}

    spec = yaml.safe_load(spec_path.read_text(encoding="utf-8"))
    spec.setdefault("info", {}).setdefault("x-roles", [
        {"slug": r["slug"], "display": r.get("display"), "type": r.get("type")}
        for r in ar.get("roles", [])
    ])
    spec["info"]["x-rbac-mode"] = ar.get("rbac_mode")

    # Annotate paths with x-permissions
    perms_by_resource: dict[str, list[dict]] = {}
    for p in pm.get("permissions", []):
        perms_by_resource.setdefault(p["resource"], []).append(p)

    for path, methods in spec.get("paths", {}).items():
        # find sitemap route matching path
        for route in sm.get("routes", []):
            if route.get("path") == path:
                resource_id = f"route.{path.strip('/').replace('/', '.')}"
                if resource_id in perms_by_resource:
                    for method_name, op in methods.items():
                        if isinstance(op, dict):
                            op.setdefault("x-permissions", []).extend(perms_by_resource[resource_id])
                break

    out_path.write_text(yaml.safe_dump(spec, sort_keys=False, allow_unicode=True), encoding="utf-8")
    print(f"Wrote {out_path}")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("intel_dir")
    ap.add_argument("--target", required=True, choices=["cursor", "windsurf", "generic", "openapi"])
    ap.add_argument("--out", help="Output path (file or dir depending on target)")
    ap.add_argument("--spec", help="OpenAPI input spec (for --target openapi)")
    args = ap.parse_args()

    intel_dir = Path(args.intel_dir)
    if not intel_dir.exists():
        print(f"ERROR: {intel_dir} does not exist", file=sys.stderr)
        sys.exit(2)

    if args.target == "cursor":
        out = Path(args.out or ".cursor/rules/")
        sys.exit(export_cursor(intel_dir, out))
    elif args.target == "windsurf":
        out = Path(args.out or ".windsurfrules")
        sys.exit(export_windsurf(intel_dir, out))
    elif args.target == "generic":
        out = Path(args.out or "INTEL.md")
        sys.exit(export_generic(intel_dir, out))
    elif args.target == "openapi":
        if not args.spec:
            print("ERROR: --spec required for openapi target", file=sys.stderr)
            sys.exit(3)
        out = Path(args.out or "openapi.augmented.yml")
        sys.exit(export_openapi(intel_dir, Path(args.spec), out))


if __name__ == "__main__":
    main()
