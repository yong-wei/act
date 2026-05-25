# simulation-arena-evidence-governance Specification

## Purpose
TBD - created by archiving change govern-simulation-and-arena-evidence-sources. Update Purpose after archive.
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

