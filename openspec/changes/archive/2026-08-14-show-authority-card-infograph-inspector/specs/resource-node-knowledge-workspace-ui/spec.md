## ADDED Requirements

### Requirement: Authority inspector resolves card and infograph resources through source-owned contracts
The knowledge workspace SHALL resolve Knowledge Card and infograph availability through their governed export and authorized media contracts. The graph client SHALL NOT construct repository paths, bypass card review status or treat an infograph as proof of an unpublished graph relation.

#### Scenario: Inspector requests learning resources
- **WHEN** a selected Authority object advertises card or infograph availability through a matching composite shard envelope
- **THEN** the workspace SHALL use the source-owned detail and media routes
- **AND** stale selection responses SHALL be discarded before presentation

#### Scenario: Selected node has no bound Teaching content
- **WHEN** the current composite shard envelope does not report an available, passed Teaching binding
- **THEN** the workspace SHALL not read an independently current card or projection index
- **AND** it SHALL keep the semantic inspector available without rendering optional media placeholders

#### Scenario: Node selection changes during media load
- **WHEN** the user selects another node before the prior card or image request completes
- **THEN** the inspector SHALL show only the current node's detail
- **AND** the stale response SHALL not replace content or focus state
