## Why

React is the UI runtime for the application and the peer foundation for Next and the 3D visualization stack. Moving to React 19 requires explicit UI compatibility checks and type migration before React-dependent package majors are upgraded.

## What Changes

- Upgrade React, React DOM, and React type packages to the selected latest stable React 19 line.
- Address React 19 type and runtime compatibility issues in application code and shared UI primitives.
- Validate App Router pages and client components through tests and browser checks.
- Keep Tailwind 4, Prisma 7, and React Three Fiber/Drei major upgrades out of scope.

## Capabilities

### Modified Capabilities
- `stable-dependency-chain-migration`: Requires React runtime upgrades to be validated across shared UI, authenticated pages, and interactive routes.

## Impact

- Affects package versions, TypeScript types, shared UI primitives, client components, and browser-rendered pages.
- Unblocks later React Three Fiber and Drei latest-stable migration.
