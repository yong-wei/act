# simulation-scene-trace-protocol Specification

## Purpose
Define the canonical scene, trace, and evaluation contracts that let standalone simulations, course resources, and Arena evaluation paths share model identity, replay metadata, summary metrics, and evidence governance semantics without reintroducing page-local numerical engines.
## Requirements
### Requirement: SceneSpec v1 describes simulation scenes
The system SHALL define `SceneSpec v1` as the canonical description for a virtual simulation scene, including scene identity, model identity, disturbance policy, evaluation policy, assets, telemetry, replay metadata, and evidence governance metadata.

#### Scenario: Scene is launched from a standalone route
- **WHEN** a standalone `/simulations/*` route resolves its scene configuration
- **THEN** the scene configuration SHALL be representable as `SceneSpec v1`

#### Scenario: Scene is launched from a course resource
- **WHEN** a DB BOPPPS lesson item launches a simulation resource
- **THEN** the resource configuration SHALL resolve to the same `SceneSpec v1` contract with course/class/session context attached separately

### Requirement: SimulationTrace v1 separates samples from summaries
The system SHALL define `SimulationTrace v1` with a run envelope, sample cadence, high-frequency trace reference, compact summary metrics, seed/version metadata, and replay checksum.

#### Scenario: Simulation run completes
- **WHEN** a simulation run completes
- **THEN** the recorded trace envelope SHALL include scene id, scenario id, protocol version, runtime version, model version, sample cadence, summary metrics, and checksum fields

#### Scenario: Learning evidence is materialized
- **WHEN** a simulation run is converted into learning evidence
- **THEN** learning facts SHALL reference or summarize the trace instead of embedding high-frequency samples directly

### Requirement: EvaluationSpec v1 maps scene and Arena evaluation semantics
The system SHALL define `EvaluationSpec v1` references that bind each scene or Arena path to preview metrics, official metrics, hard constraints, visibility policy, and model relation metadata.

#### Scenario: Arena object is a simplified model
- **WHEN** an Arena black-box object is not the same model as the corresponding 3D simulation scene
- **THEN** the mapping SHALL record `modelRelation` as `simplified` or `surrogate`, state the teaching semantics, and identify evaluation claims that must not be mixed with the high-fidelity scene

#### Scenario: Official evaluation is configured
- **WHEN** an official evaluation protocol is attached to a scene or Arena task
- **THEN** the protocol SHALL state its metric ids, hard constraints, visibility boundary, and whether preview metrics are allowed to be shown to students

### Requirement: Existing runtime rules remain authoritative
The system SHALL keep Rust/WASM model ownership and fixed-step `SimulationClock` execution as the simulation runtime baseline.

#### Scenario: Protocol is added
- **WHEN** `SceneSpec v1` and `SimulationTrace v1` are introduced
- **THEN** the system SHALL NOT reintroduce front-end physics steppers, variable-delta model progression, or page-local numerical integrators

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

### Requirement: Agent tool runs reference canonical simulation runs
Simulation tool executions SHALL reference canonical SimulationRun and SimulationTrace records when creating, analyzing, comparing, or modifying simulation-related state.

#### Scenario: Tool creates a run
- **WHEN** an agent tool creates a simulation run
- **THEN** the resulting SimulationRun SHALL include the AgentSession or AgentToolRun reference where available
- **AND** the run SHALL keep owner-user isolation metadata.

#### Scenario: Tool analyzes a trace
- **WHEN** an agent tool analyzes a trace
- **THEN** the analysis result SHALL reference SimulationRun and SimulationTrace identifiers and SHALL NOT become the canonical trace itself.

### Requirement: Simulation tool outputs preserve provenance
Simulation tool outputs SHALL preserve whether a run is standalone, course-launched, Arena preview, official evaluation, teacher batch, or agent experiment.

#### Scenario: Preview run is analyzed
- **WHEN** Konling analyzes a preview-only run
- **THEN** the output SHALL identify it as preview-only and SHALL NOT present it as official evaluation evidence.
