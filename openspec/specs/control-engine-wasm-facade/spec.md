# control-engine-wasm-facade Specification

## Purpose
Define the stable Control Engine Rust/WASM façade used by browser, worker, and server runtimes, including generated-package identity, fail-closed lifecycle, executor/authority source, and surrogate versus identified model claims.
## Requirements
### Requirement: Client, worker, and server consumers use one control-engine facade

The platform SHALL expose one versioned control-engine facade contract for browser client, browser worker, and server runtime execution. Only the facade adapters and the build producer MAY import generated control-engine modules; business consumers SHALL use the facade contract.

#### Scenario: Client requests analysis

- **WHEN** a client analysis or simulation consumer submits a supported request
- **THEN** it SHALL call the client/worker facade with the versioned request contract
- **AND** it SHALL NOT import `index.js`, `index.d.ts`, or `index_bg.wasm` directly.

#### Scenario: Server requests analysis

- **WHEN** a server consumer needs control analysis or a simulation step
- **THEN** it SHALL call the server facade
- **AND** the returned result SHALL carry the same model, protocol, runtime, and schema identity contract as the client path.

### Requirement: WASM lifecycle failures are fail-closed

The facade SHALL distinguish `ready`, `error`, `timeout`, and `unavailable` states. A request SHALL NOT produce a numerical result while the runtime is not ready, and a failed or timed-out request SHALL NOT be converted to an empty, zero, stale, or heuristic result.

#### Scenario: Client runtime is not ready

- **WHEN** a fixed-step simulation tick occurs before WASM readiness
- **THEN** the `SimulationClock` consumer SHALL pause or report controlled unavailability
- **AND** it SHALL NOT advance a TypeScript physics or numerical fallback.

#### Scenario: Server runtime cannot initialize

- **WHEN** the server cannot load the generated WASM package or an invocation fails
- **THEN** the facade SHALL return a typed failure state or bounded server error
- **AND** no official evaluation, evidence-bearing run, or leaderboard result SHALL be written from that request.

### Requirement: Executor and authority source govern persistence

Every facade capability and result envelope SHALL include `executor` and `authoritySource`. Browser and worker facades MAY produce non-persistent display output only. The `/api/arena/virtual-simulation-runs` persistence path SHALL use the server facade to validate the artifact/task, recompute the result, calculate the checksum, and perform the existing preview-run write. A server request SHALL reject client-provided `trace`, `summary`, or `checksum` fields before numerical execution or persistence.

#### Scenario: Browser preview is display-only

- **WHEN** a browser or worker facade runs a supported preview capability
- **THEN** its envelope SHALL identify the actual executor and authority source and set the output as non-persistent
- **AND** the browser path SHALL have no permission to write `ArenaVirtualSimulationRun`, `SimulationRun`, checksum, or evidence records.

#### Scenario: Virtual preview is persisted by the server facade

- **WHEN** `/api/arena/virtual-simulation-runs` receives a valid task and artifact
- **THEN** the server facade SHALL validate authorized inputs, execute the Rust capability, derive the trace/summary, calculate the checksum, and write the preview record
- **AND** the persisted envelope SHALL identify `executor=server` and `authoritySource=control-engine-server-facade`.

#### Scenario: Client result fields are supplied

- **WHEN** a client includes `trace`, `summary`, or `checksum` in a virtual-preview request
- **THEN** the route SHALL reject the request before calling the numerical executor or any persistence writer
- **AND** no client-provided result, checksum, or summary SHALL be used as an official or preview authority.

### Requirement: Model relation claims are capability-verified

The control-engine capability contract SHALL distinguish fixed surrogates from identified models. A surrogate result SHALL record `modelRelation=surrogate`, governed teaching semantics, and `prohibitsMixedClaims=true`. A result MAY claim `modelRelation=identified` only when an authorized model parameter or snapshot is resolved by the server and actually consumed by the Rust capability; metadata, labels, or hashes alone SHALL NOT satisfy this requirement.

#### Scenario: Fixed surrogate is used for teaching

- **WHEN** a fixed surrogate capability produces a preview or Practice result
- **THEN** its envelope SHALL include `modelRelation=surrogate`, `teachingSemantics`, and `prohibitsMixedClaims=true`
- **AND** the result SHALL not claim an identified model or official physical validity.

#### Scenario: Identified capability consumes authorized parameters

- **WHEN** an identified-model capability is requested
- **THEN** the server SHALL resolve an authorized model snapshot/parameter set and the Rust capability SHALL consume it in the numerical request
- **AND** absence, mismatch, or metadata-only use of the parameters SHALL produce an unavailable/invalid result.

#### Scenario: Identity is not part of the computation

- **WHEN** a task, spec, artifact, or model identity is changed while the numerical inputs remain otherwise equal
- **THEN** canonical request validation, cache/checksum binding, or result verification SHALL detect the change
- **AND** an identity value that only appears in metadata SHALL not authorize reuse of the previous result.

#### Scenario: Client preview or surrogate claim is tampered

- **WHEN** a client changes preview trace/summary/checksum or labels a fixed surrogate as an identified model
- **THEN** validation SHALL reject the tampered request or mark it non-authoritative
- **AND** no persisted run or official evaluation SHALL be derived from the claim.

### Requirement: Generated control-engine artifacts have one runtime identity

The generated JavaScript, declarations, WASM binary, and build metadata SHALL be produced by the control-engine build script and SHALL be validated as one runtime identity bound to Rust source, lockfile, toolchain, and exported ABI.

#### Scenario: Generated package is complete

- **WHEN** the WASM build completes
- **THEN** the package SHALL contain the required generated files and matching identity metadata
- **AND** the identity SHALL be available to client, worker, server, and runtime receipts.

#### Scenario: Generated package is partial or stale

- **WHEN** a generated file is missing, hand-edited, or does not match the Rust/build identity
- **THEN** the build or runtime validation SHALL fail closed
- **AND** it SHALL NOT silently use a different generated module or TypeScript numerical implementation.

### Requirement: Fallback results are never authoritative

Any `fallbackResult` accepted by a control-analysis hook SHALL be explicitly marked as non-authoritative presentation state. It SHALL NOT be stored as the current authoritative analysis result or used as input to official evaluation, leaderboard scoring, SimulationRun evidence, or learning evidence.

#### Scenario: Fallback is shown while a request loads

- **WHEN** a hook renders a supplied fallback while the current request is loading
- **THEN** the state SHALL identify the fallback source and non-authoritative status
- **AND** a ready result SHALL replace it before any current-result persistence or evaluation.

#### Scenario: Request times out after fallback display

- **WHEN** the runtime times out or errors after a fallback was displayed
- **THEN** the consumer SHALL report controlled unavailability
- **AND** it SHALL NOT label the fallback as the current request's successful result.

### Requirement: Rust numerical behavior is modular and tolerance-verified

The control-engine implementation SHALL keep numerical model ownership in Rust/WASM while allowing internal analysis, controller, simulation, constraint, and metric modules to evolve independently. Public model ids, units, fixed-step semantics, and result meaning SHALL remain stable unless a versioned contract changes.

#### Scenario: Rust internals are reorganized

- **WHEN** a Rust implementation is moved between internal modules
- **THEN** supported requests SHALL preserve baseline result invariants within the declared absolute/relative tolerance profile
- **AND** generated identity and protocol metadata SHALL be updated together.

#### Scenario: Non-finite numerical output occurs

- **WHEN** a model produces a non-finite value or violates a hard numerical constraint
- **THEN** the facade SHALL return a bounded failure or invalid result state
- **AND** it SHALL NOT coerce the value to a guessed finite number.

### Requirement: Control-engine analysis and controllers have independent internal ownership
The Rust control-engine SHALL keep analysis and controller implementation responsibilities in independently testable internal modules, while `lib.rs` remains the stable facade-facing decode, dispatch and export boundary. Internal modularization SHALL remove the original implementation from the root module rather than adding a wrapper chain.

#### Scenario: Analysis implementation is reorganized
- **WHEN** an analysis function moves from `lib.rs` into the analysis module
- **THEN** supported request/response JSON, model ids, units, errors, non-finite rejection and declared tolerance SHALL remain unchanged
- **AND** the facade SHALL call the module directly without a second numerical implementation.

#### Scenario: Controller implementation is reorganized
- **WHEN** PID or structure-controller application moves into the controller module
- **THEN** parameter bounds, hard constraints, units and controller output semantics SHALL remain unchanged
- **AND** the old root implementation and redundant forwarding wrapper SHALL be removed.

### Requirement: Analysis/controller modularization preserves the existing WASM facade
Internal module changes SHALL preserve the existing generated WASM export names, versioned client/worker/server facade contract and runtime identity. A public ABI or Artifact/Run contract change SHALL require a separate versioned change.

#### Scenario: Facade requests a supported analysis
- **WHEN** the client, worker or server facade submits an existing analysis/controller request
- **THEN** the request SHALL resolve through the same supported capability and result envelope
- **AND** no consumer SHALL import generated modules directly or use a TypeScript numerical fallback.

#### Scenario: Non-finite or invalid controller input occurs
- **WHEN** analysis/controller input violates an existing numerical boundary or produces a non-finite value
- **THEN** the same bounded error/invalid result SHALL be returned
- **AND** the modularization SHALL not coerce, default or silently accept it.

