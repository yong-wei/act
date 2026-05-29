# simulation-arena-evidence-governance Specification

## Purpose
Define how simulation and Arena runtime records are cataloged, audited, and materialized as governed learning evidence while preserving source context and keeping high-frequency trace samples out of `LearningFact`.
## Requirements
### Requirement: Simulation and Arena evidence sources are cataloged
The system SHALL catalog simulation sessions/logs and Arena public experiments, virtual previews, official submissions, and official evaluation runs as governed evidence sources.

#### Scenario: Governance status is generated
- **WHEN** the admin governance status report is generated
- **THEN** simulation and Arena evidence sources SHALL report coverage, readiness, provenance, and traceability fields

#### Scenario: Session and log roles are distinct
- **WHEN** simulation sources are classified
- **THEN** `SimulationSession` SHALL be treated as the run/session envelope and `SimulationLog` SHALL be treated as attempt or activity detail, with separate readiness and traceability metadata

### Requirement: LearningFact stores compact summaries
The system SHALL materialize simulation and Arena learning evidence into `LearningFact` using compact summaries and source references rather than high-frequency trace samples.

#### Scenario: Virtual simulation run becomes learning evidence
- **WHEN** a virtual simulation run is materialized into a learning fact
- **THEN** the learning fact SHALL include source id, run id, scene or task id, protocol version, trace reference, summary metrics, and governance profile

#### Scenario: High-frequency trace exists
- **WHEN** high-frequency samples are available for a simulation or Arena preview
- **THEN** the learning fact SHALL reference or summarize those samples without copying the complete sample array

### Requirement: Course context is preserved
The system SHALL preserve course, class, session, publication, and standalone launch context when simulation or Arena evidence is generated.

#### Scenario: Simulation launches from a lesson
- **WHEN** a simulation is launched from a DB BOPPPS lesson item
- **THEN** materialized evidence SHALL include the available course/class/session context

### Requirement: Arena preview evidence uses SimulationRun envelope
Governed Arena preview evidence SHALL use the canonical SimulationRun envelope as the platform reference while preserving Arena detail lineage.

#### Scenario: Governance status inspects preview runs
- **WHEN** governance status reports Arena preview readiness
- **THEN** it SHALL report whether each new preview has a SimulationRun envelope, Arena detail reference, owner user, replay metadata, summary metrics, and preview/official boundary metadata.

#### Scenario: Preview evidence is consumed
- **WHEN** a downstream evidence, teacher, profile, or Konling consumer uses an Arena preview result
- **THEN** it SHALL consume the SimulationRun envelope and summary
- **AND** it MAY follow the Arena detail reference only for authorized preview-specific drilldown.

### Requirement: Preview and official claims remain unmixed
The system SHALL prevent preview-only Arena runs from being presented as official evaluation or leaderboard evidence.

#### Scenario: Preview-only evidence reaches LearningFact draft
- **WHEN** an Arena preview SimulationRun is converted into an evidence draft
- **THEN** the draft SHALL identify preview-only provenance and official ineligibility
- **AND** it SHALL NOT use preview metrics as official score, rank, or hard-constraint authority.

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
