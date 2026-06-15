## ADDED Requirements

### Requirement: Konling receives knowledge workspace context from governed sources
Konling SHALL resolve knowledge graph context from server-owned user, route, resource, evidence, and permission sources, supplemented by scoped client selection hints.

#### Scenario: Konling opens with a selected knowledge node
- **WHEN** Konling starts on `/knowledge` and a graph node is selected
- **THEN** it SHALL receive the knowledge route, selected node id, selected node name, node type, chapter context, relation summary, active filters, density mode, view mode, and available learning actions where permitted
- **AND** learner identity, evidence access, resource access, and tool permissions SHALL remain server-owned.

#### Scenario: Client hints are broader than permission scope
- **WHEN** a client graph hint references a resource, evidence item, class, path, or selected node outside the user's permitted scope
- **THEN** Konling SHALL ignore or degrade that context
- **AND** it SHALL NOT expand the user's accessible evidence, resources, tools, or privacy scope.

### Requirement: Knowledge assistant fallback is explicit
Konling SHALL expose route-level or degraded guidance when selected-node or learner context is missing.

#### Scenario: No knowledge node is selected
- **WHEN** Konling opens on `/knowledge` without a selected node
- **THEN** it SHALL provide route-level graph exploration guidance
- **AND** it SHALL NOT claim selected-node diagnosis or evidence analysis.

#### Scenario: Selected-node context is incomplete
- **WHEN** Konling cannot resolve required selected-node, resource, or evidence context
- **THEN** it SHALL present a degraded or unavailable state with a clear reason
- **AND** it SHALL NOT infer authoritative learning advice from generic chat context alone.
