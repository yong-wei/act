# document-rubric-grading-workbench Specification

## Purpose
TBD - created by archiving change add-document-rubric-grading-workbench. Update Purpose after archive.
## Requirements
### Requirement: Documents are converted before grading
The system SHALL convert uploaded assignment documents into analysis-ready artifacts before rubric grading.

#### Scenario: Document is converted
- **WHEN** a teacher or authorized service uploads a PDF or supported office document for grading
- **THEN** the system SHALL create a submission asset record, run a conversion adapter such as MarkItDown, store Markdown or structured blocks, preserve checksum, page or block references, and report conversion confidence.

#### Scenario: Conversion loses precise layout
- **WHEN** the converter cannot produce reliable bbox or span mapping
- **THEN** the grading UI SHALL fall back to page-level or block-level references
- **AND** it SHALL NOT pretend to offer precise inline PDF evidence.

### Requirement: Rubric grading remains teacher-approved
The system SHALL keep a human teacher in the loop for document grading.

#### Scenario: Draft grading is produced
- **WHEN** a grading run evaluates a converted document against an analytic rubric
- **THEN** it SHALL produce criterion-level draft scores, evidence references, comments, confidence, citation metadata, and profile writeback candidates.

#### Scenario: Teacher approves grading
- **WHEN** the teacher approves or edits a grading run
- **THEN** returned feedback, annotations, score breakdown, and governed evidence writeback SHALL use the approved state
- **AND** unapproved machine drafts SHALL NOT update competency profiles as high-confidence evidence.

### Requirement: Grading UI is part of the workflow
The grading workbench SHALL support professional teacher review states.

#### Scenario: Teacher opens grading workbench
- **WHEN** a teacher opens a grading draft
- **THEN** the UI SHALL show converted document precision, evaluator limitations, criterion-level AI draft, teacher-edit controls, evidence anchors, approval state, and writeback preview.

### Requirement: Document grading persists first-class artifacts
The system SHALL persist document submissions, conversion artifacts, rubric assessments, and annotation anchors as durable grading workflow records.

#### Scenario: Submission is created
- **WHEN** an authorized student, teacher, or service creates a grading submission
- **THEN** the system SHALL persist owner, class, assignment, original file reference, mime type, checksum, status, and timestamps
- **AND** repeated submission processing SHALL be idempotent by checksum or workflow dedupe key where policy allows.

#### Scenario: Conversion artifact is created
- **WHEN** a document conversion finishes
- **THEN** the system SHALL persist converter id, converter version, markdown or structured blocks, page/block/span anchor map, checksum, confidence, and warnings
- **AND** conversion precision SHALL be visible to downstream grading and UI consumers.

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
