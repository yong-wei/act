## Purpose
Control workbench panels need concise, student-facing explanations that connect visible design evidence to control-design judgments while preserving Arena evaluation and black-box privacy boundaries.

## Requirements

### Requirement: Workbench views provide design evidence explanations
The system SHALL provide concise evidence explanations for supported workbench views.

#### Scenario: Student views a configured panel
- **WHEN** a supported workbench view renders with available session data
- **THEN** the view exposes an explanation of what the visible evidence suggests for control design

### Requirement: Explanations preserve official evaluation boundaries
The system SHALL distinguish workbench evidence from official Arena scoring.

#### Scenario: Student reads an explanation before submitting
- **WHEN** the explanation references preview or diagnostic data
- **THEN** it does not present preview evidence as an official leaderboard result

### Requirement: Black-box explanations protect hidden targets
The system SHALL explain black-box confidence and mismatch without revealing hidden target details.

#### Scenario: Black-box session uses hidden evaluation
- **WHEN** the explanation is generated
- **THEN** it avoids hidden scenario parameters, target trajectories, and private evaluation order
