## ADDED Requirements

### Requirement: Path-plannable resources declare evidence-lineage behavior
ResourceNodes that produce or consume learner evidence SHALL declare evidence-lineage behavior before they can affect path state.

#### Scenario: Evidence-producing ResourceNode is audited
- **WHEN** a ResourceNode can mark completion, checkpoint success, mastery lift, readiness unlock, remediation need, or terminal validation
- **THEN** it SHALL declare event type, event source, clientEventId policy, attemptKey policy, dedupe key, timestamp policy, source-log or source-event linkage, LearningFact materialization policy, confidence policy, and privacy scope
- **AND** the planner SHALL treat missing required lineage as a readiness blocker.
