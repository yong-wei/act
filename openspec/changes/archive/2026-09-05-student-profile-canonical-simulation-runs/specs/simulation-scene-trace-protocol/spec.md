## MODIFIED Requirements

### Requirement: SimulationRun is the canonical run envelope
The system SHALL create a canonical `SimulationRun` envelope for every evidence-bearing simulation run, Arena preview run, agent experiment run, and teacher batch run.

#### Scenario: Evidence-bearing run is created
- **WHEN** a run is accepted for execution or persisted from a supported domain
- **THEN** the system SHALL record owner user or authorized batch scope, run kind, source domain, source reference, task spec reference or snapshot, controller snapshot reference, status, summary, replay token, and timestamps.

#### Scenario: Domain-specific run detail exists
- **WHEN** a domain such as Arena preview needs dataset, controller, publication, or model-specific fields
- **THEN** those fields MAY remain in a domain detail table
- **AND** the detail table SHALL reference the canonical SimulationRun rather than replacing it as the platform run identity.

#### Scenario: Profile consumers use canonical summaries
- **WHEN** a student profile, personal portfolio, recommendation, or learning-evidence consumer reads simulation data
- **THEN** it SHALL consume the owner-filtered canonical `SimulationRun` summary or a governed projection derived from it
- **AND** a legacy `SimulationLog` MAY be used only for eligible historical compatibility records that have no equivalent canonical run
- **AND** the consumer SHALL not count the same underlying artifact twice.
