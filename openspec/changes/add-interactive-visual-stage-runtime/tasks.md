## 1. Runtime Contract

- [ ] 1.1 Add `visual.stage` to the shared manifest module registry.
- [ ] 1.2 Validate `stageId`, `aspectRatio`, `layers`, normalized regions, z-index, and optional reveal state.
- [ ] 1.3 Reject stage layers with missing ids, invalid regions, duplicate ids, or unsupported layer kinds.

## 2. Renderer

- [ ] 2.1 Implement a shared stage renderer with stable dimensions and responsive scaling.
- [ ] 2.2 Support student, teacher, guest, unavailable, unreleased, released, and revealed states.
- [ ] 2.3 Ensure mobile rendering stays readable and does not create horizontal overflow.
- [ ] 2.4 Ensure stage layers can host future diagram, formula, annotation, media, activity, and control renderers without course-private branching.

## 3. Evidence

- [ ] 3.1 Record stage view, release state, visible layer ids, active reveal state, and role.
- [ ] 3.2 Attach embedded activity anchors to the shared response path when a layer contains an activity target.
- [ ] 3.3 Expose teacher diagnostics for viewed count, release count, and current reveal state.

## 4. Visual QA

- [ ] 4.1 Capture student and teacher screenshots in light and dark themes.
- [ ] 4.2 Capture a non-default release or reveal state screenshot.
- [ ] 4.3 Add a browser assertion that the stage does not render as a vertical list of cards.
- [ ] 4.4 Save screenshot paths and visual source paths in the implementation acceptance artifact.

## 5. Validation

- [ ] 5.1 Run `rtk openspec validate add-interactive-visual-stage-runtime --strict`.
- [ ] 5.2 Run interactive module taxonomy and manifest runtime tests.
- [ ] 5.3 Run browser audit for both student and teacher roles.
