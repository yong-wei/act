## ADDED Requirements

### Requirement: Knowledge workspace supports ResourceNode-aware exploration
The system SHALL provide a knowledge/resource workspace that can display graph nodes and mapped ResourceNodes through shared workspace UI.

#### Scenario: ResourceNode mapping exists
- **WHEN** a selected knowledge node or resource has a ResourceNode mapping
- **THEN** the UI SHALL show source reference, knowledge coverage, prerequisites, availability, privacy level, teacher policy, evidence instrumentation, and path eligibility where role scope permits.

### Requirement: Partial ResourceNode coverage is explicit
The system SHALL make missing or partial ResourceNode coverage visible.

#### Scenario: Resource lacks a required mapping
- **WHEN** a resource lacks render target, launch target, knowledge mapping, availability, privacy policy, or evidence instrumentation
- **THEN** the workspace SHALL show a warning or unavailable state with a reason suitable for the current role.

### Requirement: Resource launch actions preserve source ownership
The system SHALL launch mapped resources through their existing source-of-record, registry, or feature-owned launcher contracts.

#### Scenario: User launches a mapped resource
- **WHEN** a user launches a lesson, media item, widget, simulation, Arena task, or adaptive path node from the knowledge/resource workspace
- **THEN** the UI SHALL use the ResourceNode source reference, `registryId`, route, or feature-owned launcher contract where available
- **AND** it SHALL NOT move resource implementations, lesson rendering, or Arena/simulation business logic into the knowledge workspace UI.

### Requirement: Workspace preserves current graph exploration
The system SHALL keep existing knowledge graph browsing available while ResourceNode-aware panels are introduced.

#### Scenario: ResourceNode feature flag is disabled
- **WHEN** ResourceNode-aware UI is disabled
- **THEN** the knowledge graph SHALL remain usable through the existing exploration and resource-panel behavior.
