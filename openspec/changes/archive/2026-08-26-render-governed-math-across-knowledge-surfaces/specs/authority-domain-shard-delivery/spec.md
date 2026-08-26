## ADDED Requirements

### Requirement: Bounded Authority shards project governed rich text for their surface
Root, domain, search, neighborhood, hover-preview, and node-detail responses SHALL project only the qualified rich-text fields and same-release math presentation data required by that bounded surface. Canvas and search responses SHALL contain bounded title and preview content; full description and learning content SHALL remain detail-only. Clients MUST NOT receive or join the complete release rich-text or math-asset indexes.

#### Scenario: Domain shard contains a formulaized title
- **WHEN** a bounded domain shard includes a node whose selected-locale title contains qualified math spans
- **THEN** the response SHALL include a safe rich-title projection sufficient for canvas, search, and accessibility presentation
- **AND** it SHALL remain bound to the shard envelope without exposing raw release or math-asset identity as user content

#### Scenario: Detail is requested after node selection
- **WHEN** a viewer selects a node with a governed rich description or block mathematics
- **THEN** the detail response SHALL add only that node's qualified full rich content
- **AND** the client SHALL not fetch the complete rich-text index or another Authority envelope

#### Scenario: Optional rich content drifts
- **WHEN** a projected document, math asset, macro profile, or ledger disposition does not match the selected shard envelope
- **THEN** the affected field SHALL fail closed and the target qualification SHALL enforce its disposition gate
- **AND** valid base topology and unrelated qualified content SHALL not be rewritten or merged with another release
