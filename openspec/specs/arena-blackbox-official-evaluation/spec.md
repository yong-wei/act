# arena-blackbox-official-evaluation Specification

## Purpose
TBD - created by archiving change arena-v3-plant-adapter-and-blackbox-official-evaluation. Update Purpose after archive.
## Requirements
### Requirement: Black-box official evaluation uses hidden scenario sets
Arena black-box official evaluation SHALL replay the submitted controller against a server-side hidden scenario set rather than deriving official metrics only from submitted parameter claims.

#### Scenario: Official hidden scenario replay
- **WHEN** a student submits a valid `black-box-control` artifact for a black-box virtual simulation task
- **THEN** official evaluation MUST execute the controller across the configured hidden scenario set
- **AND** the official metrics MUST be computed from the hidden scenario traces
- **AND** the result MUST NOT reuse the student's public experiment traces or virtual preview traces

#### Scenario: Hidden scenario set records coarse identity
- **WHEN** an official black-box evaluation completes
- **THEN** the persisted evaluation result MUST identify the scenario set version used for scoring
- **AND** student-facing explanations MUST NOT expose hidden scenario parameters or full trace data

### Requirement: Black-box official metrics are scenario-derived
The hidden official evaluator SHALL produce tracking error, worst-case deviation, control energy, constraint violations, smoothness, identification fit, and disturbance recovery from scenario execution.

#### Scenario: Aggregate metric computation
- **WHEN** all hidden scenarios complete
- **THEN** the evaluator MUST aggregate scenario traces into the metric keys expected by the task metric profile
- **AND** hard constraints MUST be evaluated from those aggregate metrics

#### Scenario: Scenario failure invalidates ranking
- **WHEN** one or more hidden scenarios violate safety or execution constraints
- **THEN** the official result MUST fail the relevant hard constraint
- **AND** the submission MUST NOT enter official leaderboard rankings

### Requirement: Black-box official protocol is versioned separately from legacy estimates
Arena black-box official evaluation SHALL use `blackbox-official-v1` as the default official protocol version for black-box virtual simulation submissions.

#### Scenario: Evaluation cache separation
- **WHEN** an artifact has an existing cached `blackbox-v1` evaluation
- **THEN** a new official black-box submission MUST NOT reuse that legacy evaluation as a `blackbox-official-v1` result

#### Scenario: Protocol version persistence
- **WHEN** a `blackbox-official-v1` evaluation is persisted
- **THEN** the evaluation run MUST store the `blackbox-official-v1` protocol version
- **AND** associated submissions MUST reference that official evaluation run

### Requirement: Hidden official evaluation preserves authorized interface boundaries
Black-box official evaluation SHALL only accept artifacts produced through the authorized dataset and identification-model interface.

#### Scenario: Missing persisted dataset
- **WHEN** a black-box artifact lacks a persisted experiment dataset hash for the current student and task
- **THEN** official submission creation MUST reject it before hidden scenario evaluation
#### Scenario: Forged identification model
- **WHEN** a black-box artifact references an identification model that is not derived from the referenced dataset
- **THEN** official submission creation MUST reject it before hidden scenario evaluation
