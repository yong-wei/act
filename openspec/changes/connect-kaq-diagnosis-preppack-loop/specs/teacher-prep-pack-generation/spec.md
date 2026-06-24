## MODIFIED Requirements

### Requirement: Prep packs convert diagnosis into teacher actions
The system SHALL generate reviewable teacher prep packs from governed class diagnosis, K/A/Q graph weak points, resource coverage gaps, and evidence, and prep packs SHALL be accessible from teacher diagnosis and Graph Center surfaces as reviewable interventions.

#### Scenario: Graph-aware prep pack is generated
- **WHEN** a teacher generates a prep pack from K/A/Q class diagnosis or a Graph Center weak-node action
- **THEN** each candidate SHALL include target LearningGoal or graph node ids, source diagnosis evidence, target class or lesson context, insertion target, evidence citations, resource coverage or gap refs, expected learner impact, confidence, and teacher review state
- **AND** unsupported candidates SHALL become draft-resource requests or be excluded from automatic insertion.

### Requirement: Enhancement impact is traceable
Activated enhancement packs SHALL be linkable to subsequent learning evidence, graph-node targets, and teacher feedback, and prep-pack impact SHALL be available to effect-report and teacher reflection workflows.

#### Scenario: Post-class evidence is collected for graph-aware prep item
- **WHEN** learners interact with activated overlay items tied to K/A/Q graph nodes
- **THEN** the system SHALL record impact evidence linked to pack id, item id, lesson/session scope, source diagnosis, target graph node where safe, and privacy-safe references
- **AND** effect-report and teacher reflection code SHALL be able to aggregate impact without raw private evidence.
