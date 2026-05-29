## Why

The UI report identifies the existing admin states dashboard as a strong basis for a presentation-grade data center, but it is still framed as an admin page. Future evidence, simulation, Arena, ResourceNode, adaptive, and governance changes will add many readiness and confidence states. The platform needs a distinct data-center UI contract so presentation metrics and admin governance details do not collapse into one surface.

## What Changes

- Define a platform data center surface for presentation-ready metrics, module activity, learning trajectory summaries, simulation/Arena activity, classroom activity, and demo snapshots.
- Define how `/data-center` presentation mode and `/admin/states` governance mode share chart/status primitives while exposing different detail levels.
- Require demo/real source markers, privacy-safe aggregation, export-safe snapshots, and governed drilldown boundaries.

## Capabilities

### New Capabilities
- `platform-data-center-ui`: Defines presentation and governance UI contracts for platform-wide data center surfaces.

## Impact

- Affects future `/data-center`, existing `/admin/states`, shared chart panels, admin dashboard links, and downstream evidence/status consumers.
- Depends on `unify-platform-design-system-and-shell`, `normalize-role-navigation-and-entrypoints`, and `standardize-platform-status-and-evidence-ui`.
- Consumes governance and evidence contracts without replacing admin audit or teacher governance workspaces.
