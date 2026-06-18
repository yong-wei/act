## ADDED Requirements

### Requirement: Path launch context is execution-owned
Adaptive path execution SHALL create and preserve a normalized launch context whenever a path node opens an external resource route.

#### Scenario: Launch context is created
- **WHEN** a path node launch target leaves the adaptive path center
- **THEN** the system SHALL derive source, goal id, path id, node id, route intent, return href, and resource type from the selected path execution state
- **AND** it SHALL pass that context to the target route without treating client-only path ownership hints as authorization.

#### Scenario: Launch context is consumed
- **WHEN** a target resource, course runtime, simulation, workbench, Arena, or assessment page receives a path launch context
- **THEN** it SHALL preserve that context for return navigation
- **AND** any path read or write using that context SHALL validate that the authenticated user is authorized for the path.
