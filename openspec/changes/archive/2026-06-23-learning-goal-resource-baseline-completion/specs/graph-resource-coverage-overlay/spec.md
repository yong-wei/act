## ADDED Requirements

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
