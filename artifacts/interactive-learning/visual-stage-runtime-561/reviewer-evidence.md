# Visual Stage Runtime Review Evidence

The shared `visual.stage` runtime is exercised by the internal review route `/review/visual-stage-runtime-561`.

Evidence scope:

- Role states: student, teacher, guest.
- Theme states: light and dark.
- Viewports: mobile, desktop, projection.
- Stage states: unreleased, released, submitted, teacher reveal, answer reveal, diagnostics, unavailable.
- Keyboard evidence: the browser acceptance script tabs to the shared stage canvas and records `keyboardReachable` plus visible focus geometry.
- Browser assertion: normalized canvas uses `data-visual-stage-layout="freeform"` and does not render as a vertical list.
