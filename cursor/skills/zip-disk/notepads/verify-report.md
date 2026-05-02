# Phase 6 — Verify + report

Loaded on demand by `zip-disk/SKILL.md` Phase 6.

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
  file:     $ZIP_NAME
  Vị trí:   $ZIP_PATH
  size:     ${SIZE} MB

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
