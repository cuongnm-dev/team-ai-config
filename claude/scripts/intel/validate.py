"""
Intel Layer schema validator.

Validates docs/intel/*.json against ~/.claude/schemas/intel/*.schema.json with
proper cross-schema $ref resolution via referencing.Registry.

Usage:
    python validate.py <intel_dir>
    python validate.py <intel_dir> --quick   (skip cross-reference integrity)

Exit codes: 0 OK, 1 schema/cross-ref errors, 2 missing intel dir, 3 validator
itself failed (missing dependencies, schemas, etc.).
"""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path

try:
    import jsonschema
    from referencing import Registry, Resource
    from referencing.jsonschema import DRAFT7
except ImportError as e:
    print(f"ERROR: required package missing: {e}", file=sys.stderr)
    print("Install: pip install jsonschema referencing", file=sys.stderr)
    sys.exit(3)

SCHEMA_FILES = {
    # Meta
    "_meta.json": "_meta.schema.json",
    # Tier 1 — mandatory cross-stage
    "actor-registry.json": "actor-registry.schema.json",
    "permission-matrix.json": "permission-matrix.schema.json",
    "sitemap.json": "sitemap.schema.json",
    "feature-catalog.json": "feature-catalog.schema.json",
    "test-accounts.json": "test-accounts.schema.json",
    "code-facts.json": "code-facts.schema.json",
    "system-inventory.json": "system-inventory.schema.json",
    # Tier 2 — optional cross-stage
    "data-model.json": "data-model.schema.json",
    "api-spec.json": "api-spec.schema.json",
    "architecture.json": "architecture.schema.json",
    "integrations.json": "integrations.schema.json",
    # Tier 3 — doc-only
    "business-context.json": "business-context.schema.json",
    "nfr-catalog.json": "nfr-catalog.schema.json",
    "security-design.json": "security-design.schema.json",
    "infrastructure.json": "infrastructure.schema.json",
    "cost-estimate.json": "cost-estimate.schema.json",
    "project-plan.json": "project-plan.schema.json",
    "handover-plan.json": "handover-plan.schema.json",
}

# Map "schema name" (without .schema.json suffix) → artifact filename
# Used by `--schema {name}` single-artifact mode invoked from skill hard-stop gates
SCHEMA_NAME_TO_ARTIFACT = {
    schema_name.replace(".schema.json", ""): artifact_name
    for artifact_name, schema_name in SCHEMA_FILES.items()
}


def build_registry(schemas_dir: Path) -> Registry:
    """Register every schema by both its $id and its filename so cross-refs work."""
    registry = Registry()
    for schema_path in schemas_dir.glob("*.schema.json"):
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        resource = Resource.from_contents(schema, default_specification=DRAFT7)
        # Register under $id (canonical URL)
        if "$id" in schema:
            registry = registry.with_resource(uri=schema["$id"], resource=resource)
        # Also register under bare filename for relative refs like "actor-registry.schema.json#/..."
        registry = registry.with_resource(uri=schema_path.name, resource=resource)
    return registry


def validate_artifact(artifact_path: Path, schema: dict, registry: Registry) -> list[str]:
    if not artifact_path.exists():
        return [f"MISSING: {artifact_path.name}"]
    try:
        instance = json.loads(artifact_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return [f"PARSE_ERROR {artifact_path.name}: {e}"]

    validator_cls = jsonschema.Draft7Validator
    validator = validator_cls(schema, registry=registry)
    errors = []
    for err in sorted(validator.iter_errors(instance), key=lambda e: e.path):
        path = "/".join(str(p) for p in err.path) or "<root>"
        errors.append(f"{path}: {err.message[:200]}")
    return errors


def _load(intel_dir: Path, name: str):
    p = intel_dir / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def confidence_tier_routing(intel_dir: Path) -> dict:
    """3-tier confidence routing per D4 (WORKFLOW_DESIGN.md § 0).

    Maps confidence enum to Syntex-style tier:
      - high | manual    → AUTO-ACCEPT (silent)
      - medium           → REVIEW QUEUE (1-click confirm)
      - low              → GAP (mark [CẦN BỔ SUNG], exclude from render)
      - (unset/missing)  → UNKNOWN (warning, treat as medium)

    Returns dict with per-artifact + aggregate tier counts.
    """
    artifacts_with_confidence = [
        ("actor-registry.json", "roles"),
        ("feature-catalog.json", "features"),
        ("permission-matrix.json", "permissions"),
        ("sitemap.json", "routes"),
        ("data-model.json", "entities"),
        ("api-spec.json", "endpoints"),
        ("architecture.json", "components"),
        ("integrations.json", "integrations"),
        ("nfr-catalog.json", "items"),
        ("security-design.json", "risk_analysis"),
        ("system-inventory.json", "services"),
    ]

    summary = {
        "auto_accept": [],         # high + manual
        "review_queue": [],        # medium
        "gap": [],                 # low
        "unknown": [],             # unset
        "totals": {"auto": 0, "review": 0, "gap": 0, "unknown": 0},
        "per_artifact": {},
    }

    for filename, list_field in artifacts_with_confidence:
        artifact = _load(intel_dir, filename)
        if not artifact:
            continue
        items = artifact.get(list_field, []) or []
        # Some artifacts use nested location (e.g. system-inventory.tech_stack)
        if not items and filename == "system-inventory.json":
            items = artifact.get("tech_stack", []) or []

        per_art = {"auto": 0, "review": 0, "gap": 0, "unknown": 0}
        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            conf = item.get("confidence", None)
            ident = item.get("id") or item.get("slug") or item.get("name") or f"#{idx}"
            entry = {"file": filename, "id": ident}
            if conf in ("high", "manual"):
                per_art["auto"] += 1
                summary["auto_accept"].append(entry)
            elif conf == "medium":
                per_art["review"] += 1
                summary["review_queue"].append(entry)
            elif conf == "low":
                per_art["gap"] += 1
                summary["gap"].append(entry)
            else:
                # unset or invalid value
                per_art["unknown"] += 1
                summary["unknown"].append(entry)

        if any(per_art.values()):
            summary["per_artifact"][filename] = per_art
            for k in ("auto", "review", "gap", "unknown"):
                summary["totals"][k] += per_art[k]

    return summary


def print_confidence_tier_report(tier_summary: dict, max_show: int = 10) -> None:
    """Print 3-section gap report per D4."""
    t = tier_summary["totals"]
    grand_total = t["auto"] + t["review"] + t["gap"] + t["unknown"]
    if grand_total == 0:
        return

    print("\n--- Confidence Tier Routing (D4) ---")
    print(f"  Total entries with confidence field: {grand_total}")
    print(f"  ✅ AUTO-ACCEPT  : {t['auto']}  (high + manual — silent OK)")
    print(f"  ⚠ REVIEW QUEUE : {t['review']}  (medium — user 1-click confirm)")
    print(f"  ❌ GAP          : {t['gap']}  (low — mark [CẦN BỔ SUNG])")
    if t["unknown"] > 0:
        print(f"  ⓘ UNKNOWN      : {t['unknown']}  (no confidence field — treat as medium)")

    if tier_summary["per_artifact"]:
        print("\n  Per-artifact breakdown:")
        for fname, counts in tier_summary["per_artifact"].items():
            parts = [f"{k}={v}" for k, v in counts.items() if v > 0]
            print(f"    {fname}: {' '.join(parts)}")

    if tier_summary["review_queue"]:
        print(f"\n  Review queue ({len(tier_summary['review_queue'])} entries — sample {max_show}):")
        for e in tier_summary["review_queue"][:max_show]:
            print(f"    - {e['file']} → {e['id']}")
        if len(tier_summary["review_queue"]) > max_show:
            print(f"    ... and {len(tier_summary['review_queue']) - max_show} more")

    if tier_summary["gap"]:
        print(f"\n  Gap entries ({len(tier_summary['gap'])} — needs [CẦN BỔ SUNG] or fill):")
        for e in tier_summary["gap"][:max_show]:
            print(f"    - {e['file']} → {e['id']}")
        if len(tier_summary["gap"]) > max_show:
            print(f"    ... and {len(tier_summary['gap']) - max_show} more")


def cross_reference_check(intel_dir: Path) -> tuple[list[str], list[str], list[str]]:
    """Tier-aware cross-reference integrity per README.md § Cross-Reference Integrity Rules.

    Returns (t1_issues, t2_issues, t3_issues) for tier-aware exit code computation.
    """
    t1, t2, t3 = [], [], []

    # Load all artifacts
    ar = _load(intel_dir, "actor-registry.json")
    pm = _load(intel_dir, "permission-matrix.json")
    sm = _load(intel_dir, "sitemap.json")
    fc = _load(intel_dir, "feature-catalog.json")
    ta = _load(intel_dir, "test-accounts.json")
    cf = _load(intel_dir, "code-facts.json")
    si = _load(intel_dir, "system-inventory.json")
    dm = _load(intel_dir, "data-model.json")
    api = _load(intel_dir, "api-spec.json")
    arch = _load(intel_dir, "architecture.json")
    ig = _load(intel_dir, "integrations.json")
    nfr = _load(intel_dir, "nfr-catalog.json")
    sec = _load(intel_dir, "security-design.json")
    bc = _load(intel_dir, "business-context.json")
    ce = _load(intel_dir, "cost-estimate.json")
    pp = _load(intel_dir, "project-plan.json")
    inf = _load(intel_dir, "infrastructure.json")
    hp = _load(intel_dir, "handover-plan.json")

    role_slugs = {r["slug"] for r in ar.get("roles", [])} if ar else set()

    # ===== Tier 1 — Mandatory cross-refs (block on violation) =====

    # Rule 1: permission.role ∈ actor-registry.roles[].slug ∪ {"*"}
    if pm and ar:
        for i, p in enumerate(pm.get("permissions", [])):
            if p["role"] != "*" and p["role"] not in role_slugs:
                t1.append(f"[T1.1] permission-matrix.permissions[{i}].role='{p['role']}' not in actor-registry")

    # Rule 2: permission.resource ∈ resources[].id ∪ prefix
    if pm:
        resource_ids = {r["id"] for r in pm.get("resources", [])}
        for i, p in enumerate(pm.get("permissions", [])):
            res = p["resource"]
            if res == "*" or res in resource_ids:
                continue
            if res.endswith(".*") and any(rid.startswith(res[:-2]) for rid in resource_ids):
                continue
            t1.append(f"[T1.2] permission-matrix.permissions[{i}].resource='{res}' not in resources[]")

    # Rule 3: sitemap.roles[].role ∈ actor-registry
    if sm and ar:
        for i, rn in enumerate(sm.get("roles", [])):
            if rn["role"] not in role_slugs:
                t1.append(f"[T1.3] sitemap.roles[{i}].role='{rn['role']}' not in actor-registry")

    # Rule 4: sitemap.routes[].auth.allowed_roles[] ⊆ actor-registry
    if sm and ar:
        for i, route in enumerate(sm.get("routes", [])):
            for r in route.get("auth", {}).get("allowed_roles", []):
                if r not in role_slugs:
                    t1.append(f"[T1.4] sitemap.routes[{i}].auth.allowed_roles contains '{r}' not in actor-registry")

    # Rule 6: feature-catalog.features[].role_visibility[].role ∈ actor-registry
    if fc and ar:
        for i, f in enumerate(fc.get("features", [])):
            for rv in f.get("role_visibility", []):
                if rv["role"] not in role_slugs:
                    t1.append(f"[T1.6] feature-catalog.features[{i}({f.get('id','?')})].role_visibility contains '{rv['role']}' not in actor-registry")

    # Rule 7: feature-catalog.features[].routes[] ⊆ sitemap.routes[].path
    if fc and sm:
        sitemap_paths = {r["path"] for r in sm.get("routes", [])}
        for i, f in enumerate(fc.get("features", [])):
            for rp in f.get("routes", []):
                if rp not in sitemap_paths:
                    t1.append(f"[T1.7] feature-catalog.features[{i}({f.get('id','?')})].routes contains '{rp}' not in sitemap.routes")

    # Rule 8: test-accounts.accounts[].role_slug ∈ actor-registry
    if ta and ar:
        for i, acc in enumerate(ta.get("accounts", [])):
            if acc.get("role_slug") and acc["role_slug"] not in role_slugs:
                t1.append(f"[T1.8] test-accounts.accounts[{i}].role_slug='{acc['role_slug']}' not in actor-registry")

    # Rule 9: code-facts.services[].id ↔ system-inventory.services[].id alignment
    if cf and si:
        cf_svc = {s["id"] for s in cf.get("services", [])}
        si_svc = {s["id"] for s in si.get("services", [])}
        only_cf = cf_svc - si_svc
        only_si = si_svc - cf_svc
        for sid in only_cf:
            t1.append(f"[T1.9] code-facts.services has '{sid}' but system-inventory does not")
        for sid in only_si:
            t1.append(f"[T1.9] system-inventory.services has '{sid}' but code-facts does not")

    # ===== Tier 2 — Cross-stage cross-refs (warn on violation) =====

    # Rule 10: api-spec.endpoints[].path ↔ sitemap.routes[].path
    if api and sm:
        sitemap_paths = {r["path"] for r in sm.get("routes", [])}
        api_paths = {e["path"] for e in api.get("endpoints", [])}
        for ep in api.get("endpoints", []):
            if ep["path"] not in sitemap_paths:
                t2.append(f"[T2.10] api-spec.endpoints[{ep['operation_id']}] path='{ep['path']}' not in sitemap.routes")
        for r in sm.get("routes", []):
            if r["path"] not in api_paths:
                t2.append(f"[T2.10] sitemap.routes path='{r['path']}' has no corresponding api-spec.endpoints entry")

    # Rule 11: architecture.components[].owned_entities[] ⊆ data-model.entities[].name
    if arch and dm:
        entity_names = {e["name"] for e in dm.get("entities", [])}
        for c in arch.get("components", []):
            for ent in c.get("owned_entities", []):
                if ent not in entity_names:
                    t2.append(f"[T2.11] architecture.components['{c['name']}'].owned_entities contains '{ent}' not in data-model.entities")

    # Rule 12: architecture.components[].integrations_consumed[] ⊆ integrations.integrations[].id
    if arch and ig:
        integration_ids = {i["id"] for i in ig.get("integrations", [])}
        for c in arch.get("components", []):
            for iid in c.get("integrations_consumed", []):
                if iid not in integration_ids:
                    t2.append(f"[T2.12] architecture.components['{c['name']}'].integrations_consumed contains '{iid}' not in integrations.integrations")

    # Rule 13: architecture.cpdt_layers[] MUST cover all 4 layers
    if arch:
        layers_present = {l["layer"] for l in arch.get("cpdt_layers", [])}
        layers_required = {"giao-dien", "nghiep-vu", "du-lieu", "ha-tang"}
        missing_layers = layers_required - layers_present
        if missing_layers:
            t2.append(f"[T2.13] architecture.cpdt_layers missing required CPĐT 4.0 layers: {sorted(missing_layers)}")

    # Rule 14: architecture.components[] count ≥ 3 (TKKT minimum)
    if arch and len(arch.get("components", [])) < 3:
        t2.append(f"[T2.14] architecture.components count ({len(arch.get('components', []))}) < 3 — TKKT minimum violated")

    # Rule 15: architecture.models.{overall,logical,physical}_diagram all present (TKCS Đ13)
    if arch:
        models = arch.get("models", {})
        for k in ["overall_diagram", "logical_diagram", "physical_diagram"]:
            if not models.get(k):
                t2.append(f"[T2.15] architecture.models.{k} missing — TKCS §3.3 Đ13 mandate (3 mô hình)")

    # Rule 16: integrations.integrations[].consuming_components[] ⊆ architecture.components[].name
    if ig and arch:
        comp_names = {c["name"] for c in arch.get("components", [])}
        for i, integration in enumerate(ig.get("integrations", [])):
            for cn in integration.get("consuming_components", []):
                if cn not in comp_names:
                    t2.append(f"[T2.16] integrations[{integration.get('id','?')}].consuming_components contains '{cn}' not in architecture.components")

    # ===== Tier 3 — Doc-only cross-refs (block at writer level only) =====

    # Rule 17: nfr-catalog.items[] count ≥ 7 (TKKT §9 minimum)
    if nfr and len(nfr.get("items", [])) < 7:
        t3.append(f"[T3.17] nfr-catalog.items count ({len(nfr.get('items', []))}) < 7 — TKKT §9 minimum violated")

    # Rule 18: security-design.attt_level ∈ {1..5}
    if sec and sec.get("attt_level") not in {1, 2, 3, 4, 5}:
        t3.append(f"[T3.18] security-design.attt_level={sec.get('attt_level')} not in {{1,2,3,4,5}} — NĐ 85/2016 violation")

    # Rule 19: security-design.risk_analysis[] count ≥ 3
    if sec and len(sec.get("risk_analysis", [])) < 3:
        t3.append(f"[T3.19] security-design.risk_analysis count ({len(sec.get('risk_analysis', []))}) < 3 — threat-model minimum")

    # Rule 20: cost-estimate.summary[] covers 6 mandatory line items
    if ce:
        codes = {item.get("item_code") for item in ce.get("summary", [])}
        required = {"I", "II", "III", "IV", "V", "VI"}
        missing = required - codes
        if missing:
            t3.append(f"[T3.20] cost-estimate.summary missing mandatory line items: {sorted(missing)}")

    # Rule 21: business-context.legal_basis[] count ≥ 3
    if bc and len(bc.get("legal_basis", [])) < 3:
        t3.append(f"[T3.21] business-context.legal_basis count ({len(bc.get('legal_basis', []))}) < 3")

    # Rule 22: business-context.objectives.specific[] count ≥ 3
    if bc and len((bc.get("objectives", {}) or {}).get("specific", [])) < 3:
        t3.append(f"[T3.22] business-context.objectives.specific count < 3")

    # Rule 23: business-context.pain_points[] count ≥ 3
    if bc and len(bc.get("pain_points", [])) < 3:
        t3.append(f"[T3.23] business-context.pain_points count ({len(bc.get('pain_points', []))}) < 3")

    # Rule 24: infrastructure.hardware[] non-empty when on-premise
    if inf:
        if inf.get("deployment_model", {}).get("type") == "on-premise" and not inf.get("hardware"):
            t3.append(f"[T3.24] infrastructure.hardware empty but deployment_model.type=on-premise")

    # Rule 25: handover-plan.training[] non-empty AND warranty.period_months ≥ 12
    if hp:
        if not hp.get("training"):
            t3.append(f"[T3.25] handover-plan.training is empty")
        wp = hp.get("warranty", {}).get("period_months")
        if wp is not None and wp < 12:
            t3.append(f"[T3.25] handover-plan.warranty.period_months={wp} < 12")

    # Rule 26: permission-matrix.uncovered_resources[] non-empty (warning only)
    # Counted as info; not appended to t1/t2/t3 (no severity tier)

    return t1, t2, t3


def main():
    ap = argparse.ArgumentParser(
        description="Intel Layer schema validator. Two modes: directory-wide (default) or single-artifact (--schema).",
    )
    ap.add_argument(
        "target",
        help="Either intel directory (e.g. docs/intel/) OR single artifact path (e.g. docs/intel/code-facts.json) when --schema is set.",
    )
    ap.add_argument("--quick", action="store_true", help="Skip cross-reference checks (only schema validation)")
    ap.add_argument("--schemas-dir", default=str(Path.home() / ".claude" / "schemas" / "intel"))
    ap.add_argument(
        "--schema",
        choices=sorted(SCHEMA_NAME_TO_ARTIFACT.keys()),
        help="Single-artifact mode — validate ONLY the artifact whose schema name is given. Used by from-code/from-doc hard-stop gates.",
    )
    ap.add_argument(
        "--strict",
        action="store_true",
        help="Tier-aware bitmask exit codes: 0=clean | 1=T1 errors | 2=T2 errors | 4=T3 errors | 8=schema/structural errors. OR-able when multiple tiers fail (e.g. exit 5 = T1+T3). Default: legacy 0/1/2/3.",
    )
    args = ap.parse_args()

    target = Path(args.target)
    schemas_dir = Path(args.schemas_dir)
    if not schemas_dir.exists():
        print(f"ERROR: schemas dir {schemas_dir} not found", file=sys.stderr)
        sys.exit(3)

    registry = build_registry(schemas_dir)

    # ---- Single-artifact mode (--schema provided) ----
    if args.schema:
        # target may be either a file or a directory; in single-artifact mode prefer file
        artifact_filename = SCHEMA_NAME_TO_ARTIFACT[args.schema]
        if target.is_dir():
            artifact_path = target / artifact_filename
        else:
            artifact_path = target
        if not artifact_path.exists():
            print(f"ERROR: artifact {artifact_path} does not exist", file=sys.stderr)
            sys.exit(2)
        schema_path = schemas_dir / SCHEMA_FILES[artifact_filename]
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        errors = validate_artifact(artifact_path, schema, registry)
        if errors:
            print(f"  FAIL  {artifact_path.name} (schema: {args.schema})")
            for e in errors:
                print(f"          {e}")
            print(f"\nFAIL: {len(errors)} issue(s)")
            sys.exit(1)
        print(f"  OK    {artifact_path.name} (schema: {args.schema})")
        sys.exit(0)

    # ---- Directory-wide mode (default) ----
    intel_dir = target
    if not intel_dir.exists():
        print(f"ERROR: {intel_dir} does not exist", file=sys.stderr)
        sys.exit(2)

    schema_errors = 0
    for artifact_name, schema_name in SCHEMA_FILES.items():
        artifact_path = intel_dir / artifact_name
        if not artifact_path.exists():
            print(f"  SKIP  {artifact_name} (not produced yet)")
            continue
        schema = json.loads((schemas_dir / schema_name).read_text(encoding="utf-8"))
        errors = validate_artifact(artifact_path, schema, registry)
        if errors:
            print(f"  FAIL  {artifact_name}")
            for e in errors:
                print(f"          {e}")
            schema_errors += len(errors)
        else:
            print(f"  OK    {artifact_name}")

    # Per-feature test-evidence iteration (test-evidence is per-feature subdir pattern)
    test_evidence_dir = intel_dir / "test-evidence"
    if test_evidence_dir.is_dir():
        te_schema_path = schemas_dir / "test-evidence.schema.json"
        if te_schema_path.exists():
            te_schema = json.loads(te_schema_path.read_text(encoding="utf-8"))
            for evidence_file in sorted(test_evidence_dir.glob("*.json")):
                errors = validate_artifact(evidence_file, te_schema, registry)
                rel_name = f"test-evidence/{evidence_file.name}"
                if errors:
                    print(f"  FAIL  {rel_name}")
                    for e in errors:
                        print(f"          {e}")
                    schema_errors += len(errors)
                else:
                    print(f"  OK    {rel_name}")
        else:
            print(f"  SKIP  test-evidence/* (schema {te_schema_path.name} not found)")

    t1_errors, t2_errors, t3_errors = [], [], []
    if not args.quick:
        print("\n--- Cross-reference integrity (tier-aware) ---")
        t1_errors, t2_errors, t3_errors = cross_reference_check(intel_dir)
        for issue in t1_errors:
            print(f"  XREF[T1] {issue}")
        for issue in t2_errors:
            print(f"  XREF[T2] {issue}")
        for issue in t3_errors:
            print(f"  XREF[T3] {issue}")
        if not (t1_errors or t2_errors or t3_errors):
            print("  OK    all cross-references resolve (T1+T2+T3)")

        # D4 — 3-tier confidence routing report
        tier_summary = confidence_tier_routing(intel_dir)
        print_confidence_tier_report(tier_summary)

    total = schema_errors + len(t1_errors) + len(t2_errors) + len(t3_errors)
    print(
        f"\n{'PASS' if total == 0 else 'FAIL'}: {total} issue(s) "
        f"[schema:{schema_errors} t1:{len(t1_errors)} t2:{len(t2_errors)} t3:{len(t3_errors)}]"
    )

    if args.strict:
        # Tier-aware bitmask: 1=T1 | 2=T2 | 4=T3 | 8=schema (OR-able)
        code = 0
        if t1_errors:
            code |= 1
        if t2_errors:
            code |= 2
        if t3_errors:
            code |= 4
        if schema_errors:
            code |= 8
        sys.exit(code)
    else:
        # Legacy: 0 OK | 1 any error
        sys.exit(0 if total == 0 else 1)


if __name__ == "__main__":
    main()
