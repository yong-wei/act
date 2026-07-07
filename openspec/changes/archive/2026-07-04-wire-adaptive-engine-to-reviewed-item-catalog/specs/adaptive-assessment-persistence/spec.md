## ADDED Requirements

### Requirement: Catalog-backed assessment selections persist immutable metadata snapshots
Adaptive assessment persistence SHALL snapshot catalog-backed selection metadata at question selection or answer submission time.

#### Scenario: Reviewed catalog item is selected
- **WHEN** a reviewed path-eligible catalog item is selected for an adaptive session
- **THEN** the item reference SHALL persist catalog item id, catalog version, source family, source id or file anchor, content hash, review state, eligibility state, LearningGoal ids, K/A/Q objective ids, graph-node refs, stage purpose, difficulty, cognitive level, misconception refs, remediation refs, and version refs
- **AND** historical answers SHALL remain readable after catalog metadata changes.

#### Scenario: Provisional item is selected for low-stakes practice
- **WHEN** a generated or provisional item is selected under an allowed low-stakes policy
- **THEN** the item reference SHALL persist provisional state and limited-confidence authority
- **AND** subsequent evidence SHALL NOT unlock readiness, checkpoint, heavy-node, or terminal-validation gates.
