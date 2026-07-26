## 1. Provider and worker reliability

- [x] 1.1 Add deterministic smart-lesson output normalization and validation receipts.
- [x] 1.2 Add exactly one linked model-correction attempt for remaining schema violations.
- [x] 1.3 Separate queue-delivery identity from explicit teacher retry identity.
- [x] 1.4 Preserve completed stages and resume from the first incomplete stage across retry, cancellation, restart, and navigation.

## 2. Progress experience

- [x] 2.1 Add the exact seven Chinese teaching-stage and nine action-state projections from the accepted interview.
- [x] 2.2 Add active-job refresh or event delivery and stop it at terminal state.
- [x] 2.3 Render each validated completed stage immediately as teaching content with completion motion and text state.
- [x] 2.4 Map existing jobs and unknown historical failures to safe localized projections.

## 3. Verification

- [x] 3.1 Test deterministic normalization, one successful correction, second invalid result, duplicate delivery, and explicit retry.
- [x] 3.2 Test exact stage and action labels, structure/source/duration completion gates, automatic refresh, completed-stage preservation, cancellation, resume, and no raw JSON.
- [ ] 3.3 Complete one real-provider full BOPPPS generation and record stage, attempt, validation, latency, and recovery evidence.
- [ ] 3.4 Run typecheck, provider adapter tests, worker tests, and smart-preparation browser tests.
