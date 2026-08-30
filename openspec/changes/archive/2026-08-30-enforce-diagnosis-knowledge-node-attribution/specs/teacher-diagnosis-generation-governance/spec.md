## ADDED Requirements

### Requirement: Knowledge-progress findings carry governed node attribution

For every finding that cites at least one `knowledge-progress:` evidence reference, the generation contract SHALL resolve the knowledge node from the governed input projection rows cited by that finding and enforce attribution before persistence:

- When the cited rows resolve to exactly one governed node and the finding omits `knowledgeNodeId`, the system SHALL deterministically backfill that node.
- When the cited rows resolve to multiple distinct governed nodes and the finding omits `knowledgeNodeId`, the system SHALL reject the output as a retryable model-behavior defect and SHALL NOT persist it.
- When the finding provides a `knowledgeNodeId` that is absent from the governed input's node universe or disagrees with the nodes resolved from its cited rows, the system SHALL reject the output as a retryable model-behavior defect and SHALL NOT persist it.
- When the cited rows carry no governed node at all, the finding SHALL remain unattributed and flow to the projection as attribution-limited.

The retry semantics SHALL follow the existing model-behavior defect budget, and a persistent attribution failure SHALL fail the job with an explicit Chinese reason while keeping the teacher's explicit retry available. Findings about overall risk, score distribution, or class coverage are exempt from this requirement.

#### Scenario: Model omits a node that the cited evidence provides

- **WHEN** a knowledge finding cites knowledge-progress rows that all resolve to one governed node and the model omits `knowledgeNodeId`
- **THEN** the system SHALL backfill the finding with that node and persist the report through the ordinary governed path.

#### Scenario: Model omits a node across ambiguous evidence

- **WHEN** a knowledge finding cites knowledge-progress rows resolving to multiple distinct nodes and omits `knowledgeNodeId`
- **THEN** the system SHALL reject the output and retry within the existing attempt budget
- **AND** the report SHALL NOT be persisted while attribution remains unresolved.

#### Scenario: Model provides an unknown or inconsistent node

- **WHEN** a knowledge finding provides a `knowledgeNodeId` outside the governed node universe or disagreeing with its cited rows
- **THEN** the system SHALL reject the output and retry within the existing attempt budget.

#### Scenario: Governed evidence has no node mapping

- **WHEN** a knowledge finding cites knowledge-progress rows that carry no governed node
- **THEN** the finding SHALL persist without a node
- **AND** the delivery projection SHALL describe it as knowledge-node attribution limitation rather than data coverage limitation.
