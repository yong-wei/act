## ADDED Requirements

### Requirement: Graph Center exposes role-scoped actions
The system SHALL expose authorized actions from Graph Center nodes, goals, overlays, and resource coverage states.

#### Scenario: Student opens a graph node
- **WHEN** an authorized student selects a graph node or LearningGoal-related subgraph in Graph Center
- **THEN** the node detail SHALL expose available actions such as start or continue path, inspect recommended resources, review personal evidence, or ask Konling with graph context
- **AND** unavailable actions SHALL show explicit degraded reasons rather than disappearing silently.

#### Scenario: Teacher opens a graph node
- **WHEN** an authorized teacher selects a graph node in learner, class, or resource coverage mode
- **THEN** the node detail SHALL expose class diagnosis, affected population, resource gap, prep-pack, and evidence drilldown actions where available
- **AND** actions SHALL preserve class-scope authorization and privacy limits.

#### Scenario: Administrator opens a graph node
- **WHEN** an administrator inspects resource coverage or stale artifact limitations
- **THEN** Graph Center MAY expose audit diagnostics for resource binding, citation readiness, path eligibility, overlay freshness, and version drift
- **AND** raw source content, private learner evidence, and hidden evaluation internals SHALL remain governed by their source contracts.

### Requirement: Graph Center actions preserve read-only graph body semantics
Graph Center actions SHALL operate on paths, resources, overlays, diagnosis, prep packs, and audit surfaces without mutating the graph catalog.

#### Scenario: Action is triggered
- **WHEN** a user launches a path, resource, diagnosis, prep-pack, or audit action from Graph Center
- **THEN** the action SHALL carry stable LearningGoal, graph node, ResourceNode, citation, overlay, or diagnosis references as appropriate
- **AND** graph body node definitions and canonical graph edges SHALL remain unchanged.

### Requirement: Action access is accessible and mobile-safe
Graph Center actions SHALL remain reachable without direct canvas interaction.

#### Scenario: User uses mobile or keyboard navigation
- **WHEN** graph actions are available for a selected node or list item
- **THEN** the non-canvas detail path SHALL expose the same authorized action set with explicit labels, disabled states, and status text
- **AND** action availability SHALL NOT rely on color alone or canvas-only hit testing.
