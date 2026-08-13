## ADDED Requirements

### Requirement: Authority shard merge preserves workspace state
The knowledge workspace SHALL merge version-valid Authority shards by canonical object identity and layer-aware relation identity. Shard arrival SHALL NOT duplicate multi-domain objects, remount existing nodes, reset the inspector, discard user positions or mix optional teaching data from another projection version.

#### Scenario: Secondary-domain membership arrives
- **WHEN** a later shard references an already loaded object through another reviewed domain membership
- **THEN** the workspace SHALL reuse the existing object and add only the membership context
- **AND** the object's selection, position and open detail state SHALL remain stable

#### Scenario: Version-mismatched shard arrives
- **WHEN** a shard does not match the established Authority, catalog or applicable teaching identity
- **THEN** the workspace SHALL reject it before state merge
- **AND** it SHALL request the matching shard or show a controlled unavailable state
