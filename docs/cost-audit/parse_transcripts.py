"""
Cursor Transcript Parser — Cost Audit (v2)

Đọc ~/.cursor/projects/<proj>/agent-transcripts/<run-id>/ và phân tích:

1. Parent + subagent message metadata
2. Tool invocations (Read/Glob/Grep) per subagent
3. **NEW**: Estimate tool_result tokens by looking up actual file sizes on disk
   (Cursor không lưu tool_result trong JSONL, chỉ lưu tool_use args)
4. agent-tools/*.txt: stored tool outputs (terminal, web)
5. File read redundancy across subagents

Usage:
  python parse_transcripts.py [project-key]
  Default project: d-Projects-ufh-rfid

Output:
  - stdout: human-readable cost breakdown
  - transcript-analysis.json: machine-readable aggregate
  - per-stage-detail.json: per-Task() detail
"""
import json
import os
import sys
import re
from pathlib import Path
from collections import defaultdict, Counter

PROJECT_KEY = sys.argv[1] if len(sys.argv) > 1 else "d-Projects-ufh-rfid"
BASE = Path(os.path.expanduser("~/.cursor/projects")) / PROJECT_KEY / "agent-transcripts"
TOOLS_DIR = Path(os.path.expanduser("~/.cursor/projects")) / PROJECT_KEY / "agent-tools"

# Project root - infer from key (d-Projects-ufh-rfid -> D:\Projects\ufh-rfid)
def infer_project_root(key):
    parts = key.split("-")
    if len(parts) >= 3 and len(parts[0]) == 1:
        drive = parts[0].upper() + ":"
        rest = "\\".join(parts[1:])
        return Path(f"{drive}\\{rest}")
    return None

PROJECT_ROOT = infer_project_root(PROJECT_KEY)
CHARS_PER_TOKEN = 4


def chars_to_tokens(c):
    return c // CHARS_PER_TOKEN


def normalize_path(p):
    """Normalize Windows path: lowercase drive letter, forward separators ok."""
    if not p:
        return ""
    p = str(p).replace("/", "\\")
    if len(p) >= 2 and p[1] == ":":
        p = p[0].lower() + p[1:]
    return p


def file_size_on_disk(path):
    """Try to get current file size. Returns -1 if missing."""
    try:
        # Try as-is, then with normalized casing
        for variant in (path, path.replace("D:", "d:"), path.replace("d:", "D:")):
            p = Path(variant)
            if p.exists() and p.is_file():
                return p.stat().st_size
    except Exception:
        pass
    return -1


def extract_text(message_content):
    if isinstance(message_content, str):
        return message_content
    if not isinstance(message_content, list):
        return ""
    parts = []
    for item in message_content:
        if isinstance(item, dict):
            if item.get("type") == "text":
                parts.append(item.get("text", ""))
            elif item.get("type") == "tool_use":
                inp = item.get("input", {})
                parts.append(f"[tool:{item.get('name','?')} {json.dumps(inp)[:200]}]")
    return "\n".join(parts)


def parse_jsonl(path):
    messages = []
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    messages.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    except Exception as e:
        print(f"  Error reading {path}: {e}", file=sys.stderr)
    return messages


def detect_subagent_type(first_user_text):
    if not first_user_text:
        return "unknown"
    m = re.search(r"current-stage:\s*([a-z0-9\-]+)", first_user_text)
    if m:
        return m.group(1)
    m = re.search(r"\b(ba|sa|tech-lead|dev|qa|reviewer|security|devops|designer|domain-analyst|pm|dispatcher)\b",
                  first_user_text, re.IGNORECASE)
    if m:
        return m.group(1).lower()
    return "unknown"


def measure_frontmatter(prompt_text):
    sections = {"pipeline-context": 0, "intel-contract": 0, "current-state": 0}
    if "## Pipeline Context" in prompt_text:
        m = re.search(r"## Pipeline Context.*?(?=^## |\Z)", prompt_text, re.MULTILINE | re.DOTALL)
        if m:
            sections["pipeline-context"] = len(m.group(0))
    if "intel-contract:" in prompt_text:
        m = re.search(r"intel-contract:.*?(?=\n\w|^## |\Z)", prompt_text, re.MULTILINE | re.DOTALL)
        if m:
            sections["intel-contract"] = len(m.group(0))
    if "## Current State" in prompt_text:
        m = re.search(r"## Current State.*?(?=^## |\Z)", prompt_text, re.MULTILINE | re.DOTALL)
        if m:
            sections["current-state"] = len(m.group(0))
    sections["total"] = len(prompt_text)
    return sections


def collect_tool_invocations(messages):
    """Return list of all tool_use entries with name, input, and resolved metadata."""
    tools = []
    for msg in messages:
        content = msg.get("message", {}).get("content", [])
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "tool_use":
                    tools.append({
                        "name": item.get("name", "?"),
                        "input": item.get("input", {}),
                    })
    return tools


def estimate_tool_result_size(tool):
    """Estimate bytes that would have been returned by this tool call."""
    name = tool["name"]
    inp = tool.get("input", {})
    if name == "Read":
        path = inp.get("path") or inp.get("file_path") or inp.get("target_file")
        if not path:
            return 0, "no-path"
        size = file_size_on_disk(path)
        if size < 0:
            return 0, "missing"
        # Read tool may have offset/limit — heuristic: full size if no limit
        limit = inp.get("limit")
        if limit:
            # roughly limit lines × 100 chars/line cap
            return min(size, int(limit) * 100), "read-limited"
        return size, "read-full"
    elif name == "Glob":
        # Glob returns file list — varies widely. Estimate 50-200 entries × 80 chars/entry
        return 5000, "glob-estimated"
    elif name == "Grep":
        # Grep result depends on match count. Estimate.
        output_mode = inp.get("output_mode", "files_with_matches")
        if output_mode == "content":
            return 10000, "grep-content-estimated"
        return 3000, "grep-files-estimated"
    elif name in ("Bash", "PowerShell"):
        # Bash output varies. Conservative.
        return 2000, "bash-estimated"
    elif name == "Task":
        # Task subagent return — its summary
        return 5000, "task-summary-estimated"
    elif name in ("Write", "Edit", "MultiEdit", "updateCurrentStep"):
        return 200, "write-confirmation"
    return 500, "other-estimated"


def analyze_run(run_dir):
    run_id = run_dir.name
    parent_jsonl = run_dir / f"{run_id}.jsonl"
    subagent_dir = run_dir / "subagents"

    result = {
        "run_id": run_id,
        "parent": None,
        "subagents": [],
    }

    def analyze_one(jsonl_path, is_parent=False):
        msgs = parse_jsonl(jsonl_path)
        if not msgs:
            return None
        first_user = None
        for m in msgs:
            if m.get("role") == "user":
                first_user = extract_text(m.get("message", {}).get("content", []))
                break
        stage = detect_subagent_type(first_user or "")
        front = measure_frontmatter(first_user or "")
        text_chars = sum(len(extract_text(m.get("message", {}).get("content", []))) for m in msgs)
        tools = collect_tool_invocations(msgs)
        tool_results_bytes = 0
        tool_results_breakdown = Counter()
        file_reads_paths = []
        for t in tools:
            size, why = estimate_tool_result_size(t)
            tool_results_bytes += size
            tool_results_breakdown[t["name"]] += size
            if t["name"] == "Read":
                p = t["input"].get("path") or t["input"].get("file_path") or t["input"].get("target_file") or ""
                file_reads_paths.append(normalize_path(p))
        return {
            "file": jsonl_path.name,
            "is_parent": is_parent,
            "stage": stage,
            "messages": len(msgs),
            "prompt_chars": front["total"],
            "prompt_tokens": chars_to_tokens(front["total"]),
            "frontmatter_tokens": {k: chars_to_tokens(v) for k, v in front.items() if k != "total"},
            "text_response_chars": text_chars - front["total"],
            "text_response_tokens": chars_to_tokens(max(0, text_chars - front["total"])),
            "tool_count": len(tools),
            "tool_breakdown": dict(Counter(t["name"] for t in tools)),
            "tool_results_bytes": tool_results_bytes,
            "tool_results_tokens": chars_to_tokens(tool_results_bytes),
            "tool_results_breakdown_tokens": {k: chars_to_tokens(v) for k, v in tool_results_breakdown.items()},
            "file_reads_paths": file_reads_paths,
        }

    if parent_jsonl.exists():
        result["parent"] = analyze_one(parent_jsonl, is_parent=True)
    if subagent_dir.exists():
        for sa in sorted(subagent_dir.glob("*.jsonl")):
            sa_data = analyze_one(sa, is_parent=False)
            if sa_data:
                result["subagents"].append(sa_data)
    return result


def main():
    if not BASE.exists():
        print(f"ERROR: {BASE} not found", file=sys.stderr)
        sys.exit(1)

    print(f"=== Cursor Transcript Cost Audit (v2) ===")
    print(f"Project key: {PROJECT_KEY}")
    print(f"Inferred root: {PROJECT_ROOT}")
    print(f"Transcripts: {BASE}")
    print()

    runs = sorted([d for d in BASE.iterdir() if d.is_dir()])
    all_results = [analyze_run(r) for r in runs]

    # === Per-run summary ===
    print(f"{'='*120}")
    print(f"PER-RUN SUMMARY (tokens)")
    print(f"{'='*120}")
    header = f"{'run_id':38s} {'p_msg':>5s} {'p_text':>8s} {'p_tools':>8s} {'p_tool_res':>11s} {'subs':>5s} {'s_text':>8s} {'s_tools':>8s} {'s_tool_res':>11s}"
    print(header)
    grand = {"p_text": 0, "p_tool_res": 0, "s_text": 0, "s_tool_res": 0, "p_tools": 0, "s_tools": 0, "subs": 0}
    for ar in all_results:
        p = ar["parent"]
        p_text = p["text_response_tokens"] + p["prompt_tokens"] if p else 0
        p_tools = p["tool_count"] if p else 0
        p_tool_res = p["tool_results_tokens"] if p else 0
        p_msg = p["messages"] if p else 0
        s_text = sum(s["text_response_tokens"] + s["prompt_tokens"] for s in ar["subagents"])
        s_tools = sum(s["tool_count"] for s in ar["subagents"])
        s_tool_res = sum(s["tool_results_tokens"] for s in ar["subagents"])
        subs = len(ar["subagents"])
        grand["p_text"] += p_text; grand["p_tool_res"] += p_tool_res
        grand["s_text"] += s_text; grand["s_tool_res"] += s_tool_res
        grand["p_tools"] += p_tools; grand["s_tools"] += s_tools; grand["subs"] += subs
        print(f"{ar['run_id']:38s} {p_msg:>5d} {p_text:>8,} {p_tools:>8d} {p_tool_res:>11,} {subs:>5d} {s_text:>8,} {s_tools:>8d} {s_tool_res:>11,}")
    print("-" * 120)
    print(f"{'TOTAL':38s} {'':>5s} {grand['p_text']:>8,} {grand['p_tools']:>8d} {grand['p_tool_res']:>11,} {grand['subs']:>5d} {grand['s_text']:>8,} {grand['s_tools']:>8d} {grand['s_tool_res']:>11,}")
    grand_total_tokens = grand["p_text"] + grand["p_tool_res"] + grand["s_text"] + grand["s_tool_res"]
    print(f"\nGRAND TOTAL estimated tokens injected to LLM context: {grand_total_tokens:,}")
    print(f"  Parent text+prompt:   {grand['p_text']:>10,} ({100*grand['p_text']/grand_total_tokens:5.1f}%)")
    print(f"  Parent tool results:  {grand['p_tool_res']:>10,} ({100*grand['p_tool_res']/grand_total_tokens:5.1f}%)")
    print(f"  Subagent text+prompt: {grand['s_text']:>10,} ({100*grand['s_text']/grand_total_tokens:5.1f}%)")
    print(f"  Subagent tool results:{grand['s_tool_res']:>10,} ({100*grand['s_tool_res']/grand_total_tokens:5.1f}%)")
    print()

    # === By stage ===
    print(f"{'='*120}")
    print(f"BY STAGE — aggregate")
    print(f"{'='*120}")
    by_stage = defaultdict(lambda: {"calls": 0, "prompt_tok": 0, "resp_tok": 0,
                                     "tool_count": 0, "tool_res_tok": 0,
                                     "reads": 0, "globs": 0, "greps": 0, "bashes": 0})
    for ar in all_results:
        for s in ar["subagents"]:
            st = by_stage[s["stage"]]
            st["calls"] += 1
            st["prompt_tok"] += s["prompt_tokens"]
            st["resp_tok"] += s["text_response_tokens"]
            st["tool_count"] += s["tool_count"]
            st["tool_res_tok"] += s["tool_results_tokens"]
            st["reads"] += s["tool_breakdown"].get("Read", 0)
            st["globs"] += s["tool_breakdown"].get("Glob", 0)
            st["greps"] += s["tool_breakdown"].get("Grep", 0)
            st["bashes"] += s["tool_breakdown"].get("Bash", 0) + s["tool_breakdown"].get("PowerShell", 0)

    print(f"{'stage':22s} {'calls':>5s} {'avg_prompt':>10s} {'avg_resp':>9s} {'avg_tools':>9s} {'avg_tool_res':>12s} {'reads':>5s} {'globs':>5s} {'greps':>5s} {'bash':>5s}")
    rows = []
    for st_name, st in by_stage.items():
        n = st["calls"]
        rows.append((st["tool_res_tok"], st_name, st, n))
    for _, st_name, st, n in sorted(rows, reverse=True):
        avg_p = st["prompt_tok"] // n if n else 0
        avg_r = st["resp_tok"] // n if n else 0
        avg_tc = st["tool_count"] // n if n else 0
        avg_tres = st["tool_res_tok"] // n if n else 0
        print(f"{st_name:22s} {n:>5d} {avg_p:>10,} {avg_r:>9,} {avg_tc:>9d} {avg_tres:>12,} {st['reads']:>5d} {st['globs']:>5d} {st['greps']:>5d} {st['bashes']:>5d}")
    print()

    # === Top redundant Reads ===
    print(f"{'='*120}")
    print(f"FILE READ REDUNDANCY (after path normalization)")
    print(f"{'='*120}")
    file_counter = Counter()
    file_size_cache = {}
    for ar in all_results:
        for s in ar["subagents"]:
            for f in s["file_reads_paths"]:
                if not f:
                    continue
                file_counter[f] += 1
                if f not in file_size_cache:
                    file_size_cache[f] = file_size_on_disk(f)
        if ar["parent"]:
            for f in ar["parent"]["file_reads_paths"]:
                if not f:
                    continue
                file_counter[f] += 1
                if f not in file_size_cache:
                    file_size_cache[f] = file_size_on_disk(f)
    print(f"{'count':>6s}  {'file_size':>10s}  {'tokens_redundant':>16s}  path")
    grand_redundant = 0
    for f, n in file_counter.most_common(30):
        size = file_size_cache.get(f, -1)
        size_str = f"{size}" if size >= 0 else "missing"
        tok_redundant = chars_to_tokens(size * (n - 1)) if size >= 0 and n > 1 else 0
        grand_redundant += tok_redundant
        print(f"{n:>6d}  {size_str:>10s}  {tok_redundant:>16,}  {f}")
    print(f"\nTotal redundant tokens (n-1 reads × file_size): ~{grand_redundant:,}")
    print()

    # === agent-tools/*.txt analysis ===
    print(f"{'='*120}")
    print(f"AGENT-TOOLS DIR (stored tool outputs — terminal/web)")
    print(f"{'='*120}")
    if TOOLS_DIR.exists():
        total_bytes = 0
        for f in sorted(TOOLS_DIR.glob("*.txt")):
            sz = f.stat().st_size
            total_bytes += sz
            print(f"  {sz:>8,}B  ~{chars_to_tokens(sz):>7,}tok  {f.name}")
        print(f"\n  TOTAL: {total_bytes:,}B = ~{chars_to_tokens(total_bytes):,} tokens")
    else:
        print(f"  No agent-tools dir at {TOOLS_DIR}")
    print()

    # === Top expensive subagents by total tokens ===
    print(f"{'='*120}")
    print(f"TOP 15 EXPENSIVE Task() CALLS (prompt + response + tool_results)")
    print(f"{'='*120}")
    all_subs = []
    for ar in all_results:
        for s in ar["subagents"]:
            total = s["prompt_tokens"] + s["text_response_tokens"] + s["tool_results_tokens"]
            all_subs.append((total, s, ar["run_id"]))
    print(f"{'total_tok':>10s}  {'stage':18s}  {'prompt':>7s}  {'resp':>7s}  {'tool_res':>9s}  {'reads':>5s}  {'tools':>5s}  run")
    for total, s, run_id in sorted(all_subs, reverse=True)[:15]:
        print(f"{total:>10,}  {s['stage']:18s}  {s['prompt_tokens']:>7,}  {s['text_response_tokens']:>7,}  {s['tool_results_tokens']:>9,}  {s['tool_breakdown'].get('Read',0):>5d}  {s['tool_count']:>5d}  {run_id[:8]}")
    print()

    # === Summary card ===
    print(f"{'='*120}")
    print(f"SUMMARY CARD")
    print(f"{'='*120}")
    print(f"Project: {PROJECT_KEY}")
    print(f"Total runs: {len(all_results)}")
    print(f"Total Task() subagent calls: {grand['subs']}")
    print(f"Estimated context tokens injected to LLMs (visible portion):")
    print(f"  - Text + prompts: {grand['p_text'] + grand['s_text']:,}")
    print(f"  - Tool results (file reads, glob, grep, bash):  {grand['p_tool_res'] + grand['s_tool_res']:,}")
    print(f"  - GRAND TOTAL: {grand_total_tokens:,}")
    print(f"  - Tool result % of total: {100*(grand['p_tool_res']+grand['s_tool_res'])/grand_total_tokens:.1f}%")
    print(f"")
    print(f"Cursor billing same period (from CSV):")
    print(f"  - Apr 2026 total: 772M tokens, $397")
    print(f"  - Apr 20 (F-001 day): 45M tokens, $219")
    print(f"  - Apr 30 (F-002 day): 22M tokens, $11.70")
    print(f"")
    print(f"Coverage ratio:")
    print(f"  - Our estimate: {grand_total_tokens:,} tokens")
    print(f"  - Cursor billed (Apr 20 + Apr 30, F-001+F-002): ~67M tokens")
    print(f"  - Our estimate covers: {100*grand_total_tokens/67_000_000:.1f}% of billed")
    print(f"  - Gap explanation: agent system prompts (5-30K × 41 calls), alwaysApply rules,")
    print(f"    Cursor IDE auto-context, model thinking tokens, prompt cache writes")
    print()

    # === Save raw data ===
    out_path = Path(__file__).parent / "transcript-analysis.json"
    save = {
        "project": PROJECT_KEY,
        "summary": {
            "total_runs": len(all_results),
            "total_subagent_calls": grand["subs"],
            "tokens": grand,
            "grand_total": grand_total_tokens,
            "grand_redundant_reads": grand_redundant,
        },
        "by_stage": {k: dict(v) for k, v in by_stage.items()},
        "file_read_top": {f: {"count": n, "size": file_size_cache.get(f, -1)}
                          for f, n in file_counter.most_common(50)},
        "runs": [
            {
                "run_id": ar["run_id"],
                "parent_summary": {k: v for k, v in (ar["parent"] or {}).items()
                                    if k not in ("file_reads_paths",)},
                "subagent_count": len(ar["subagents"]),
                "subagent_summaries": [
                    {k: v for k, v in s.items() if k not in ("file_reads_paths",)}
                    for s in ar["subagents"]
                ],
            }
            for ar in all_results
        ],
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(save, f, indent=2, default=str)
    print(f"Raw data saved: {out_path}")


if __name__ == "__main__":
    main()
