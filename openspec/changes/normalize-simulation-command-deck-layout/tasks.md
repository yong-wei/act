## 1. Shell Geometry

- [ ] 1.1 Inventory current scene chrome and panel positions in all seven simulation detail routes.
- [ ] 1.2 Remove resource-local top-left `返回上一层` controls from simulation scene frames.
- [ ] 1.3 Remove resource-local top-right abbreviations such as `LNG/OBE` from simulation scene frames.
- [ ] 1.4 Move left telemetry/status and right control/evaluation panels to the upper command area with safe-area offsets.

## 2. Cruise Alignment

- [ ] 2.1 Refactor `/simulations/cruise` away from the alternate geometry that narrows and elongates the primary scene.
- [ ] 2.2 Preserve cruise context, support, command, and evidence information in collapsible mission or local-tool surfaces.
- [ ] 2.3 Ensure cruise mobile renders the scene before large explanatory content.

## 3. Interaction And Accessibility

- [ ] 3.1 Preserve panel collapse/restore behavior after the top-alignment change.
- [ ] 3.2 Ensure restore handles are keyboard reachable and named.
- [ ] 3.3 Verify bottom toolbar, hint strip, shared Konling dock, and side panels do not overlap at desktop and mobile widths.

## 4. Visual Acceptance

- [ ] 4.1 Capture all seven simulation details in desktop and mobile, light and dark themes.
- [ ] 4.2 Include explicit checks for absence of in-scene `返回上一层` and simulation abbreviation text.
- [ ] 4.3 Include cruise geometry comparison against at least two non-cruise simulation routes.
- [ ] 4.4 Run `rtk openspec validate normalize-simulation-command-deck-layout --strict`.
