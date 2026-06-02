## React Migration Focus

React 19 affects runtime and type contracts used by:

- Shared UI primitives under `src/components/ui`.
- Icon rendering and tree-shaking through `lucide-react`.
- Client components using refs and controlled inputs.
- App Router pages that mix server and client components.
- Next peer compatibility and generated types.

## Selected Versions

- `react` / `react-dom`: `^19.2.7`
- `@types/react`: `^19.2.16`
- `@types/react-dom`: `^19.2.3`
- `lucide-react`: `^1.17.0`

## Scope Boundary

This change should not upgrade Tailwind or Prisma. Those packages have their own migration lanes.

React 19 exposed a runtime peer mismatch with the previous 3D stack: `@react-three/fiber@8.18.0`, `@react-three/drei@9.122.0`, and the nested React reconciler were React 18-oriented while `/simulations/*` remained production reachable. Review therefore required restoring a peer-valid 3D runtime in the same PR rather than leaving a reachable peer-invalid rendering path. The fix upgrades the 3D visualization stack through the `upgrade-3d-visualization-stack` lane and restores 3D Playwright smoke coverage.

## Type Compatibility Notes

- Replace remaining `JSX.Element` source annotations with `ReactElement`.
- Provide explicit initial values to `useRef` calls affected by React 19 type overloads.
- Express component ref props as nullable `RefObject<T | null>` when the owning ref is initialized with `null`.
- Guard Markdown image/link props that can now be typed as `string | Blob`.
- Use `LucideIcon` for dynamic icon component configuration so lucide-react 1.x icon props remain typed.

## Browser Checks

Use routes that exercise:

- Shared shell and navigation.
- Login and authenticated redirection.
- Data center UI.
- Interactive lesson entry pages.
- Teacher/admin dashboards.
