## ADDED Requirements

### Requirement: Control-correction planner returns three path styles
The path planner SHALL provide a three-style path bundle for control-correction diagnosis when sufficient resources and evidence exist.

#### Scenario: Three-style bundle is generated
- **WHEN** a student requests control-correction next steps from a diagnosis surface
- **THEN** the bundle SHALL include foundation remediation, Arena or simulation sprint, and preference-matched route options
- **AND** each option SHALL include target deficits, evidence basis, estimated effort, modality mix, terminal validation strategy, and limitations.

#### Scenario: Resources are insufficient
- **WHEN** the planner cannot produce meaningfully distinct path options
- **THEN** it SHALL return an explicit low-resource or low-confidence fallback
- **AND** it SHALL NOT show three cosmetic variants with materially identical resources.

### Requirement: Path choice writes back as preference evidence
Student path selection and outcomes SHALL update governed preference and strategy evidence without inflating mastery directly.

#### Scenario: Student selects a path style
- **WHEN** a student chooses one of the displayed path styles
- **THEN** the system SHALL record the selected style, rejected alternatives, diagnosis snapshot reference, resource mix, and rationale metadata
- **AND** the choice SHALL be available to learner-state preference features.

#### Scenario: Path execution changes mastery
- **WHEN** the selected path is executed
- **THEN** completion, deviation, terminal validation, and helpfulness evidence MAY affect mastery, risk, and strategy features according to their own evidence quality
- **AND** the original selection alone SHALL NOT be treated as mastery evidence.

### Requirement: Path bundles remain explainable
Displayed path bundles SHALL expose why options differ and what tradeoffs they make.

#### Scenario: User compares path options
- **WHEN** a student or authorized teacher compares path options
- **THEN** the response SHALL include overlap, modality mix, estimated effort, expected target lift, terminal validation difference, and evidence limitations
- **AND** all personalized claims SHALL cite authorized diagnosis, learner-state, path, or resource evidence.

#### Scenario: Diagnosis and Konling consume path option context
- **WHEN** diagnosis surfaces or the Konling path-advisor read the current control-correction path context
- **THEN** they SHALL receive sanitized path option summaries and selection history
- **AND** the context SHALL expose evidence basis and terminal validation references without private raw traces or hidden prompt payloads.
