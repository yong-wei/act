## 1. Dock Registration

- [ ] 1.1 Inventory all Konling launchers, assistant panels, settings buttons, and right-bottom fixed controls on simulation routes.
- [ ] 1.2 Register simulation catalog and detail pages with the shared dock model.
- [ ] 1.3 Remove or adapt duplicate page-local assistant panels.

## 2. Simulation Context

- [ ] 2.1 Provide route, simulation id, provenance, run summary availability, and task context to Konling through server-owned page context.
- [ ] 2.2 Ensure client hints cannot expand Konling tool permissions.
- [ ] 2.3 Add degraded/unavailable states when simulation context is missing.

## 3. Collision And Mobile Behavior

- [ ] 3.1 Define dock offsets relative to bottom toolbar, hint strip, and side panels.
- [ ] 3.2 Implement expanded assistant behavior that avoids covering primary controls.
- [ ] 3.3 Implement mobile drawer or sheet behavior with coherent focus order.

## 4. Acceptance

- [ ] 4.1 Capture desktop and 320px evidence showing Konling collapsed and expanded.
- [ ] 4.2 Verify the assistant does not overlap bottom toolbar, side panels, or primary scene.
- [ ] 4.3 Run dock/governance checks and `rtk openspec validate unify-konling-simulation-dock --strict`.
