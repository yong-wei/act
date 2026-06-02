## Why

Next is the core application framework and currently sits behind the latest stable line. Migrating it requires explicit handling of framework behavior, lint configuration, generated types, standalone output, and browser route behavior.

## What Changes

- Upgrade the Next framework chain to the selected latest stable Next 16 release.
- Update related framework tooling such as `eslint-config-next`, Playwright peer requirements, and Next configuration as needed.
- Preserve App Router behavior, standalone build output, and deployment assumptions.
- Keep React 19, Prisma 7, Tailwind 4, and 3D visualization major upgrades out of scope unless strictly required by Next peer constraints.

## Capabilities

### Modified Capabilities
- `stable-dependency-chain-migration`: Requires framework upgrades to validate route behavior, browser behavior, and production build output.
- `dependency-vulnerability-catalog`: Records whether Next 16 changes any remaining Next-owned audit residuals.

## Impact

- Affects package versions, Next config, generated route types, lint tooling, build behavior, and browser route behavior.
- Requires browser verification across login, data center, home, interactive learning, teacher/admin, and representative simulation routes.
