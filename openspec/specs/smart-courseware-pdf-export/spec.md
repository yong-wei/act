# smart-courseware-pdf-export Specification

## Purpose
TBD - created by archiving change export-smart-courseware-pdf. Update Purpose after archive.
## Requirements
### Requirement: PDF export uses a dedicated 16:9 slide projection
The system SHALL export only an immutable published courseware revision through a dedicated student-presentation projection with one fixed 16:9 PDF page per courseware step.

#### Scenario: Teacher exports courseware
- **WHEN** an authorized teacher requests PDF export for a courseware revision
- **THEN** the export SHALL preserve the revision id, displayed courseware/plan version label, step order, registered layout, and 16:9 page geometry
- **AND** it SHALL create exactly one PDF page for each courseware step.

#### Scenario: Teacher requests export for a draft or preview revision
- **WHEN** an export request references mutable, preview-only, or unpublished courseware
- **THEN** the system SHALL reject the request
- **AND** it SHALL require the id of an immutable published courseware revision.

#### Scenario: Workspace page has browser chrome or scrolling
- **WHEN** PDF export renders the courseware
- **THEN** it SHALL render the dedicated slide projection rather than printing the current workspace DOM or browser viewport
- **AND** navigation, editor controls, audit drawers, scroll containers, and browser-print headers or footers SHALL not appear.

### Requirement: PDF export preserves student-safe static semantics
PDF pages SHALL represent the student presentation state and SHALL not expose teacher-only answers, review points, or audit internals.

#### Scenario: Reveal module is exported
- **WHEN** a step contains a reveal module
- **THEN** its content SHALL appear in the fully expanded final state on the same step page
- **AND** export SHALL NOT create additional reveal-state pages.

#### Scenario: Objective activity is exported
- **WHEN** a step contains a choice, ordering, or matching activity
- **THEN** the page SHALL include the prompt and student options or items
- **AND** it SHALL omit the correct answer and explanation and indicate that the activity is completed online.

#### Scenario: Open activity is exported
- **WHEN** a step contains a short-text or long-text activity
- **THEN** the page SHALL include the task and expected student response format
- **AND** it SHALL omit teacher review points and indicate that submission is completed online.

#### Scenario: AI-assisted courseware is exported
- **WHEN** the source revision contains AI-generated lineage
- **THEN** the PDF SHALL show the course-level AI-assisted and teacher-reviewed notice
- **AND** it SHALL not show provider, prompt, schema, source-gap audit, or gate internals.

### Requirement: PDF export is derived and non-authoritative
PDF output SHALL be a derivative artifact and SHALL NOT become the editable courseware source or publication authority.

#### Scenario: PDF generation completes
- **WHEN** an export succeeds
- **THEN** the system SHALL record the source courseware revision id, manifest hash, export renderer version, page count, output hash, actor, and time
- **AND** the immutable courseware revision SHALL remain the content source of truth.

#### Scenario: Courseware is revised after export
- **WHEN** a new courseware revision is published
- **THEN** an older PDF SHALL remain associated only with its original revision
- **AND** the system SHALL require a new export to represent the new revision.

#### Scenario: PPTX export is requested
- **WHEN** a user requests editable PPTX export in this change
- **THEN** the system SHALL report that PPTX export is unsupported
- **AND** it SHALL NOT convert the PDF into a misleading editable format.

### Requirement: PDF export validates page safety
The export pipeline SHALL verify page geometry, page count, rendering completion, and absence of teacher-only answer content before delivering a PDF.

#### Scenario: Export validation passes
- **WHEN** every rendered slide matches the fixed 16:9 geometry, expected step count, and student-safe projection contract
- **THEN** the system SHALL deliver the PDF and persist its export evidence.

#### Scenario: A page overflows or leaks teacher content
- **WHEN** export rendering detects clipping, scroll overflow, missing modules, answer leakage, or a page-count mismatch
- **THEN** the export SHALL fail with page/step-specific deterministic issues
- **AND** it SHALL NOT deliver a partial or silently truncated PDF.

