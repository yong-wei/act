## MODIFIED Requirements

### Requirement: Draft rubric grading is anchor-backed
Draft rubric grading SHALL evaluate document quality through schema-validated scoring-item assessments selected from the frozen rubric version rather than fixed scaffold scores.

#### Scenario: Scoring-standard-only draft is produced
- **WHEN** an answer is evaluated against a frozen scoring item whose detailed rubric is disabled
- **THEN** its assessment SHALL include scoring-item id, one-decimal score within zero and the scoring-item maximum, rationale, confidence, evidence anchors, and limitation state
- **AND** it SHALL NOT require or infer a selected evaluation-level identity.

#### Scenario: Detailed-rubric draft is produced
- **WHEN** an answer is evaluated against a frozen scoring item whose detailed rubric is enabled
- **THEN** its assessment SHALL include scoring-item id, selected evaluation-level identity, suggested score, rationale, confidence, evidence anchors, and limitation state
- **AND** the selected level SHALL belong to that frozen scoring item and the AI suggested score SHALL be clamped to the selected level's legal one-decimal interval.

#### Scenario: Evaluator output is invalid
- **WHEN** evaluator output is malformed, uses the wrong schema for the frozen detailed-rubric flag, references unsupported scoring items, levels, or evidence anchors, exceeds the applicable score range, or violates safety constraints
- **THEN** the draft SHALL NOT be approved or written back automatically
- **AND** the workbench SHALL expose a retry or blocked-evaluator state for teacher review.

### Requirement: Teacher review governs feedback and writeback
Teacher review SHALL remain the governing step for student feedback and learner-profile writeback.

#### Scenario: Teacher edits a scoring-item assessment
- **WHEN** a teacher changes score, rationale, evidence anchor, or an applicable detailed-rubric level before approval
- **THEN** the teacher score SHALL require one decimal place and remain between zero and the scoring-item maximum
- **AND** it SHALL NOT be clamped to the AI-selected level interval
- **AND** the system SHALL preserve AI draft values, teacher-approved values, and their diff for quality metrics and audit.

#### Scenario: Student feedback is generated
- **WHEN** grading is approved for student feedback
- **THEN** the student feedback SHALL include scoring-item results, evidence anchors, teacher-approved comments, and remediation action cards
- **AND** each action card SHALL link to a valid learner-record, path, resource, or practice destination.

### Requirement: Evaluator drafts are schema-validated and evidence-anchored
The system SHALL accept an AI grading draft only when every scoring-item assessment and annotation satisfies the schema selected by the frozen rubric version, the applicable score scale, and the conversion anchor schema.

#### Scenario: Evaluator returns a valid scoring-standard-only draft
- **WHEN** detailed rubric is disabled and output includes known scoring-item ids, in-range one-decimal scores, rationale, confidence, supported evidence anchors, location-aware annotations, limitations, and overall comment without requiring selected levels
- **THEN** the system SHALL persist the draft as awaiting teacher review.

#### Scenario: Evaluator returns a valid detailed-rubric draft
- **WHEN** detailed rubric is enabled and output includes known scoring-item ids, valid frozen level identities, level-clamped one-decimal scores, rationale, confidence, supported evidence anchors, location-aware annotations, limitations, and overall comment
- **THEN** the system SHALL persist the draft as awaiting teacher review.

#### Scenario: Evaluator output is invalid
- **WHEN** output uses a schema inconsistent with the frozen rubric version or detailed-rubric flag, references unknown scoring items, levels, or anchors, exceeds score ranges, lacks required evidence, contains malformed annotations, or violates safety constraints
- **THEN** the run SHALL enter a retryable or blocked-evaluator state
- **AND** no draft SHALL be approved, shown to students, or written back as governed evidence.
