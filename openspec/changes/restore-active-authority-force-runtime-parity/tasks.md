## 1. Establish failing force evidence

- [ ] 1.1 Add 2D and 3D tests proving ordinary active nodes currently receive automatic fixed coordinates and do not move under configured forces.
- [ ] 1.2 Replace zero-tick/source-string expectations with behavioral assertions for movement, separation, settlement and reflow.
- [ ] 1.3 Record baseline force, frame, label-visibility and camera-fit metrics on the bounded overview and one-hop fixtures.

## 2. Separate coordinate ownership

- [ ] 2.1 Model deterministic initial seeds, live settled coordinates and explicit user pins as distinct state in both dimensions.
- [ ] 2.2 Keep line-free root packing fixed while removing automatic `fx`/`fy`/`fz` from ordinary active domain and neighborhood nodes.
- [ ] 2.3 Make drag-end create an explicit pin, unpin return force ownership and manual reflow preserve all user pins.
- [ ] 2.4 Preserve independent active/Legacy sessions and dimension-specific cameras without label- or type-based coordinate mapping.

## 3. Restore bounded force lifecycle

- [ ] 3.1 Configure explicit warmup, reheat alpha, tick/time ceiling, settle milestone and reduced-motion behavior for 2D and 3D.
- [ ] 3.2 Reheat only the connected scope affected by newly verified neighborhood nodes and keep unaffected coordinates stable.
- [ ] 3.3 Delay camera fit until a valid settlement milestone and prevent filter-only changes from restarting full simulation.
- [ ] 3.4 Make relayout produce a newly settled movable layout instead of recreating identical automatic anchors.

## 4. Restore default labels

- [ ] 4.1 Mark DomainConcept overview labels as ordinary priority labels and integrate force separation with the shared collision/LOD policy.
- [ ] 4.2 Define blocking visible-label ratios, overlap bounds and deferred-label counts for desktop/mobile 2D/3D.
- [ ] 4.3 Preserve selected, hovered, keyboard-focused, rich-text and root-label behavior without per-frame content rendering.

## 5. Verify the change

- [ ] 5.1 Run direct coordinate-owner, force-lifecycle, drag/pin, label-placement and camera tests plus the knowledge graph domain suite.
- [ ] 5.2 Run real browser wheel/pinch, pan, drag, pin, unpin, reflow, neighborhood reheat and 2D/3D state-isolation checks with performance traces.
- [ ] 5.3 Run typecheck, lint, full `npm run test`, build, commercial UI governance and strict OpenSpec validation on the final clean revision.
- [ ] 5.4 Obtain independent review that rejects static-coordinate rendering, unbounded simulation and regressions to Legacy/session isolation.
