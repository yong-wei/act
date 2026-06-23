# Commercial UI Compact Spacing

This document records the page-edge spacing contract used by commercial UI surfaces.

## Contract

- Page-level shells use compact fixed edge spacing, not centered `max-w-*` wrappers.
- The shared spacing tokens live in `src/app/globals.css`:
  - `--platform-page-edge-x-mobile`
  - `--platform-page-edge-x-tablet`
  - `--platform-page-edge-x-desktop`
- AppShell route frames use `APP_SHELL_COMPACT_PAGE_EDGE_CLASS` from `src/components/platform/app-shell.tsx`.
- Interactive lesson pages use `.premium-lesson-main` and shared course topbar rules from `src/app/globals.css`.

## Exceptions

Allowed width constraints must be component-intrinsic, not page-level layout. Examples include dialogs, QR previews, print/export surfaces, media aspect wrappers, and measured text blocks.

Temporary page-level exceptions require inventory entries with owner, scope, reason, and removal condition in `artifacts/commercial-ui/compact-spacing-685/inventory.json`.

## Verification

Run these checks after changing page shells, AppShell frames, interactive runtimes, or workspace wrappers:

```bash
rtk npm run test:unit -- src/lib/__tests__/platform-ui-contracts.test.ts src/lib/__tests__/commercial-ui-governance.test.ts
COMPACT_SPACING_QA_BASE_URL=http://localhost:3001 rtk node scripts/tests/capture-compact-spacing-qa.mjs
rtk npm run test:commercial-ui-governance
rtk openspec validate standardize-sitewide-compact-spacing --strict
```

The visual capture covers 1024, 1100, 1279, 1440, 1920, 2560, 768, and 320 pixel widths across representative knowledge, text-first, interactive course entry, student runtime, teacher runtime, adaptive practice, simulation, teacher operations, report/evidence, and form-first route families. Form-first evidence uses intrinsic edge mode because the login form is a component-width surface rather than an AppShell page-edge workspace.
