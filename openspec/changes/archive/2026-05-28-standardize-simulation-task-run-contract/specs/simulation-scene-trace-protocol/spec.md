## ADDED Requirements

### Requirement: SimulationTaskSpec defines executable simulation tasks
The system SHALL define `SimulationTaskSpec` as the canonical executable task contract derived from SceneSpec, EvaluationSpec, and launch context.

#### Scenario: Course-launched task is resolved
- **WHEN** a simulation launches from a course resource, assignment, or Konling task
- **THEN** the system SHALL resolve scene id, scenario id, objectives, constraints, disturbance policy, evaluation spec, allowed controllers, schema version, and stable spec hash into a SimulationTaskSpec
- **AND** course, class, resource, lesson, or publication context SHALL be attached separately from the scene description.

### Requirement: SimulationRun is the canonical run envelope
The system SHALL create a canonical `SimulationRun` envelope for every evidence-bearing simulation run, Arena preview run, agent experiment run, and teacher batch run.

#### Scenario: Evidence-bearing run is created
- **WHEN** a run is accepted for execution or persisted from a supported domain
- **THEN** the system SHALL record owner user or authorized batch scope, run kind, source domain, source reference, task spec reference or snapshot, controller snapshot reference, status, summary, replay token, and timestamps.

#### Scenario: Domain-specific run detail exists
- **WHEN** a domain such as Arena preview needs dataset, controller, publication, or model-specific fields
- **THEN** those fields MAY remain in a domain detail table
- **AND** the detail table SHALL reference the canonical SimulationRun rather than replacing it as the platform run identity.

### Requirement: Simulation records are isolated by user and role scope
The system SHALL enforce owner-user isolation for student simulation records and scoped role access for teacher or admin views.

#### Scenario: Student reads runs
- **WHEN** a student requests simulation run or trace metadata
- **THEN** the system SHALL return only runs owned by that user unless a future spec grants a specific shared-resource exception.

#### Scenario: Teacher reads class runs
- **WHEN** a teacher requests class simulation evidence
- **THEN** the system SHALL return only authorized summaries or drilldown references for students in the teacher's class scope
- **AND** it SHALL NOT expose another user's raw high-frequency trace.

### Requirement: SimulationTrace stores summaries and sample references
The system SHALL store trace envelope, compact summary, cadence, checksum, sample count, and high-frequency sample reference without requiring LearningFact or profile consumers to scan raw samples.

#### Scenario: Run completes
- **WHEN** a SimulationRun completes with trace output
- **THEN** the associated trace SHALL record protocol version, runtime version, model version, seed, checksum, summary metrics, sample count, cadence, and optional storage URI.

#### Scenario: Profile consumer needs simulation features
- **WHEN** a profile, recommendation, or teacher summary consumer reads simulation-derived evidence
- **THEN** it SHALL use the run summary, governed facts, or feature cache rather than directly scanning high-frequency samples.
