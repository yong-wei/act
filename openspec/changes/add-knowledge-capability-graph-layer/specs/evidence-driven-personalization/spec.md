## ADDED Requirements

### Requirement: Personalization distinguishes targets from observed mastery
Profile, diagnosis, and recommendation outputs SHALL distinguish desired capability targets from observed learner evidence.

#### Scenario: Capability target is shown
- **WHEN** a personalized explanation references a target on a knowledge node
- **THEN** it SHALL identify the target capability level and the evidence state separately
- **AND** it SHALL NOT present a teacher-defined target as proof that the learner has mastered that target.

#### Scenario: Evidence is missing for target
- **WHEN** a learner has no governed evidence for a capability target
- **THEN** personalization SHALL expose missing or low-confidence evidence
- **AND** it SHALL prefer starter or evidence-gathering recommendations over high-confidence mastery claims.
