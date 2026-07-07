## ADDED Requirements

### Requirement: Path-relevant resource evidence lineage is complete
The data completeness helper SHALL require source-event lineage for resources that affect path planning, path execution, mastery, checkpoint state, or learner personalization.

#### Scenario: Path-relevant evidence event is audited
- **WHEN** a resource is path-plannable, evidence-producing, checkpoint-capable, terminal-validation-capable, or mastery-affecting
- **THEN** the helper SHALL verify EventDictionary mapping, clientEventId policy, attemptKey policy, timestamp policy, source log or source event linkage, LearningFact materialization policy, confidence policy, and privacy scope
- **AND** missing lineage SHALL block evidence effect even if the resource is otherwise path-plannable.

#### Scenario: Legacy evidence is incomplete
- **WHEN** historical or legacy evidence lacks required source lineage
- **THEN** the helper SHALL report a limitation or blocker according to whether that evidence is used by current path planning
- **AND** learner fixture generation SHALL remain blocked when path tests would depend on incomplete evidence.
