## Context

The handoff accepts concept 2 as the simulation detail reference: AppShell navigation, top breadcrumb/context, central 3D scene, left telemetry/status panel, right control/evaluation panel, bottom toolbar, and a shared Konling dock. The audit shows that the implementation partially follows this shell but leaves resource-local scene chrome and an alternate cruise layout path.

## Goals / Non-Goals

**Goals:**

- Make all seven detail pages share the same scene-first command-deck geometry.
- Remove redundant resource-local scene navigation and route abbreviations.
- Move side panels upward so controls read as top-aligned command surfaces rather than mid-scene cards.
- Restore `/simulations/cruise` to the same geometry while preserving its learning/evidence context.
- Keep panel collapse, restore, keyboard access, and mobile reachability.

**Non-Goals:**

- No deletion of useful telemetry, controls, or mission/evidence context.
- No change to numerical behavior, task definitions, or evidence semantics.
- No redesign of the catalog page.

## Decisions

- AppShell breadcrumbs are the only upward navigation. Scene-local "返回上一层" creates duplicate navigation and must be removed.
- Route title and catalog metadata own simulation identity. Right-top abbreviations such as `LNG/OBE` are decorative resource chrome and must be removed.
- Side panels should anchor to the upper part of the simulation workspace, not float around the vertical midpoint. This better matches the command-deck concept and keeps bottom tools available.
- Cruise should not maintain a separate `workspaceSlots` geometry if that path prevents scene-first composition. Its context, support, command, and evidence content should be refit into the same shell primitives used by other simulations.

## Risks / Trade-offs

- [Risk] Removing internal labels may reduce local orientation if route title is hidden on mobile. Mitigation: keep AppShell breadcrumb/title visible or provide a compact shell title outside the scene chrome.
- [Risk] Moving panels upward can overlap top route chrome. Mitigation: define safe-area offsets relative to AppShell header and test 1440px and 320px layouts.
- [Risk] Cruise has more contextual content than other routes. Mitigation: keep content but move it into collapsible mission/support/evidence surfaces rather than widening or narrowing the scene.
