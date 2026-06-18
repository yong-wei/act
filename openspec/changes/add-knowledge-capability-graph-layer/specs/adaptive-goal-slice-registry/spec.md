## ADDED Requirements

### Requirement: Goal slices expose knowledge capability targets
Registered adaptive goals SHALL be able to declare capability targets on knowledge graph nodes without changing the factual knowledge node definition.

#### Scenario: Capability target is registered
- **WHEN** a goal slice declares a capability target
- **THEN** it SHALL include knowledge node reference, capability level, behavior verb, success criteria, observable evidence type, and evaluation method
- **AND** the target SHALL map to existing competency dimensions or learner-state feature groups where applicable.

#### Scenario: Knowledge relation informs path planning
- **WHEN** a capability target references prerequisite knowledge relations
- **THEN** those relations SHALL be treated as disciplinary prerequisites
- **AND** path strategy edges such as remedial, alternative, extension, or fallback SHALL remain separate planning metadata.
