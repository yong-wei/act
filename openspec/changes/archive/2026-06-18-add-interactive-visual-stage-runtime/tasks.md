## 1. Runtime Contract

- [x] 1.1 Add `visual.stage` to the shared manifest module registry.
- [x] 1.2 Validate `stageId`, `aspectRatio`, `layers`, normalized regions, z-index, and optional reveal state.
- [x] 1.3 Reject stage layers with missing ids, invalid regions, duplicate ids, or unsupported layer kinds.

## 2. Renderer

- [x] 2.1 Implement a shared stage renderer with stable dimensions and responsive scaling.
- [x] 2.2 Support student, teacher, guest, unavailable, unreleased, released, and revealed states.
- [x] 2.3 Ensure mobile rendering stays readable and does not create horizontal overflow.
- [x] 2.4 Ensure stage layers can host future diagram, formula, annotation, media, activity, and control renderers without course-private branching.

## 3. Evidence

- [x] 3.1 Record stage view, release state, visible layer ids, active reveal state, and role.
- [x] 3.2 Attach embedded activity anchors to the shared response path when a layer contains an activity target.
- [x] 3.3 Expose teacher diagnostics for viewed count, release count, and current reveal state.
- [x] 3.4 Record evidence samples with `eventType`, `clientEventId`, `attemptKey`, trusted `sourceLogId`, `lessonKey`, `stepId`, `moduleId`, `componentKind`, `componentId`, `actorRole`, `clientEventAt`, `schemaVersion`, and `payload`.
- [x] 3.5 Classify each stage event as `InteractionLog` only, `StudentStepResponse`, or `LearningFact` materialization input.
- [x] 3.6 Define diagnostics denominator, dedupe key, latest-vs-all-attempt policy, resubmission display, unreleased-student inclusion, default free-text redaction, and teacher/admin-only access.

## 4. Visual QA

- [x] 4.1 Capture student and teacher screenshots in light and dark themes.
- [x] 4.2 Capture required state-matrix screenshots for student unreleased, student released, student submitted or browsed, teacher reveal, teacher answer reveal, and teacher diagnostic aggregation.
- [x] 4.3 Capture mobile, desktop, and projection viewport screenshots with no horizontal overflow and no teacher controls covering the main stage.
- [x] 4.4 Add a browser assertion that the stage does not render as a vertical list of cards.
- [x] 4.5 Save screenshot paths and visual source paths in the implementation acceptance artifact using the shared screenshot naming schema.

## 5. Validation

- [x] 5.1 Run `rtk openspec validate add-interactive-visual-stage-runtime --strict`.
- [x] 5.2 Run interactive module taxonomy and manifest runtime tests.
- [x] 5.3 Run browser audit for both student and teacher roles.
