## ADDED Requirements

### Requirement: Candidate discovery may consume the teaching-projection binding adapter
The `PlanLearningPath` pipeline MAY consume teaching-projection binding adaptations as one candidate source of its candidate-discovery port. The adapter SHALL feed the same candidate/eligibility ports as every other source and MUST NOT become a second ranking or assembly authority. `PlanLearningPath` SHALL remain the only use case that assembles a learner path; the adapter MUST NOT call or embed a competing planner such as `planActPrerequisitePath`.

#### Scenario: Binding adapter contributes candidates
- **WHEN** the pipeline runs for a goal whose resources carry teaching-projection bindings
- **THEN** candidate discovery SHALL include adapter-adapted candidates alongside the existing families
- **AND** hard eligibility SHALL still be decided by the eligibility stage before soft ranking

#### Scenario: Adapter output bypasses eligibility
- **WHEN** an adapter-adapted candidate fails a prerequisite, permission, readiness, or review rule
- **THEN** the eligibility stage SHALL exclude it
- **AND** no adapter signal SHALL reintroduce it as an executable path node

#### Scenario: A second assembly authority is proposed
- **WHEN** a change proposes wiring `planActPrerequisitePath` or any other planner into production path assembly
- **THEN** it SHALL be rejected under this capability
- **AND** prerequisite-projection candidate input MAY only enter as a future candidate-source port evaluated in its own change
