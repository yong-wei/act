## ADDED Requirements

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
