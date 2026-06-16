## 1. Shell Geometry

- [x] 1.1 Inventory current scene chrome and panel positions in all seven simulation detail routes.
- [x] 1.2 Remove resource-local top-left `返回上一层` controls from simulation scene frames.
- [x] 1.3 Remove resource-local top-right abbreviations such as `LNG/OBE` from simulation scene frames.
- [x] 1.4 Move left telemetry/status and right control/evaluation panels to the upper command area with safe-area offsets.

## 2. Cruise Alignment

- [x] 2.1 Refactor `/simulations/cruise` away from the alternate geometry that narrows and elongates the primary scene.
- [x] 2.2 Preserve cruise context, support, command, and evidence information in collapsible mission or local-tool surfaces.
- [x] 2.3 Ensure cruise mobile renders the scene before large explanatory content.

## 3. Interaction And Accessibility

- [x] 3.1 Preserve panel collapse/restore behavior after the top-alignment change.
- [x] 3.2 Ensure restore handles are keyboard reachable and named.
- [x] 3.3 Verify bottom toolbar, hint strip, shared Konling dock, and side panels do not overlap at desktop and mobile widths.

## 4. Visual Acceptance

- [x] 4.1 Capture all seven simulation details in desktop and mobile, light and dark themes.
- [x] 4.2 Include explicit checks for absence of in-scene `返回上一层` and simulation abbreviation text.
- [x] 4.3 Include cruise geometry comparison against at least two non-cruise simulation routes.
- [x] 4.4 Run `rtk openspec validate normalize-simulation-command-deck-layout --strict`.
