## MODIFIED Requirements

### Requirement: Adaptive path center renders readiness gates in product language
The adaptive learning center SHALL show preparation, locked, and evidence-needed states without exposing internal readiness codes, and SHALL explain locked nodes with a student-facing unlock chain derived from existing readiness data.

#### Scenario: Locked node is visible in a path option
- **WHEN** a generated path option includes a locked node
- **THEN** the UI SHALL label it with student-facing text such as `稍后解锁` or `Arena 暂未解锁`
- **AND** it SHALL show the student-facing unlock chain with the missing conditions and the preparation action required before unlock
- **AND** it SHALL NOT render internal strings such as `locked`, `low-resource-fallback`, `reasonCodes`, `policyBundle`, `missing-*`, or `terminal-validation-unavailable`.

#### Scenario: Locked node is visible in execution timeline
- **WHEN** the selected path execution timeline includes a locked node
- **THEN** the UI SHALL show the locked node's reason, unmet readiness conditions, and next unlock action
- **AND** it SHALL NOT expose internal readiness codes, node IDs, or raw field names.

#### Scenario: Multiple readiness gaps exist
- **WHEN** a locked node has multiple unmet readiness conditions
- **THEN** the UI SHALL list only the unmet conditions in a stable student-readable order
- **AND** it SHALL show current and required values where available.

#### Scenario: Readiness details are unavailable
- **WHEN** a locked node has no structured readiness gaps and no usable unlock message
- **THEN** the UI SHALL state that the specific unlock conditions are temporarily unavailable
- **AND** it SHALL NOT fabricate resource titles, thresholds, or unlock actions.

#### Scenario: Next unlock action has a target
- **WHEN** the next unlock action resolves to an executable path node
- **THEN** the UI SHALL render an actionable link or button for that node.

#### Scenario: Next unlock action has no target
- **WHEN** the next unlock action has no executable target
- **THEN** the UI SHALL render the next action as text only.

#### Scenario: Unlock chain scope remains node-local
- **WHEN** the UI renders a locked node explanation
- **THEN** it SHALL explain only that node's missing conditions and next action
- **AND** it SHALL NOT require or replace a complete global progress map.

#### Scenario: Current node is selected
- **WHEN** the selected path contains active and locked nodes
- **THEN** the path center SHALL mark exactly one eligible current node
- **AND** locked nodes SHALL be inspectable but not startable until readiness conditions are satisfied.
