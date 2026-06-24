## Why

Several packages have latest stable patch or minor releases that do not require a framework, database, or design-system major migration. Updating those first reduces background dependency drift and keeps later major migration failures easier to attribute.

## What Changes

- Upgrade eligible low-risk stable packages within compatible major lines or clearly low-risk minor lines.
- Keep Next, React, Prisma, Tailwind, React Three Fiber, Drei, Three, ESLint major, TypeScript major, Zod major, and bcrypt major out of scope.
- Re-run audit, typecheck, unit, smoke, and browser checks required by the touched package surfaces.

## Capabilities

### Modified Capabilities
- `stable-dependency-chain-migration`: Requires low-risk stable package refreshes to be isolated from major framework migrations.

## Impact

- Affects package versions and lockfile only, except for minimal compatibility updates required by upgraded packages.
- Reduces dependency drift before the high-risk migration stages.
- Provides a clean baseline for later major upgrades.
