---
name: zip-disk
description: Đóng gói toàn bộ sản phẩm bàn giao thành 1 file ZIP để giao khách hàng hoặc ghi ra đĩa. Tự đổi tên tiếng Việt có dấu, gom tài liệu Word/Excel + thư mục mã nguồn + Docker file, loại bỏ file build và cache không cần thiết. Tên file dạng: {tên-dự-án}-ban-giao-{ngày}.zip.
---

# ZIP Disk — Customer delivery package

**Recommended model**: Composer 2 (simple deterministic task, no deep reasoning needed).
**Output language**: Vietnamese (status messages printed to user).

---

## Phase 0 — Auto-detect repo name

Priority order (stop on first hit):

| # | Source | Extract |
|---|---|---|
| 1 | `git config --get remote.origin.url` | `basename $URL .git` |
| 2 | `git rev-parse --show-toplevel` | `basename $RESULT` |
| 3 | `package.json` → `.name` | strip `@scope/` prefix |
| 4 | `nx.json` → `.npmScope` | — |
| 5 | `pyproject.toml` → `[project].name` | — |
| 6 | `go.mod` line 1 | last path segment |
| 7 | `Cargo.toml` → `[package].name` | — |
| 8 | `basename $(pwd)` | fallback |

Slugify: lowercase, replace non-alphanumeric with `-`, collapse multi-hyphens, strip leading/trailing hyphens.

```bash
# Bash one-liner for auto-detect (terminal YOLO approved)
detect_repo_name() {
  local name=""
  # 1. Git remote
  name=$(git config --get remote.origin.url 2>/dev/null | sed 's/\.git$//' | xargs -I{} basename {})
  # 2. Git toplevel
  [ -z "$name" ] && name=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null)
  # 3. package.json
  [ -z "$name" ] && [ -f package.json ] && \
    name=$(node -p "require('./package.json').name" 2>/dev/null | sed 's/@[^/]*\///')
  # 4-7. Other manifest files
  [ -z "$name" ] && [ -f nx.json ] && name=$(node -p "require('./nx.json').npmScope" 2>/dev/null)
  [ -z "$name" ] && [ -f pyproject.toml ] && name=$(grep -oP '^name\s*=\s*"\K[^"]+' pyproject.toml 2>/dev/null | head -1)
  [ -z "$name" ] && [ -f go.mod ] && name=$(basename "$(grep -oP '^module\s+\K\S+' go.mod | head -1)")
  [ -z "$name" ] && [ -f Cargo.toml ] && name=$(grep -A10 '^\[package\]' Cargo.toml | grep -oP '^name\s*=\s*"\K[^"]+' | head -1)
  # 8. Fallback
  [ -z "$name" ] && name=$(basename "$(pwd)")
  # Slugify
  echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//g'
}

REPO_SLUG=$(detect_repo_name)
TODAY=$(date +%Y%m%d)
ZIP_NAME="${REPO_SLUG}-ban-giao-${TODAY}.zip"
```

Show detected name, ask 1 line confirm:
```
📦 Repo: {REPO_SLUG} → ZIP: {ZIP_NAME}
Xác nhận (yes) hoặc nhập tên khác:
```

---

## Phase 1 — Inputs (1 batch)

User-facing prompts (VN):
```
ZIP output dir:    [Enter để dùng thư mục cha của project]
Include PDF?       [yes/no]
```

Resolve paths:
```bash
PROJECT_PATH="${PWD}"

# Match generate-docs convention: docs/generated/<slug>/output/
# Priority: new convention → legacy paths → error
DOCS_OUT=""
for candidate in \
    "${PROJECT_PATH}/docs/generated/${SLUG}/output" \
    "${PROJECT_PATH}/docs/output" \
    "${PROJECT_PATH}/output"; do
  [ -d "$candidate" ] && DOCS_OUT="$candidate" && break
done

SRC_DIR="${PROJECT_PATH}/src"
[ -d "$SRC_DIR" ] || SRC_DIR="$PROJECT_PATH"
ZIP_PATH="${ZIP_DIR:-$(dirname $PROJECT_PATH)}/${ZIP_NAME}"

# Blocker check
if [ -z "$DOCS_OUT" ]; then
  echo "❌ Không tìm thấy docs output — thử các path sau:"
  echo "   - docs/generated/${SLUG}/output/   (convention mới)"
  echo "   - docs/output/                       (legacy)"
  echo "   - output/                            (legacy)"
  echo "Chạy /generate-docs trước."
  exit 1
fi
echo "📂 DOCS_OUT = $DOCS_OUT"
```

---

## Phase 2 — Filename mapping (English → Vietnamese)

**Exact matches:**

| Source | → Target |
|---|---|
| `huong-dan-su-dung.docx` | `Hướng dẫn sử dụng.docx` |
| `thiet-ke-kien-truc.docx` | `Thiết kế kiến trúc.docx` |
| `thiet-ke-co-so.docx` | `Thiết kế cơ sở.docx` |
| `thiet-ke-chi-tiet.docx` | `Thiết kế chi tiết.docx` |
| `catalog.docx` | `Danh mục chức năng.docx` |
| `bo-test-case.docx` | `Bộ test case.docx` |
| `kich-ban-kiem-thu.xlsx` | `Kịch bản kiểm thử.xlsx` |
| `test-cases.xlsx` | `Kịch bản kiểm thử.xlsx` |

**Per-service regex patterns:**

| Pattern | Replacement |
|---|---|
| `^huong-dan-su-dung-(.+)\.(docx\|pdf)$` | `Hướng dẫn sử dụng - $1.$2` |
| `^thiet-ke-kien-truc-(.+)\.(docx\|pdf)$` | `Thiết kế kiến trúc - $1.$2` |
| `^thiet-ke-co-so-(.+)\.docx$` | `Thiết kế cơ sở - $1.docx` |
| `^thiet-ke-chi-tiet-(.+)\.docx$` | `Thiết kế chi tiết - $1.docx` |

**Service slug beautification (after rename):**

| Slug | → Display |
|---|---|
| `api` | `API` |
| `web` | `Web` |
| `admin` | `Quản trị` |
| `worker` | `Worker` |
| `mobile` | `Mobile` |
| `api-gateway` | `API Gateway` |

No mapping found → keep original filename, log warning.

---

## Phase 3 — Source exclusions

**EXCLUDE_PATTERNS** (grouped by stack):

| Stack | Patterns |
|---|---|
| Node/JS | `node_modules/`, `.next/`, `dist/`, `build/`, `out/`, `.turbo/`, `.parcel-cache/`, `coverage/`, `.nyc_output/` |
| Python | `__pycache__/`, `*.pyc`, `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`, `venv/`, `.venv/`, `env/`, `*.egg-info/` |
| .NET | `bin/`, `obj/`, `packages/`, `TestResults/` |
| Java | `target/`, `.gradle/`, `*.class` |
| Go | `vendor/`, `*.exe` |
| Rust | `target/` |
| IDE/OS | `.idea/`, `.vscode/`, `.vs/`, `*.swp`, `.DS_Store`, `Thumbs.db` |
| VCS | `.git/`, `.svn/`, `.hg/` |
| Logs/Temp | `*.log`, `logs/`, `tmp/`, `.cache/` |
| Docker volumes | `postgres-data/`, `mysql-data/`, `redis-data/`, `volumes/` |
| Secrets | `.env`, `.env.local`, `.env.production`, `.env.*.local` |
| Doc artifacts | `docs/generated/`, `docs/screenshots/`, `docs/intel/`, `docs/playwright/` |

**WHITELIST** (always include, override excludes):

`.env.example`, `.env.template`, `Dockerfile`, `docker-compose.yml`, `docker-compose.*.yml`, `.dockerignore`, `.gitignore`, `.editorconfig`, `README.md`, `LICENSE`

---

## Phase 4 — Pre-flight size check

```bash
# Estimate (du with excludes)
SRC_SIZE=$(du -sm --exclude=node_modules --exclude=.next --exclude=dist --exclude=build \
  --exclude=__pycache__ --exclude=bin --exclude=obj --exclude=target --exclude=vendor \
  --exclude=.git --exclude=venv --exclude=.venv --exclude=coverage --exclude=logs \
  "$SRC_DIR" 2>/dev/null | cut -f1)
DOCS_SIZE=$(du -sm "$DOCS_OUT" 2>/dev/null | cut -f1)
TOTAL=$((SRC_SIZE + DOCS_SIZE))
ZIPPED=$((TOTAL * 30 / 100))  # ~70% compression

echo "📊 Ước tính:
  Tài liệu: ${DOCS_SIZE} MB
  Mã nguồn: ${SRC_SIZE} MB (sau exclude)
  ZIP ước tính: ~${ZIPPED} MB"

# Warn if >500MB
[ $ZIPPED -gt 500 ] && read -p "⚠️  ZIP có thể >${ZIPPED}MB. Tiếp tục? (y/n) " -n 1 CONFIRM
```

---

## Phase 5 — Create ZIP (Python, UTF-8 safe)

**CRITICAL**: Windows `Compress-Archive` KHÔNG handle tiếng Việt đúng. BẮT BUỘC dùng Python `zipfile` với encoding UTF-8.

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
    # Whitelist wins
    for wl in WHITELIST:
        if fnmatch.fnmatch(basename, wl):
            return False
    # Check patterns
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
        # Docs at ZIP root (flat, no subdirectory)
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

        # Source code in "Mã nguồn/" folder
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

---

## Phase 6 — Verify + report

```bash
# Integrity check
python -c "
import zipfile
with zipfile.ZipFile('$ZIP_PATH') as zf:
    bad = zf.testzip()
    print('❌ Corrupt:', bad) if bad else print('✓ Integrity OK')
    print(f'  Entries: {len(zf.namelist())}')
"

SIZE=$(du -m "$ZIP_PATH" | cut -f1)
echo "
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📦 ĐÓNG GÓI HOÀN TẤT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  File:     $ZIP_NAME
  Vị trí:   $ZIP_PATH
  Size:     ${SIZE} MB
  
  Cấu trúc ZIP:
    ├── Hướng dẫn sử dụng.docx  (và các tài liệu khác ở root)
    ├── Kịch bản kiểm thử.xlsx
    ├── Thiết kế kiến trúc.docx
    └── Mã nguồn/
        ├── src/
        ├── docker-compose.yml
        └── README.md
  
  ✓ Loại: node_modules, dist, bin, obj, .git, venv, target
  ✓ Giữ: Dockerfile, docker-compose.yml, .env.example
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"

# Cleanup tmp
rm -f .cursor/tmp/zip_disk.py
```

---

## Phase 7 — Optional post-actions

Hỏi user (có thể chọn nhiều hoặc skip):

| # | Action | Command |
|---|---|---|
| 1 | SHA-256 checksum | `python -c "import hashlib;print(hashlib.sha256(open('$ZIP').read()).hexdigest())" > $ZIP.sha256` |
| 2 | Test xả nén + docker build | `unzip $ZIP -d /tmp/test && cd /tmp/test/Mã\ nguồn && docker compose config --quiet` |
| 3 | Ghi trực tiếp vào ổ đĩa | Nhờ user cung cấp drive letter, dùng `cp` hoặc Explorer |
| 4 | Thêm README.txt tiếng Việt | Insert vào ZIP via `zipfile.writestr()` |

---

## Error handling

| Condition | Action |
|---|---|
| `docs/output/` không tồn tại | Stop, suggest `/generate-docs` trước |
| No .docx/.xlsx | Warn, chỉ package source |
| `src/` không tồn tại | Fallback to project root, warn |
| Total size >2GB | Stop, suggest split hoặc thêm exclude |
| Python không có | Lỗi nghiêm trọng — Cursor cần Python cho UTF-8 filename. Hướng dẫn `winget install Python.Python.3.12` |
| ZIP write permission denied | Hỏi output path khác |

---

## Cursor-specific features

- **YOLO mode**: skill chạy `python`, `unzip`, `du`, `git config` → cần YOLO approved list
- **Checkpoint trước khi xóa tmp script**: Cursor 3 Checkpoint có thể rollback nếu cần debug script
- **MEMORIES.md**: persist `dev-unit`, `client-name` across runs để không phải hỏi lại
- **@Files**: có thể mention `@Files docs/output/` để Cursor validate đúng thư mục trước khi zip

---

## ▶ What's next?

| Kết quả | Hành động |
|---|---|
| ZIP tạo thành công | Test xả nén + `docker compose up` để verify |
| File >500MB | Review EXCLUDE_PATTERNS, thêm folders lớn |
| Filename không map tiếng Việt | Bổ sung `FILENAME_MAP`, chạy lại |
| Multiple khách hàng khác nhau | Tạo config file mapping per-client |
| Post-delivery updates | Dùng `git bundle` thay ZIP để customer `git fetch` |
