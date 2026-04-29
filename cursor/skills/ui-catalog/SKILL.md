---
name: ui-catalog
description: Tạo file docs/ui-library/component-catalog.md bằng cách quét Figma kit hoặc mã nguồn của template UI đã cài đặt. Chạy 1 LẦN sau khi cài template — sau đó mọi tính năng đọc catalog tĩnh này thay vì gọi Figma MCP mỗi lần (tiết kiệm token và thời gian). Chỉ chạy lại khi nâng cấp template UI.
---

# Skill: UI Catalog Generator

> **Run once. All features reuse.**
> After catalog exists, `designer` reads it directly — no Figma MCP for discovery.
> Re-run only on major template version upgrade.

Output template is in `ref-catalog-template.md` (same folder).

## Step 0 — Read Template Config

Read `.cursor/rules/30-ui-template.mdc` (or workspace equivalent like `ui-metronic.mdc`) to get:
- Template name, framework, Figma kit URL, base path

**Source priority:** 1) Figma MCP (if URL configured) 2) Source scan (Glob/Grep)

## Step 1 — Discover Template Structure

```
glob: {base_path}/**/components/**/*.{tsx,jsx,vue,ts,js}
glob: {base_path}/**/pages/**/*.{tsx,jsx,vue}
glob: {base_path}/**/layouts/**/*.{tsx,jsx,vue}
glob: {base_path}/**/_variables.scss, **/tokens.{ts,js,json}, **/theme.{ts,js}
glob: {base_path}/**/index.{ts,js,tsx}  (barrel exports)
```

## Step 2 — Enumerate Components

For each component, extract: Name, Category, Import Path, Variants/Props, UI states (loading/error/empty/disabled), Description (JSDoc).

categories: Layout, Navigation, Forms, Data Display, Feedback, Overlay, Charts, Buttons & Actions, Badges & Tags, Page Templates.

## Step 3 — Extract Design Tokens

From token files: Colors (primary/secondary/etc + shades), Typography (families, sizes, weights), Spacing scale, Border radius, Shadows, Breakpoints.

## Step 4 — Write Catalog

Write to `docs/ui-library/component-catalog.md` using the template from `ref-catalog-template.md`. Fill all tables with discovered components and tokens.

## Step 5 — Report

```
## /ui-catalog Complete

template: {name} ({framework})
catalog: docs/ui-library/component-catalog.md

components: {N} across {N} categories
Page templates: {N}
Design token categories: {N}

next: /new-feature — BA, designer, fe-dev will use template-first development.
```

### Rules for extension vs creation
- Wrap template components, pass props — allowed
- Override via CSS variables — allowed
- Copy/rename template source — NOT allowed
- Duplicate existing component — NOT allowed

## ▶ What's next?

| Kết quả | Skill tiếp theo |
|---|---|
| Catalog cập nhật | `/new-feature` — reference catalog khi build UI mới |
| Component mới cần | `/implement` — implement component, rồi thêm vào catalog |
| Design system sync cần | `fe-dev` agent pull từ Figma Kit |
| Stale components found | `/tech-debt` — schedule cleanup |
