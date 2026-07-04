## Tasks

- [ ] 1. Classify all second-level and deeper routes.
  - Group routes by product area and determine the correct AppShell-compatible wrapper.
  - Explicitly cover `/teacher/**`, `/admin/**`, `/data-center`, `/graph-center`, `/classroom/**`, `/ai/**`, `/playlists/**`, `/assessment/**`, `/arena/**`, `/simulations/**`, `/interactive-learning/**`, `/profile/**`, `/dashboard`, `/missions`, and `/virtual-lab`.
  - Record unavoidable exceptions with owner, reason, and removal condition.

- [ ] 2. Migrate course and lesson runtime routes.
  - Ensure course entry, student runtime, teacher runtime, and waiting pages keep the canonical rail and top bar.
  - Preserve immersive teaching controls as local tools, not shell replacements.

- [ ] 3. Migrate classroom, AI, playlist, and legacy student routes.
  - Wrap routes or route groups with AppShell-compatible shells.
  - Add breadcrumbs and active top-level navigation mapping.

- [ ] 4. Migrate teacher, administrator, data-center, graph-center, virtual-lab, and older interactive pages.
  - Remove standalone local headers where they compete with AppShell.
  - Preserve role-aware Personal Center targets for teacher and administrator routes.
  - Preserve activity-specific controls inside content or workspace slots.

- [ ] 5. Add deep-route coverage tests.
  - Verify every deep product route is wrapped or appears in the exception inventory.
  - Verify representative deep routes retain the canonical rail and top-right action order.
  - Verify registered wrappers pass the same header/sidebar/breadcrumb DOM contract as direct AppShell.

- [ ] 6. Validate the change.
  - Run `rtk openspec validate migrate-deep-product-routes-appshell-chrome --strict`.
  - Run route shell coverage tests plus representative Playwright visual checks.
