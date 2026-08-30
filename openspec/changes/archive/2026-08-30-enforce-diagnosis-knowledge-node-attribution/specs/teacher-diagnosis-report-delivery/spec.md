## MODIFIED Requirements

### Requirement: Attribution-limited status requires knowledge-node findings

The teacher diagnosis history projection SHALL mark a report attribution-limited only when a finding that requires knowledge-node attribution is missing `knowledgeNodeId`. A finding requires knowledge-node attribution when it cites at least one `knowledge-progress:` evidence reference. Findings about overall risk, score distribution, or class coverage SHALL NOT by themselves mark the report as coverage-limited.

When attribution limitation is the only confidence reason — the report's data coverage is complete and no other evidence boundary applies — the availability state and recovery advice SHALL describe the knowledge-node attribution problem explicitly and SHALL NOT describe it as data coverage limitation. Reports with genuine student, assignment, assessment, or behavior coverage gaps SHALL keep the existing data coverage limitation wording.

#### Scenario: Knowledge-progress finding lacks a node

- **WHEN** a persisted finding cites `knowledge-progress:` evidence and has no `knowledgeNodeId`
- **THEN** the history projection SHALL set attribution-limited
- **AND** it SHALL keep a recovery action to complete knowledge-node mapping

#### Scenario: Overall risk or score distribution lacks a node

- **WHEN** a finding describes overall risk or score distribution and has no `knowledgeNodeId`
- **AND** it does not cite `knowledge-progress:` evidence
- **THEN** the history projection SHALL NOT set attribution-limited solely because of that finding

#### Scenario: Mixed findings with complete coverage

- **WHEN** assignment, assessment, student, and learning-behavior coverage are complete
- **AND** the report declares no limitations
- **AND** only non-knowledge-node findings omit `knowledgeNodeId`
- **THEN** the history projection SHALL display an availability state consistent with the persisted complete coverage
- **AND** it SHALL NOT show coverage-limited solely because of those findings

#### Scenario: Attribution limitation is the only confidence reason

- **WHEN** a report's data coverage is complete with no declared data limitations
- **AND** the only confidence reason is a knowledge finding without a node
- **THEN** the availability state SHALL be described as knowledge-node attribution limitation
- **AND** it SHALL NOT use the data coverage-limited wording.
