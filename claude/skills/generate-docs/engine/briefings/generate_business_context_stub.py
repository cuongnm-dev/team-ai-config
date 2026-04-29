"""Generate a starter `business-context.json` from existing intel files.

The briefing system needs business-context.json for two cross-cutting purposes:
  1. `module_lexicon`        — maps module slugs (m01, m02) to user-friendly VN
                                names (e.g. "Quản lý người dùng"). Used by
                                tropes when transforming routes → menu names.
  2. `external_integrations` — declares project-specific proper nouns that
                                merge with skill's baseline allowed list.

This stub generator produces a skeleton with `[CẦN BỔ SUNG]` markers for
fields the user must fill. It does NOT invent values; it extracts what's
inferable from intel and leaves the rest as placeholders.

Usage:
    python generate_business_context_stub.py \
      --intel-dir D:/Projects/foo/docs/intel \
      --out       D:/Projects/foo/docs/intel/business-context.json

Idempotent: refuses to overwrite existing file unless --force.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Reuse canonical_facts loader from the same package.
sys.path.insert(0, str(Path(__file__).parent))
from canonical_facts import field_at, load_canonical_facts


PLACEHOLDER = "[CẦN BỔ SUNG]"


def build_stub(facts: dict) -> dict:
    """Assemble a starter business-context dict using whatever intel exposes."""
    # Module lexicon — try sitemap titles first (already VN-friendly),
    # fall back to feature names mapped by module.
    module_lexicon: dict[str, str] = {}
    sitemap_groups = field_at(facts, "sitemap.services.web-admin.route_groups") or []
    if not sitemap_groups:
        # Look for any service's route_groups
        services = field_at(facts, "sitemap.services") or {}
        for svc in services.values():
            if isinstance(svc, dict) and svc.get("route_groups"):
                sitemap_groups = svc["route_groups"]
                break
    for rg in sitemap_groups:
        if isinstance(rg, dict) and rg.get("id") and rg.get("title"):
            module_lexicon[rg["id"]] = rg["title"]

    # If no sitemap, derive from feature module + name (best effort)
    if not module_lexicon:
        features = field_at(facts, "feature_catalog.features") or []
        for fe in features:
            mod = fe.get("module") if isinstance(fe, dict) else None
            name = fe.get("name") if isinstance(fe, dict) else None
            if mod and name and mod not in module_lexicon:
                # strip trailing module-id suffix from name (e.g. "Foo (M01)" → "Foo")
                clean = name.rsplit(" (", 1)[0].strip() if " (" in name else name
                module_lexicon[mod] = clean

    # External integrations — extract from integrations.json if present
    external_integrations = []
    ext_systems = field_at(facts, "integrations.external_systems") or []
    for ext in ext_systems:
        if isinstance(ext, dict) and ext.get("name"):
            external_integrations.append({
                "name": ext.get("name"),
                "purpose": ext.get("purpose") or PLACEHOLDER,
                "integration_type": ext.get("integration_type") or PLACEHOLDER,
            })

    # Role display lexicon — extract from actor-registry
    role_lexicon: dict[str, str] = {}
    roles = field_at(facts, "actor_registry.roles") or []
    for role in roles:
        if isinstance(role, dict) and role.get("slug"):
            role_lexicon[role["slug"]] = role.get("display_name") or PLACEHOLDER

    # System name — from system-inventory if available
    system_name = field_at(facts, "system_inventory.system.name") or PLACEHOLDER
    organization = field_at(facts, "system_inventory.system.organization") or PLACEHOLDER
    description = field_at(facts, "system_inventory.system.description") or PLACEHOLDER

    return {
        "_generated_by": "briefings/generate_business_context_stub.py",
        "_instructions": (
            "Fill all [CẦN BỔ SUNG] markers with project-specific values. "
            "module_lexicon + external_integrations affect briefings (tropes); "
            "current_system + investment + stakeholders are required by TKCS Section 3 (≥10 numeric values, ≥7 legal refs)."
        ),

        # ─── Domain identity ───
        "domain": PLACEHOLDER + " (e.g. 'customs-clearance' / 'doc-management' / 'tax-admin')",

        # ─── Organization (TKCS Section 1) ───
        "organization": {
            "name": organization,
            "name_full": PLACEHOLDER,
            "type": PLACEHOLDER + " (e.g. 'Cơ quan trung ương' / 'Sở chuyên ngành')",
            "level": PLACEHOLDER + " (central / provincial / district)",
            "address": PLACEHOLDER,
            "investor_role": "Chủ đầu tư",
        },

        # ─── Current system (TKCS Section 3 — needs ≥10 numbers) ───
        "current_system": {
            "name": PLACEHOLDER + " (current system being replaced/upgraded)",
            "deployment_year": PLACEHOLDER,
            "vendor": PLACEHOLDER,
            "current_version": PLACEHOLDER,
            "user_count_internal": PLACEHOLDER,
            "user_count_external": PLACEHOLDER,
            "transaction_volume_monthly": PLACEHOLDER,
            "transaction_volume_peak_daily": PLACEHOLDER,
            "uptime_percent": PLACEHOLDER,
            "avg_response_time_ms": PLACEHOLDER,
            "error_rate_percent": PLACEHOLDER,
            "eol_dates": {
                "hardware": PLACEHOLDER,
                "database_version": PLACEHOLDER,
                "os": PLACEHOLDER,
            },
            "pain_points": [
                PLACEHOLDER + " (specific metric — e.g. 'Hệ thống quá tải mùa cao điểm, downtime trung bình N giờ/quý')",
                PLACEHOLDER,
                PLACEHOLDER,
            ],
        },

        # ─── Compliance & ATTT (TKCS Section 7) ───
        "compliance_requirements": {
            "data_classification": PLACEHOLDER + " (e.g. 'PII công dân + tài chính doanh nghiệp')",
            "applicable_regulations": [
                PLACEHOLDER + " (e.g. 'Luật ... số .../QH...')",
                PLACEHOLDER,
                PLACEHOLDER,
                PLACEHOLDER,
                PLACEHOLDER,
                PLACEHOLDER,
                PLACEHOLDER,
            ],
            "security_level_attt": {
                "level": PLACEHOLDER + " (cấp độ N theo NĐ 85/2016 Đ7)",
                "rationale_5_criteria": {
                    "phạm_vi_ảnh_hưởng": PLACEHOLDER,
                    "quy_mô_dữ_liệu": PLACEHOLDER,
                    "mức_độ_nhạy_cảm": PLACEHOLDER,
                    "mức_độ_công_khai": PLACEHOLDER,
                    "hậu_quả_sự_cố": PLACEHOLDER,
                },
            },
        },

        # ─── Investment (TKCS Section 10) ───
        "investment": {
            "investment_type": PLACEHOLDER + " (e.g. 'Đầu tư xây dựng mới')",
            "funding_source": PLACEHOLDER + " (e.g. 'Ngân sách Nhà nước Trung ương')",
            "project_duration_months": PLACEHOLDER,
            "start_year": PLACEHOLDER,
            "end_year": PLACEHOLDER,
            "total_investment_billion_vnd": PLACEHOLDER,
            "operating_cost_yearly_billion_vnd": PLACEHOLDER,
            "warranty_months": PLACEHOLDER,
            "decision_authority": PLACEHOLDER,
            "approval_decision": PLACEHOLDER,
        },

        # ─── Stakeholders (TKCS Section 11) ───
        "stakeholders": {
            "investor": organization if organization != PLACEHOLDER else PLACEHOLDER,
            "operator": PLACEHOLDER,
            "primary_users": [PLACEHOLDER, PLACEHOLDER, PLACEHOLDER],
            "project_management_form": PLACEHOLDER,
            "pm_method": PLACEHOLDER,
        },

        # ─── Timeline (TKCS Section 9) ───
        "timeline": {
            "milestones": [
                PLACEHOLDER + " (M1 — phê duyệt chủ trương: tháng/năm)",
                PLACEHOLDER + " (M2 — phê duyệt TKCS)",
                PLACEHOLDER + " (M3 — đấu thầu)",
                PLACEHOLDER + " (M4 — pilot)",
                PLACEHOLDER + " (M5 — diện rộng)",
                PLACEHOLDER + " (M6 — nghiệm thu)",
            ],
        },

        # ─── Objectives (TKCS Section 3c) ───
        "objectives": {
            "primary_goals": [
                PLACEHOLDER + " (e.g. 'Hiện đại hóa nền tảng theo CT 34/CT-TTg')",
                PLACEHOLDER,
                PLACEHOLDER,
            ],
            "kpi_targets": {
                "uptime_target": PLACEHOLDER,
                "response_time_target_ms": PLACEHOLDER,
                "concurrent_users_target": PLACEHOLDER,
                "throughput_target_tps": PLACEHOLDER,
            },
        },

        # ─── Project-specific lexicon (drives briefing tropes) ───
        "module_lexicon": module_lexicon if module_lexicon else {
            PLACEHOLDER + "_module_id": PLACEHOLDER + "_user_friendly_name",
        },
        "role_display_lexicon": role_lexicon if role_lexicon else {
            PLACEHOLDER + "_role_slug": PLACEHOLDER + "_role_display",
        },
        "external_integrations": external_integrations if external_integrations else [
            {"name": PLACEHOLDER, "purpose": PLACEHOLDER, "integration_type": PLACEHOLDER},
        ],

        # ─── System summary (used by TKKT) ───
        "system_name": system_name,
        "system_description": description,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Generate business-context.json stub from intel")
    p.add_argument("--intel-dir", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--force", action="store_true", help="overwrite if exists")
    args = p.parse_args(argv)

    intel_dir = Path(args.intel_dir)
    out_path = Path(args.out)

    if out_path.exists() and not args.force:
        print(f"✗ {out_path} already exists. Use --force to overwrite.", file=sys.stderr)
        return 1

    facts = load_canonical_facts(intel_dir)
    stub = build_stub(facts)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(stub, ensure_ascii=False, indent=2), encoding="utf-8")

    placeholder_count = json.dumps(stub).count(PLACEHOLDER)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print(f"✓ Stub written: {out_path}")
    print(f"  Module lexicon entries auto-derived: {len(stub.get('module_lexicon', {}))}")
    print(f"  Role lexicon entries auto-derived:   {len(stub.get('role_display_lexicon', {}))}")
    print(f"  External integrations auto-derived:  {len(stub.get('external_integrations', []))}")
    print(f"  [CẦN BỔ SUNG] markers to fill:       {placeholder_count}")
    print(f"  Files loaded from intel:             {facts['_meta']['files_loaded']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
