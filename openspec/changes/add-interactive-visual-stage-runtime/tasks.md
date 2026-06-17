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
- [ ] 3.4 Record evidence samples with `eventType`, `clientEventId`, `attemptKey`, trusted `sourceLogId`, `lessonKey`, `stepId`, `moduleId`, `componentKind`, `componentId`, `actorRole`, `clientEventAt`, `schemaVersion`, and `payload`.
- [ ] 3.5 Classify each stage event as `InteractionLog` only, `StudentStepResponse`, or `LearningFact` materialization input.
- [ ] 3.6 Define diagnostics denominator, dedupe key, latest-vs-all-attempt policy, resubmission display, unreleased-student inclusion, default free-text redaction, and teacher/admin-only access.

## 4. Visual QA

- [ ] 4.1 Capture student and teacher screenshots in light and dark themes.
- [ ] 4.2 Capture required state-matrix screenshots for student unreleased, student released, student submitted or browsed, teacher reveal, teacher answer reveal, and teacher diagnostic aggregation.
- [ ] 4.3 Capture mobile, desktop, and projection viewport screenshots with no horizontal overflow and no teacher controls covering the main stage.
- [ ] 4.4 Add a browser assertion that the stage does not render as a vertical list of cards.
- [ ] 4.5 Save screenshot paths and visual source paths in the implementation acceptance artifact using the shared screenshot naming schema.

## 5. Validation

- [ ] 5.1 Run `rtk openspec validate add-interactive-visual-stage-runtime --strict`.
- [ ] 5.2 Run interactive module taxonomy and manifest runtime tests.
- [ ] 5.3 Run browser audit for both student and teacher roles.
