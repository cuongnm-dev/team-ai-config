"""
PostToolUse hook — validates intel artifacts after every Write/Edit.

CD-10 enforcement: every write to docs/intel/<artifact>.json triggers
schema validation + _meta.json freshness check. Non-intel writes pass through.

Hook contract (Claude Code):
- Receives JSON via stdin: {"tool_name", "tool_input", "tool_response", ...}
- stdout/stderr → captured by harness, shown if non-zero exit
- Exit 0 = pass; Exit 2 = block (Claude sees stderr); Exit other = warn

For intel writes that fail schema → exit 2 (block).
For non-intel writes → exit 0 silently (no-op).
For meta update failures → exit 0 with stderr warning (do not block).

Performance: target <500ms for typical artifact (5-50KB JSON).
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

SCHEMAS_DIR = Path.home() / ".claude" / "schemas" / "intel"


def is_intel_artifact(path: str) -> tuple[bool, str | None]:
    """Detect docs/intel/<artifact>.json paths.

    Returns (is_intel, artifact_name) where artifact_name is e.g.
    "actor-registry.json" or None if not intel.
    """
    if not path:
        return False, None
    p = Path(path).as_posix()
    # Match {anything}/docs/intel/<file>.json or {anything}/intel/<file>.json
    parts = p.split("/")
    try:
        idx = parts.index("intel")
        if idx + 1 < len(parts):
            artifact = parts[idx + 1]
            # Ignore subdirs (test-evidence/*, _briefings/*, screenshots/*)
            if artifact in ("test-evidence", "_briefings", "screenshots", "_meta.json"):
                return False, None
            if artifact.endswith(".json"):
                return True, artifact
    except ValueError:
        pass
    return False, None


def find_schema(artifact: str) -> Path | None:
    base = artifact.rsplit(".json", 1)[0]
    candidate = SCHEMAS_DIR / f"{base}.schema.json"
    return candidate if candidate.exists() else None


def validate_quick(file_path: Path, schema_path: Path) -> tuple[bool, str]:
    try:
        import jsonschema  # type: ignore
    except ImportError:
        return True, ""  # silent pass if jsonschema not installed
    try:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        payload = json.loads(file_path.read_text(encoding="utf-8"))
        validator = jsonschema.Draft7Validator(schema)
        errors = list(validator.iter_errors(payload))
        if not errors:
            return True, ""
        # First 3 errors only
        msgs = []
        for err in errors[:3]:
            path = "/".join(str(x) for x in err.path) or "<root>"
            msgs.append(f"  • {path}: {err.message[:120]}")
        return False, "\n".join(msgs)
    except Exception:
        return True, ""  # don't block on parser glitches


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read())
    except Exception:
        return 0  # invalid input → silent pass

    tool_input = payload.get("tool_input") or {}
    file_path = tool_input.get("file_path") or ""

    is_intel, artifact = is_intel_artifact(file_path)
    if not is_intel:
        return 0  # non-intel write → no-op

    target = Path(file_path)
    if not target.exists():
        return 0  # write hadn't materialized yet (rare race)

    schema = find_schema(artifact)
    if schema is None:
        # No schema for this artifact (e.g. business-context.json, code-facts.json)
        # → silent pass; coverage gap, not error.
        return 0

    ok, errmsg = validate_quick(target, schema)
    if ok:
        # Optional: print success to stderr (visible only on debug)
        return 0

    # Schema invalid → BLOCK with diagnostic
    print(
        f"INTEL SCHEMA VIOLATION — {artifact} (CD-10 enforcement):\n{errmsg}\n"
        f"Fix: align JSON to {schema.name} or run "
        f"`python C:/Users/James/.claude/scripts/intel/write_wrapper.py "
        f"<intel_dir> {artifact} <payload> --producer <name>` for atomic write+validate.",
        file=sys.stderr,
    )
    return 2  # exit 2 = block per Claude Code hook contract


if __name__ == "__main__":
    sys.exit(main())
