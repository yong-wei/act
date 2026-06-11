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
The system SHALL provide teacher and student UI surfaces for document grading.

#### Scenario: Teacher opens grading workbench
- **WHEN** a teacher opens the grading workbench
- **THEN** the page SHALL show upload/conversion status, document preview, rubric tree, AI draft comments, editable annotations, approval actions, and error states.

#### Scenario: Student opens feedback
- **WHEN** a student opens returned grading feedback
- **THEN** the page SHALL show annotated document or page references, rubric breakdown, teacher-approved comments, evidence capsules, and profile impact summary.

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
Rubric grading drafts SHALL cite converted document anchors for every criterion that affects learner-state or diagnosis.

#### Scenario: Draft criterion grade is produced
- **WHEN** a draft assessment scores a rubric criterion
- **THEN** it SHALL include criterion id, selected level, normalized score, rationale, confidence, and one or more evidence anchors
- **AND** criterion grades without required anchors SHALL be blocked from profile writeback.

#### Scenario: Anchor precision is limited
- **WHEN** a converted document only supports page-level or block-level references
- **THEN** the grading UI SHALL disclose that precision
- **AND** it SHALL NOT present the feedback as exact inline PDF annotation.

### Requirement: Teacher review governs feedback and writeback
Only teacher-approved or teacher-edited grading assessments SHALL be returned to students or written back to profiles.

#### Scenario: Teacher approves assessment
- **WHEN** a teacher approves or edits a grading assessment
- **THEN** the final assessment SHALL become eligible for student feedback and governed LearningFact writeback
- **AND** the writeback preview SHALL identify affected dimensions, evidence references, confidence, and dedupe keys.

#### Scenario: Draft remains unapproved
- **WHEN** a grading run is still draft, returned, or rejected
- **THEN** it SHALL NOT create high-confidence learner-state, diagnosis, path, or teacher-prep evidence.

### Requirement: Grading writeback is idempotent and auditable
Approved grading writeback SHALL produce governed learning evidence without duplicating profile facts.

#### Scenario: Writeback is repeated
- **WHEN** the same final assessment is written back more than once
- **THEN** the system SHALL reuse or skip existing LearningFact records through stable source ids
- **AND** it SHALL report created, skipped, and blocked counts.

#### Scenario: Writeback is audited
- **WHEN** approved grading contributes to a diagnosis or profile
- **THEN** the resulting evidence SHALL include rubric id, rubric version, assessment id, criterion id, anchor references, teacher review state, confidence, and privacy scope.
