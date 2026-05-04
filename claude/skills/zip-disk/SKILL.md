---
name: zip-disk
description: Đóng gói toàn bộ sản phẩm bàn giao thành 1 file ZIP để giao khách hàng hoặc ghi ra đĩa. Tự đổi tên tiếng Việt có dấu, gom tài liệu Word/Excel + thư mục mã nguồn + Docker file, loại bỏ file build và cache không cần thiết. Tên file dạng: {tên-dự-án}-ban-giao-{ngày}.zip.
---

# ZIP Disk — Customer Delivery Package

**Output language:** Vietnamese for user messages. Filenames inside ZIP are Vietnamese (with diacritics).

---

## Step 0 — Auto-detect repo/workspace name (priority order)

**Goal:** Get ZIP filename without asking user — derive from repo context automatically.

```bash
PROJECT_PATH="${project-path:-.}"  # default to current directory
cd "$PROJECT_PATH"

# Priority 1: Git repo name (if git-tracked)
REPO_NAME=""
if [ -d ".git" ] || git rev-parse --is-inside-work-tree &>/dev/null; then
    # Try remote origin URL first (most authoritative)
    REMOTE_URL=$(git config --get remote.origin.url 2>/dev/null)
    if [ -n "$REMOTE_URL" ]; then
        # Extract repo name from URL: git@github.com:user/REPO.git → REPO
        #                             https://github.com/user/REPO    → REPO
        REPO_NAME=$(basename "$REMOTE_URL" .git)
    fi
    # Fallback: git rev-parse --show-toplevel → basename
    [ -z "$REPO_NAME" ] && REPO_NAME=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)")
fi

# Priority 2: package.json "name" field (Node workspaces)
[ -z "$REPO_NAME" ] && [ -f "package.json" ] && \
    REPO_NAME=$(python -c "import json; print(json.load(open('package.json')).get('name','').replace('@','').replace('/','-'))" 2>/dev/null)

# Priority 3: pnpm-workspace.yaml / nx.json workspace name
[ -z "$REPO_NAME" ] && [ -f "nx.json" ] && \
    REPO_NAME=$(python -c "import json; print(json.load(open('nx.json')).get('npmScope',''))" 2>/dev/null)

# Priority 4: pyproject.toml [project].name
[ -z "$REPO_NAME" ] && [ -f "pyproject.toml" ] && \
    REPO_NAME=$(grep -oP '^name\s*=\s*"\K[^"]+' pyproject.toml 2>/dev/null | head -1)

# Priority 5: go.mod module name (last path component)
[ -z "$REPO_NAME" ] && [ -f "go.mod" ] && \
    REPO_NAME=$(basename "$(grep -oP '^module\s+\K\S+' go.mod | head -1)")

# Priority 6: Cargo.toml package name
[ -z "$REPO_NAME" ] && [ -f "Cargo.toml" ] && \
    REPO_NAME=$(grep -A10 '^\[package\]' Cargo.toml | grep -oP '^name\s*=\s*"\K[^"]+' | head -1)

# Priority 7: folder name (fallback)
[ -z "$REPO_NAME" ] && REPO_NAME=$(basename "$(pwd)")

# Slugify: lowercase, hyphens, strip specials
SLUG=$(echo "$REPO_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//g')

echo "📦 Detected repo/workspace name: $REPO_NAME → slug: $SLUG"
```

---

## Step 1 — Inputs — confirm auto-detected + fill gaps

Show user the auto-detected name, ask to confirm or override. Ask other fields in 1 batch (G2):

```
📦 Đã phát hiện tên repo: {REPO_NAME}
   → tên file ZIP: {SLUG}-ban-giao-{YYYYMMDD}.zip

Xác nhận tên này? (yes, hoặc nhập tên khác)
Output ZIP path:   [Enter để dùng {project-path}/../]
Include PDF files? [yes/no]
```

```bash
# After confirmation
TODAY=$(date +%Y%m%d)
ZIP_NAME="${SLUG}-ban-giao-${TODAY}.zip"
ZIP_PATH="${output-zip-dir:-$(dirname $PROJECT_PATH)}/${ZIP_NAME}"

# Resolve docs output path — priority order (match generate-docs convention)
# SLUG đã detect ở Step 0
DOCS_OUT=""
for candidate in \
    "${PROJECT_PATH}/docs/generated/${SLUG}/output" \
    "${PROJECT_PATH}/docs/output" \
    "${PROJECT_PATH}/output"; do
  if [ -d "$candidate" ]; then
    DOCS_OUT="$candidate"
    break
  fi
done

# Resolve source paths
SRC_DIR="${PROJECT_PATH}/src"
[ -d "$SRC_DIR" ] || SRC_DIR="$PROJECT_PATH"

# Verify docs output exists
if [ -z "$DOCS_OUT" ]; then
  echo "ERROR: Không tìm thấy docs output ở bất kỳ path nào sau:"
  echo "  - docs/generated/${SLUG}/output/   (generate-docs convention, preferred)"
  echo "  - docs/output/                      (legacy)"
  echo "  - output/                           (legacy)"
  echo "Chạy /generate-docs trước."
  exit 1
fi
echo "📂 DOCS_OUT = $DOCS_OUT"
```

**Priority table summary (cho user biết skill lấy từ đâu):**

| Nguồn | Ví dụ | Dùng khi |
|---|---|---|
| Git remote `origin.url` | `github.com/user/etracking` → `etracking` | Có git remote |
| Git toplevel basename | `/projects/etracking/` → `etracking` | Git local, chưa remote |
| `package.json` name | `"@myorg/etracking"` → `myorg-etracking` | Node/JS project |
| `nx.json` npmScope | `"etracking"` | NX monorepo |
| `pyproject.toml` name | `name = "etracking"` | Python project |
| `go.mod` module | `module github.com/user/etracking` → `etracking` | Go project |
| `Cargo.toml` package.name | `name = "etracking"` | Rust project |
| Folder basename | `/path/to/etracking` → `etracking` | Fallback cuối cùng |

---

## Step 2 — Build filename mapping table (English → Vietnamese)

```python
FILENAME_MAP = {
    # Word documents
    "huong-dan-su-dung.docx":             "Hướng dẫn sử dụng.docx",
    "thiet-ke-kien-truc.docx":            "Thiết kế kiến trúc.docx",
    "thiet-ke-co-so.docx":                "Thiết kế cơ sở.docx",
    "thiet-ke-chi-tiet.docx":             "Thiết kế chi tiết.docx",
    "catalog.docx":                        "Danh mục chức năng.docx",
    "bo-test-case.docx":                  "Bộ test case.docx",
    # Excel
    "kich-ban-kiem-thu.xlsx":             "Kịch bản kiểm thử.xlsx",
    "test-cases.xlsx":                    "Kịch bản kiểm thử.xlsx",
    # PDF (if --include-pdf)
    "huong-dan-su-dung.pdf":              "Hướng dẫn sử dụng.pdf",
    "thiet-ke-kien-truc.pdf":             "Thiết kế kiến trúc.pdf",
}

# Per-service pattern: huong-dan-su-dung-{service}.docx → Hướng dẫn sử dụng - {service}.docx
PATTERN_RULES = [
    (r"^huong-dan-su-dung-(.+)\.docx$", r"Hướng dẫn sử dụng - \1.docx"),
    (r"^huong-dan-su-dung-(.+)\.pdf$",  r"Hướng dẫn sử dụng - \1.pdf"),
    (r"^thiet-ke-kien-truc-(.+)\.docx$",r"Thiết kế kiến trúc - \1.docx"),
    (r"^thiet-ke-co-so-(.+)\.docx$",    r"Thiết kế cơ sở - \1.docx"),
    (r"^thiet-ke-chi-tiet-(.+)\.docx$", r"Thiết kế chi tiết - \1.docx"),
]
```

For each file in `docs/output/`:
1. Check exact match in `FILENAME_MAP`
2. Else try `PATTERN_RULES` regex
3. Else keep original name + warn user
4. Also beautify service slugs: `api` → `API`, `web` → `Web`, `admin` → `Quản trị`

---

## Step 3 — Define source exclusion rules

```python
# Patterns to EXCLUDE when copying src/ (build artifacts + large dirs)
EXCLUDE_PATTERNS = [
    # Node/JS
    "node_modules/", ".next/", "dist/", "build/", "out/", ".turbo/", ".parcel-cache/",
    "coverage/", ".nyc_output/",
    # Python
    "__pycache__/", "*.pyc", ".pytest_cache/", ".mypy_cache/", ".ruff_cache/",
    "venv/", ".venv/", "env/", "*.egg-info/",
    # .NET
    "bin/", "obj/", "packages/", "TestResults/",
    # Java
    "target/", ".gradle/", "*.class",
    # Go
    "vendor/", "*.exe",
    # Rust
    "target/",
    # IDE / OS
    ".idea/", ".vscode/", ".vs/", "*.swp", ".DS_Store", "Thumbs.db",
    # Version control
    ".git/", ".svn/", ".hg/",
    # Logs / temp
    "*.log", "logs/", "tmp/", ".cache/",
    # Docker volumes (keep Dockerfile, exclude mounted data)
    "postgres-data/", "mysql-data/", "redis-data/", "volumes/",
    # Env files with secrets (include .env.example, exclude .env*)
    ".env", ".env.local", ".env.production", ".env.*.local",
    # Screenshots/generated docs (already in separate delivery)
    "docs/generated/", "docs/screenshots/", "docs/intel/", "docs/playwright/",
]

# Whitelist (always include even if matches EXCLUDE):
WHITELIST = [
    ".env.example",
    ".env.template",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.*.yml",
    ".dockerignore",
    ".gitignore",
    ".editorconfig",
    "README.md",
    "LICENSE",
]
```

---

## Step 4 — Pre-flight size check

```bash
# Estimate source size after exclusions
echo "🔍 Scanning source directory..."

# Quick estimate using rsync dry-run (if available) or du
if command -v rsync &>/dev/null; then
    # rsync with exclude patterns
    rsync -an --delete \
        --exclude=node_modules --exclude=.next --exclude=dist --exclude=build \
        --exclude=__pycache__ --exclude=bin --exclude=obj --exclude=target \
        --exclude=vendor --exclude=.git --exclude=venv --exclude=.venv \
        --exclude=coverage --exclude=logs \
        --stats "${SRC_DIR}/" /tmp/zip-disk-dryrun/ 2>&1 | grep "Total file size"
fi

# Alternative: du -sh with --exclude
du -sh --exclude=node_modules --exclude=dist --exclude=bin --exclude=obj "${SRC_DIR}" 2>/dev/null
```

Display estimate:
```
📦 Ước tính kích thước:
  Tài liệu:   {N} MB ({N} files)
  Mã nguồn:   {N} MB (sau khi loại node_modules, dist, bin, obj, .git)
  Tổng ZIP:   ~{N} MB (nén ~70%)

Tiếp tục? (yes/no)
```

If estimate > 500 MB → warn user, ask confirm.

---

## Step 5 — Create ZIP (Python implementation for cross-platform + UTF-8 filename support)

**IMPORTANT:** Windows `Compress-Archive` does NOT handle UTF-8 Vietnamese filenames correctly. Use Python `zipfile` with explicit UTF-8 encoding.

```python
import zipfile
import os
import re
import shutil
import fnmatch
from pathlib import Path
from datetime import datetime

def should_exclude(path_rel, exclude_patterns, whitelist):
    """Check if path should be excluded. Whitelist overrides."""
    name = os.path.basename(path_rel)
    # Whitelist always wins
    for wl in whitelist:
        if fnmatch.fnmatch(name, wl):
            return False
    # Check exclusion patterns
    for pattern in exclude_patterns:
        if pattern.endswith("/"):
            # Directory pattern — match any path component
            dir_name = pattern.rstrip("/")
            if dir_name in path_rel.replace("\\", "/").split("/"):
                return True
        elif fnmatch.fnmatch(name, pattern):
            return True
    return False

def vietnamese_rename(filename, filename_map, pattern_rules):
    """Map English filename → Vietnamese with diacritics."""
    if filename in filename_map:
        return filename_map[filename]
    for pattern, replacement in pattern_rules:
        m = re.match(pattern, filename)
        if m:
            # Beautify service slugs
            result = re.sub(pattern, replacement, filename)
            service_map = {
                "api": "API", "web": "Web", "admin": "Quản trị",
                "worker": "Worker", "api-gateway": "API Gateway",
                "mobile": "Mobile",
            }
            for eng, vi in service_map.items():
                result = result.replace(f"- {eng}.", f"- {vi}.")
            return result
    return filename  # fallback: keep original

def create_delivery_zip(project_path, docs_out, src_dir, zip_path,
                        include_pdf=True, exclude_patterns=None, whitelist=None,
                        filename_map=None, pattern_rules=None):
    file_count = 0
    skipped_docs = []

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        # ── Documents at ZIP root (flat, no subdirectory) ────────────────
        for fname in sorted(os.listdir(docs_out)):
            fpath = os.path.join(docs_out, fname)
            if not os.path.isfile(fpath):
                continue
            ext = fname.lower().rsplit(".", 1)[-1]
            if ext not in {"docx", "xlsx", "pdf" if include_pdf else ""}:
                continue

            vi_name = vietnamese_rename(fname, filename_map, pattern_rules)
            if vi_name == fname:
                skipped_docs.append(fname)  # no mapping found

            # Write at ZIP root — no "Tài liệu/" prefix
            zf.write(fpath, arcname=vi_name)
            file_count += 1
            print(f"  📄 {fname} → {vi_name}")

        # ── Source code in "Mã nguồn/" folder ────────────────────────────
        for root, dirs, files in os.walk(src_dir):
            # Filter dirs in-place to prevent walking into excluded
            dirs[:] = [d for d in dirs
                       if not should_exclude(os.path.relpath(os.path.join(root, d), src_dir),
                                             exclude_patterns, whitelist)]
            for fname in files:
                src_abs = os.path.join(root, fname)
                src_rel = os.path.relpath(src_abs, src_dir)
                if should_exclude(src_rel, exclude_patterns, whitelist):
                    continue
                # Write under "Mã nguồn/" folder
                arc_name = os.path.join("Mã nguồn", src_rel).replace("\\", "/")
                zf.write(src_abs, arcname=arc_name)
                file_count += 1

    # Warn about unmapped doc filenames
    if skipped_docs:
        print(f"\n⚠️  {len(skipped_docs)} file tài liệu không có mapping tên Việt, giữ nguyên tên gốc:")
        for f in skipped_docs:
            print(f"    - {f}")

    return file_count, os.path.getsize(zip_path)
```

Run the script, capture output.

---

## Step 6 — Verify + report

```bash
# Verify ZIP integrity
python -c "
import zipfile
with zipfile.ZipFile('$ZIP_PATH') as zf:
    bad = zf.testzip()
    if bad:
        print(f'ERROR: corrupted entry: {bad}')
        exit(1)
    print(f'OK: {len(zf.namelist())} entries, integrity verified')
"

# Final report
SIZE_MB=$(du -m "$ZIP_PATH" | cut -f1)
SIZE_ORIG=$(du -sm "$SRC_DIR" "$DOCS_OUT" 2>/dev/null | awk '{s+=$1} END {print s}')
RATIO=$(echo "scale=0; 100 - ($SIZE_MB * 100 / $SIZE_ORIG)" | bc 2>/dev/null || echo "~70")

echo "
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📦 ĐÓNG GÓI BÀN GIAO HOÀN TẤT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  File ZIP:    $ZIP_NAME
  Vị trí:      $ZIP_PATH
  Kích thước:  ${SIZE_MB} MB (giảm ${RATIO}% so với nguồn)
  Tổng files:  $file_count

  ✓ Tài liệu Word/Excel đổi tên tiếng Việt có dấu
  ✓ Mã nguồn đã loại: node_modules, dist, bin, obj, .git, venv, target...
  ✓ Giữ: Dockerfile, docker-compose.yml, .env.example, README.md

  🎯 Cấu trúc khi xả nén:
     ├── Hướng dẫn sử dụng.docx       (và các file tài liệu khác ở root)
     ├── Kịch bản kiểm thử.xlsx
     ├── Thiết kế kiến trúc.docx
     ├── ...
     └── Mã nguồn/
         ├── src/
         ├── docker-compose.yml
         ├── Dockerfile
         └── README.md

  📋 Bước tiếp theo:
     1. Test: xả nén vào thư mục tạm, chạy 'docker compose up' để verify
     2. Ghi đĩa: dùng Windows Explorer → right-click ZIP → Send to → DVD/USB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"
```

---

## Step 7 — Optional post-actions

Ask user:

```
Muốn thực hiện thêm? (chọn số nhiều, hoặc "no"):
  1. Generate SHA-256 checksum file (cho hợp đồng bàn giao)
  2. Test unzip vào thư mục tạm + verify Docker build (~2 phút)
  3. Ghi trực tiếp vào ổ đĩa/USB (cần chỉ định drive letter)
  4. Tạo README.txt tiếng Việt ở root ZIP (hướng dẫn xả nén + build)
```

### Option 1: SHA-256

```bash
python -c "
import hashlib
with open('$ZIP_PATH', 'rb') as f:
    h = hashlib.sha256(f.read()).hexdigest()
print(h)
" > "${ZIP_PATH}.sha256"
echo "Checksum saved: ${ZIP_PATH}.sha256"
```

### Option 2: Test unzip + docker build

```bash
TMPDIR=$(mktemp -d)
cd "$TMPDIR"
unzip -q "$ZIP_PATH"
cd "Mã nguồn"
docker compose config --quiet && echo "✓ docker-compose syntax OK" || echo "✗ docker-compose invalid"
# Optional: docker compose build --quiet (takes longer)
cd /
rm -rf "$TMPDIR"
```

### Option 4: README.txt

Prepend README at ZIP root:

```
HƯỚNG DẪN XẢ NÉN VÀ CÀI ĐẶT
============================

1. XẢ NÉN
   - Click phải → Extract All
   - Chọn thư mục đích (tránh Program Files để không bị UAC)

2. TÀI LIỆU
   Các file .docx, .xlsx ở thư mục gốc — mở bằng Microsoft Office (2016+).

3. CÀI ĐẶT MÃ NGUỒN
   Yêu cầu: Docker Desktop, Git (tùy chọn)

   Bước 1: cd "Mã nguồn"
   Bước 2: copy file .env.example → .env, chỉnh các biến môi trường
   Bước 3: docker compose up -d --build
   Bước 4: Mở trình duyệt truy cập http://localhost:{port}

4. LIÊN HỆ HỖ TRỢ
   Đơn vị phát triển: {dev-unit}
   Email / Hotline:   [điền thông tin liên hệ]
```

---

## Error handling

| Error | Action |
|---|---|
| `docs/output/` không tồn tại | Stop, suggest run `/generate-docs` first |
| No .docx/.xlsx in `docs/output/` | Warn, only package source code |
| `src/` không tồn tại | Fall back to project root, warn |
| Total size > 2 GB | Stop, suggest splitting or excluding more |
| Python not installed | Fall back to PowerShell `Compress-Archive` with warning about UTF-8 filename issue |
| ZIP write permission denied | Ask user for alternative output path |

---

## ▶ What's next?

| Kết quả | Hành động |
|---|---|
| ZIP tạo thành công | Test xả nén + docker compose up để verify trước khi bàn giao |
| File size quá lớn (>500MB) | Review EXCLUDE_PATTERNS, thêm các folder lớn (e.g. `assets/videos/`) |
| Tên file tài liệu không được map tiếng Việt | Bổ sung vào `FILENAME_MAP` trong skill, chạy lại |
| Cần bàn giao nhiều khách hàng khác nhau | Tạo config file mapping per-client → chạy skill với `--config customer-A.yaml` |
| Sau bàn giao, khách hàng report vấn đề | Dùng `git bundle` thay ZIP để khách pull updates qua `git fetch` |
