---
description: Build UI catalog cho frontend — danh sách components, screens, design tokens. Sync với Figma qua MCP. Output - docs/intel/ui-catalog.json + thumbnails.
mode: primary
model: anthropic/claude-sonnet-4-20250514
---

# /ui-catalog {scope?}

## Step 1 — Scope

| Scope | Source |
|---|---|
| Frontend service/app | `apps/{name}/src/` or `services/{frontend}/src/` |
| Component library | `libs/ui/` or `packages/ui/` |
| Whole frontend | All frontend code in repo |

## Step 2 — Extract components

Scan code:
- React/Vue/Angular component files
- Storybook stories (if exists)
- Style files (SCSS / CSS modules / Tailwind config)

For each component:
- Name, file path, type (atom/molecule/organism)
- Props (TypeScript types)
- Variants/states
- Accessibility annotations

## Step 3 — Sync Figma (if MCP registered)

Use `mcp__figma__get_design_context` per component. Use `mcp__figma__add_code_connect_map` for traceability.

Output `docs/intel/code-connect-map.json` if Figma sync done.

## Step 4 — Build catalog

Save to `docs/intel/ui-catalog.json`:

```json
{
  "generated_at": "{ISO timestamp}",
  "scope": "{scope}",
  "components": [
    {
      "id": "comp-001",
      "name": "UserCard",
      "type": "molecule",
      "file": "src/components/UserCard.tsx",
      "props": [{"name": "user", "type": "User"}, ...],
      "variants": ["default", "compact", "expanded"],
      "states": ["default", "hover", "selected", "disabled"],
      "accessibility": {"aria_role": "button", "keyboard_nav": true},
      "figma_node_id": "...",
      "screenshot_path": "docs/intel/ui-screenshots/UserCard.png"
    }
  ],
  "design_tokens": {
    "colors": {...},
    "spacing": {...},
    "typography": {...}
  }
}
```

## Step 5 — Generate thumbnails

If Figma MCP available, fetch component screenshots → save to `docs/intel/ui-screenshots/`.

If not, skip — leave `screenshot_path: null`.

## Step 6 — Cross-reference

Map components to features via `feature-catalog.json.features[].ui_components[]`.

## What's next

| Outcome | Next |
|---|---|
| Catalog built | Use in `/generate-docs` HDSD section |
| Coverage gaps | `/code-change` to add missing components |
| Figma drift | Update Figma OR `/code-change` per source of truth |
