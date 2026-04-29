#!/usr/bin/env python3
"""
agent_log.py — Observability for generate-docs pipeline (E17).

Append structured events to _agent-log.jsonl per run.

Events:
  - phase_start, phase_end
  - tool_call (MCP, Playwright, file ops)
  - finding (placeholder emitted, warning, error)
  - artifact_written
  - quality_gate_result

Usage (agent hook):
  python agent_log.py append --event phase_start --phase 1 --route A
  python agent_log.py summary --since "1h ago"

Reads/writes: {docs-path}/_agent-log.jsonl (append-only)
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def append_event(log_path, event_type, **kwargs):
    event = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "type": event_type,
        **kwargs
    }
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=False) + "\n")
    return event


def summary(log_path):
    if not log_path.exists():
        print("No log file.")
        return
    events = [json.loads(l) for l in open(log_path, encoding="utf-8") if l.strip()]

    by_type = {}
    for e in events:
        by_type.setdefault(e["type"], []).append(e)

    print(f"=== Agent log summary: {log_path} ===")
    print(f"Total events: {len(events)}")
    print()

    # Phase timing
    phase_starts = [e for e in events if e["type"] == "phase_start"]
    phase_ends = [e for e in events if e["type"] == "phase_end"]
    for start in phase_starts:
        end = next((e for e in phase_ends if e.get("phase") == start.get("phase")), None)
        if end:
            dur = datetime.fromisoformat(end["ts"]) - datetime.fromisoformat(start["ts"])
            print(f"  Phase {start['phase']}: {dur.total_seconds():.1f}s ({start.get('route', '-')})")

    # Tool calls
    tool_calls = by_type.get("tool_call", [])
    if tool_calls:
        tool_counts = {}
        for e in tool_calls:
            tool_counts[e.get("tool", "unknown")] = tool_counts.get(e.get("tool", "unknown"), 0) + 1
        print()
        print("  Tool calls:")
        for tool, cnt in sorted(tool_counts.items(), key=lambda x: -x[1])[:10]:
            print(f"    {tool}: {cnt}")

    # Findings
    findings = by_type.get("finding", [])
    if findings:
        severity_counts = {}
        for f in findings:
            severity_counts[f.get("severity", "info")] = severity_counts.get(f.get("severity", "info"), 0) + 1
        print()
        print(f"  Findings: {severity_counts}")

    # Artifacts
    artifacts = by_type.get("artifact_written", [])
    if artifacts:
        print()
        print(f"  Artifacts written: {len(artifacts)}")
        for a in artifacts[-5:]:
            print(f"    {a.get('path')} ({a.get('size_bytes', '?')}B)")

    # Quality gate
    qg = by_type.get("quality_gate_result")
    if qg:
        latest = qg[-1]
        print()
        print(f"  Quality gate: {latest.get('score')}/100 ({latest.get('verdict')})")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_append = sub.add_parser("append")
    p_append.add_argument("--log-path", required=True)
    p_append.add_argument("--event", required=True, dest="event_type")
    p_append.add_argument("--extra", default="{}", help="JSON string of extra fields")

    p_summary = sub.add_parser("summary")
    p_summary.add_argument("--log-path", required=True)

    args = ap.parse_args()
    log_path = Path(args.log_path)

    if args.cmd == "append":
        extra = json.loads(args.extra)
        event = append_event(log_path, args.event_type, **extra)
        print(json.dumps(event, ensure_ascii=False))
    elif args.cmd == "summary":
        summary(log_path)


if __name__ == "__main__":
    main()
