# teacher-course-basis-management Specification

## Purpose
TBD - created by archiving change add-teacher-course-basis-management. Update Purpose after archive.
## Requirements
### Requirement: Teachers manage private reusable course bases
The system SHALL provide each teacher with private course bases that group course standards and textbook materials for reuse across single-lesson preparation tasks.

#### Scenario: Teacher creates a course basis
- **WHEN** an authenticated teacher creates a course basis
- **THEN** the system SHALL record the owner, course identity, title, description, and timestamps
- **AND** the course basis SHALL be selectable by multiple single-lesson tasks owned by that teacher.

#### Scenario: Another teacher requests a course basis
- **WHEN** a teacher who is neither the owner nor an authorized governance administrator requests another teacher's course basis, source text, anchors, or generated records
- **THEN** the system SHALL deny access
- **AND** the course basis SHALL NOT appear in cross-teacher search or selection results.

### Requirement: Course bases accept bounded text-bearing source formats
The system SHALL accept searchable PDF, Markdown, plain-text files, and directly pasted text as P0 course-basis inputs.

#### Scenario: Supported text source is imported
- **WHEN** a teacher imports a supported file or pasted text
- **THEN** the system SHALL verify the declared and detected type, compute a content hash, store the teacher-scoped original where applicable, and enqueue normalized text extraction
- **AND** the import SHALL record its source type, original filename or pasted-text label, size, and extraction state.

#### Scenario: PDF has no usable text layer
- **WHEN** a PDF produces no usable searchable text or is detected as scan-only
- **THEN** the system SHALL mark the import as unsupported with an explicit scan-or-empty-text-layer reason
- **AND** the system SHALL NOT invoke OCR or present fabricated extracted text.

#### Scenario: Unsupported document type is imported
- **WHEN** a teacher attempts to import DOCX, PPTX, an image, or another unsupported type
- **THEN** the system SHALL reject the import with the supported-format list
- **AND** no document version SHALL become retrieval-eligible.

### Requirement: Extraction results expose stable teacher-reviewable anchors
The system SHALL normalize imported text into ordered segments with stable anchors and SHALL require teacher confirmation before retrieval use.

#### Scenario: Searchable PDF extraction completes
- **WHEN** a searchable PDF is successfully extracted
- **THEN** the preview SHALL show ordered text by page and paragraph
- **AND** every segment SHALL retain a stable page-and-paragraph anchor and content hash.

#### Scenario: Markdown, text, or pasted-text extraction completes
- **WHEN** a Markdown, plain-text, or pasted-text source is normalized
- **THEN** the preview SHALL show its heading path and ordered paragraphs
- **AND** every segment SHALL retain a stable heading/paragraph anchor and content hash.

#### Scenario: Teacher confirms extraction
- **WHEN** the owning teacher confirms that an extraction preview is usable
- **THEN** the document version SHALL become eligible for governed corpus projection
- **AND** the confirmation actor, time, extraction version, and content hash SHALL be recorded.

#### Scenario: Teacher rejects extraction
- **WHEN** the owning teacher rejects an extraction preview
- **THEN** the version SHALL remain in a rejected or needs-replacement state
- **AND** it SHALL NOT be used by Source Pack retrieval or generation.

### Requirement: Course-basis documents use immutable versions
The system SHALL create an immutable document version for every successful import or replacement and SHALL preserve versions referenced by lesson-plan revisions.

#### Scenario: Teacher replaces a document
- **WHEN** a teacher imports replacement content for an existing standard or textbook document
- **THEN** the system SHALL create a new positive sequential version without changing prior version content, anchors, or hashes
- **AND** new lesson tasks MAY select the new version independently of prior tasks.

#### Scenario: Referenced source version is retired
- **WHEN** a teacher retires a document version already referenced by a lesson-plan revision
- **THEN** the version SHALL stop appearing as a default selection for new tasks
- **AND** its content, anchors, citations, and audit metadata SHALL remain available to authorized historical views.

#### Scenario: Referenced source version deletion is requested
- **WHEN** a physical deletion is requested for a document version referenced by a lesson-plan or courseware revision
- **THEN** the system SHALL refuse destructive deletion
- **AND** it SHALL identify the blocking revision references without exposing them to unauthorized users.

### Requirement: Confirmed course-basis segments enter governed retrieval
Confirmed document versions SHALL be projected into the existing governed corpus and `lesson-design` Source Pack path rather than scanned directly by the generation model.

#### Scenario: Confirmed version is indexed
- **WHEN** a confirmed course-basis document version is projected for retrieval
- **THEN** each segment SHALL preserve owner scope, course-basis id, document/version id, stable anchor, content hash, title, source type, and review state
- **AND** the projection SHALL expose server-owned citation metadata usable by the existing citation verifier.

#### Scenario: Lesson task requests evidence
- **WHEN** a smart lesson task retrieves evidence from selected course-basis versions
- **THEN** the Source Pack SHALL use the `lesson-design` profile and teacher authorization scope
- **AND** raw unconfirmed uploads, retired versions not explicitly selected, and other teachers' sources SHALL be excluded.

### Requirement: A reproducible root-locus demo course basis is provided
The change SHALL provide importable demonstration materials for the standard smart-preparation acceptance path.

#### Scenario: Demo materials are prepared
- **WHEN** the demonstration package is built
- **THEN** it SHALL include the governed runtime Markdown/citation segments for `hu-shousong-exercise-analysis-3rd` chapter four and a compact course standard derived from `course-content/syllabus-refactor/blueprint.md`
- **AND** the compact standard SHALL identify the course, prerequisites, root-locus learning goals, and lesson scope needed for the demonstration
- **AND** a machine-readable provenance record SHALL identify the rights basis and permitted demonstration scope for every packaged source.

#### Scenario: Textbook redistribution rights are not established
- **WHEN** the existing Hu Shousong runtime Markdown is available only as teacher-local or otherwise restricted course material
- **THEN** the public repository or contest delivery bundle SHALL NOT redistribute the full restricted text
- **AND** the demonstration SHALL import it from the authorized teacher-local runtime location or use an independently authorized excerpt while preserving the same ordinary ingestion path.

#### Scenario: Demo course basis is exercised
- **WHEN** the standard demonstration starts
- **THEN** the materials SHALL pass through the same teacher import, extraction confirmation, versioning, governed projection, and Source Pack flow as other teacher materials
- **AND** a preloaded generated lesson SHALL NOT substitute for source ingestion acceptance.

