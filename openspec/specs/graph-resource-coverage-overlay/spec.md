# graph-resource-coverage-overlay Specification

## Purpose
Define the read-only graph-center overlay that reports ResourceNode, runtime, RAG, and Arena coverage readiness for KAQ graph nodes without copying governed source content.
## Requirements
### Requirement: Graph nodes expose resource coverage status
The system SHALL provide read-only resource coverage overlays for graph nodes.

#### Scenario: Resource coverage is generated
- **WHEN** graph-center resource coverage mode is requested
- **THEN** each covered graph node SHALL expose linked resource count, path-eligible resource count, RAG-indexed resource count, citation-ready resource count, verified-citation resource count, assessment resource count, simulation resource count, Arena preview resource count, Arena official resource count, terminal-validation-capable resource count, coverage state, and missing coverage types.

### Requirement: Resource coverage preserves source ownership
The resource coverage overlay SHALL consume resource projections without copying raw content or bypassing ResourceNode governance.

#### Scenario: Coverage reads registered resources
- **WHEN** ResourceNode, textbook runtime, lesson runtime, or RAG projection data is used for coverage
- **THEN** the overlay SHALL retain only identity, mapping, count, status, and governance fields needed for coverage
- **AND** it SHALL not store raw markdown, chunk text, hidden Arena internals, raw submissions, or teacher-editable catalog payloads.

### Requirement: Coverage status distinguishes availability dimensions
The resource coverage overlay SHALL not conflate a linked resource with a path-eligible or citation-ready resource.

#### Scenario: Node has linked but not path-eligible resources
- **WHEN** a graph node has linked resources that are blocked, unavailable, or missing path audit requirements
- **THEN** the overlay SHALL show linked count separately from path-eligible count
- **AND** the coverage state SHALL expose the missing governance dimensions.

#### Scenario: Node has indexed but not citation-ready resources
- **WHEN** a graph node has RAG-indexed resources whose citation target, CitationAddress, authority, freshness, privacy visibility, or resolver validation is missing or rejected
- **THEN** the overlay SHALL show indexed count separately from citation-ready and verified-citation counts
- **AND** the node detail SHALL expose a limitation rather than presenting indexed resources as verified clickable citations.

#### Scenario: Arena resource is counted
- **WHEN** Arena resources contribute to graph coverage
- **THEN** preview, official, and terminal-validation-capable coverage SHALL be counted separately
- **AND** official validation coverage SHALL not be inferred unless governed official evaluation evidence is available through the Arena contract.

### Requirement: Field completion coverage exposes governance dimensions
The resource coverage overlay SHALL not conflate a linked resource with a path-eligible or citation-ready resource.

#### Scenario: Resource coverage includes field completion state
- **WHEN** graph resource coverage is generated
- **THEN** each graph node SHALL expose counts for complete, missing-field, provisional, human-confirmed, citation-ready, path-eligible, and blocked resources where available
- **AND** missing field dimensions SHALL be visible to teacher or administrator diagnostics without copying raw resource content.
- **AND** the coverage payload SHALL include denominator, source window, artifact version, sample limitations, and limitation reasons for each displayed coverage dimension.

#### Scenario: Provisional coverage exists
- **WHEN** a graph node is covered only by model-assisted or generated-provisional metadata
- **THEN** the overlay SHALL report coverage limitations
- **AND** it SHALL NOT count that coverage as high-confidence path eligibility.

#### Scenario: Coverage is shown to different roles
- **WHEN** coverage is shown to students, teachers, or administrators
- **THEN** student-facing payloads SHALL avoid internal resource governance diagnostics
- **AND** teacher and administrator payloads SHALL explicitly distinguish linked, reviewed, citation-ready, path-eligible, and mastery-affecting coverage.

### Requirement: LearningGoal baseline coverage is exposed by graph overlays
The system SHALL provide read-only resource coverage overlays for graph nodes.

#### Scenario: LearningGoal baseline coverage is generated
- **WHEN** resource coverage is generated for a path-ready LearningGoal
- **THEN** the overlay SHALL report coverage by K/A/Q objective and by baseline category: concept, diagnostic, practice, checkpoint, remediation, citation, and terminal validation where required
- **AND** it SHALL distinguish linked, human-confirmed, path-eligible, citation-ready, assessment-capable, and high-complexity locked resources.

#### Scenario: Baseline category is missing
- **WHEN** a path-ready LearningGoal lacks a required baseline category
- **THEN** the overlay SHALL expose a low-resource limitation
- **AND** the planner SHALL NOT present cosmetic path options that cannot satisfy the LearningGoal's baseline coverage policy.

### Requirement: LearningGoal baseline coverage distinguishes availability dimensions
The resource coverage overlay SHALL not conflate a linked resource with a path-eligible or citation-ready resource.

#### Scenario: Resource has provisional field completion
- **WHEN** a resource is linked to a LearningGoal only through provisional or model-assisted metadata
- **THEN** the overlay SHALL count it separately from human-confirmed coverage
- **AND** it SHALL NOT count it as baseline path coverage.

### Requirement: Resource coverage overlay can display SAR candidate gaps
The graph resource coverage overlay SHALL display SAR-backed candidate resources as suggestions without treating them as covered resources.

#### Scenario: SAR suggests a resource for a coverage gap
- **WHEN** SAR finds a candidate resource or evidence item for a graph node with missing coverage
- **THEN** the overlay SHALL show the candidate separately from linked, path-eligible, citation-ready, and verified-citation counts
- **AND** it SHALL expose the trace or rationale for teacher/admin review.
