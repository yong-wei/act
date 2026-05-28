## ADDED Requirements

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
