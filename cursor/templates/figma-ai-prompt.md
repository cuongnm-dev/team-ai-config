## Figma AI Prompt Template

Use this template when composing the Figma AI generation prompt. Fill all fields from collected inputs before invoking.

```
Feature: {feature-name}
UI Surface: {screen/page/modal/drawer/table name}

Screens / Frames to generate:
- {list each screen or state as a separate frame}

For each frame, include these UI states as variants or separate frames:
- Empty state: {describe what user sees when no data}
- Loading state: {skeleton/spinner placement}
- Success state: {describe content when data loads}
- Error state: {error message text, retry affordance}
- Permission-denied state: {if applicable}

Form behavior (if applicable):
- Fields: {list fields with type, required/optional, validation rule}
- Field-level errors: {placement — inline below field}
- Form-level errors: {placement — top of form or submit area}
- Submit disabled until: {condition}
- Retry on failure: {yes/no, behavior}

Composition (assemble from these Metronic components — do NOT design custom):
- Layout shell:   {component name from vocabulary, e.g. PageWrapper + ContentCard}
- Data display:   {component name, e.g. DataTable with sortable+paginated variants}
- Toolbar:        {component name + slot description, e.g. Toolbar: SearchInput + FilterDropdown + Button(primary)}
- Actions:        {component names, e.g. Dropdown: Edit|Delete, Button variants}
- Overlays:       {component name + size, e.g. Modal(md) for create/edit}
- Status/labels:  {component name + variant, e.g. Badge: success/warning/danger}
- Feedback:       {component names, e.g. Skeleton(table), EmptyState, Alert}

Color tokens: {from Metronic kit — e.g. primary, success, danger, warning}
Spacing scale: {from Metronic kit — e.g. 4px base grid}
Typography:   {from Metronic kit — heading/body/label token names}

Accessibility requirements:
- Keyboard navigation order: {describe tab order}
- Focus indicators: visible on all interactive elements
- Error messages: announced via ARIA live region
- Input labels: always visible (not placeholder-only)

Interaction notes:
- {list key transitions, e.g. "Form submit → loading overlay → success toast"}
- {list hover/active/focus states for primary actions}
```

After generation, validate each checklist item above before accepting the output.
