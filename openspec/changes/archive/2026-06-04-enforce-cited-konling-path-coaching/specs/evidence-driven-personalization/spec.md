## ADDED Requirements

### Requirement: Personalized explanations expose citation coverage
Personalized recommendations and profile explanations SHALL expose citation coverage when they are generated for the control-correction path.

#### Scenario: Recommendation is explained
- **WHEN** a control-correction recommendation or coaching rationale is shown to a student
- **THEN** it SHALL expose content, learner-state, path-execution, simulation, Arena, or intervention citations that support the claim
- **AND** it SHALL identify missing citation classes or low-confidence evidence as limitations.

#### Scenario: Citation support is insufficient
- **WHEN** required citations cannot be retrieved or normalized
- **THEN** personalization output SHALL return a fallback or low-confidence explanation
- **AND** it SHALL NOT present the claim as fully verified.
