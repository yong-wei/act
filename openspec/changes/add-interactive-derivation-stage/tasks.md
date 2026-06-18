## 1. Manifest Contract

- [x] 1.1 Register `visual.derivationStage`.
- [x] 1.2 Validate stage id, coordinate system, formulas, text blocks, connectors, reveal steps, formula blocks, regions, color roles, and teacher control metadata.
- [x] 1.3 Reject formulas that lack LaTeX source or use image/text-only formulas.
- [x] 1.4 Reject reveal steps with duplicate ids, missing targets, or invalid target references.

## 2. Renderer

- [x] 2.1 Render formulas through KaTeX/LaTeX.
- [x] 2.2 Support arbitrary two-dimensional reveal order.
- [x] 2.3 Support long formula split rendering and progressive reveal by formula block.
- [x] 2.4 Support formula block color roles: `known`, `transform`, `cancel`, `target`, `risk`, and `result`.
- [x] 2.5 Support local highlight for individual formula blocks and connectors.
- [x] 2.6 Preserve readable layout in light, dark, mobile, desktop, and projection states.
- [x] 2.7 Gate cognitive load by limiting per-step newly revealed formula blocks, declaring long-formula split strategy, capping simultaneous color roles, and defining default teacher release pace and student self-study visible range.

## 3. Teacher And Student Flow

- [x] 3.1 Add teacher controls for next, previous, arbitrary jump, temporary highlight, answer reveal, and reset.
- [x] 3.2 Persist teacher reveal state across refresh.
- [x] 3.3 Show student unreleased, released, browsed, and submitted states.
- [x] 3.4 Record student answer by reveal step.

## 4. Evidence And Diagnostics

- [x] 4.1 Record `stageId`, max reveal step seen, visited reveal steps, formula block focus events, and answer by reveal step.
- [x] 4.2 Show teacher diagnostics for reveal step distribution, unvisited formula blocks, formula block misconceptions, and submitted count.
- [x] 4.3 Ensure diagnostics do not expose student answer input controls in teacher mode.
- [x] 4.4 Record evidence with `clientEventId`, `attemptKey`, trusted `sourceLogId`, `schemaVersion`, and explicit `InteractionLog` / `StudentStepResponse` / `LearningFact` classification.
- [x] 4.5 Persist teacher reveal, temporary highlight, answer reveal, student browsed, submitted, and diagnostic states across refresh.
- [x] 4.6 Record feedback fields for misconception tags, student feedback mode, teacher next prompt, and retry or review action.
- [x] 4.7 Use the unified evidence sample fields: `eventType`, `clientEventId`, `attemptKey`, trusted `sourceLogId`, `lessonKey`, `stepId`, `moduleId`, `componentKind`, `componentId`, `actorRole`, `clientEventAt`, `schemaVersion`, and `payload`.
- [x] 4.8 Define diagnostics denominator, dedupe key, latest-vs-all-attempt policy, resubmission display, unreleased-student inclusion, default free-text redaction, and teacher/admin-only access.

## 5. Visual QA

- [x] 5.1 Add tests for non-linear reveal order.
- [x] 5.2 Add tests for long formula progressive reveal.
- [x] 5.3 Add tests for formula block color roles.
- [x] 5.4 Add browser screenshots for student unreleased, student released, student submitted, teacher arbitrary jump, answer reveal, and diagnostic aggregation states.
- [x] 5.5 Add mobile, desktop, and projection screenshots with no horizontal overflow and no controls covering formulas.
- [x] 5.6 Fail acceptance if formulas are not rendered through KaTeX/LaTeX.

## 6. Validation

- [x] 6.1 Run `rtk openspec validate add-interactive-derivation-stage --strict`.
- [x] 6.2 Run manifest runtime tests and interactive evidence tests.
- [x] 6.3 Run browser audit for both student and teacher roles.
