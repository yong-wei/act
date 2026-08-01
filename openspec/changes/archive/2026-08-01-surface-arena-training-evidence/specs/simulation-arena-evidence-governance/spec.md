## MODIFIED Requirements

### Requirement: LearningFact stores compact summaries
The system SHALL materialize simulation and Arena learning evidence into `LearningFact` using compact summaries and source references rather than high-frequency trace samples. Arena virtual training facts SHALL retain the Arena task id, scenario id, preview boundary, official ineligibility, protocol version, trace reference, summary metrics, replay confidence, and governance profile.

#### Scenario: Virtual simulation run becomes learning evidence
- **WHEN** an Arena virtual simulation run is materialized into a learning fact
- **THEN** the learning fact SHALL include source id, run id, Arena task id, scene or scenario id, protocol version, trace reference, summary metrics, preview/official boundary, and governance profile
- **AND** its module attribution SHALL use the Arena task id when available

#### Scenario: High-frequency trace exists
- **WHEN** high-frequency samples are available for a simulation or Arena preview
- **THEN** the learning fact SHALL reference or summarize those samples without copying the complete sample array

### Requirement: Preview and official claims remain unmixed
The system SHALL prevent preview-only Arena runs from being presented as official evaluation or leaderboard evidence. A completed preview MAY provide a bounded, low-confidence learning-profile contribution only when its governed provenance and replay summary are retained.

#### Scenario: Preview-only evidence reaches LearningFact draft
- **WHEN** an Arena preview SimulationRun is converted into an evidence draft
- **THEN** the draft SHALL identify preview-only provenance, task attribution, and official ineligibility
- **AND** it SHALL apply the preview contribution policy rather than an official submission contribution
- **AND** it SHALL NOT use preview metrics as official score, rank, hard-constraint authority, or formal capability attainment
