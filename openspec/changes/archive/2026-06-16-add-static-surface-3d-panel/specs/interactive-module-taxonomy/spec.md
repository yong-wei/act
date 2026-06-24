## ADDED Requirements

### Requirement: Static 3D surface is a registered compute capability
The system SHALL register static 3D surface rendering as a compute capability usable by canonical `compute.panel` modules.

#### Scenario: Static surface compute panel is validated
- **WHEN** a runtime manifest module has `kind: compute.panel` and `payload.capabilityRef: static-surface-3d`
- **THEN** the module registry gate SHALL recognize the capability as registered
- **AND** the module SHALL still be subject to payload validation for required surface data or data asset references.

#### Scenario: Unregistered surface capability is used
- **WHEN** a lesson declares a 3D surface through an unregistered capability reference or a course-private module kind
- **THEN** the module registry gate SHALL fail before merge
- **AND** the failure SHALL identify the unsupported capability or module kind.

### Requirement: Static 3D surface payloads are auditable
The system SHALL require enough structured payload data for static 3D surface modules to be reviewed without lesson-private renderer knowledge.

#### Scenario: Static surface payload is authored
- **WHEN** a lesson authors a static 3D surface compute panel
- **THEN** its payload SHALL identify the data source, title, axis labels, color scale or value meaning, default camera, and fallback evidence
- **AND** those fields SHALL be inspectable by shared validation code.
