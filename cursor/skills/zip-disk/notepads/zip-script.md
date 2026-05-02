# Phase 5 — Python ZIP script (UTF-8 safe)

Loaded on demand by `zip-disk/SKILL.md` Phase 5.

**CRITICAL**: Windows `Compress-Archive` does NOT handle Vietnamese filenames correctly. MUST use Python `zipfile` with UTF-8 encoding.

Save script to `{project}/.cursor/tmp/zip_disk.py` then run it:

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""zip-disk — Package delivery ZIP with Vietnamese filenames."""
import zipfile, os, re, sys, fnmatch, argparse
from datetime import datetime

FILENAME_MAP = {
    "huong-dan-su-dung.docx":  "Hướng dẫn sử dụng.docx",
    "thiet-ke-kien-truc.docx": "Thiết kế kiến trúc.docx",
    "thiet-ke-co-so.docx":     "Thiết kế cơ sở.docx",
    "thiet-ke-chi-tiet.docx":  "Thiết kế chi tiết.docx",
    "catalog.docx":            "Danh mục chức năng.docx",
    "bo-test-case.docx":       "Bộ test case.docx",
    "kich-ban-kiem-thu.xlsx":  "Kịch bản kiểm thử.xlsx",
    "test-cases.xlsx":         "Kịch bản kiểm thử.xlsx",
}

PATTERN_RULES = [
    (r"^huong-dan-su-dung-(.+)\.(docx|pdf)$",  r"Hướng dẫn sử dụng - \1.\2"),
    (r"^thiet-ke-kien-truc-(.+)\.(docx|pdf)$", r"Thiết kế kiến trúc - \1.\2"),
    (r"^thiet-ke-co-so-(.+)\.docx$",           r"Thiết kế cơ sở - \1.docx"),
    (r"^thiet-ke-chi-tiet-(.+)\.docx$",        r"Thiết kế chi tiết - \1.docx"),
]

SERVICE_MAP = {"api": "API", "web": "Web", "admin": "Quản trị",
               "worker": "Worker", "mobile": "Mobile", "api-gateway": "API Gateway"}

EXCLUDE = [
    "node_modules/", ".next/", "dist/", "build/", "out/", ".turbo/", ".parcel-cache/",
    "coverage/", ".nyc_output/", "__pycache__/", "*.pyc", ".pytest_cache/", ".mypy_cache/",
    ".ruff_cache/", "venv/", ".venv/", "env/", "*.egg-info/", "bin/", "obj/", "packages/",
    "TestResults/", "target/", ".gradle/", "*.class", "vendor/", "*.exe",
    ".idea/", ".vscode/", ".vs/", "*.swp", ".DS_Store", "Thumbs.db",
    ".git/", ".svn/", ".hg/", "*.log", "logs/", "tmp/", ".cache/",
    "postgres-data/", "mysql-data/", "redis-data/", "volumes/",
    ".env", ".env.local", ".env.production", ".env.*.local",
    "docs/generated/", "docs/screenshots/", "docs/intel/", "docs/playwright/",
]

WHITELIST = [".env.example", ".env.template", "Dockerfile", "docker-compose.yml",
             "docker-compose.*.yml", ".dockerignore", ".gitignore", ".editorconfig",
             "README.md", "LICENSE"]

def rename_vi(name):
    if name in FILENAME_MAP:
        return FILENAME_MAP[name]
    for pat, repl in PATTERN_RULES:
        m = re.match(pat, name)
        if m:
            result = re.sub(pat, repl, name)
            for eng, vi in SERVICE_MAP.items():
                result = result.replace(f"- {eng}.", f"- {vi}.")
            return result
    return name

def should_exclude(rel_path):
    basename = os.path.basename(rel_path)
    for wl in WHITELIST:
        if fnmatch.fnmatch(basename, wl):
            return False
    parts = rel_path.replace("\\", "/").split("/")
    for pat in EXCLUDE:
        if pat.endswith("/"):
            if pat.rstrip("/") in parts:
                return True
        elif fnmatch.fnmatch(basename, pat):
            return True
    return False

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--docs-out", required=True)
    ap.add_argument("--src-dir", required=True)
    ap.add_argument("--zip-path", required=True)
    ap.add_argument("--include-pdf", action="store_true")
    args = ap.parse_args()

    allowed_ext = {"docx", "xlsx"}
    if args.include_pdf:
        allowed_ext.add("pdf")

    file_count = 0
    skipped = []

    with zipfile.ZipFile(args.zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for fname in sorted(os.listdir(args.docs_out)):
            fpath = os.path.join(args.docs_out, fname)
            if not os.path.isfile(fpath):
                continue
            ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
            if ext not in allowed_ext:
                continue
            vi_name = rename_vi(fname)
            if vi_name == fname:
                skipped.append(fname)
            zf.write(fpath, arcname=vi_name)
            file_count += 1
            print(f"  📄 {fname} → {vi_name}")

        for root, dirs, files in os.walk(args.src_dir):
            dirs[:] = [d for d in dirs
                       if not should_exclude(os.path.relpath(os.path.join(root, d), args.src_dir))]
            for fname in files:
                src_abs = os.path.join(root, fname)
                src_rel = os.path.relpath(src_abs, args.src_dir)
                if should_exclude(src_rel):
                    continue
                arc = "Mã nguồn/" + src_rel.replace("\\", "/")
                zf.write(src_abs, arcname=arc)
                file_count += 1

    if skipped:
        print(f"\n⚠️  {len(skipped)} files không có mapping tên Việt:")
        for f in skipped:
            print(f"    - {f}")

    print(f"\n✅ Done: {args.zip_path}")
    print(f"   Files: {file_count}, Size: {os.path.getsize(args.zip_path) / 1024 / 1024:.1f} MB")

if __name__ == "__main__":
    main()
```

Run:
```bash
python .cursor/tmp/zip_disk.py \
  --docs-out "$DOCS_OUT" \
  --src-dir  "$SRC_DIR" \
  --zip-path "$ZIP_PATH" \
  ${INCLUDE_PDF:+--include-pdf}
```
