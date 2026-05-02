---
name: zip-disk
description: Đóng gói toàn bộ sản phẩm bàn giao thành 1 file ZIP để giao khách hàng hoặc ghi ra đĩa. Tự đổi tên tiếng Việt có dấu, gom tài liệu Word/Excel + thư mục mã nguồn + Docker file, loại bỏ file build và cache không cần thiết. Tên file dạng: {tên-dự-án}-ban-giao-{ngày}.zip.
disable-model-invocation: true
---

# ZIP Disk — Customer delivery package

**Recommended model**: Composer 2 (simple deterministic task, no deep reasoning needed).
**Output language**: Vietnamese (status messages printed to user).

---

## Phase 0 — Auto-detect repo name

→ Read `notepads/repo-detect.md` and execute the `detect_repo_name` bash function. Output: `REPO_SLUG`, `ZIP_NAME`. Ask user confirmation.

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

**Service slug beautification (after rename):** `api → API | web → Web | admin → Quản trị | worker → Worker | mobile → Mobile | api-gateway → API Gateway`. No mapping found → keep original filename, log warning.

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

[ $ZIPPED -gt 500 ] && read -p "⚠️  ZIP có thể >${ZIPPED}MB. Tiếp tục? (y/n) " -n 1 CONFIRM
```

---

## Phase 5 — Create ZIP (Python, UTF-8 safe)

→ Read `notepads/zip-script.md` and execute. Saves Python script to `.cursor/tmp/zip_disk.py`, runs with `--docs-out`, `--src-dir`, `--zip-path`, optional `--include-pdf`.

---

## Phase 6 — Verify + report (and Phase 7 optional post-actions)

→ Read `notepads/verify-report.md` and execute. Covers integrity check, summary report, optional checksum / extract-test / drive-write / VN README.

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
