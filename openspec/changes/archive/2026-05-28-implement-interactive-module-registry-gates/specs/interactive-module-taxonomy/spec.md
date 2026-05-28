## ADDED Requirements

### Requirement: Canonical modules are registry-backed
The system SHALL provide a registry that defines each canonical interactive module class and the metadata needed to validate and render it.

#### Scenario: Registry entry describes module behavior
- **WHEN** a canonical module class is registered
- **THEN** the entry SHALL identify its class, renderer or activity-slot behavior, allowed configuration shape, evidence-producing status, and authoring availability
- **AND** the entry SHALL be usable by validation code without importing lesson-private components.

### Requirement: Legacy aliases are registry-backed
The system SHALL keep every migration alias in one registry-backed map.

#### Scenario: Alias maps to canonical replacement
- **WHEN** an existing manifest contains a legacy kind such as `formula-strip`, `choice-check`, `step-reveal-list`, or `parametric-workspace`
- **THEN** the alias map SHALL identify the canonical module class and replacement fields
- **AND** validation output SHALL be able to name the alias and the canonical target.
