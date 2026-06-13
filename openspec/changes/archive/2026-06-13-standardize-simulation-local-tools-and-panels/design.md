## Local Tool Layer

`SimulationLocalToolWorkspace` is a display-only layer inside `SimulationShell`'s primary instrument frame. It renders:

- a collapsible left status/telemetry panel,
- a collapsible right control/evaluation panel,
- a hint strip below the primary scene,
- a sticky bottom toolbar scoped to simulation-local commands.

The component does not own simulation state, controller parameters, telemetry persistence, or Arena submission behavior. It receives only a template id and children, and leaves runtime components inside the instrument area.

## Template Families

The first templates map current simulations into four families:

- `heading-control`: Destroyer, LNG, Container.
- `dp-positioning`: Drilling, Dredger.
- `comfort-frequency`: Cruise.
- `ice-propulsion`: Icebreaker.

Template copy is intentionally instructional and low-risk. It names the expected local control categories without fabricating unavailable live data or changing simulation model truth.

## Mobile And Collapse Behavior

Side panels use native disclosure controls and expose `data-simulation-panel-collapsible="true"`. Mobile secondary controls are stacked below the scene via `data-simulation-mobile-secondary-controls="stacked-sheets"` rather than rendered as persistent sidebars. The bottom toolbar is part of the local workspace and uses platform tokens.

## Verification

Source tests assert that migrated pages pass a local template into `SimulationShell`, that the shared layer exposes side-panel, hint-strip, bottom-toolbar, mobile-secondary-control, and commercial zone markers, and that representative Playwright smoke coverage still finds a nonblank scene.
