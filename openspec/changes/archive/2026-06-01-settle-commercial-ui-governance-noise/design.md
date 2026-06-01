## Context

`npm run test` passes smoke and Arena route checks, then fails in the commercial UI governance gate:

- `token.page-local-palette` in `src/app/page.tsx`
- `shell.unregistered-route-frame` for `/`

These are real governance findings, not false positives. The clean-up should make the homepage satisfy the active platform design-system contract.

## Approach

- Prefer adapting the homepage to the registered platform shell and token system.
- Use a narrow, dated exception only if a route is intentionally in a temporary migration state and an owner issue is recorded.
- Keep this change focused on the failing default test signal; do not start the larger commercial UI redesign series here.

## Verification

- `rtk npm run test:commercial-ui-governance`
- `rtk npm run test`
- Browser check for `/` at desktop and mobile widths if source UI changes are made.
- `rtk openspec validate settle-commercial-ui-governance-noise --strict`
