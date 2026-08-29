## ADDED Requirements

### Requirement: Practice live numerics use the shared control-engine facade

Standalone simulation and Practice live plant integration, controller execution, disturbance/environment evolution, and numerical metrics SHALL execute through the shared control-engine facade backed by Rust/WASM. The page layer SHALL retain only fixed-step scheduling, state adaptation, UI, charts, and telemetry presentation.

#### Scenario: Cruise live vertical slice runs

- **WHEN** the Cruise Practice scene advances a live run
- **THEN** plant, controller, disturbance, and metric phases SHALL call the facade using the registered capability contract
- **AND** the browser SHALL not execute a page-local Euler, RK4, or TypeScript numerical fallback.

#### Scenario: A model capability is unavailable

- **WHEN** a Practice scene has no ready Rust capability for its required numerical path
- **THEN** the scene SHALL pause or return controlled unavailable
- **AND** it SHALL not continue from a stale, precomputed, or heuristic numerical result.

### Requirement: Existing fixed-step profiles are preserved

The migration SHALL preserve the existing per-scene fixed-step scheduling profiles: the seven standalone scenes SHALL retain `dt=1/60,maxSubSteps=120`, and Control Odyssey SHALL retain `dt=1/60,maxSubSteps=6`, unless a separately versioned scene contract changes them.

#### Scenario: Standalone scene receives variable frame time

- **WHEN** a standalone scene receives a render frame with variable elapsed time
- **THEN** `SimulationClock` SHALL subdivide it according to that scene's fixed dt and maxSubSteps
- **AND** the numerical model SHALL receive only fixed dt values.

#### Scenario: Simulation is paused or reset

- **WHEN** a user pauses or resets a scene or WASM becomes unavailable
- **THEN** the clock SHALL pause/reset without advancing physics
- **AND** no additional Practice evidence sample SHALL be generated for the unexecuted step.

### Requirement: Every migrated TypeScript numerical path has a supported replacement or fails closed

PID, Smith predictor, DP, thruster allocation, notch, gain schedule, wind/current, ice-breaking, sloshing, RK4, and any other discovered numerical implementation SHALL map to an explicit Rust capability and tolerance profile. A path without a supported replacement SHALL be unavailable rather than implemented by a new TypeScript heuristic.

#### Scenario: Replacement stays within tolerance

- **WHEN** a migrated capability is compared with its captured baseline for the same model, inputs, fixed dt, and seed
- **THEN** summary metrics and declared invariants SHALL remain within the capability's absolute/relative tolerance
- **AND** the result SHALL retain its runtime/model identity.

#### Scenario: Replacement exceeds tolerance

- **WHEN** a Rust result falls outside the declared tolerance or violates a numerical constraint
- **THEN** the run SHALL be marked invalid/unavailable for review
- **AND** the implementation SHALL not widen tolerance or fall back to the old TS numerical path.

### Requirement: Practice runs remain owner-scoped and non-official

Practice live execution SHALL write only its own owner-scoped `SimulationRun`/`SimulationTrace` and outcome/evidence references using the common artifact/run contract. Its capability and run envelope SHALL record the actual `executor` and `authoritySource`; browser facade output SHALL be non-persistent display state, and persistence SHALL be performed by the trusted Practice/server writer. It SHALL NOT create Arena submissions/evaluations, leaderboard rows, or formal official capability attainment.

#### Scenario: Practice run completes

- **WHEN** a student completes a Practice live run
- **THEN** the run SHALL retain owner, task/spec, controller snapshot, protocol/runtime/model, actual `executor`, `authoritySource`, seed, checksum, summary, and visibility metadata
- **AND** the outcome SHALL remain in the Practice/Simulation authority.

#### Scenario: Browser result is display-only

- **WHEN** a browser or worker facade returns a live Practice step/result
- **THEN** the response SHALL identify its actual `executor` and `authoritySource` and remain non-persistent
- **AND** a trusted Practice/server writer SHALL validate the result before creating the owner-scoped run or evidence reference.

#### Scenario: Practice result reaches Arena

- **WHEN** a Practice outcome is passed to an Arena submission or leaderboard path
- **THEN** the server SHALL reject it before official persistence
- **AND** the Practice run SHALL remain unchanged.

### Requirement: Live migration preserves replay and evidence semantics

Evidence-bearing Practice runs SHALL preserve SceneSpec/Trace, seed, protocol/runtime/model revision, sample cadence, checksum, metric denominator, and owner scope. High-frequency samples SHALL not be used as a second numerical authority or copied into compact learning evidence.

#### Scenario: Seeded run is replayed

- **WHEN** the same scene, controller, disturbance, fixed-step profile, runtime/model revision, and seed are replayed
- **THEN** normalized summary and checksum SHALL verify within the declared tolerance policy
- **AND** the persisted run SHALL remain immutable.

#### Scenario: Replay mismatch occurs

- **WHEN** replay output differs from the stored checksum or summary
- **THEN** verification SHALL report mismatch with safe diagnostics
- **AND** it SHALL not overwrite the Practice run, trace, or derived evidence.
