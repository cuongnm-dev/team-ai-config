#!/usr/bin/env python3
"""
Extract human-readable Markdown summary from canonical JSON Schemas.

Schema-as-SSoT pattern (D6 in WORKFLOW_DESIGN.md):
  - Canonical schema = source of truth
  - _summaries/{name}.md = auto-generated markdown summary
  - Sub-agent prompts embed summary verbatim (cache-friendly inline injection)
  - Run after schema edit to refresh summaries

Usage:
    python extract_schema_summary.py {schema-name}     # single schema
    python extract_schema_summary.py --all             # all schemas

Output: ~/.claude/schemas/intel/_summaries/{name}.md
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

SCHEMAS_DIR = Path.home() / ".claude" / "schemas" / "intel"
SUMMARIES_DIR = SCHEMAS_DIR / "_summaries"


# Diátaxis tag per schema — primary organizing principle (D1)
# Map: schema name → which docs consume it + Diátaxis voice for prose
DIATAXIS_CONSUMER_MAP = {
    "actor-registry": {
        "consumed_by": ["TKKT", "TKCS", "TKCT", "HDSD", "xlsx"],
        "voice_hint": "Reference (facts about roles)",
    },
    "permission-matrix": {
        "consumed_by": ["TKCT (§5.2)", "HDSD (per-role chapters)"],
        "voice_hint": "Reference (RBAC matrix)",
    },
    "sitemap": {
        "consumed_by": ["TKCT (§3.2, §7.1)", "HDSD (navigation)"],
        "voice_hint": "Reference (route catalog)",
    },
    "feature-catalog": {
        "consumed_by": ["all 5 docs"],
        "voice_hint": "Reference + business intent context",
    },
    "code-facts": {
        "consumed_by": ["TKKT", "TKCT (architecture/data-model derivation)"],
        "voice_hint": "Reference (raw code facts, not for end-user docs)",
    },
    "system-inventory": {
        "consumed_by": ["TKKT (§11)", "TKCS (§3.4)", "TKCT (§2.3)"],
        "voice_hint": "Reference (tech stack tables)",
    },
    "data-model": {
        "consumed_by": ["TKCT (§4 entirely)", "TKKT (§5 aggregated)"],
        "voice_hint": "Reference (DDL detail for engineers)",
    },
    "api-spec": {
        "consumed_by": ["TKCT (§7.1)", "TKKT (§6 aggregate counts only)"],
        "voice_hint": "Reference (endpoint catalog)",
    },
    "architecture": {
        "consumed_by": ["TKKT (§3-4-6)", "TKCS (§3.3 — 3 mô hình mandate)", "TKCT (§2.1 kế thừa)"],
        "voice_hint": "Reference + Explanation (architecture facts + design rationale)",
    },
    "integrations": {
        "consumed_by": ["TKKT (§7)", "TKCT (§7.2-7.3)", "TKCS (§3.6)"],
        "voice_hint": "Reference (LGSP/NGSP integration catalog)",
    },
    "business-context": {
        "consumed_by": ["TKCS (§1, §2.4, §7, §8)", "TKCT (§1.2-1.3)", "TKKT (§1)"],
        "voice_hint": "Reference + Explanation (project facts + WHY for non-tech audience)",
    },
    "nfr-catalog": {
        "consumed_by": ["TKKT (§9)", "TKCS (§3.2, §3.5)"],
        "voice_hint": "Reference (NFR table with measurable targets)",
    },
    "security-design": {
        "consumed_by": ["TKCT (§5)", "TKKT (§10)", "TKCS (§3.5)"],
        "voice_hint": "Reference + Explanation (security architecture + threat rationale)",
    },
    "infrastructure": {
        "consumed_by": ["TKCS (§4)", "TKCT (§6)"],
        "voice_hint": "Reference (deployment + hardware catalog)",
    },
    "cost-estimate": {
        "consumed_by": ["TKCS (§6)", "TKCT (§10)"],
        "voice_hint": "Reference (cost tables, TT 04/2020 method)",
    },
    "project-plan": {
        "consumed_by": ["TKCS (§5)"],
        "voice_hint": "Reference (phases, timeline, RACI)",
    },
    "handover-plan": {
        "consumed_by": ["TKCT (§9)"],
        "voice_hint": "Reference (training, warranty, maintenance)",
    },
    "test-accounts": {
        "consumed_by": ["HDSD (prerequisites)", "Cursor /resume-feature QA"],
        "voice_hint": "Reference (credentials per role)",
    },
    "test-evidence": {
        "consumed_by": ["xlsx (§ entire)", "TKCT (§8.2)"],
        "voice_hint": "Reference (test case catalog with execution status)",
    },
    "_meta": {
        "consumed_by": ["all consumers (staleness/lock arbiter)"],
        "voice_hint": "Internal — not directly rendered to docs",
    },
}


def render_type(field_def: dict) -> str:
    """Render a field's type concisely."""
    if "type" in field_def:
        t = field_def["type"]
        if isinstance(t, list):
            return " | ".join(t)
        if t == "array":
            items = field_def.get("items", {})
            inner = render_type(items) if items else "any"
            return f"array<{inner}>"
        if t == "object" and "properties" in field_def:
            return "object {...}"
        return t
    if "enum" in field_def:
        vals = field_def["enum"]
        if len(vals) <= 6:
            return f"enum [{', '.join(repr(v) for v in vals)}]"
        return f"enum (one of {len(vals)} values)"
    if "$ref" in field_def:
        return f"$ref:{field_def['$ref'].split('/')[-1]}"
    if "oneOf" in field_def:
        return "oneOf [...]"
    return "any"


def render_constraints(field_def: dict) -> str:
    """Render constraint tags concisely."""
    parts = []
    if "minLength" in field_def:
        parts.append(f"min_chars={field_def['minLength']}")
    if "maxLength" in field_def:
        parts.append(f"max_chars={field_def['maxLength']}")
    if "minItems" in field_def:
        parts.append(f"min_items={field_def['minItems']}")
    if "maxItems" in field_def:
        parts.append(f"max_items={field_def['maxItems']}")
    if "minimum" in field_def:
        parts.append(f"min={field_def['minimum']}")
    if "maximum" in field_def:
        parts.append(f"max={field_def['maximum']}")
    if "pattern" in field_def:
        parts.append(f"pattern={field_def['pattern']!r}")
    if "format" in field_def:
        parts.append(f"format={field_def['format']}")
    if "const" in field_def:
        parts.append(f"const={field_def['const']!r}")
    return ", ".join(parts)


def walk_properties(properties: dict, required: list[str], indent: int = 0,
                    max_depth: int = 2, _depth: int = 0) -> list[str]:
    """Walk properties dict, emit markdown bullets."""
    lines = []
    pad = "  " * indent
    for key, defn in properties.items():
        is_required = "**REQUIRED**" if key in required else ""
        type_str = render_type(defn)
        constraints = render_constraints(defn)
        desc = defn.get("description", "").strip()
        # Truncate long descriptions
        if len(desc) > 200:
            desc = desc[:197] + "..."
        parts = [f"`{key}`", f"({type_str})"]
        if constraints:
            parts.append(f"[{constraints}]")
        if is_required:
            parts.append(is_required)
        line = f"{pad}- " + " ".join(parts)
        if desc:
            line += f" — {desc}"
        lines.append(line)
        # Recurse into nested objects (depth-limited)
        if (_depth < max_depth - 1
                and defn.get("type") == "object"
                and "properties" in defn):
            inner_req = defn.get("required", [])
            lines.extend(walk_properties(defn["properties"], inner_req,
                                         indent + 1, max_depth, _depth + 1))
        # Recurse into array items if object-typed
        elif (_depth < max_depth - 1
              and defn.get("type") == "array"
              and isinstance(defn.get("items"), dict)
              and defn["items"].get("type") == "object"
              and "properties" in defn["items"]):
            item_req = defn["items"].get("required", [])
            lines.append(f"{pad}  - **(each array item)**:")
            lines.extend(walk_properties(defn["items"]["properties"],
                                         item_req, indent + 2, max_depth,
                                         _depth + 1))
    return lines


def walk_definitions(definitions: dict) -> list[str]:
    """Walk $defs / definitions block."""
    lines = []
    for name, defn in definitions.items():
        lines.append(f"\n#### `${name}`")
        if "description" in defn:
            lines.append(f"\n{defn['description']}\n")
        if defn.get("type") == "object" and "properties" in defn:
            req = defn.get("required", [])
            lines.append("**Fields**:")
            lines.extend(walk_properties(defn["properties"], req, indent=0))
        elif "enum" in defn:
            lines.append(f"**Enum**: {', '.join(repr(v) for v in defn['enum'])}")
    return lines


def extract_summary(schema_path: Path) -> str:
    """Extract markdown summary from a JSON Schema file."""
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    name = schema_path.name.replace(".schema.json", "")
    title = schema.get("title", name)
    description = schema.get("description", "").strip()
    schema_id = schema.get("$id", "")
    schema_version = "n/a"
    if "properties" in schema and "schema_version" in schema["properties"]:
        sv = schema["properties"]["schema_version"]
        if "const" in sv:
            schema_version = sv["const"]

    diataxis = DIATAXIS_CONSUMER_MAP.get(name, {})
    consumed_by = diataxis.get("consumed_by", "TBD")
    voice_hint = diataxis.get("voice_hint", "TBD")
    if isinstance(consumed_by, list):
        consumed_by = ", ".join(consumed_by)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    lines = [
        f"# Schema Summary — {title}",
        "",
        f"> **AUTO-GENERATED** by `extract_schema_summary.py` at {now}.",
        f"> **DO NOT EDIT** — edit canonical schema instead, then re-run script.",
        f"> **Source**: `~/.claude/schemas/intel/{schema_path.name}` (schema_version: `{schema_version}`)",
        f"> **Consumed by** (Diátaxis tag — D1): {consumed_by}",
        f"> **Writer voice hint**: {voice_hint}",
        "",
    ]

    if description:
        lines.append("## Purpose")
        lines.append("")
        lines.append(description)
        lines.append("")

    # Top-level required fields
    required = schema.get("required", [])
    if required:
        lines.append("## Required top-level fields")
        lines.append("")
        for r in required:
            lines.append(f"- `{r}`")
        lines.append("")

    # Top-level properties walk
    if "properties" in schema:
        lines.append("## Field structure (depth ≤ 2)")
        lines.append("")
        walked = walk_properties(schema["properties"], required, indent=0)
        lines.extend(walked)
        lines.append("")

    # Definitions
    defs = schema.get("definitions", schema.get("$defs", {}))
    if defs:
        lines.append("## Reusable definitions")
        lines.extend(walk_definitions(defs))
        lines.append("")

    # Critical constraints quick-reference (extract minLength + minItems + pattern)
    critical = []
    def collect_critical(obj, path=""):
        if not isinstance(obj, dict):
            return
        if "minLength" in obj or "minItems" in obj or "pattern" in obj:
            cons = render_constraints(obj)
            if cons:
                critical.append((path or "<root>", cons))
        if "properties" in obj:
            for k, v in obj["properties"].items():
                collect_critical(v, f"{path}.{k}" if path else k)
        if "items" in obj and isinstance(obj["items"], dict):
            collect_critical(obj["items"], f"{path}[]")
        if "definitions" in obj:
            for k, v in obj["definitions"].items():
                collect_critical(v, f"$defs.{k}")
    collect_critical(schema)

    if critical:
        lines.append("## Critical constraints (quick reference for emit/validate)")
        lines.append("")
        for path, cons in critical[:30]:  # cap to top 30
            lines.append(f"- `{path}` — {cons}")
        if len(critical) > 30:
            lines.append(f"- ... ({len(critical) - 30} more constraints in canonical schema)")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("**Sub-agent prompt usage** (D6 — compile-time inline injection):")
    lines.append("")
    lines.append("Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `" + name + ".json`.")
    lines.append("Output JSON MUST match constraints listed above. Run validate.py post-hoc.")
    lines.append("")
    lines.append(f"For full schema: `~/.claude/schemas/intel/{schema_path.name}`")

    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(
        description="Extract markdown summary from canonical JSON Schema (D6).",
    )
    ap.add_argument("name", nargs="?",
                    help="Schema name (without .schema.json suffix), or omit with --all")
    ap.add_argument("--all", action="store_true",
                    help="Process all schemas in ~/.claude/schemas/intel/")
    ap.add_argument("--check", action="store_true",
                    help="Verify summaries fresh; exit 1 if any stale")
    args = ap.parse_args()

    SUMMARIES_DIR.mkdir(exist_ok=True)

    if args.all or (args.check and not args.name):
        # --check defaults to --all when no name given
        schemas = sorted(SCHEMAS_DIR.glob("*.schema.json"))
    elif args.name:
        target = SCHEMAS_DIR / f"{args.name}.schema.json"
        if not target.exists():
            print(f"ERROR: schema {target} not found", file=sys.stderr)
            sys.exit(2)
        schemas = [target]
    else:
        ap.error("Must provide schema name or --all")

    stale = []
    for schema_path in schemas:
        name = schema_path.name.replace(".schema.json", "")
        summary = extract_summary(schema_path)
        out_path = SUMMARIES_DIR / f"{name}.md"

        if args.check:
            if not out_path.exists():
                stale.append(f"{name} (missing)")
                continue
            existing = out_path.read_text(encoding="utf-8")
            # Strip generation timestamp lines for comparison
            def strip_ts(s: str) -> str:
                return "\n".join(l for l in s.splitlines()
                                if "AUTO-GENERATED" not in l)
            if strip_ts(existing) != strip_ts(summary):
                stale.append(name)
        else:
            out_path.write_text(summary, encoding="utf-8")
            size_kb = len(summary.encode("utf-8")) / 1024
            print(f"  WROTE  _summaries/{name}.md  ({size_kb:.1f}KB)")

    if args.check:
        if stale:
            print(f"STALE: {len(stale)} summaries out of sync:", file=sys.stderr)
            for s in stale:
                print(f"  - {s}", file=sys.stderr)
            sys.exit(1)
        print(f"OK: {len(schemas)} summaries fresh")
        sys.exit(0)

    print(f"\nDONE: {len(schemas)} summaries written to {SUMMARIES_DIR}/")


if __name__ == "__main__":
    main()
