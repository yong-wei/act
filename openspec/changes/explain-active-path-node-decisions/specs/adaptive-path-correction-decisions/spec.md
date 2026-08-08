## ADDED Requirements

### Requirement: Confirmed corrections project the latest node adjustment
The system SHALL derive node-level adjustment explanations from the server-authoritative activity-path sequence immediately before confirmation and the server-authoritative sequence produced by that confirmation.

#### Scenario: Confirmed correction reorders existing nodes
- **WHEN** a student confirms a correction that changes existing node positions
- **THEN** the system SHALL classify a node with a lower resulting index as advanced and a node with a higher resulting index as delayed relative to the immediately preceding active path
- **AND** it SHALL persist the latest student-safe adjustment on the directly affected nodes

#### Scenario: Confirmed correction replaces or removes a node
- **WHEN** a confirmed proposal contains an explicit replacement or removal
- **THEN** the system SHALL use the persisted proposal facts to describe the affected node's latest adjustment where that node remains available as activity-path history
- **AND** it SHALL NOT expose internal node identifiers, reason codes, or fingerprints in the explanation text

#### Scenario: A later correction affects the same node
- **WHEN** a later confirmed correction directly affects a node that already has a latest adjustment
- **THEN** the system SHALL replace only that node's latest adjustment with the new adjacent-version result
- **AND** the append-only correction decision history SHALL remain the source for the complete multi-round record

#### Scenario: Correction does not affect a node
- **WHEN** a confirmed correction leaves a node outside the proposal changes and at the same effective position
- **THEN** the system SHALL preserve that node's existing latest adjustment without modification

#### Scenario: Client submits a claimed adjustment
- **WHEN** a correction decision request includes a client-supplied node order or explanation claim
- **THEN** the system SHALL ignore the claim and derive the projection only from server-authoritative persisted state

### Requirement: Correction application retains reviewable execution history
The system SHALL keep completed and skipped nodes that require historical review in the persisted plan-node collection while maintaining the corrected executable sequence separately.

#### Scenario: Skipped historical node is removed from future execution
- **WHEN** a confirmed correction removes a skipped node from the future executable sequence
- **THEN** the node SHALL remain available as skipped history with its historical decision explanation
- **AND** it SHALL NOT remain in the corrected executable `mainPathNodeIds`
