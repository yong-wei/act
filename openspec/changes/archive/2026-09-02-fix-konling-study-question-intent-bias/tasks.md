## 1. Frozen regression set

- [x] 1.1 Add a frozen 120-case JSON fixture: 6 intents × 10 items × standard/implicit phrasings.
- [x] 1.2 Add a metric helper and tests that load the fixture through `buildKonlingTeachingAssistantRuntimeContract`.

## 2. Classifier correction

- [x] 2.1 Expand `classifyGenericStudyQuestionIntent` for implicit phrasings and stop using `fact-explanation` as the residual bucket.
- [x] 2.2 Keep the existing `answerIntent` union and caller contract unchanged.

## 3. Verification

- [x] 3.1 Reach macro-F1 ≥ 0.80, per-class recall ≥ 0.75, and `normative-content` recall ≥ 0.90 on the frozen set.
- [x] 3.2 Run focused Konling runtime tests and `openspec validate --type change --strict`.
