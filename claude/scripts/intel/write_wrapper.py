"""
Intel Layer write wrapper — enforces CD-10 contract automatically.

Wraps an intel artifact write with: (1) JSON schema validation per
~/.claude/schemas/intel/<artifact>.schema.json, (2) atomic write,
(3) _meta.json provenance update via meta_helper.

Producer agents call this INSTEAD of bare Write/Edit on docs/intel/*.json.
This shifts CD-10 enforcement from policy to mechanism.

Usage (CLI):
    python write_wrapper.py <intel_dir> <artifact_name> <json_payload_path> \
        --producer <name> [--ttl 30] [--sources file1 file2 ...]

Exit codes: 0 OK, 1 schema invalid, 2 meta update failed, 3 file IO error,
            4 missing schema (warn-only, write proceeds).
"""
from __future__ import annotations
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

SCHEMAS_DIR = Path.home() / ".claude" / "schemas" / "intel"
META_HELPER = Path(__file__).parent / "meta_helper.py"


def find_schema(artifact: str) -> Path | None:
    """Resolve schema file for artifact (e.g. actor-registry.json → actor-registry.schema.json)."""
    base = artifact.rsplit(".json", 1)[0]
    candidate = SCHEMAS_DIR / f"{base}.schema.json"
    return candidate if candidate.exists() else None


def validate_schema(payload_path: Path, schema_path: Path) -> tuple[bool, str]:
    """Validate payload against JSON Schema draft-07. Returns (ok, error_msg)."""
    try:
        import jsonschema  # type: ignore
    except ImportError:
        return False, "jsonschema not installed; run: pip install jsonschema"

    try:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        payload = json.loads(payload_path.read_text(encoding="utf-8"))
        validator = jsonschema.Draft7Validator(schema)
        errors = sorted(validator.iter_errors(payload), key=lambda e: e.path)
        if not errors:
            return True, ""
        msgs = []
        for err in errors[:5]:  # first 5 errors only — keep terse
            path = "/".join(str(p) for p in err.path) or "<root>"
            msgs.append(f"  {path}: {err.message}")
        return False, "Schema validation failed:\n" + "\n".join(msgs)
    except json.JSONDecodeError as e:
        return False, f"Invalid JSON: {e}"
    except Exception as e:
        return False, f"Validation error: {e}"


def atomic_write(target: Path, source: Path) -> None:
    """Copy source → target atomically (tmp + rename)."""
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(target.suffix + ".tmp")
    shutil.copyfile(source, tmp)
    tmp.replace(target)


def update_meta(
    intel_dir: Path, artifact: str, producer: str, ttl: int, sources: list[str]
) -> tuple[bool, str]:
    """Invoke meta_helper update via subprocess."""
    cmd = [
        sys.executable,
        str(META_HELPER),
        "update",
        str(intel_dir),
        artifact,
        "--producer",
        producer,
        "--ttl",
        str(ttl),
    ]
    if sources:
        cmd.extend(["--sources", *sources])
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return False, f"meta_helper update failed: {result.stderr.strip()}"
        return True, ""
    except subprocess.TimeoutExpired:
        return False, "meta_helper update timed out (30s)"
    except Exception as e:
        return False, f"meta_helper invocation error: {e}"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Intel write wrapper — schema validate + atomic write + _meta update"
    )
    parser.add_argument("intel_dir", type=Path, help="docs/intel/ directory")
    parser.add_argument(
        "artifact", help="Artifact name with .json (e.g. actor-registry.json)"
    )
    parser.add_argument("payload", type=Path, help="Path to JSON payload to write")
    parser.add_argument(
        "--producer", required=True, help="Agent/skill that produced this artifact"
    )
    parser.add_argument("--ttl", type=int, default=30, help="TTL days (default 30)")
    parser.add_argument(
        "--sources",
        nargs="*",
        default=[],
        help="Source files (used in checksum_sources)",
    )
    parser.add_argument(
        "--skip-schema",
        action="store_true",
        help="Skip schema validation (use only for ad-hoc artifacts)",
    )
    args = parser.parse_args()

    intel_dir: Path = args.intel_dir.resolve()
    payload: Path = args.payload.resolve()

    if not payload.exists():
        print(f"ERROR: payload not found: {payload}", file=sys.stderr)
        return 3

    if not intel_dir.exists():
        print(f"ERROR: intel_dir not found: {intel_dir}", file=sys.stderr)
        return 3

    # Step 1 — schema validation (optional skip for ad-hoc artifacts)
    if not args.skip_schema:
        schema = find_schema(args.artifact)
        if schema is None:
            print(
                f"WARN: no schema for {args.artifact}; proceeding without validation",
                file=sys.stderr,
            )
            # Exit 4 = warn but continue; caller decides whether to treat as failure
        else:
            ok, msg = validate_schema(payload, schema)
            if not ok:
                print(f"BLOCK: {msg}", file=sys.stderr)
                return 1

    # Step 2 — atomic write
    target = intel_dir / args.artifact
    try:
        atomic_write(target, payload)
    except Exception as e:
        print(f"ERROR: write failed: {e}", file=sys.stderr)
        return 3

    # Step 3 — _meta update
    ok, msg = update_meta(
        intel_dir, args.artifact, args.producer, args.ttl, args.sources
    )
    if not ok:
        print(f"WARN: {msg}", file=sys.stderr)
        return 2

    print(
        f"OK: wrote {target} (producer={args.producer} ttl={args.ttl}d)",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
