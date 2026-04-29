"""Read intel/*.json into a flexible canonical-facts dict.

Design: shape-tolerant. Different from-code/from-doc producers may emit slightly
different schemas; this loader does NOT assume fixed shape. It collects whatever
files exist and exposes them under canonical keys (intel.feature_catalog,
intel.sitemap, etc.) for the briefing builder to project per audience.

Missing files are tolerated — caller checks via `available()`. Bad JSON raises
explicitly so the orchestrator surfaces the issue rather than silently failing.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# Canonical mapping: skill-defined name → glob pattern in intel/.
# Multiple producers may write to different filenames; we accept aliases.
INTEL_FILE_ALIASES: dict[str, list[str]] = {
    "business_context":  ["business-context.json"],
    "system_inventory":  ["system-inventory.json"],
    "feature_catalog":   ["feature-catalog.json"],
    "actor_registry":    ["actor-registry.json"],
    "code_facts":        ["code-facts.json", "stack-facts.json"],
    "data_model":        ["data-model.json", "entities.json"],
    "sitemap":           ["sitemap.json"],
    "permission_matrix": ["permission-matrix.json"],
    "screenshot_map":    ["screenshot-map.json"],
    "test_evidence":     ["test-evidence/"],   # directory aggregate
    "integrations":      ["integrations.json"],
    "routes":            ["routes.json"],
    "auth_rules":        ["auth-rules.json"],
}


def load_canonical_facts(intel_dir: Path) -> dict[str, Any]:
    """Read all intel files into a flexible dict keyed by canonical names.

    Returns:
        {
          "_meta": {"intel_dir": str, "files_loaded": [...], "files_missing": [...]},
          "feature_catalog": {...} or None,
          "sitemap": {...} or None,
          ...
        }

    Missing files become None (not absent) — easier for downstream `if facts.X:` checks.
    """
    intel_dir = Path(intel_dir)
    if not intel_dir.exists():
        raise FileNotFoundError(f"Intel directory not found: {intel_dir}")

    facts: dict[str, Any] = {
        "_meta": {
            "intel_dir": str(intel_dir),
            "files_loaded": [],
            "files_missing": [],
        }
    }

    for canonical_key, candidate_names in INTEL_FILE_ALIASES.items():
        loaded = None
        for name in candidate_names:
            target = intel_dir / name
            if target.is_dir():
                # Directory aggregate — load all *.json into a list.
                files = sorted(target.glob("*.json"))
                if files:
                    loaded = [_safe_load(f) for f in files]
                    facts["_meta"]["files_loaded"].append(f"{name} ({len(files)} files)")
                    break
            elif target.is_file():
                loaded = _safe_load(target)
                facts["_meta"]["files_loaded"].append(name)
                break
        if loaded is None:
            facts["_meta"]["files_missing"].append(canonical_key)
        facts[canonical_key] = loaded

    return facts


def _safe_load(path: Path) -> Any:
    """Load JSON or raise with file context. Don't swallow errors — orchestrator
    needs to know if intel is corrupt."""
    try:
        with path.open(encoding="utf-8") as fp:
            return json.load(fp)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc


def available(facts: dict[str, Any]) -> set[str]:
    """Return the set of canonical keys that loaded successfully."""
    return {
        k for k, v in facts.items()
        if k != "_meta" and v is not None
    }


def field_at(obj: Any, path: str) -> Any:
    """Walk a dotted path into a nested dict/list. Returns None if any segment misses.

    Examples:
        field_at({"a":{"b":[{"c":1}]}}, "a.b[0].c")  → 1
        field_at({"a":{"b":2}}, "a.x")                → None
        field_at(facts, "feature_catalog.features")   → list of features
    """
    if obj is None or not path:
        return obj
    cursor = obj
    for segment in _split_path(path):
        if cursor is None:
            return None
        # List index: [N] or [N:M]
        if segment.startswith("["):
            try:
                idx = int(segment[1:-1])
            except ValueError:
                return None
            if not isinstance(cursor, list) or not (0 <= idx < len(cursor)):
                return None
            cursor = cursor[idx]
        elif isinstance(cursor, dict):
            cursor = cursor.get(segment)
        elif isinstance(cursor, list):
            # `field` after list → return None (caller should iterate explicitly)
            return None
        else:
            return None
    return cursor


def _split_path(path: str) -> list[str]:
    """Split 'a.b[0].c' into ['a', 'b', '[0]', 'c']."""
    out: list[str] = []
    buf = ""
    i = 0
    while i < len(path):
        ch = path[i]
        if ch == ".":
            if buf:
                out.append(buf)
                buf = ""
        elif ch == "[":
            if buf:
                out.append(buf)
                buf = ""
            j = path.find("]", i)
            if j == -1:
                raise ValueError(f"Unclosed bracket in path: {path!r}")
            out.append(path[i:j + 1])
            i = j
        else:
            buf += ch
        i += 1
    if buf:
        out.append(buf)
    return out


__all__ = ["load_canonical_facts", "available", "field_at", "INTEL_FILE_ALIASES"]
