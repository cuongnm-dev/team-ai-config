#!/usr/bin/env python3
"""Cache discipline linter for Cursor agent prompts + skill files.

Enforces FROZEN_HEADER + 4-block invariants from CACHE_OPTIMIZATION.md.
Run: python lint.py [--path PATH] [--strict] [--fix-whitespace]
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

FROZEN_DYNAMIC_TOKENS = [
    "{iter}", "{iter+1}", "{last_verdict}", "{stage}", "{current-stage}",
    "{tokens-total}", "{this_agent}", "{verdict}", "{today}", "{timestamp}",
]

FOUR_BLOCK_HEADERS = [
    "## Agent Brief",
    "## Project Conventions",
    "## Feature Context",
    "## Inputs",
]

VN_PATTERNS = re.compile(
    r"[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]",
    re.IGNORECASE,
)


class Finding:
    __slots__ = ("path", "line", "rule", "severity", "msg")

    def __init__(self, path: str, line: int, rule: str, severity: str, msg: str):
        self.path = path
        self.line = line
        self.rule = rule
        self.severity = severity
        self.msg = msg

    def format(self) -> str:
        tag = {"error": "ERROR", "warn": "WARN", "info": "INFO"}[self.severity]
        loc = f"{self.path}:{self.line}" if self.line else self.path
        return f"[{tag:5s}] {loc} {self.rule} — {self.msg}"


def is_in_code_fence(lines: list[str], idx: int) -> bool:
    fence = 0
    for i in range(idx):
        if lines[i].lstrip().startswith("```"):
            fence += 1
    return fence % 2 == 1


def is_in_frontmatter(lines: list[str], idx: int) -> bool:
    if idx == 0 or not lines[0].startswith("---"):
        return False
    for i in range(1, len(lines)):
        if lines[i].startswith("---"):
            return idx <= i
    return False


def lint_file(path: Path, strict: bool = False) -> list[Finding]:
    findings: list[Finding] = []
    raw = path.read_bytes()

    # CL-2: CRLF
    if b"\r\n" in raw:
        crlf_count = raw.count(b"\r\n")
        findings.append(Finding(str(path), 0, "CL-2", "error",
                                f"CRLF line endings detected ({crlf_count} occurrences)"))

    text = raw.decode("utf-8", errors="replace").replace("\r\n", "\n")
    lines = text.split("\n")

    # CL-8: frontmatter (only for agents/*.md and skills/**/SKILL.md, not docs)
    is_agent_or_skill = (
        path.name == "SKILL.md"
        or ("/agents/" in str(path).replace("\\", "/") and path.name not in {"AGENTS.md"} and not path.name.startswith("ref-"))
    )
    has_frontmatter = bool(lines and lines[0].strip() == "---")
    if is_agent_or_skill:
        if not has_frontmatter:
            findings.append(Finding(str(path), 1, "CL-8", "error",
                                    "Missing YAML frontmatter (--- ... ---)"))
        else:
            fm_end = next((i for i in range(1, len(lines)) if lines[i].startswith("---")), -1)
            if fm_end > 0:
                fm = "\n".join(lines[1:fm_end])
                if "name:" not in fm:
                    findings.append(Finding(str(path), 1, "CL-8", "error",
                                            "Frontmatter missing 'name:' field"))
                if "description:" not in fm:
                    findings.append(Finding(str(path), 1, "CL-8", "error",
                                            "Frontmatter missing 'description:' field"))

    # CL-1: trailing whitespace (skip code fences + frontmatter)
    for i, line in enumerate(lines):
        if line != line.rstrip(" \t") and line.strip():
            if not is_in_code_fence(lines, i):
                findings.append(Finding(str(path), i + 1, "CL-1", "warn",
                                        "Trailing whitespace"))

    # CL-9: triple newlines outside code fences
    for m in re.finditer(r"\n\n\n+", text):
        line_num = text[:m.start()].count("\n") + 1
        if not is_in_code_fence(lines, line_num - 1):
            findings.append(Finding(str(path), line_num, "CL-9", "warn",
                                    "Triple newline (\\n\\n\\n) breaks cache prefix consistency"))

    # CL-3: 4-block order check (only if file mentions any 4-block header)
    found_headers = [(i, h) for i, line in enumerate(lines)
                     for h in FOUR_BLOCK_HEADERS if line.strip() == h]
    if found_headers:
        seen_names = [h for _, h in found_headers]
        # Check ordering: each appearance of a known header should follow declared order
        expected_order = FOUR_BLOCK_HEADERS
        last_idx = -1
        for line_idx, hdr in found_headers:
            cur = expected_order.index(hdr)
            if cur < last_idx:
                findings.append(Finding(str(path), line_idx + 1, "CL-3", "error",
                                        f"4-block header out of order: '{hdr}' appears after later block"))
            last_idx = max(last_idx, cur)
        # If file declares 4-block template but missing some headers
        declared_template = ("Agent Brief" in text and "Inputs" in text
                             and ("Feature Context" in text or "Project Conventions" in text))
        if declared_template:
            missing = [h for h in FOUR_BLOCK_HEADERS if h not in seen_names]
            if missing:
                findings.append(Finding(str(path), 1, "CL-3", "error",
                                        f"4-block template missing headers: {', '.join(missing)}"))

    # CL-4: dynamic placeholders in FROZEN_HEADER region
    # Skip files whose purpose is documenting CL-4 itself (cache-lint's own docs)
    is_cache_lint_self_doc = "/cache-lint/" in str(path).replace("\\", "/")
    if not is_cache_lint_self_doc:
        for i, line in enumerate(lines):
            stripped = line.strip()
            # Trigger: line that DEFINES FROZEN_HEADER (assignment / heading), not arbitrary mention
            is_def = (
                "FROZEN_HEADER" in stripped
                and (stripped.startswith("**FROZEN_HEADER**")
                     or "FROZEN_HEADER =" in stripped
                     or "FROZEN_HEADER (" in stripped
                     or "build_frozen_header" in stripped.lower())
            )
            if is_def:
                for j in range(i + 1, min(i + 50, len(lines))):
                    if lines[j].lstrip().startswith("```"):
                        for k in range(j + 1, min(j + 80, len(lines))):
                            if lines[k].lstrip().startswith("```"):
                                block = "\n".join(lines[j + 1:k])
                                for tok in FROZEN_DYNAMIC_TOKENS:
                                    if tok in block:
                                        findings.append(Finding(
                                            str(path), j + 1, "CL-4", "error",
                                            f"Dynamic placeholder '{tok}' found inside FROZEN_HEADER block"))
                                break
                        break
                break  # only check first FROZEN_HEADER section

    # CL-5: kebab-case field names inside ## blocks (heuristic — only flag clear violations)
    in_block = None
    for i, line in enumerate(lines):
        s = line.strip()
        if s.startswith("## "):
            in_block = s
            continue
        if in_block and ":" in s and not s.startswith("#") and not s.startswith("-"):
            # field-name: value
            m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*:", s)
            if m:
                name = m.group(1)
                if "_" in name or name.lower() != name:
                    if name not in {"YAML", "JSON", "TODO"}:
                        findings.append(Finding(str(path), i + 1, "CL-5", "warn",
                                                f"Field '{name}' should be kebab-case lowercase"))

    # CL-6: VN text in prompt-loaded files (CD-9 + CACHE_OPTIMIZATION English-only rule)
    # Scope expanded: tdoc-*, AGENTS.md, ref-*.md, dispatcher.md, pm.md, rules/*.mdc
    # Allowed VN: frontmatter description, code fences (output examples), HTML comments,
    #             user-facing strings explicitly marked with `# user-facing:` prefix
    prompt_loaded = (
        "tdoc-" in path.name
        or path.name in ("AGENTS.md", "dispatcher.md", "pm.md")
        or path.name.startswith("ref-")
        or "/rules/" in str(path).replace("\\", "/")
    )
    if prompt_loaded:
        for i, line in enumerate(lines):
            if not VN_PATTERNS.search(line):
                continue
            if is_in_frontmatter(lines, i):
                continue
            if is_in_code_fence(lines, i):
                continue
            if "<!--" in line or line.strip().startswith("<!--"):
                continue
            # Allow user-facing strings (skill output to user is allowed VN)
            if "user-facing:" in line.lower() or "# vn-allowed" in line.lower():
                continue
            # Allow VN inside Markdown table cells that document VN values (e.g. role display names)
            # Heuristic: line starts with `|` and contains ` | `
            if line.lstrip().startswith("|") and " | " in line:
                continue
            findings.append(Finding(
                str(path), i + 1, "CL-6", "error",
                f"Vietnamese in prompt-loaded file (CD-9 violation). Move to user-facing strings or HTML comment. Line: {line.strip()[:60]}"))
            break  # one finding per file

    # CL-7: tab/space mixing inside markdown blocks
    for i, line in enumerate(lines):
        if "\t" in line and "    " in line:
            findings.append(Finding(str(path), i + 1, "CL-7", "warn",
                                    "Mixed tab + space indentation"))

    return findings


def discover_files(root: Path) -> list[Path]:
    files: list[Path] = []
    cursor_root = root.expanduser()
    if cursor_root.is_file():
        return [cursor_root]
    agents = cursor_root / "agents"
    skills = cursor_root / "skills"
    if agents.exists():
        files.extend(sorted(agents.glob("*.md")))
    if skills.exists():
        files.extend(sorted(skills.glob("**/SKILL.md")))
    return files


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--path", default="~/.cursor",
                   help="File or directory (default: ~/.cursor)")
    p.add_argument("--strict", action="store_true",
                   help="Treat warnings as errors")
    p.add_argument("--fix-whitespace", action="store_true",
                   help="Auto-fix trailing whitespace + CRLF")
    args = p.parse_args()

    root = Path(args.path).expanduser()
    if not root.exists():
        print(f"[ERROR] Path not found: {root}", file=sys.stderr)
        return 2

    files = discover_files(root) if root.is_dir() else [root]
    all_findings: list[Finding] = []
    for f in files:
        try:
            all_findings.extend(lint_file(f, strict=args.strict))
        except Exception as e:
            print(f"[ERROR] Failed to lint {f}: {e}", file=sys.stderr)

    if args.fix_whitespace:
        for f in files:
            raw = f.read_bytes()
            new = raw.replace(b"\r\n", b"\n")
            text = new.decode("utf-8", errors="replace")
            fixed = "\n".join(line.rstrip(" \t") for line in text.split("\n"))
            if fixed.encode("utf-8") != raw:
                f.write_bytes(fixed.encode("utf-8"))
                print(f"[FIXED] {f}")

    errors = [f for f in all_findings if f.severity == "error"]
    warns = [f for f in all_findings if f.severity == "warn"]

    for f in all_findings:
        try:
            print(f.format())
        except UnicodeEncodeError:
            # Windows cp1252 console — emit ASCII-safe version
            print(f.format().encode("ascii", "replace").decode("ascii"))

    print(f"\n[INFO] Scanned {len(files)} files, {len(errors)} errors, {len(warns)} warnings")

    if errors:
        return 1
    if args.strict and warns:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
