## ADDED Requirements

### Requirement: Course-basis sources have a Chinese document lifecycle
The system SHALL present each course-basis document version with exactly one applicable user-facing lifecycle state from `上传中`, `正在提取`, `可编辑`, `已冻结`, `已停用`, and `处理失败`.

#### Scenario: Extraction succeeds before use
- **WHEN** a supported document finishes extraction and has not been adopted by a preparation resource pack
- **THEN** its state SHALL be `可编辑`
- **AND** it SHALL remain readable and editable by the owning teacher.

#### Scenario: Document is disabled
- **WHEN** the teacher disables a document version
- **THEN** its state SHALL be `已停用`
- **AND** authorized historical views SHALL remain able to open and read it.

### Requirement: Extracted sources render as complete documents
The course-basis UI SHALL render normalized source content as one continuous structured document while retaining stable internal anchors.

#### Scenario: Teacher opens an extracted Markdown document
- **WHEN** the teacher opens the document
- **THEN** headings, paragraphs, tables, formulas, code blocks, and lists SHALL render according to their document structure
- **AND** the page SHALL show concise Chinese state, version, and extraction metadata without exposing internal segments, index identifiers, or engineering enums.

### Requirement: First actual use freezes a course-basis version
A successfully extracted course-basis version SHALL remain mutable until an authorized operation accepts its content as evidence for a preparation resource pack, knowledge point, goal, or generation input.

#### Scenario: Version is merely selected
- **WHEN** the teacher selects a document version but no content from it is adopted
- **THEN** the version SHALL remain editable and SHALL NOT be frozen.

#### Scenario: Content is retrieved but not adopted
- **WHEN** content is recalled, ranked, or previewed but no candidate is accepted as preparation evidence or generation context
- **THEN** the version SHALL remain editable and SHALL NOT be frozen.

#### Scenario: Content is first adopted
- **WHEN** an authorized preparation operation first accepts content from a mutable version
- **THEN** the system SHALL atomically confirm and freeze that version and bind the adopting record to its content hash and stable anchors
- **AND** the user-facing state SHALL become `已冻结`.

#### Scenario: Two first-use operations race
- **WHEN** concurrent operations attempt to adopt different mutable content identities
- **THEN** only one content identity SHALL be frozen
- **AND** the conflicting operation SHALL reload or retry against the frozen identity.

### Requirement: Post-freeze edits create immutable successor versions
The system SHALL never mutate the content, anchors, or hash of a frozen course-basis version.

#### Scenario: Teacher edits frozen content
- **WHEN** the owning teacher starts editing a frozen version
- **THEN** the system SHALL create the next positive sequential mutable version
- **AND** references to the frozen version SHALL continue to resolve to its original content.

### Requirement: Course-basis deletion is reference-aware
The system SHALL permanently delete an authorized course basis or document version only when no task, resource pack, lesson revision, courseware revision, publication, or classroom runtime references it.

#### Scenario: Unreferenced source is deleted
- **WHEN** the teacher confirms deletion and the reference check finds no blocker
- **THEN** the source and its unreferenced owned extraction records SHALL be permanently deleted.

#### Scenario: Referenced source deletion is requested
- **WHEN** the source is referenced
- **THEN** the system SHALL refuse destructive deletion, keep the source readable, and list authorized blocking object names, categories, and navigation targets
- **AND** it SHALL offer the applicable actions to enter the task, delete still-deletable draft or generated content, or disable the source without disclosing unauthorized reference details.

## MODIFIED Requirements

### Requirement: Extraction results expose stable teacher-reviewable anchors
The system SHALL normalize imported text into ordered content with stable anchors and SHALL keep a successfully extracted version editable until first actual adoption.

#### Scenario: Searchable PDF extraction completes
- **WHEN** a searchable PDF is successfully extracted
- **THEN** the complete document preview SHALL preserve ordered text by page and paragraph
- **AND** every internal unit SHALL retain a stable page-and-paragraph anchor and content hash.

#### Scenario: Markdown, text, or pasted-text extraction completes
- **WHEN** a Markdown, plain-text, or pasted-text source is normalized
- **THEN** the complete document preview SHALL preserve its heading path and ordered content
- **AND** every internal unit SHALL retain a stable heading/paragraph anchor and content hash.

#### Scenario: Extraction becomes editable
- **WHEN** the owning teacher receives a successful extraction
- **THEN** the version SHALL enter the editable state and MAY participate in authorized preparation candidate retrieval
- **AND** retrieval, selection, ranking, and preview SHALL NOT confirm or freeze it.

#### Scenario: Teacher rejects extraction
- **WHEN** the owning teacher rejects an extraction preview as unusable
- **THEN** the version SHALL remain in a rejected or needs-replacement state
- **AND** it SHALL NOT be used by preparation retrieval or generation.

### Requirement: Course-basis documents use immutable versions
The system SHALL keep a successful submitted version mutable before first actual adoption and SHALL preserve every frozen version referenced by lesson-plan or courseware revisions.

#### Scenario: Teacher edits before first adoption
- **WHEN** the teacher saves changes to an editable version before any content is adopted
- **THEN** the current mutable version SHALL update its content, anchors, and content hash
- **AND** no immutable historical reference SHALL be changed because none yet exists.

#### Scenario: Teacher replaces or edits frozen content
- **WHEN** the teacher changes a frozen document
- **THEN** the system SHALL create a new positive sequential editable version without changing prior version content, anchors, or hashes
- **AND** new lesson tasks MAY select the new version independently of prior tasks.

#### Scenario: Referenced source version is retired
- **WHEN** the teacher disables a document version already referenced by a lesson-plan or courseware revision
- **THEN** the version SHALL stop appearing as a default selection for new tasks
- **AND** its content, anchors, citations, and audit metadata SHALL remain available to authorized historical views.

#### Scenario: Referenced source version deletion is requested
- **WHEN** a physical deletion is requested for a referenced document version
- **THEN** the system SHALL refuse destructive deletion
- **AND** it SHALL identify authorized blocking references without exposing them to unauthorized users.

### Requirement: Confirmed course-basis segments enter governed retrieval
Editable and frozen enabled document versions MAY provide authorized retrieval candidates, but only accepted content SHALL enter a preparation resource pack and freeze a mutable version.

#### Scenario: Usable version is indexed for candidate retrieval
- **WHEN** an enabled editable or frozen course-basis version is projected for preparation retrieval
- **THEN** each candidate SHALL preserve owner scope, course-basis id, document/version id, stable anchor, content hash, title, source type, and lifecycle state
- **AND** disabled, rejected, processing, failed, and other teachers' versions SHALL be excluded.

#### Scenario: Retrieved content is accepted
- **WHEN** a smart lesson operation accepts candidate content into its preparation resource pack
- **THEN** the accepted evidence SHALL use the `lesson-design` profile and teacher authorization scope
- **AND** an editable source version SHALL freeze atomically with the accepted binding.

#### Scenario: Candidate content is not accepted
- **WHEN** candidate content is recalled or previewed but not accepted
- **THEN** it SHALL NOT enter generation context
- **AND** an editable source version SHALL remain mutable.

### Requirement: A reproducible root-locus demo course basis is provided
The change SHALL preserve importable demonstration materials for the standard smart-preparation acceptance path under the first-use freeze lifecycle.

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
- **THEN** the materials SHALL pass through ordinary teacher import, editable extraction, authorized candidate retrieval, first actual adoption freeze, immutable versioning, governed projection, and preparation resource-pack flow
- **AND** selection, recall, ranking, and preview SHALL NOT freeze the source before actual adoption
- **AND** a preloaded generated lesson SHALL NOT substitute for source ingestion acceptance.
