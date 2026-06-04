## ADDED Requirements

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
