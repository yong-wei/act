# konling-study-question-intent-classification Specification

## Purpose
Define how Konling classifies generic-chat study questions into six intents, including implicit phrasings, and how the frozen 120-case regression gates that classifier.
## Requirements
### Requirement: Study-question intents cover explicit and implicit phrasings
Konling SHALL classify generic-chat study questions into `formula-derivation`, `code-debugging`, `concept-comparison`, `normative-content`, `open-ended-explanation`, or `fact-explanation` from the current user request, including implicit phrasings that omit the original high-precision keywords.

#### Scenario: An implicit derivation request is classified
- **WHEN** a learner asks how a transfer function or derivation is obtained without using 推导/证明/derive
- **THEN** the runtime SHALL set `answerIntent` to `formula-derivation`

#### Scenario: An implicit debugging request is classified
- **WHEN** a learner describes a simulation or code failure that will not go away without using 报错/调试/bug
- **THEN** the runtime SHALL set `answerIntent` to `code-debugging`

### Requirement: Fact explanation is not the residual bucket
Konling SHALL assign `fact-explanation` only when the request is a definition, meaning, or “what is” question. Unmatched professional how/why/must/compare requests SHALL NOT default to `fact-explanation`.

#### Scenario: A definition question remains fact explanation
- **WHEN** a learner asks what overshoot means
- **THEN** the runtime SHALL set `answerIntent` to `fact-explanation`

#### Scenario: An implicit normative request is not dumped to fact explanation
- **WHEN** a learner asks which report cover fields are required to pass
- **THEN** the runtime SHALL set `answerIntent` to `normative-content`

### Requirement: Frozen 120-case intent regression is gated
The change SHALL keep a frozen 120-case set (60 base items × standard and implicit phrasings, ten items per intent) in automatic tests, and SHALL report confusion matrix, accuracy, macro-F1, and per-class recall against that set.

#### Scenario: The frozen set is evaluated
- **WHEN** the intent-classification tests run
- **THEN** they SHALL load the frozen 120 cases
- **AND** macro-F1 SHALL be at least 0.80
- **AND** each class recall SHALL be at least 0.75
- **AND** `normative-content` recall SHALL be at least 0.90

