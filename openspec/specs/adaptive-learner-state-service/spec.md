# adaptive-learner-state-service Specification

## Purpose
Define the server-owned adaptive learner-state read model used by path planning, personalization, profile, and Konling consumers.
## Requirements
### Requirement: Learner state is server-owned
The system SHALL provide a server-owned Learner State Service for adaptive-learning consumers.

#### Scenario: Path planner requests learner state
- **WHEN** the path planner requests learner state for a student
- **THEN** the service SHALL return primary competency state, second-level competency state, knowledge mastery, resource preference, media absorption, risks, path context, evidence windows, and confidence markers
- **AND** missing, stale, partial, or low-confidence evidence SHALL be explicit.

#### Scenario: Client sends profile hints
- **WHEN** a client sends profile-like values to an AI or path endpoint
- **THEN** the server SHALL treat them as hints only
- **AND** authoritative adaptive state SHALL come from the Learner State Service.

### Requirement: Learner state retains and extends competency dimensions
The system SHALL retain the current six primary competency dimensions while adding second-level dimensions.

#### Scenario: Learner state is returned
- **WHEN** learner state is read
- **THEN** it SHALL include `controlModeling`, `parameterDesign`, `crossDomainTransfer`, `engineeringDecision`, `inquiryReflection`, and `selfDirectedLearning`
- **AND** it SHALL include second-level dimensions for concept mastery, time/frequency transfer, modeling reliability, tuning efficiency, constrained optimization, solution stability, cross-modal transfer, scenario generalization, risk recognition, constraint compliance, explanation quality, AI-use strategy, reflection depth, path execution, persistence, and remedial initiative where evidence exists.

### Requirement: Learner-state fields are quantified and scoped
The system SHALL declare quantification and privacy metadata for learner-state field families.

#### Scenario: Field family is added
- **WHEN** a learner-state field family is introduced
- **THEN** it SHALL declare value range, source families, algorithm version, evidence threshold, confidence policy, fallback reason, and privacy scope
- **AND** consumers SHALL NOT treat undeclared or low-confidence fields as high-confidence personalization state.

