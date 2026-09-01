## 1. Establish failing force evidence

- [x] 1.1 Add 2D and 3D tests proving ordinary active nodes currently receive automatic fixed coordinates and do not move under configured forces.
- [x] 1.2 Replace zero-tick/source-string expectations with behavioral assertions for movement, separation, settlement and reflow.
- [x] 1.3 Record baseline force, frame, label-visibility and camera-fit metrics on the bounded overview and one-hop fixtures.

## 2. Separate coordinate ownership

- [x] 2.1 Model deterministic initial seeds, live settled coordinates and explicit user pins as distinct state in both dimensions.
- [x] 2.2 Keep line-free root packing fixed while removing automatic `fx`/`fy`/`fz` from ordinary active domain and neighborhood nodes.
- [x] 2.3 Make drag-end create an explicit pin, unpin return force ownership and manual reflow preserve all user pins.
- [x] 2.4 Preserve independent active/Legacy sessions and dimension-specific cameras without label- or type-based coordinate mapping.

## 3. Restore bounded force lifecycle

- [x] 3.1 Configure explicit warmup, reheat alpha, tick/time ceiling, settle milestone and reduced-motion behavior for 2D and 3D.
- [x] 3.2 Reheat only the connected scope affected by newly verified neighborhood nodes and keep unaffected coordinates stable.
- [x] 3.3 Delay camera fit until a valid settlement milestone and prevent filter-only changes from restarting full simulation.
- [x] 3.4 Make relayout produce a newly settled movable layout instead of recreating identical automatic anchors.

## 4. Restore default labels

- [x] 4.1 Mark DomainConcept overview labels as ordinary priority labels and integrate force separation with the shared collision/LOD policy.
- [x] 4.2 Define blocking visible-label ratios, overlap bounds and deferred-label counts for desktop/mobile 2D/3D.
- [x] 4.3 Preserve selected, hovered, keyboard-focused, rich-text and root-label behavior without per-frame content rendering.

## 5. Verify the change

- [x] 5.1 Run direct coordinate-owner, force-lifecycle, drag/pin, label-placement and camera tests plus the knowledge graph domain suite.
- [x] 5.2 Run real browser wheel/pinch, pan, drag, pin, unpin, reflow, neighborhood reheat and 2D/3D state-isolation checks with performance traces.
- [ ] 5.3 Run typecheck, lint, full `npm run test`, build, commercial UI governance and strict OpenSpec validation on the final clean revision.
- [ ] 5.4 Obtain independent review that rejects static-coordinate rendering, unbounded simulation and regressions to Legacy/session isolation.
