## ADDED Requirements

### Requirement: Generated paths use governed resource nodes
Adaptive path generation SHALL use only audited resource nodes and checkpoint nodes with registered path semantics.

#### Scenario: Path option is generated
- **WHEN** the planner returns a path option
- **THEN** every node SHALL reference a governed ResourceNode or generated checkpoint contract
- **AND** node type, icon key, estimated time, evidence behavior, and launch target SHALL be present where applicable.

#### Scenario: External resource is included
- **WHEN** a generated path includes an external resource
- **THEN** the node SHALL expose student-facing source and evidence status
- **AND** it SHALL NOT be counted as completed or mastery-affecting without explicit governed access or interaction evidence.
