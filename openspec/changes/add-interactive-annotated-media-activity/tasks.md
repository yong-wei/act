## 1. Manifest Contract

- [x] 1.1 Register `visual.annotatedMedia`.
- [x] 1.2 Register `visual.embedded-activity` as the canonical embedded visual activity layer.
- [x] 1.3 Validate media src, alt, annotations, regions, evidence roles, reveal references, selectable annotations, and activity anchors.
- [x] 1.4 Reject visible captions, titles, fallback text, or labels that expose file names, renderer names, module names, payload keys, or internal ids.

## 2. Renderer

- [x] 2.1 Render image/media with hotspots, annotation lines, masks, zoom regions, evidence labels, and activity anchors.
- [x] 2.2 Support selectable annotations and required evidence selection.
- [x] 2.3 Support embedded activity types through shared response contracts.
- [x] 2.4 Preserve readable contrast in light, dark, mobile, desktop, and projection states.

## 3. Evidence And Diagnostics

- [x] 3.1 Record hotspot selections, activity answers, selected evidence roles, reveal state, and submission status.
- [x] 3.2 Reuse ordinary activity submission evidence for canvas-embedded answers.
- [x] 3.3 Surface teacher diagnostics for most selected hotspots, missing hotspots, evidence-role confusion, and submission coverage.
- [x] 3.4 Ensure teacher diagnostics do not expose student answer inputs.
- [x] 3.5 Persist selected hotspot, submitted, teacher reveal, and diagnostic aggregation states across refresh.
- [x] 3.6 Add student feedback fields for misconception tags, feedback mode, retry/review action, and teacher next prompt.
- [x] 3.7 Record evidence samples with `eventType`, `clientEventId`, `attemptKey`, trusted `sourceLogId`, `lessonKey`, `stepId`, `moduleId`, `componentKind`, `componentId`, `actorRole`, `clientEventAt`, `schemaVersion`, and `payload`.
- [x] 3.8 Classify each annotated-media and embedded-activity event as `InteractionLog` only, `StudentStepResponse`, or `LearningFact` materialization input.
- [x] 3.9 Define diagnostics denominator, dedupe key, latest-vs-all-attempt policy, resubmission display, unreleased-student inclusion, default free-text redaction, and teacher/admin-only access.

## 4. Visual QA

- [x] 4.1 Capture student and teacher screenshots in light and dark themes.
- [x] 4.2 Capture required state-matrix screenshots for student unreleased, student released, selected hotspot, submitted state, teacher reveal, and diagnostic aggregation.
- [x] 4.3 Add tests that annotated media cannot pass when hotspots are unrecorded.
- [x] 4.4 Add tests that internal naming leaks in media frames fail the gate.

## 5. Validation

- [x] 5.1 Run `rtk openspec validate add-interactive-annotated-media-activity --strict`.
- [x] 5.2 Run manifest runtime, response, evidence, and visible-text leak tests.
- [x] 5.3 Run browser audit for both student and teacher roles.
