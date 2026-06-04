## ADDED Requirements

### Requirement: Control-correction reports provide evaluation-ready metrics
The system SHALL provide evaluation-ready metrics for the control-correction closed loop without requiring contextual bandit, reinforcement learning, or experimental optimization to be enabled.

#### Scenario: Evaluation metrics are requested
- **WHEN** a teacher, admin, or evaluation package requests control-correction outcome metrics
- **THEN** the system SHALL expose path adoption, completion, competency lift, simulation/Arena transfer, intervention outcome, citation coverage, and resource contribution metrics with confidence and denominator metadata
- **AND** the metrics SHALL be computable from governed evidence, feature cache, learner state, and path records.

#### Scenario: Optimization experiments are disabled
- **WHEN** adaptive-learning optimization experiments are disabled
- **THEN** control-correction outcome reporting SHALL remain available
- **AND** it SHALL NOT require bandit or reinforcement-learning policy data to compute Stage 1 metrics.
