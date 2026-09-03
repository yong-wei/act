## MODIFIED Requirements

### Requirement: Frozen 120-case intent regression is gated
The change SHALL keep a frozen 120-case set (60 base items × standard and implicit phrasings, ten items per intent) in automatic tests, and SHALL report confusion matrix, accuracy, macro-F1, and per-class recall against that set both overall and separately for the standard and implicit phrasing groups.

#### Scenario: The frozen set is evaluated
- **WHEN** the intent-classification tests run
- **THEN** they SHALL load the frozen 120 cases
- **AND** macro-F1 SHALL be at least 0.80
- **AND** each class recall SHALL be at least 0.75
- **AND** `normative-content` recall SHALL be at least 0.90

#### Scenario: Standard and implicit phrasings are gated separately
- **WHEN** the intent-classification tests run
- **THEN** they SHALL compute accuracy, macro-F1, per-class recall, and the confusion matrix separately for the standard group and the implicit group
- **AND** each group SHALL satisfy accuracy at least 0.80, macro-F1 at least 0.75, and per-class recall at least 0.70
- **AND** no single fallback class SHALL receive more than half of that group's misclassifications.

## ADDED Requirements

### Requirement: Multi-intent questions resolve through a stable primary-intent priority
Konling SHALL resolve a multi-intent study question to one primary intent using a fixed, explainable priority order: `normative-content` first (safety), then `formula-derivation`, `code-debugging`, `concept-comparison`, explicit `open-ended-explanation` features, and `fact-explanation`, with `open-ended-explanation` as the only default fallback when no stronger signal matches. The resolved primary intent SHALL NOT depend on clause order within the question, and the `answerIntent` contract and six-intent enumeration SHALL remain unchanged.

#### Scenario: Safety intent wins over methodology
- **WHEN** a question combines a normative-risk clause with a formula-derivation clause in either sentence order
- **THEN** the primary intent SHALL be `normative-content`.

#### Scenario: Methodology wins over failure diagnosis
- **WHEN** a question combines a derivation request with a code-debugging request in either sentence order
- **THEN** the primary intent SHALL be `formula-derivation`.

#### Scenario: Adjacent pairs keep their order in both clause orders
- **WHEN** a question combines clauses of code-debugging with concept-comparison, or concept-comparison with explicit open-ended features, or a definition with explicit open-ended features, in either sentence order
- **THEN** the primary intent SHALL be the higher-priority intent of the pair.

#### Scenario: Unmatched professional questions fall back to open-ended explanation only
- **WHEN** a professional question matches no stronger signal
- **THEN** the primary intent SHALL default to `open-ended-explanation` and SHALL NOT default to `fact-explanation`.
