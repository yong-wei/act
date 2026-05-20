## 1. Shared Submission Contract

- [x] 1.1 Add a shared manifest submission controller or hook for student pages.
- [x] 1.2 Extend submission telemetry to emit `manifest-submission-v2` with answers, summaries, score fields, misconception tags, and optional extra evidence.
- [x] 1.3 Add shared answer normalization helpers for single, multi, match, sort, and subjective cards.

## 2. Server Persistence

- [x] 2.1 Persist v2 evidence into `InteractionLog.eventData` and `StudentStepResponse.responseData`.
- [x] 2.2 Derive `LearningFact.score`, `outcome`, and `contextJson.interactiveQuiz` from the v2 envelope.
- [x] 2.3 Mark non-v2 submit events with an explicit legacy evidence quality.

## 3. Reports and Compatibility

- [x] 3.1 Add session report counts for evidence-rich, partial, and legacy submissions.
- [x] 3.2 Keep legacy submit events from failing persistence or report generation.
- [x] 3.3 Add one representative lesson integration path without migrating all module 5 pages.

## 4. Verification

- [x] 4.1 Add telemetry unit tests for answer digest and objective scoring.
- [x] 4.2 Add interactive event API tests for durable response payloads.
- [x] 4.3 Add LearningFact materialization tests for scored and unsupported submissions.
- [x] 4.4 Run `npm run lint` and targeted interactive/data-governance tests.
