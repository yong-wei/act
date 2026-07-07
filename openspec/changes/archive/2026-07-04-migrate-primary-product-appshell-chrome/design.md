## Investigation

Observed primary-route issues:

- Knowledge Graph uses AppShell but lacks the same breadcrumb orientation expected from the unified top bar.
- Interactive Learning routes use `InteractiveLearningShell`, but the visible top-right account action is missing or inconsistent with other first-level routes.
- Learning Path uses `/assessment/adaptive-practice` as the current path planning surface; it places path management in the shell action area.
- Arena uses `ArenaPageShell`, but header action order is not guaranteed by the central AppShell contract.
- Virtual Simulation passes a Personal Center link through page actions, creating route-local ordering instead of shell ownership.
- Control Workbench passes a return link through `actions`, which makes the top-right action area route-specific.
- Student profile family uses AppShell, but current metadata leaves it in fixed report-ledger navigation rather than the same collapsible primary rail.

## Migration Rules

- Use the shared AppShell header action implementation for all primary module pages.
- Header right side contains only the shell-owned theme switch then role-aware Personal Center. Konling, assistant docks, return links, path management, exports, settings, filters, and other local commands do not enter that pair.
- Breadcrumbs identify 首页 or the parent product area and current surface.
- Route-local commands move to stable local command areas:
  - Learning Path path management: local path toolbar inside the learning-path surface.
  - Control Workbench return-to-exploration/challenge: breadcrumb/contextual return plus local command bar, not shell action.
  - Arena challenge/config commands: Arena page toolbar or challenge-local command area.
  - Simulation catalog/detail commands: simulation local tools or content toolbar.
  - Knowledge Graph filters/legend/view controls: canvas-local floating/tool panel, not shell action.
- The active left-nav item for nested primary surfaces resolves to the correct first-level module.

## Validation Matrix

Representative desktop and mobile checks should cover:

- `/knowledge`
- `/interactive-learning`
- `/assessment/adaptive-practice`
- `/arena`
- `/simulations`
- `/interactive-learning/control-workbench`
- `/profile`

Each route should be checked for:

- collapsible left navigation on desktop,
- canonical navigation order,
- breadcrumb presence,
- top-right order: theme switch then Personal Center,
- absence of route-local commands in the shell action pair.

Responsive checks must cover 1440, 1280, 1024, 768, 390, and 320 widths, including collapsed/expanded desktop rail, mobile drawer open/closed, breadcrumb truncation, right-action wrapping, and no horizontal overflow.
