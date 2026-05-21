## Purpose
Support black-box Arena training as an engineering workflow: students can reason from experiment budgets, coverage, nominal-model confidence, and official hidden-evaluation boundaries without seeing hidden scenario details.

## Requirements

### Requirement: Black-box training exposes experiment budget evidence
The system SHALL show experiment cost and coverage evidence for black-box Arena tasks.

#### Scenario: Student runs black-box experiments
- **WHEN** experiment records exist for the task
- **THEN** the workbench shows budget usage and coverage signals derived from those records

### Requirement: Black-box training explains nominal-model confidence
The system SHALL explain confidence and mismatch for student nominal models without revealing hidden targets.

#### Scenario: Student saves a nominal model
- **WHEN** the model is compared with available experiment or preview evidence
- **THEN** the system shows confidence or mismatch signals that do not reveal hidden plant parameters

### Requirement: Black-box feedback distinguishes preview from hidden evaluation
The system SHALL state that virtual preview is not the official hidden evaluation result.

#### Scenario: Student submits after preview
- **WHEN** official evaluation completes
- **THEN** feedback explains whether hidden evaluation exposed a generalization issue without disclosing hidden scenario details
