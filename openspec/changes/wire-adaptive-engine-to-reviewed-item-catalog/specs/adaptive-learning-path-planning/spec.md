## ADDED Requirements

### Requirement: Path assessment nodes consume catalog-backed outcome refs
Adaptive path execution SHALL bind assessment node completion to catalog-backed outcome refs when the node is used for readiness, checkpoint, remediation, or terminal-validation support.

#### Scenario: Assessment node completes
- **WHEN** a path-owned adaptive assessment node is completed
- **THEN** its execution record SHALL include selected catalog item refs, assessment stage, reviewed coverage matrix version, score summary, ability or mastery effect, weak target summary, and evidence authority
- **AND** downstream node readiness SHALL use those typed outcome refs instead of free-form quiz labels.

#### Scenario: Provisional answer exists
- **WHEN** a provisional or generated low-stakes answer exists in the learner history
- **THEN** the planner MAY use it as limited practice context
- **AND** it SHALL NOT treat it as satisfying readiness, checkpoint, heavy-node unlock, or terminal-validation requirements.
