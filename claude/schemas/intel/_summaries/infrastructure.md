# Schema Summary — Infrastructure

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/infrastructure.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): TKCS (§4), TKCT (§6)
> **Writer voice hint**: Reference (deployment + hardware catalog)

## Purpose

Deployment model, hardware catalog, network topology, environments. Tier 3 doc-only — resume-feature SKIPS (devops sources from terraform/k8s manifests, not this JSON). Producer: from-doc (interview-driven for hardware list + sizing). Consumed by tdoc-tkcs-writer §4 (entirely) + tdoc-tkct-writer §6. Hard-stop in from-doc Phase 8 if deployment_model.type empty OR hardware[] = 0 (when on-prem). Justified by: TKCS §4.1-4.3, TKCT §6.1-6.4.

## Required top-level fields

- `schema_version`
- `deployment_model`

## Field structure (depth ≤ 2)

- `schema_version` (string) [const='1.0'] **REQUIRED**
- `deployment_model` (object {...}) **REQUIRED** — TKCS §4.1 + TKCT §6.4 source.
  - `type` (enum ['on-premise', 'cloud-public', 'cloud-private', 'hybrid', 'edge']) **REQUIRED**
  - `rationale` (string | null) [min_chars=50] — Why this model. Min 50 chars Vietnamese.
  - `cloud_provider` (string | null) — When cloud: 'VNPT Cloud', 'Viettel Cloud', 'AWS', etc. Prefer VN providers per CT 34.
  - `datacenter_location` (string | null) — Geographic location. VN-resident requirement for sensitive data.
  - `datacenter_tier` (enum ['Tier-I', 'Tier-II', 'Tier-III', 'Tier-IV', 'unknown', None])
- `hardware` (array<object {...}>) — TKCS §4.2 hardware catalog with cost. Each row maps to a line item in dự toán.
  - **(each array item)**:
    - `item_type` (string) **REQUIRED**
    - `name` (string) — Display name.
    - `spec` (string) **REQUIRED** — Hardware specifications. Example: 'Intel Xeon Silver 4310, 64GB DDR4, 2x 1TB NVMe RAID 1'.
    - `quantity` (integer) [min=1] **REQUIRED**
    - `unit_price_vnd` (integer | null) [min=0]
    - `total_price_vnd` (integer | null) [min=0]
    - `vendor` (string | null)
    - `warranty_years` (integer | null) [min=0]
    - `deployment_role` (string | null) — Free-form: 'app server', 'db primary', 'backup target', etc.
    - `notes` (string | null)
- `servers` (array<object {...}>) — TKCT §6.2 server config table. Logical servers (may map to physical hardware[] or VMs).
  - **(each array item)**:
    - `role` (string) **REQUIRED** — Server role. Example: 'Web Server', 'Application Server', 'Database Primary', 'Cache'.
    - `hostname_pattern` (string | null) — Naming convention.
    - `cpu` (string) **REQUIRED** — Free-form. Example: '8 vCPU' or 'Intel Xeon 4310 @ 2.1GHz x2'.
    - `ram_gb` (integer) [min=1] **REQUIRED**
    - `storage` (string) **REQUIRED** — Free-form. Example: '500GB SSD + 4TB HDD'.
    - `os` (string | null) — Operating system. Example: 'Ubuntu 22.04 LTS', 'Windows Server 2022'.
    - `count` (integer) [min=1] — Number of instances of this server role.
    - `deployed_services` (array<string>) — system-inventory.services[].id deployed on this server.
    - `ha_strategy` (enum ['active-active', 'active-passive', 'single', 'load-balanced', None])
- `network` (object {...}) — TKCS §4.3 + TKCT §6.3 source.
  - `topology_diagram` (string | null) — Mermaid graph LR or path to diagram file.
  - `zones` (array<object {...}>) — Network zones. Cross-ref security-design.network_security.zones[] for security boundaries.
  - `vlans` (array<object {...}>)
  - `ipv6_plan` (string | null) — IPv6 deployment plan. TKCS §3.5 mandate. Cross-ref security-design.ipv6_readiness.
  - `internet_egress_policy` (string | null)
  - `bandwidth_internal_mbps` (integer | null) [min=0]
  - `bandwidth_internet_mbps` (integer | null) [min=0]
- `environments` (array<object {...}>) — TKCT §6.4 source. Cross-ref system-inventory.runtime_environments[] for runtime config.
  - **(each array item)**:
    - `name` (string) **REQUIRED** — dev | staging | uat | prod | dr.
    - `purpose` (string) **REQUIRED**
    - `sizing_summary` (string | null) — Free-form: 'minimal — 2 servers', 'production-grade'.
    - `access_control` (string | null) — Who can access this env.
    - `data_isolation` (enum ['full', 'anonymized-prod-copy', 'synthetic', 'shared', None])
    - `url` (string | null)
- `high_availability` (object | null) — HA strategy at infra level. Cross-ref nfr-catalog availability NFRs.
- `warnings` (array<object {...}>)
  - **(each array item)**:
    - `severity` (enum ['high', 'medium', 'low']) **REQUIRED**
    - `category` (string)
    - `message` (string) **REQUIRED**

## Critical constraints (quick reference for emit/validate)

- `deployment_model.rationale` — min_chars=50

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `infrastructure.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/infrastructure.schema.json`