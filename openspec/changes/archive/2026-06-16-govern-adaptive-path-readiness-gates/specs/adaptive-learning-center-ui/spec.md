## ADDED Requirements

### Requirement: Adaptive path center renders readiness gates in product language
The adaptive learning center SHALL show preparation, locked, and evidence-needed states without exposing internal readiness codes.

#### Scenario: Locked node is visible in a path option
- **WHEN** a generated path option includes a locked node
- **THEN** the UI SHALL label it with student-facing text such as `稍后解锁` or `Arena 暂未解锁`
- **AND** it SHALL show the preparation action required before unlock
- **AND** it SHALL NOT render internal strings such as `locked`, `low-resource-fallback`, `reasonCodes`, `policyBundle`, `missing-*`, or `terminal-validation-unavailable`.

#### Scenario: Current node is selected
- **WHEN** the selected path contains active and locked nodes
- **THEN** the path center SHALL mark exactly one eligible current node
- **AND** locked nodes SHALL be inspectable but not startable until readiness conditions are satisfied.
