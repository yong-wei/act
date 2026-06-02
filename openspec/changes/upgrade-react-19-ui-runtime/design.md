## React Migration Focus

React 19 affects runtime and type contracts used by:

- Shared UI primitives under `src/components/ui`.
- Icon rendering and tree-shaking through `lucide-react`.
- Client components using refs and controlled inputs.
- App Router pages that mix server and client components.
- Next peer compatibility and generated types.

## Scope Boundary

This change should not upgrade React Three Fiber, Drei, Tailwind, or Prisma. Those packages have their own migration lanes.

## Browser Checks

Use routes that exercise:

- Shared shell and navigation.
- Login and authenticated redirection.
- Data center UI.
- Interactive lesson entry pages.
- Teacher/admin dashboards.
