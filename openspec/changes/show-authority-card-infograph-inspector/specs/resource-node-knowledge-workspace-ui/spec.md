## ADDED Requirements

### Requirement: Authority inspector resolves card and infograph resources through source-owned contracts
The knowledge workspace SHALL resolve Knowledge Card and infograph availability through their governed export and authorized media contracts. The graph client SHALL NOT construct repository paths, bypass card review status or treat an infograph as proof of an unpublished graph relation.

#### Scenario: Inspector requests learning resources
- **WHEN** a selected Authority object advertises card or infograph availability
- **THEN** the workspace SHALL use the source-owned detail and media routes
- **AND** stale selection responses SHALL be discarded before presentation

#### Scenario: Node selection changes during media load
- **WHEN** the user selects another node before the prior card or image request completes
- **THEN** the inspector SHALL show only the current node's detail
- **AND** the stale response SHALL not replace content or focus state
