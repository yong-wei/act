## ADDED Requirements

### Requirement: Snapshot materialization preserves source provenance
Authority domain shard materialization MUST NOT hard-code node-detail `sources` to an empty array. Node-detail `sources` SHALL be filled from the governed engineering-textbook mapping ledger passed as an explicit materialization input. When the active snapshot itself carries `sourceMappings`, `sourceObjects`, or `evidence`, materialization MUST preserve them rather than dropping them.

#### Scenario: Governed mappings fill node detail sources
- **WHEN** materialization runs with a governed mapping ledger containing approved mappings for a node
- **THEN** the node-detail shard `sources` SHALL list that node's approved textbook source locators
- **AND** the canvas node detail SHALL display the citations without any frontend change

#### Scenario: Snapshot carries source data
- **WHEN** the active snapshot contains non-empty `sourceMappings`, `sourceObjects`, or `evidence`
- **THEN** materialization SHALL retain them through the projection pipeline
- **AND** it SHALL NOT blank them out

#### Scenario: No governed ledger is provided
- **WHEN** materialization runs without a mapping ledger input
- **THEN** node-detail `sources` SHALL remain empty by explicit default
- **AND** the absence SHALL be visible in the coverage receipt rather than silently implied

### Requirement: Node detail sources are citation locators, not bodies
Node-detail `sources` entries MUST contain only citation locators — source edition identity, structural-unit coordinate, and display label. Textbook body text MUST NOT appear in shard payloads.

#### Scenario: Source entry is emitted
- **WHEN** a node-detail shard lists a textbook source
- **THEN** the entry SHALL carry edition identity, structural-unit coordinate, and label
- **AND** it SHALL NOT carry textbook body text or raw extraction payload
