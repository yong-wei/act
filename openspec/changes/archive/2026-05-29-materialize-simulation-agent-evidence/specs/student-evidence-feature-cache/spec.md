## ADDED Requirements

### Requirement: Feature cache consumes materialized simulation and agent evidence
Student evidence feature cache SHALL consume materialized SimulationRun, Arena preview, and AgentToolRun evidence through governed facts, summaries, or drafts rather than raw traces or raw memory.

#### Scenario: Cache rebuild includes simulation-agent evidence
- **WHEN** the feature cache rebuilds for a student with materialized simulation or agent evidence
- **THEN** it SHALL derive deterministic feature groups from owner-scoped LearningFacts, evidence drafts, run summaries, replay confidence, and source provenance
- **AND** it SHALL NOT scan raw high-frequency trace samples for normal profile features.

#### Scenario: Cache rebuild is cross-user safe
- **WHEN** the cache rebuilds for one student
- **THEN** it SHALL use only evidence owned by that student unless a future shared-team evidence spec explicitly allows another scope.

### Requirement: Feature cache marks simulation-agent confidence
Student evidence feature cache SHALL expose confidence, freshness, source coverage, preview/official provenance, and low-evidence markers for simulation and agent-derived feature groups.

#### Scenario: Preview-only evidence contributes context
- **WHEN** preview-only Arena or simulation evidence is present
- **THEN** the feature cache SHALL mark it as preview-only context or low-confidence competency evidence according to materialization policy.
