## ADDED Requirements

### Requirement: The smart-preparation series has six exclusive child changes
The series parent SHALL track exactly six executable child changes, and each product capability SHALL be owned by only one child.

#### Scenario: Series metadata is validated
- **WHEN** the parent and child proposals are checked
- **THEN** the declared children SHALL be `add-teacher-course-basis-management`, `add-smart-lesson-plan-authoring`, `standardize-generated-courseware-slide-runtime`, `add-smart-courseware-generation-editor`, `publish-smart-courseware-to-classroom`, and `export-smart-courseware-pdf`
- **AND** no two active children SHALL add the same capability.

### Requirement: Child execution follows the declared dependency graph
The series SHALL permit only dependency-ready children to be claimed while allowing the two foundation children to proceed independently.

#### Scenario: A child is selected for execution
- **WHEN** Buddy evaluates a child change
- **THEN** all entries in that child's `blocked_by` relationship SHALL already be archived
- **AND** the course-basis and slide-runtime children SHALL have no dependency on each other.

### Requirement: Series completion requires archived child evidence
The parent SHALL remain a non-executable tracking record until every declared child is archived.

#### Scenario: P0 completion is evaluated
- **WHEN** the first five children are archived and the root-locus scenario reaches classroom runtime
- **THEN** P0 SHALL be reported complete
- **AND** the evidence SHALL include natural-language task creation, one ambiguity clarification, a later-turn confirmed constraint revision, zero unresolved teaching-goal or module source gaps, at least three authoritative content-quality comparisons, source-rights provenance for demonstration materials, and feedback from at least two target users with usage and effect records
- **AND** the PDF child MAY remain open as P1.

#### Scenario: Parent completion is evaluated
- **WHEN** all six declared children are archived with their issue and review evidence reconciled
- **THEN** the series parent MAY close
- **AND** no product implementation commit or pull request SHALL be required for the parent itself.
