## ADDED Requirements

### Requirement: Resource management audits knowledge capability readiness
The teacher-facing ResourceNode management surface SHALL expose read-only readiness for knowledge mapping, capability mapping, citation readiness, and evidence capability.

#### Scenario: Teacher reviews resource readiness
- **WHEN** a teacher or administrator opens the ResourceNode management entrance
- **THEN** each visible resource SHALL identify whether it has knowledge coverage, capability target mapping, citation target readiness, evidence instrumentation, and path eligibility
- **AND** missing required fields SHALL appear as governance warnings or blocking issues.

#### Scenario: Resource lacks capability mapping
- **WHEN** a resource lacks required capability mapping or evidence instrumentation for high-confidence adaptive path use
- **THEN** the management surface SHALL explain the missing field
- **AND** the resource SHALL be excluded from high-confidence path planning unless an explicit fallback policy permits limited use.
