## ADDED Requirements

### Requirement: New ResourceNode records cannot be provisionally complete
New or modified resource records SHALL not be treated as complete when semantic fields are generated, provisional, or missing review evidence.

#### Scenario: Generated metadata is present
- **WHEN** a new resource contains generated suggestions for K/A/Q, graph, path profile, evidence, citation, or disposition fields
- **THEN** the ResourceNode audit SHALL keep the resource incomplete until an implementing-agent review records reviewer identity, source/version evidence, rationale, and fresh review metadata.

#### Scenario: Resource is intentionally not path-plannable
- **WHEN** a new resource should not become a PathNode
- **THEN** it SHALL still declare reviewed supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale disposition
- **AND** the rationale SHALL be sufficient for the helper to stop reporting it as unexplained missing path readiness.
