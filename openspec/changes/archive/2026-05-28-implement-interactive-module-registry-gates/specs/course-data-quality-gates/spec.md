## ADDED Requirements

### Requirement: Runtime manifests reject unregistered module kinds
The course data-quality gate SHALL detect manifest modules that do not resolve to a canonical module class or approved migration alias.

#### Scenario: Unknown module kind fails
- **WHEN** the gate scans runtime manifests
- **AND** a module kind is not a canonical class and not present in the legacy alias map
- **THEN** the gate SHALL fail with the lesson id, step id, module id, and offending kind.

#### Scenario: Migrated lesson uses legacy alias
- **WHEN** a lesson is marked as migrated to standard modules
- **AND** its manifest still uses a legacy alias
- **THEN** the gate SHALL fail and identify the canonical replacement.

### Requirement: Module gates cover activity and compute contracts
The course data-quality gate SHALL reject modules whose declared behavior cannot be governed by the shared runtime contracts.

#### Scenario: Activity module lacks response contract
- **WHEN** an activity module or response-producing step is present
- **THEN** the gate SHALL verify that its response kind is registered
- **AND** objective response kinds SHALL expose enough metadata for scoring or explicit unsupported-scoring status.

#### Scenario: Compute panel lacks capability reference
- **WHEN** a module resolves to `compute.panel`
- **THEN** the gate SHALL require a registered compute capability reference or explicit migration exception
- **AND** the failure SHALL identify the missing reference.
