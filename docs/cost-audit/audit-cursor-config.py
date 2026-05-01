"""
Audit Cursor Configuration — Identify what's loaded into harness

Outputs `cursor-config-inventory.md` listing:
- Rules (with alwaysApply flag + size)
- Skills (with description + size)
- Agents (with size)
- MCP plugins (configured vs discovered)
- Plugin cache size

User reviews + marks "keep" or "disable" per item, then we apply.

Usage:
  python audit-cursor-config.py [project-dir]
  Default project: D:/Projects/ufh-rfid
"""
import os
import sys
import json
import re
from pathlib import Path

PROJECT_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("D:/Projects/ufh-rfid")
OUTPUT_FILE = Path(__file__).parent / "cursor-config-inventory.md"

CURSOR_HOME = Path(os.path.expanduser("~/.cursor"))


def read_frontmatter_field(path, field):
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
        m = re.search(rf"^{field}:\s*(.+?)$", content, re.MULTILINE)
        return m.group(1).strip() if m else None
    except Exception:
        return None


def read_first_description(path):
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
        m = re.search(r"^description:\s*(.+?)$", content, re.MULTILINE)
        return m.group(1).strip()[:120] if m else ""
    except Exception:
        return ""


def audit_rules(rules_dir, label):
    if not rules_dir.exists():
        return []
    items = []
    for f in sorted(rules_dir.glob("*.mdc")):
        size = f.stat().st_size
        always = read_frontmatter_field(f, "alwaysApply")
        always_bool = (always == "true")
        globs = read_frontmatter_field(f, "globs") or ""
        desc = read_first_description(f)
        items.append({
            "label": label,
            "name": f.name,
            "size_bytes": size,
            "tokens_est": size // 4,
            "alwaysApply": always_bool,
            "globs": globs,
            "description": desc,
        })
    return items


def audit_skills():
    skills_dir = CURSOR_HOME / "skills"
    items = []
    if not skills_dir.exists():
        return items
    for d in sorted(skills_dir.iterdir()):
        if not d.is_dir():
            continue
        skill_md = d / "SKILL.md"
        if not skill_md.exists():
            continue
        size = sum(f.stat().st_size for f in d.rglob("*") if f.is_file())
        items.append({
            "name": d.name,
            "skill_md_size": skill_md.stat().st_size,
            "skill_md_tokens": skill_md.stat().st_size // 4,
            "total_size": size,
            "description": read_first_description(skill_md),
        })
    return items


def audit_agents():
    agents_dir = CURSOR_HOME / "agents"
    items = []
    if not agents_dir.exists():
        return items
    for f in sorted(agents_dir.glob("*.md")):
        size = f.stat().st_size
        desc = read_first_description(f)
        items.append({
            "name": f.name,
            "size_bytes": size,
            "tokens_est": size // 4,
            "description": desc,
        })
    return items


def audit_mcp():
    config = CURSOR_HOME / "mcp.json"
    configured = {}
    if config.exists():
        try:
            cfg = json.loads(config.read_text(encoding="utf-8"))
            configured = cfg.get("mcpServers", {})
        except Exception:
            pass

    project_mcp_dir = CURSOR_HOME / "projects" / project_dir_to_key(PROJECT_DIR) / "mcps"
    discovered = []
    if project_mcp_dir.exists():
        for d in sorted(project_mcp_dir.iterdir()):
            if d.is_dir():
                metadata = d / "SERVER_METADATA.json"
                meta = {}
                try:
                    meta = json.loads(metadata.read_text(encoding="utf-8")) if metadata.exists() else {}
                except Exception:
                    pass
                discovered.append({
                    "name": d.name,
                    "tools_in_metadata": len(meta.get("tools", [])),
                    "metadata_size": metadata.stat().st_size if metadata.exists() else 0,
                })

    return configured, discovered


def project_dir_to_key(p: Path) -> str:
    s = str(p).replace("\\", "-").replace(":", "")
    return s


def write_report(rules, skills, agents, mcp_configured, mcp_discovered):
    parts = []
    parts.append(f"""---
generated: 2026-05-01
project: {PROJECT_DIR}
purpose: Audit Cursor harness inventory. User marks each item "keep" or "disable".
---

# Cursor Configuration Inventory

Mark each item with `[x] keep` or `[ ] disable` to drive the next cleanup pass.

## Summary

| Category | Total items | Total size | Total tokens (est) |
|---|---|---|---|""")

    rules_total = sum(r["size_bytes"] for r in rules)
    skills_total = sum(s["skill_md_size"] for s in skills)
    agents_total = sum(a["size_bytes"] for a in agents)
    mcp_total = sum(m["metadata_size"] for m in mcp_discovered)

    parts.append(f"| Rules (.mdc) | {len(rules)} | {rules_total:,}B | ~{rules_total // 4:,} |")
    parts.append(f"| Skills (SKILL.md) | {len(skills)} | {skills_total:,}B | ~{skills_total // 4:,} |")
    parts.append(f"| Agents (.cursor/agents/*.md) | {len(agents)} | {agents_total:,}B | ~{agents_total // 4:,} |")
    parts.append(f"| MCP plugins discovered | {len(mcp_discovered)} | {mcp_total:,}B | ~{mcp_total // 4:,} |")
    grand = rules_total + skills_total + agents_total + mcp_total
    parts.append(f"| **TOTAL** | | **{grand:,}B** | **~{grand // 4:,}** |")

    parts.append("\n*Caveat: not all of this loads at every Task(). Confirm with empirical test.*")

    # === Rules ===
    parts.append("\n## Rules\n")
    parts.append("Rules with `alwaysApply: true` load into EVERY Task() context. Glob-triggered load only when files match.\n")
    parts.append("| Keep? | Always? | Tokens | Globs | File | Description |")
    parts.append("|---|---|---|---|---|---|")
    for r in rules:
        keep = "[x]"
        always = "🔴 YES" if r["alwaysApply"] else "glob/manual"
        glob = r["globs"][:30] if r["globs"] else "-"
        parts.append(f"| {keep} | {always} | {r['tokens_est']:>5,} | {glob} | `{r['label']}/{r['name']}` | {r['description'][:60]} |")

    # === Skills ===
    parts.append("\n## Skills (~/.cursor/skills/)\n")
    parts.append("Skills are user-invokable via slash commands. Cursor 3 may register all of them at startup.\n")
    parts.append("**Mark essential = used in your daily SDLC pipeline. Optional = rarely used / project-specific.**\n")
    parts.append("| Keep? | Tokens | Skill | Description |")
    parts.append("|---|---|---|---|")

    sdlc_essential = {"new-feature", "resume-feature", "close-feature", "feature-status",
                       "from-doc", "implement", "plan", "spike", "code-change", "quality"}
    config_skills = {"new-workspace", "new-project", "configure-workspace"}
    doc_skills = {"generate-docs"}
    optional = {"adr", "arch-review", "audit", "cache-lint", "hotfix", "incident",
                "intel-snapshot", "release", "runbook", "strategic-critique",
                "ui-catalog", "zip-disk"}

    for s in sorted(skills, key=lambda x: x["name"]):
        if s["name"] in sdlc_essential:
            keep = "[x]"
            note = "(SDLC essential)"
        elif s["name"] in config_skills:
            keep = "[x]"
            note = "(config — keep but rare)"
        elif s["name"] in doc_skills:
            keep = "[ ]"
            note = "(doc-gen — đã chuyển sang Claude/MCP, có thể disable)"
        elif s["name"] in optional:
            keep = "[?]"
            note = "(optional — review)"
        else:
            keep = "[?]"
            note = "(unclassified)"
        parts.append(f"| {keep} | {s['skill_md_tokens']:>5,} | `{s['name']}` {note} | {s['description'][:80]} |")

    # === MCP ===
    parts.append("\n## MCP Plugins\n")
    parts.append(f"### Configured (mcp.json) — {len(mcp_configured)} servers\n")
    parts.append("| Keep? | Server | Notes |")
    parts.append("|---|---|---|")
    for name in sorted(mcp_configured.keys()):
        parts.append(f"| [x] | `{name}` | (used by pipeline) |")

    parts.append(f"\n### Discovered in project mcps/ but NOT configured — {len(mcp_discovered)}\n")
    parts.append("These plugins exist in your project's `~/.cursor/projects/<key>/mcps/` directory. Even though `mcp.json` doesn't reference them, Cursor 3 may auto-register their tool definitions.\n")
    parts.append("| Keep? | Plugin | Tools | Note |")
    parts.append("|---|---|---|---|")
    for m in mcp_discovered:
        configured_already = any(c.split("-")[0] in m["name"] for c in mcp_configured)
        keep = "[x]" if configured_already else "[ ]"
        parts.append(f"| {keep} | `{m['name']}` | {m['tools_in_metadata']} | {'configured' if configured_already else 'AUTO-INSTALLED — disable in Cursor settings'} |")

    # === Agents ===
    parts.append("\n## Agents (~/.cursor/agents/)\n")
    parts.append("Custom subagents invoked via `Task(subagent_type='X')`. Cursor 3 may pre-register all 44 files.\n")
    parts.append("| Keep? | Tokens | Agent | Description |")
    parts.append("|---|---|---|---|")

    sdlc_agents = {"dispatcher", "pm", "ba", "ba-pro", "sa", "sa-pro", "tech-lead",
                   "dev", "dev-pro", "fe-dev", "qa", "qa-pro", "reviewer", "reviewer-pro",
                   "designer", "security", "devops"}
    extended_agents = {"data-governance", "release-manager", "sre-observability", "telemetry"}
    doc_agents_legacy = {"doc-arch-writer", "doc-catalog-writer", "doc-exporter", "doc-intel",
                         "doc-manual-writer", "doc-researcher", "doc-test-runner",
                         "doc-testcase-writer", "doc-tkcs-writer"}
    doc_agents_new = {"tdoc-data-writer", "tdoc-exporter", "tdoc-researcher", "tdoc-test-runner"}

    for a in agents:
        stem = a["name"].replace(".md", "")
        if stem in sdlc_agents:
            keep = "[x]"
            note = "(SDLC core)"
        elif stem in extended_agents:
            keep = "[x]"
            note = "(SDLC extended)"
        elif stem in doc_agents_legacy:
            keep = "[ ]"
            note = "(legacy doc-gen — superseded by Claude/MCP)"
        elif stem in doc_agents_new:
            keep = "[ ]"
            note = "(tdoc — Claude side, can drop from Cursor)"
        elif stem.startswith("ref-"):
            keep = "[x]"
            note = "(reference doc, agent loads on demand)"
        else:
            keep = "[?]"
            note = "(review)"
        parts.append(f"| {keep} | {a['tokens_est']:>5,} | `{stem}` {note} | {a['description'][:80]} |")

    # === Suggestions section ===
    parts.append(f"""

## Suggested action — pre-filled

Based on your stated direction:
- **Doc-gen via Claude/MCP** (already migrated) → 9 legacy `doc-*` agents + `generate-docs` skill can DISABLE on Cursor
- **`tdoc-*` agents** also Claude-side → can DISABLE on Cursor
- **Plugins not used in PoC/MVP work** (figma, gitlab, prisma, sentry, supabase) → DISABLE in Cursor settings
- **Optional skills** (adr, arch-review, audit, cache-lint, hotfix, incident, intel-snapshot, release, runbook, strategic-critique, ui-catalog, zip-disk) → review and disable rarely-used ones

Estimated savings if 9 doc agents + 4 tdoc agents removed (or moved to ~/.cursor-archive/):
- 13 agent files × ~6K tokens avg = ~78K tokens removed from agent registry

Estimated if 5 unused MCP plugins disabled (figma, gitlab, prisma×2, sentry, supabase):
- Each plugin metadata + tool defs: ~5-15K tokens × 5-7 instances = ~30-100K tokens

Estimated if 8 optional skills disabled:
- 8 skills × ~2K tokens (frontmatter + body intro) = ~16K tokens

**Total expected harness reduction: ~120-200K tokens per Task()** = $0.04-0.06 per event × 12 events/day = **~$0.50-0.70/day saved per user just from disable cleanup.**

## Next steps after marking

1. User edits this file, marks `[ ]` next to items to disable.
2. Run `python apply-cursor-config-cleanup.py cursor-config-inventory.md` (will be created) to:
   a. Move disabled agent .md to `~/.cursor-archive/agents/`
   b. Move disabled skill dirs to `~/.cursor-archive/skills/`
   c. Remove disabled MCP plugins from `mcp.json` and project mcps/ folder
   d. Update rules `alwaysApply: false` if marked
3. Restart Cursor.
4. Run F-004 spike, measure new floor.
""")
    return "\n".join(parts)


def main():
    print(f"Auditing Cursor config for project: {PROJECT_DIR}")
    rules_user = audit_rules(CURSOR_HOME / "rules", "user")
    rules_proj = audit_rules(PROJECT_DIR / ".cursor" / "rules", "project")
    rules = rules_user + rules_proj
    skills = audit_skills()
    agents = audit_agents()
    mcp_configured, mcp_discovered = audit_mcp()

    report = write_report(rules, skills, agents, mcp_configured, mcp_discovered)
    OUTPUT_FILE.write_text(report, encoding="utf-8")
    print(f"\nReport written: {OUTPUT_FILE}")
    print(f"  Rules: {len(rules)}")
    print(f"  Skills: {len(skills)}")
    print(f"  Agents: {len(agents)}")
    print(f"  MCP configured: {len(mcp_configured)}")
    print(f"  MCP discovered in project: {len(mcp_discovered)}")


if __name__ == "__main__":
    main()
