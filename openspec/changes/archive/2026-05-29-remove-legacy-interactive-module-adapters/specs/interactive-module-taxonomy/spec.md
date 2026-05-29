## ADDED Requirements

### Requirement: Migrated manifests cannot use legacy aliases
The system SHALL reject legacy module aliases in migrated or newly authored manifests.

#### Scenario: Legacy alias in migrated manifest fails
- **WHEN** a migrated lesson manifest contains a historical module kind that is not a canonical module class
- **THEN** validation SHALL fail
- **AND** the failure SHALL identify the canonical replacement.

#### Scenario: New lesson invents a module kind
- **WHEN** a new lesson introduces a module kind not registered as a canonical module class
- **THEN** validation SHALL fail before the lesson can merge
- **AND** no lesson-private renderer registration SHALL make the unregistered kind acceptable.

### Requirement: Historical compatibility is isolated
The system SHALL keep any unavoidable historical compatibility paths separate from new or migrated manifest validation.

#### Scenario: Archive compatibility does not authorize new manifests
- **WHEN** a historical archive or compatibility reader can still interpret old module names
- **THEN** that compatibility SHALL NOT allow new or migrated runtime manifests to pass validation with old names.
