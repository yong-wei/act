## Why

The comprehensive simulation workbench still exposes a large object-selection area that competes with analysis panels, and the selected object is not visually clear enough across light and dark themes. Object models also need to be shown as formulas with structured labels so students can compare objects without reading dense plain text.

## What Changes

- Replace the always-expanded object selection region with collapsible object groups.
- Strengthen selected-object styling for both light and dark modes.
- Render typical and white-box object models with LaTeX/KaTeX instead of plain text transfer-function strings.
- Present object metadata such as source, visibility, and model type as labels or badges.
- Keep object selection connected to the shared workbench session and parameter drawer context.
- Provide safe feedback when an incompatible object is selected.

## Capabilities

### New Capabilities

- `control-workbench-object-selection`: object selector layout, selected-state styling, formula rendering, metadata labels, and incompatible-object feedback for the comprehensive simulation workbench.

### Modified Capabilities

None.

## Impact

- Affected frontend areas:
  - `src/features/control-workbench/shell/control-workbench-shell.tsx`
  - `src/features/control-workbench/session-resolver.ts`
  - `src/features/control-workbench/contracts/*`
  - object catalog and model-display helpers used by classic white-box contexts
- Affected tests should cover collapsed selector behavior, selected-state theme styling, formula rendering, labels, and safe incompatible-object handling.
