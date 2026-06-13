## MODIFIED Requirements

### Requirement: Draft rubric grading is anchor-backed
Draft rubric grading SHALL evaluate document quality through schema-validated criterion assessments rather than fixed scaffold scores.

#### Scenario: Draft criterion grade is produced
- **WHEN** a converted control-correction document is evaluated
- **THEN** each rubric criterion SHALL include criterion id, selected level, score, rationale, confidence, evidence anchors, and limitation state
- **AND** the selected level SHALL be derived from document content, rubric evidence requirements, and evaluator reasoning rather than a fixed middle level.

#### Scenario: Evaluator output is invalid
- **WHEN** evaluator output is malformed, references unsupported criteria, lacks evidence anchors, or violates safety constraints
- **THEN** the draft SHALL NOT be approved or written back automatically
- **AND** the workbench SHALL expose a retry or blocked-evaluator state for teacher review.

### Requirement: Teacher review governs feedback and writeback
Teacher review SHALL remain the governing step for student feedback and learner-profile writeback.

#### Scenario: Teacher edits a criterion assessment
- **WHEN** a teacher changes score, level, rationale, or evidence anchor before approval
- **THEN** the system SHALL preserve AI draft values and teacher-approved values
- **AND** it SHALL record the diff for quality metrics and audit.

#### Scenario: Student feedback is generated
- **WHEN** grading is approved for student feedback
- **THEN** the student feedback SHALL include criterion results, evidence anchors, teacher-approved comments, and remediation action cards
- **AND** each action card SHALL link to a valid learner-record, path, resource, or practice destination.

### Requirement: Grading writeback is idempotent and auditable
Writeback SHALL include grading quality metadata.

#### Scenario: Writeback is audited
- **WHEN** approved grading creates learning facts or profile contributions
- **THEN** the audit SHALL include rubric version, evaluator version, teacher reviewer, AI/teacher delta, source anchors, and idempotency key
- **AND** repeated writeback SHALL NOT duplicate learner facts.

### Requirement: Grading UI is part of the workflow
The grading workbench SHALL support professional teacher review states.

#### Scenario: Teacher opens grading workbench
- **WHEN** a teacher opens a grading draft
- **THEN** the UI SHALL show converted document precision, evaluator limitations, criterion-level AI draft, teacher-edit controls, evidence anchors, approval state, and writeback preview.
