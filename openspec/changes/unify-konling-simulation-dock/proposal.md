## Why

Konling appears as a useful assistant, but simulation pages currently risk duplicate page-local assistant regions and right-bottom control collisions. The platform needs one simulation-aware dock behavior so assistance is available without hiding controls or scenes.

## What Changes

- Use one shared bottom-right contextual Konling assistant across simulation catalog, simulation detail pages, and learning mission pages.
- Remove or adapt page-local assistant panels that duplicate the global assistant.
- Define expanded, collapsed, mobile drawer, and collision-avoidance behavior for simulation workspaces.
- Keep Konling context server-owned and page-aware; client hints may identify surface context but not expand permissions.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `platform-design-system-and-shell`: define simulation dock placement, collision avoidance, and responsive behavior.
- `konling-agent-runtime`: define simulation page context expectations for the shared assistant.

## Impact

- Affects floating dock rendering, Konling launcher placement, simulation page support regions, and mobile assistant behavior.
- Does not implement new Konling tools beyond existing scoped simulation context capabilities.
