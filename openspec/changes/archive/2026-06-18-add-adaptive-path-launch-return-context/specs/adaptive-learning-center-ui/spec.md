## ADDED Requirements

### Requirement: Path-launched resources return to the path center
The adaptive learning center SHALL provide a path-aware launch and return contract for every resource opened from a selected path.

#### Scenario: Student launches a path node
- **WHEN** the student starts a knowledge, interactive lesson, adaptive assessment, simulation, control workbench, Arena, reflection, external resource, or Konling node from the current path
- **THEN** the launch target SHALL receive a normalized path launch context containing source, goal id, path id, node id, route intent, return href, and resource type
- **AND** the visible resource destination SHALL have enough context to return to the same path execution workspace.

#### Scenario: Student uses the resource return control
- **WHEN** a resource or course runtime was opened from a valid path launch context
- **THEN** the visible return control SHALL read as `返回学习路径` or equivalent path-specific language
- **AND** it SHALL return to the adaptive path execution workspace for the same path and node.

#### Scenario: Resource is opened outside a path
- **WHEN** the same resource is opened from Interactive Learning, a course entry, or another non-path surface
- **THEN** the resource SHALL keep its normal contextual return target
- **AND** it SHALL NOT fabricate a path return when no path launch context exists.
