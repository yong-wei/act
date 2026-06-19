## ADDED Requirements

### Requirement: Path generation uses PlanningUnit projections
Adaptive path generation SHALL use PlanningUnit projections as executable learning actions derived from audited ResourceNodes or generated checkpoint contracts.

#### Scenario: Path option is generated from resources
- **WHEN** the planner selects a resource-backed path node
- **THEN** the node SHALL identify its source ResourceNode or checkpoint contract, knowledge target, capability target where available, prerequisite basis, estimated time, cognitive load, evidence behavior, and launch binding
- **AND** ResourceNode audit and eligibility SHALL remain authoritative for path inclusion.

#### Scenario: Retrieval chunk is not path-plannable
- **WHEN** a RetrievalChunk matches the learner's current need
- **THEN** it MAY inform explanation or resource discovery
- **AND** it SHALL NOT become a PathNode unless an audited PlanningUnit and ResourceNode or checkpoint contract exists.

#### Scenario: Active execution contracts are present
- **WHEN** PlanningUnit-based nodes are launched, resumed, selected, skipped, or completed
- **THEN** the implementation SHALL preserve the path launch context, selected option adoption, latest path recovery, and completion writeback contracts owned by active path changes.
