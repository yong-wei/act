## MODIFIED Requirements

### Requirement: Field completion coverage exposes governance dimensions
The resource coverage overlay SHALL not conflate a linked resource with a path-eligible or citation-ready resource.

#### Scenario: Resource coverage includes field completion state
- **WHEN** graph resource coverage is generated
- **THEN** each graph node SHALL expose counts for complete, missing-field, provisional, human-confirmed, citation-ready, path-eligible, and blocked resources where available
- **AND** missing field dimensions SHALL be visible to teacher or administrator diagnostics without copying raw resource content.
- **AND** the coverage payload SHALL include denominator, source window, artifact version, sample limitations, and limitation reasons for each displayed coverage dimension.
- **AND** the coverage payload SHALL identify whether remaining blockers are citation-only, path-planning, evidence-contract, or human-review blockers.

### Requirement: LearningGoal baseline coverage is exposed by graph overlays
The system SHALL provide read-only resource coverage overlays for graph nodes.

#### Scenario: LearningGoal baseline coverage is generated
- **WHEN** resource coverage is generated for a path-ready LearningGoal
- **THEN** the overlay SHALL report coverage by K/A/Q objective and by baseline category: concept, diagnostic, practice, checkpoint, remediation, citation, and terminal validation where required
- **AND** it SHALL distinguish linked, human-confirmed, path-eligible, citation-ready, assessment-capable, and high-complexity locked resources.
- **AND** it SHALL expose the resource ids and blocker categories needed for staged human completion without exposing raw content to unauthorized roles.
