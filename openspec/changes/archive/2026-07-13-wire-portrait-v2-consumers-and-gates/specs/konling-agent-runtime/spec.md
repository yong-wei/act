## ADDED Requirements

### Requirement: Konling learner context uses portrait v2
Konling SHALL use portrait v2 as the primary learner portrait context when
personalizing explanations, scope, style, and evidence diagnostics.

#### Scenario: Konling answers with learner context
- **WHEN** learner portrait context is available
- **THEN** Konling SHALL summarize strengths, weak dimensions, and limitations using portrait v2 ids and labels
- **AND** legacy six-dimensional data SHALL be identified as compatibility-derived if used.

#### Scenario: Learner portrait is incomplete
- **WHEN** portrait v2 data is missing or migrated with low confidence
- **THEN** Konling SHALL still answer with available content citations
- **AND** it SHALL treat portrait incompleteness as a personalization limitation rather than a retrieval failure.
