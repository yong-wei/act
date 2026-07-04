## Why

The current floating control architecture mixes theme switching and Konling in a bottom-right tools menu. Depending on route and registration state, the trigger can display “工具” or “控灵”, forcing users through a secondary menu even when the intended action is to open Konling.

Since theme switching is moving to the top-right header, the bottom-right floating entry should become a direct Konling action and avoid competing tool menus.

## What Changes

- Make the primary bottom-right floating control a direct Konling launcher on routes where Konling is available.
- Remove theme switching from the bottom-right floating menu; theme switching remains in the top-right shell action area.
- Keep page-local management or support controls out of the primary Konling button unless they have a separate approved shell placement.
- Validate that Konling does not overlap graph panels, local controls, forms, charts, or mobile content.
- Preserve route-level Konling context registration and existing GlobalAIProvider behavior.
- Depend on homepage/top-right theme switching being available before removing bottom-dock theme switching from shared floating controls.

## Impact

- Updates `PageFloatingControls` and `GlobalAIFloatingButton` responsibilities during implementation.
- Requires visual QA across knowledge graph, learning path center, interactive learning, simulation, and Arena surfaces.
- Does not change Konling chat message rendering, tool-call disclosure, or citation presentation.
