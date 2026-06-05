## ADDED Requirements

### Requirement: Learner center prioritizes current path and next action
The adaptive learning center SHALL present learner record and pathway state as a guided next-action surface.

#### Scenario: Student opens learner center or adaptive practice
- **WHEN** dashboard, profile, growth, evidence, or adaptive practice entry renders
- **THEN** current path, next recommended action, confidence, and missing-evidence state SHALL be visible before secondary metrics
- **AND** repeated metric cards SHALL NOT be the only hierarchy.

### Requirement: Learner record shows evidence write-back from core learning work
The adaptive learning center SHALL show how core learning work contributes to learner record and next recommendations.

#### Scenario: Evidence from learning work is available
- **WHEN** interactive lesson submission, Arena official/preview result, simulation/Workbench completion, or adaptive practice submission is available
- **THEN** learner record surfaces SHALL present freshness, confidence, source scope, missing-source state, and next action
- **AND** unavailable evidence instrumentation SHALL be shown honestly rather than fabricated as complete progress.

### Requirement: Low evidence states are actionable
The adaptive learning center SHALL turn low confidence and missing source coverage into actionable states.

#### Scenario: Evidence is incomplete
- **WHEN** learner evidence is stale, partial, missing, or low confidence
- **THEN** the UI SHALL explain what is missing and where the learner or teacher can continue
- **AND** it SHALL NOT present fabricated precision.
