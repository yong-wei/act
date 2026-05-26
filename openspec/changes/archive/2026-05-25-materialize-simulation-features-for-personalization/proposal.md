## Why

The report's route map does not stop at trace governance: simulation and Arena evidence must become feature-cache inputs, recommendation rationale, and teacher diagnostic signals. Without this follow-up change, the platform would have governed traces but still lack the adaptive-learning and teacher-insight closure promised by the roadmap.

## What Changes

- Extend the student evidence feature cache to derive simulation/Arena feature summaries from governed `LearningFact` context and trace summaries.
- Extend evidence-driven personalization so simulation/Arena-derived features can explain recommendations, weak areas, and confidence states.
- Extend teacher evidence governance so class and student insight views can surface simulation/Arena coverage, weak metrics, replay confidence, and low-confidence states.
- Keep this change as a consumer of governed summaries, not a new recommendation engine or raw trace scanner.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `student-evidence-feature-cache`: Add simulation/Arena feature derivation from governed trace summaries and learning facts.
- `evidence-driven-personalization`: Allow recommendations and profile claims to use simulation/Arena features with explicit rationale and confidence.
- `teacher-evidence-governance`: Add teacher-facing diagnostic summaries for simulation/Arena evidence coverage and weak metrics.

## Impact

- Affects feature-cache rebuild/refresh code, personalization evidence consumers, and teacher insight APIs.
- Depends on `govern-simulation-and-arena-evidence-sources`, `make-simulation-runtime-replayable`, and `register-simulations-as-course-resources`.
- Validation gate is `rtk proxy openspec validate materialize-simulation-features-for-personalization --strict`.
