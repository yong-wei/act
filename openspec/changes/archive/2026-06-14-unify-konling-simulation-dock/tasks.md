## 1. Dock Registration

- [x] 1.1 Inventory all Konling launchers, assistant panels, settings buttons, and right-bottom fixed controls on simulation routes.
- [x] 1.2 Register simulation catalog and detail pages with the shared dock model.
- [x] 1.3 Remove or adapt duplicate page-local assistant panels.

## 2. Simulation Context

- [x] 2.1 Provide route, simulation id, provenance, run summary availability, and task context to Konling through server-owned page context.
- [x] 2.2 Ensure client hints cannot expand Konling tool permissions.
- [x] 2.3 Add degraded/unavailable states when simulation context is missing.

## 3. Collision And Mobile Behavior

- [x] 3.1 Define dock offsets relative to bottom toolbar, hint strip, and side panels.
- [x] 3.2 Implement expanded assistant behavior that avoids covering primary controls.
- [x] 3.3 Implement mobile drawer or sheet behavior with coherent focus order.

## 4. Acceptance

- [x] 4.1 Capture desktop and 320px evidence showing Konling collapsed and expanded.
- [x] 4.2 Verify the assistant does not overlap bottom toolbar, side panels, or primary scene.
- [x] 4.3 Run dock/governance checks and `rtk openspec validate unify-konling-simulation-dock --strict`.
