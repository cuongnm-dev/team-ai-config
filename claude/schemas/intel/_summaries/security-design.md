# Schema Summary — Security Design

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/security-design.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): TKCT (§5), TKKT (§10), TKCS (§3.5)
> **Writer voice hint**: Reference + Explanation (security architecture + threat rationale)

## Purpose

Security architecture: ATTT level (NĐ 85/2016), risk analysis, encryption, logging, incident response, IPv6 readiness. Tier 3 doc-only — resume-feature SKIPS (security agent MAY peek for threat verification, optional). Producer: from-doc (threat model + policy) + from-code (encryption/audit detection). Consumed by tdoc-tkcs-writer §3.5 + tdoc-tkct-writer §5 (entirely) + tdoc-tkkt-writer §10. Hard-stop in from-doc Phase 8 if attt_level empty OR risk_analysis < 3 threats. Justified by: TKCS §3.5 (Đ13 ATTT mandate), TKCT §5 (entirely), TKKT §10.

## Required top-level fields

- `schema_version`
- `attt_level`
- `ipv6_readiness`
- `risk_analysis`

## Field structure (depth ≤ 2)

- `schema_version` (string) [const='1.0'] **REQUIRED**
- `attt_level` (integer) [min=1, max=5] **REQUIRED** — ATTT cấp độ per NĐ 85/2016/NĐ-CP. 1=public info | 2=internal | 3=confidential | 4=secret | 5=top-secret. TKCS §3.5 + TKKT §10.2 mandate.
- `attt_level_rationale` (string) [min_chars=50] — Why this level was chosen (data sensitivity, stakeholder analysis, regulatory requirement).
- `ipv6_readiness` (string) **REQUIRED** — Per QĐ 292 + Đề án IPv6 Quốc gia. TKCS §3.5 + TKKT §10.6 mandate.
- `ipv6_plan` (string | null) — If readiness != ready, narrative roadmap to full IPv6 support.
- `risk_analysis` (array<object {...}>) [min_items=3] **REQUIRED** — Threat model. Min 3 threats per from-doc Phase 8 hard-stop. TKCT §5.1 source.
  - **(each array item)**:
    - `id` (string) [pattern='^TH-[0-9]{3,}$'] **REQUIRED**
    - `threat` (string) [min_chars=30] **REQUIRED** — Vietnamese threat description.
    - `category` (string)
    - `likelihood` (enum ['very-high', 'high', 'medium', 'low', 'very-low']) **REQUIRED**
    - `impact` (enum ['catastrophic', 'major', 'moderate', 'minor', 'negligible']) **REQUIRED**
    - `mitigation` (string) [min_chars=30] **REQUIRED** — Concrete countermeasures.
    - `residual_risk` (string | null) — Remaining risk after mitigation.
    - `owner` (string | null) — Role/team responsible.
- `authentication` (object {...}) — Authentication design. TKCT §5.2 source.
  - `primary_scheme` (enum (one of 7 values))
  - `mfa_required` (boolean)
  - `mfa_methods` (array<enum (one of 7 values)>)
  - `sso` (object | null)
  - `session_policy` (object | null)
  - `password_policy` (object | null)
- `authorization` (object {...}) — Authorization model. TKCT §5.2. Cross-ref permission-matrix.json for the matrix itself.
  - `model` (enum ['rbac', 'abac', 'acl', 'hybrid'])
  - `permission_matrix_ref` (string) — Pointer to canonical RBAC matrix.
  - `principle_of_least_privilege` (boolean)
  - `segregation_of_duties` (boolean)
  - `approval_workflow_for_privileged_actions` (boolean)
- `encryption` (object {...}) — Encryption strategy. TKCT §5.3 source.
  - `at_rest` (object {...})
  - `in_transit` (object {...})
  - `key_management` (object {...})
- `logging_and_audit` (object {...}) — TKCT §5.4 source.
  - `log_categories` (array<enum (one of 9 values)>)
  - `retention_days` (integer | null) [min=0]
  - `centralization_tool` (string | null) — Example: 'ELK', 'Splunk', 'Loki'.
  - `monitoring_tool` (string | null)
  - `alerts` (array<object {...}>)
  - `siem_integration` (boolean)
  - `tamper_protection` (boolean) — Logs immutable / signed.
- `incident_response` (object {...}) — TKCT §5.5 source.
  - `rpo_minutes` (integer | null) [min=0] — Recovery Point Objective in minutes.
  - `rto_minutes` (integer | null) [min=0] — Recovery Time Objective in minutes.
  - `playbook_doc_ref` (string | null) — Path to incident response playbook.
  - `escalation_levels` (array<object {...}>)
  - `tabletop_drill_frequency` (string | null) — Free-form: 'quarterly', 'annual'.
  - `last_drill_date` (string | null) [format=date]
- `network_security` (object {...}) — Network-layer protections. TKKT §10.1 + TKCT §6.3 source.
  - `zones` (array<object {...}>)
  - `firewall_strategy` (string | null)
  - `waf_used` (boolean)
  - `ddos_protection` (boolean)
  - `vpn_required_for_admin` (boolean)
- `compliance` (object {...}) — Compliance posture for TKKT §10.5 + audit trail.
  - `certifications_held` (array<string>) — Examples: 'ISO/IEC 27001:2022', 'TCVN 11930:2017'.
  - `audits` (array<object {...}>)
  - `data_protection_impact_assessment_done` (boolean) — DPIA per NĐ 13/2023 (DLCN).
  - `dpia_doc_ref` (string | null)
- `warnings` (array<object {...}>)
  - **(each array item)**:
    - `severity` (enum ['high', 'medium', 'low']) **REQUIRED**
    - `category` (string)
    - `message` (string) **REQUIRED**

## Critical constraints (quick reference for emit/validate)

- `attt_level_rationale` — min_chars=50
- `risk_analysis` — min_items=3
- `risk_analysis[].id` — pattern='^TH-[0-9]{3,}$'
- `risk_analysis[].threat` — min_chars=30
- `risk_analysis[].mitigation` — min_chars=30

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `security-design.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/security-design.schema.json`