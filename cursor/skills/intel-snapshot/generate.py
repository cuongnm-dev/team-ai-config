#!/usr/bin/env python3
"""Compress Tier 1 canonical intel JSON files into _snapshot.md.

Per ~/.claude/schemas/intel/OUTLINE_COVERAGE.md § 8.4: snapshot includes Tier 1 ONLY.
Tier 2 (data-model, api-spec, architecture, integrations) → pro-tier reads canonical (no snapshot ROI).
Tier 3 (business-context, nfr-catalog, security-design, infrastructure, cost-estimate, project-plan, handover-plan) → SDLC SKIPS entirely (doc-only).

Token budget: aim for 3-5K tokens output. Strategy:
- actor-registry: full table (usually small)
- permission-matrix: compact table (role.resource → actions)
- sitemap: routes table only — drop deep workflow_variants, retain auth_required + feature_id
- feature-catalog: ID + name + status + AC count + role-visibility (drop full description, business_intent, flow_summary)
- code-facts: aggregate counts (services, routes/service, entities/service, marker totals) — drop full route/entity detail
- system-inventory: tech-stack one-liner per tech (layer + name + version), services brief — drop vulnerability detail

Pro-tier agents read full JSON; base-tier reads snapshot. See SKILL.md.

Run: python generate.py [--intel-path PATH] [--check]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

CANONICAL_FILES = [
    "actor-registry.json",
    "permission-matrix.json",
    "sitemap.json",
    "feature-catalog.json",
    "code-facts.json",
    "system-inventory.json",
]


def _sha256(p: Path) -> str:
    if not p.exists():
        return ""
    return hashlib.sha256(p.read_bytes()).hexdigest()


def load_json_safe(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[WARN] Failed to parse {path}: {e}", file=sys.stderr)
        return None


def compress_actor_registry(data: dict) -> str:
    if not data:
        return "_(actor-registry.json missing)_\n"
    roles = data.get("roles", [])
    rbac_mode = data.get("rbac_mode", "unknown")
    auth = data.get("auth_method", "unknown")

    lines = [f"**RBAC mode:** `{rbac_mode}` | **Auth:** `{auth}`", ""]
    lines.append("| Slug | Display | Confidence |")
    lines.append("|---|---|---|")
    for r in roles:
        slug = r.get("slug", "?")
        name = r.get("display_name", "?")
        conf = r.get("confidence", "n/a")
        lines.append(f"| `{slug}` | {name} | {conf} |")
    return "\n".join(lines) + "\n"


def compress_permission_matrix(data: dict) -> str:
    if not data:
        return "_(permission-matrix.json missing)_\n"
    perms = data.get("permissions", [])
    if not perms:
        return "_(no permissions defined)_\n"

    # Group by role for compactness
    by_role: dict[str, list[str]] = {}
    for p in perms:
        role = p.get("role", "?")
        res = p.get("resource", "?")
        actions = p.get("actions", [])
        if isinstance(actions, list):
            actions_str = ",".join(actions)
        else:
            actions_str = str(actions)
        by_role.setdefault(role, []).append(f"{res}→{actions_str}")

    lines = ["| Role | Resource→Actions |", "|---|---|"]
    for role in sorted(by_role.keys()):
        entries = "; ".join(by_role[role])
        lines.append(f"| `{role}` | {entries} |")
    return "\n".join(lines) + "\n"


def compress_sitemap(data: dict) -> str:
    if not data:
        return "_(sitemap.json missing)_\n"
    routes = data.get("routes", [])
    if not routes:
        return "_(no routes defined)_\n"

    lines = ["| Path | Auth? | Feature | Confidence |", "|---|---|---|---|"]
    for r in routes:
        path = r.get("path", "?")
        auth = "yes" if r.get("auth_required") else "no"
        fid = r.get("feature_id", "-")
        conf = r.get("confidence", "n/a")
        lines.append(f"| `{path}` | {auth} | `{fid}` | {conf} |")
    return "\n".join(lines) + "\n"


def compress_feature_catalog(data: dict) -> str:
    if not data:
        return "_(feature-catalog.json missing)_\n"
    features = data.get("features", [])
    if not features:
        return "_(no features defined)_\n"

    lines = ["| ID | Name | Status | ACs | Roles | Confidence |",
             "|---|---|---|---|---|---|"]
    for f in features:
        fid = f.get("id", "?")
        name = f.get("name", "?")
        status = f.get("status", "?")
        acs = len(f.get("acceptance_criteria", []) or [])
        rv = f.get("role_visibility", []) or f.get("roles", [])
        if isinstance(rv, list):
            # role_visibility is array of {role, level} objects in current schema
            slugs = [item.get("role") if isinstance(item, dict) else item for item in rv]
            roles_str = ",".join(s for s in slugs if s) if slugs else "-"
        else:
            roles_str = str(rv)
        conf = f.get("confidence", "n/a")
        lines.append(f"| `{fid}` | {name} | {status} | {acs} | {roles_str} | {conf} |")
    return "\n".join(lines) + "\n"


def compress_code_facts(data: dict) -> str:
    """Aggregate-only view. Drop verbose route/entity details — base-tier rarely needs handler-level info."""
    if not data:
        return "_(code-facts.json missing)_\n"

    services = data.get("services", []) or []
    routes = data.get("routes", []) or []
    entities = data.get("entities", []) or []
    integrations = data.get("integrations", []) or []
    markers = data.get("markers", []) or []
    tests = (data.get("tests", {}) or {}).get("files", []) or []

    # Per-service aggregate
    routes_by_svc = Counter(r.get("service_id") for r in routes if r.get("service_id"))
    entities_by_svc = Counter(e.get("service_id") for e in entities if e.get("service_id"))
    marker_counts = Counter(m.get("kind") for m in markers if m.get("kind"))

    lines = [
        f"**Services:** {len(services)} | **Routes:** {len(routes)} | "
        f"**Entities:** {len(entities)} | **Integrations:** {len(integrations)} | "
        f"**Test files:** {len(tests)}",
        "",
    ]

    if services:
        lines.append("| Service | Kind | Lang/Framework | Routes | Entities |")
        lines.append("|---|---|---|---|---|")
        for s in services:
            sid = s.get("id", "?")
            kind = s.get("kind", "?")
            lang = s.get("language", "?")
            fw = s.get("framework") or "-"
            r_n = routes_by_svc.get(sid, 0)
            e_n = entities_by_svc.get(sid, 0)
            lines.append(f"| `{sid}` | {kind} | {lang}/{fw} | {r_n} | {e_n} |")
        lines.append("")

    if marker_counts:
        marker_summary = ", ".join(f"{k}:{v}" for k, v in marker_counts.most_common())
        lines.append(f"**Code markers:** {marker_summary}")

    return "\n".join(lines) + "\n"


def compress_system_inventory(data: dict) -> str:
    """Tech stack one-liner per tech. Drop vulnerability/license verbosity — pro-tier reads canonical when needed."""
    if not data:
        return "_(system-inventory.json missing)_\n"

    services = data.get("services", []) or []
    tech_stack = data.get("tech_stack", []) or []
    compliance = data.get("compliance", {}) or {}

    lines = []

    # Compliance header (single line)
    ipv6 = compliance.get("ipv6_readiness", "unknown")
    lines.append(f"**IPv6 readiness:** `{ipv6}` | **Services:** {len(services)} | **Tech stack:** {len(tech_stack)} entries")
    lines.append("")

    # Tech stack by layer
    if tech_stack:
        layered: dict[str, list[str]] = {}
        for t in tech_stack:
            layer = t.get("layer", "unknown")
            name = t.get("name", "?")
            version = t.get("version") or "-"
            cat = t.get("category", "?")
            layered.setdefault(layer, []).append(f"{name}@{version} ({cat})")

        lines.append("| CPĐT 4.0 Layer | Tech entries |")
        lines.append("|---|---|")
        # Stable layer order
        for layer in ["giao-dien", "nghiep-vu", "du-lieu", "ha-tang"]:
            entries = layered.pop(layer, [])
            if entries:
                lines.append(f"| `{layer}` | {'; '.join(entries)} |")
        # Any extra non-standard layers
        for layer, entries in layered.items():
            lines.append(f"| `{layer}` | {'; '.join(entries)} |")
        lines.append("")

    # Service-to-tech link (compact)
    if services:
        lines.append("| Service | Kind | Tech refs |")
        lines.append("|---|---|---|")
        for s in services:
            sid = s.get("id", "?")
            kind = s.get("kind", "?")
            refs = s.get("tech_stack_refs", []) or []
            refs_str = ",".join(refs) if refs else "-"
            lines.append(f"| `{sid}` | {kind} | {refs_str} |")

    return "\n".join(lines) + "\n"


def build_snapshot(intel_dir: Path) -> tuple[str, dict]:
    sources_sha = {}
    for fname in CANONICAL_FILES:
        sources_sha[fname] = _sha256(intel_dir / fname)

    actor = load_json_safe(intel_dir / "actor-registry.json")
    perms = load_json_safe(intel_dir / "permission-matrix.json")
    sitemap = load_json_safe(intel_dir / "sitemap.json")
    catalog = load_json_safe(intel_dir / "feature-catalog.json")
    code_facts = load_json_safe(intel_dir / "code-facts.json")
    sys_inv = load_json_safe(intel_dir / "system-inventory.json")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    md = f"""# Intel Snapshot (compressed — Tier 1 only)

> **Generated:** {now}
> **Generator:** `~/.cursor/skills/intel-snapshot/generate.py`
> **Sources (Tier 1 per OUTLINE_COVERAGE.md § 8.4):** {", ".join(f"`{f}`" for f in CANONICAL_FILES)}
>
> ⚠ **Base-tier agents (dev/qa/reviewer/ba/sa): use this for orientation only.** For deep decisions (security review, ADR, role design, schema migration) read the full canonical JSON files. Pro-tier agents (`*-pro`, `tech-lead`, `security`, `devops`, `data-governance`, `sre-observability`) MUST read full JSON.
>
> **Tier 2 (data-model, api-spec, architecture, integrations) NOT in snapshot — pro-tier reads canonical directly.**
> **Tier 3 (business-context, nfr-catalog, security-design, infrastructure, cost-estimate, project-plan, handover-plan) is doc-only — SDLC ignores entirely.**
>
> Staleness: see `_snapshot.meta.json` — re-run generator if canonical files changed.

## Roles & RBAC

{compress_actor_registry(actor)}

## Permissions (compact)

{compress_permission_matrix(perms)}

## Routes & Sitemap

{compress_sitemap(sitemap)}

## Features

{compress_feature_catalog(catalog)}

## Code Facts (aggregate)

{compress_code_facts(code_facts)}

## System Inventory (CPĐT 4.0 layered)

{compress_system_inventory(sys_inv)}

---

**For full detail (canonical sources):**
- Roles auth schemes / claim mappings → `actor-registry.json`
- Permission rationale + evidence → `permission-matrix.json`
- Workflow variants + Playwright hints → `sitemap.json`
- AC text, business intent, flow summary, error cases → `feature-catalog.json`
- Per-route handler symbol + entities_touched + auth_scope → `code-facts.json`
- Tech license + EOL + vulnerability counts → `system-inventory.json`

**Tier 2 (when work touches the area):**
- Schema columns + ERD + data dictionary → `data-model.json`
- Endpoint request/response schema + examples → `api-spec.json`
- 4 cpdt_layers + components + 3 architecture models → `architecture.json`
- LGSP/NGSP/CSDLQG metadata + auth methods → `integrations.json`
"""

    meta = {
        "generated_at": now,
        "generator": "intel-snapshot/generate.py",
        "intel_dir": str(intel_dir),
        "sources_sha256": sources_sha,
    }
    return md, meta


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--intel-path", default="docs/intel",
                   help="Intel directory (default: docs/intel relative to cwd)")
    p.add_argument("--check", action="store_true",
                   help="Verify snapshot freshness; exit 1 if stale")
    args = p.parse_args()

    intel_dir = Path(args.intel_path)
    if not intel_dir.is_absolute():
        intel_dir = Path.cwd() / intel_dir

    if not intel_dir.exists():
        print(f"[ERROR] Intel dir not found: {intel_dir}", file=sys.stderr)
        return 2

    md, meta = build_snapshot(intel_dir)
    snapshot_path = intel_dir / "_snapshot.md"
    meta_path = intel_dir / "_snapshot.meta.json"

    if args.check:
        if not snapshot_path.exists() or not meta_path.exists():
            print(f"[STALE] Snapshot missing at {snapshot_path}")
            return 1
        try:
            old_meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"[STALE] Cannot parse meta: {e}")
            return 1
        old_sha = old_meta.get("sources_sha256", {})
        if old_sha != meta["sources_sha256"]:
            diff = [k for k in meta["sources_sha256"] if old_sha.get(k) != meta["sources_sha256"][k]]
            print(f"[STALE] Snapshot out of sync. Changed: {diff}")
            return 1
        print(f"[OK] Snapshot fresh ({snapshot_path})")
        return 0

    snapshot_path.write_text(md, encoding="utf-8")
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    size_kb = len(md.encode("utf-8")) / 1024
    print(f"[WROTE] {snapshot_path} ({size_kb:.1f} KB ~ {int(size_kb * 250)} tokens)")
    print(f"[WROTE] {meta_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
