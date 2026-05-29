## ADDED Requirements

### Requirement: Simulation and agent evidence is staged before LearningFact
The system SHALL stage SimulationRun, Arena preview, and AgentToolRun outputs as governed evidence drafts before creating LearningFact records.

#### Scenario: Simulation run completes
- **WHEN** a SimulationRun completes with summary metrics and replay metadata
- **THEN** the system SHALL create or enqueue a user-scoped evidence draft with run reference, trace reference, summary metrics, provenance, confidence, privacy scope, and dedupe key.

#### Scenario: Agent tool run completes
- **WHEN** an AgentToolRun produces analysis, comparison, patch rationale, or report draft evidence
- **THEN** the system SHALL create or enqueue an evidence draft that references the AgentToolRun and any related SimulationRun
- **AND** model-authored narrative SHALL NOT directly become a high-confidence LearningFact without deterministic metrics or review policy.

### Requirement: Evidence materialization is idempotent
The system SHALL prevent duplicate evidence drafts and LearningFacts when run, tool, replay, or review events are retried.

#### Scenario: Same run is processed twice
- **WHEN** the materializer receives the same run and dedupe key more than once
- **THEN** it SHALL reuse or report the existing draft or fact
- **AND** it SHALL NOT double-count competency contribution.

### Requirement: Evidence outbox preserves causation
The system SHALL emit materialization events with correlation id, causation id, source run/tool id, owner user, and provenance metadata.

#### Scenario: Draft is created from agent-assisted simulation
- **WHEN** a draft is created from a Konling tool-assisted run
- **THEN** the outbox or event payload SHALL retain AgentSession, AgentToolRun, SimulationRun, owner user, and source provenance references.

### Requirement: Materialized evidence remains user-isolated
The system SHALL carry owner-user scope from source records into evidence drafts, LearningFacts, and downstream summaries.

#### Scenario: Evidence is queried by a student
- **WHEN** a student reads materialized simulation or agent evidence
- **THEN** the system SHALL return only evidence owned by that user.

#### Scenario: Evidence is aggregated by a teacher
- **WHEN** a teacher reads class evidence summaries
- **THEN** the system SHALL aggregate only students within authorized class scope and SHALL NOT expose raw private memory or raw high-frequency traces.
