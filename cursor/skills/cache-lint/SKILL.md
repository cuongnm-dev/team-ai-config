---
name: cache-lint
description: Quét agent prompts + skill SKILL.md để bắt vi phạm Cache Discipline (CD-9 + CACHE_OPTIMIZATION.md). Phát hiện trailing whitespace, dynamic data trong static blocks, missing 4-block headers, kebab-case violations, CRLF line endings. Chạy on-demand hoặc qua hook khi edit file trong .cursor/agents/ hoặc .cursor/skills/.
---

# Cache Lint

Mục tiêu: Hard-enforce frozen-header + 4-block invariants thay vì chỉ convention trong tài liệu.

## Khi dùng
- Trước khi commit thay đổi file `.cursor/agents/*.md` hoặc `.cursor/skills/**/SKILL.md`
- Sau khi user thấy cache hit rate giảm
- Định kỳ (qua `/loop` hoặc Background Agent) audit toàn bộ pipeline

## Cách chạy

```
python ~/.cursor/skills/cache-lint/lint.py [--path PATH] [--fix-whitespace] [--strict]
```

Mặc định scan: `~/.cursor/agents/*.md` + `~/.cursor/skills/**/SKILL.md`.

## Rules được kiểm tra

| Rule | Mô tả | Severity |
|---|---|---|
| CL-1 | Trailing whitespace ở cuối dòng | warn |
| CL-2 | CRLF line endings (\\r\\n) | error |
| CL-3 | 4-block headers (`## Agent Brief`, `## Project Conventions`, `## Feature Context`, `## Inputs`) phải xuất hiện theo đúng thứ tự nếu file là agent prompt template | error |
| CL-4 | FROZEN_HEADER block không được chứa placeholder dynamic (`{iter}`, `{last_verdict}`, `{stage}`) | error |
| CL-5 | Field names trong header blocks: kebab-case, lowercase | warn |
| CL-6 | Tiếng Việt trong agent prompt body (CD-9) — chỉ allow trong frontmatter description, code-fence content examples | error |
| CL-7 | Tabs mixed với spaces trong YAML/Markdown header blocks | warn |
| CL-8 | File không có frontmatter `name:` + `description:` | error |
| CL-9 | Không có `\\n\\n\\n` (triple newline) ở khu vực FROZEN_HEADER → DYNAMIC_SUFFIX | warn |

## Output format

```
[ERROR] agents/dispatcher.md:147 CL-4 — Dynamic placeholder {stage} found in FROZEN_HEADER region
[WARN]  agents/pm.md:89 CL-1 — Trailing whitespace
[INFO]  Scanned 24 files, 2 errors, 5 warnings
```

Exit code: 0 nếu không có error, 1 nếu có error.

## Hook integration

Để auto-chạy khi save file, thêm vào `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python ~/.cursor/skills/cache-lint/lint.py --path ${file_path} --strict",
            "filter": "${file_path}.match(/\\\\.cursor[\\\\/](agents|skills)[\\\\/].*\\\\.md$/)"
          }
        ]
      }
    ]
  }
}
```

## Background Agent integration

Cursor Background Agent có thể chạy daily audit:
```
/loop 24h python ~/.cursor/skills/cache-lint/lint.py --strict > .cursor/cache-lint.log
```

Khi có error → escalate qua `@pm` (advisory mode) để review.
