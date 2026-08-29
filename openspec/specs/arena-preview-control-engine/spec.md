# arena-preview-control-engine Specification

## Purpose
Arena black-box and supported white-box preview numerics execute through the Control Engine façade. Preview remains non-official: it may persist virtual-preview records, but it cannot write submissions, official evaluations, or leaderboard rows.
## Requirements
### Requirement: Arena preview numerics run through supported client control-engine capabilities

Arena black-box preview numerical steps and supported white-box preview numerical paths SHALL execute through the client control-engine facade backed by Rust/WASM. The active preview path SHALL NOT contain a TypeScript Euler loop, plant integrator, or numerical heuristic fallback.

#### Scenario: Black-box controller preview runs

- **WHEN** a student requests a supported black-box controller preview
- **THEN** the preview SHALL call the registered client control-engine capability for each fixed step
- **AND** the resulting trace and metrics SHALL use the declared protocol/runtime/model identity.

#### Scenario: White-box method lacks a Rust capability

- **WHEN** a white-box preview method has no registered supported Rust capability
- **THEN** the preview SHALL return a controlled unsupported or unavailable state
- **AND** it SHALL NOT execute a TypeScript or template numerical substitute that implies official support.

### Requirement: Preview identity and visibility remain non-official

Every migrated Arena preview response and canonical `SimulationRun` SHALL retain `evaluationVisibility=preview`, `officialEligible=false`, owner, task/spec identity, dataset hash where applicable, controller hash, registered model/source experiment relation, seed, checksum, and tolerance profile.

#### Scenario: Black-box preview is persisted

- **WHEN** a supported black-box preview completes
- **THEN** `ArenaVirtualSimulationRun` and its canonical `SimulationRun/Trace` SHALL preserve dataset/controller/model/sourceExperiment lineage
- **AND** the run SHALL remain preview-only and replay-identifiable.

#### Scenario: Preview is returned to a client

- **WHEN** a preview response is rendered in Arena or evidence/profile consumers
- **THEN** its metadata SHALL state preview visibility and official ineligibility
- **AND** it SHALL NOT be represented as an official score, rank, or formal capability result.

### Requirement: Preview persistence and model claims use the correct authority

Browser and worker preview facades SHALL be display-only and non-persistent. The `/api/arena/virtual-simulation-runs` route SHALL use the R1 server facade for artifact/task validation, Rust recomputation, trace/summary derivation, checksum calculation, and writes to the existing preview records. The route SHALL reject client-provided `trace`, `summary`, or `checksum` before numerical execution or persistence. Every capability/result envelope SHALL include the actual `executor` and `authoritySource`.

#### Scenario: Browser facade renders without persistence

- **WHEN** a browser or worker runs a supported preview capability
- **THEN** the response SHALL identify its actual executor and authority source and set `persisted=false`
- **AND** the browser path SHALL not invoke an `ArenaVirtualSimulationRun`, `SimulationRun`, checksum, or evidence writer.

#### Scenario: Server facade recomputes the persisted preview

- **WHEN** `/api/arena/virtual-simulation-runs` receives an allowed task and artifact
- **THEN** the server facade SHALL validate the identity, execute the supported Rust capability, derive trace/summary, calculate checksum, and write the preview records
- **AND** the result SHALL record `executor=server` and `authoritySource=control-engine-server-facade`.

#### Scenario: Client preview fields are tampered

- **WHEN** a client includes or modifies `trace`, `summary`, or `checksum` in the virtual-preview request
- **THEN** the route SHALL reject the request before numerical execution or persistence
- **AND** no client-provided result field SHALL be used for preview or official evaluation.

#### Scenario: Identity is not part of computation

- **WHEN** task, spec, artifact, dataset, or model identity changes while the other numerical inputs remain equal
- **THEN** canonical request, cache/checksum binding, or result verification SHALL detect the change
- **AND** the preview SHALL not reuse the previous result solely because identity was stored as metadata.

#### Scenario: Surrogate cannot claim an identified model

- **WHEN** a fixed surrogate preview is labeled as an identified model
- **THEN** the envelope SHALL retain `modelRelation=surrogate`, governed `teachingSemantics`, and `prohibitsMixedClaims=true`
- **AND** validation SHALL reject the identified claim and shall not persist it as an identified-model result.

#### Scenario: Identified preview consumes authorized parameters

- **WHEN** an identified-model preview capability is selected
- **THEN** the server SHALL resolve authorized model parameters and the Rust capability SHALL consume them in the numerical request
- **AND** missing, mismatched, or metadata-only parameters SHALL produce unavailable/invalid without a persisted preview.

### Requirement: Preview cannot write official Arena records

The preview execution path SHALL NOT create or update `ArenaSubmission`, official `ArenaEvaluationRun`, leaderboard entries, or formal capability-attainment records. Official score, validity, constraints, and leaderboard data SHALL remain owned by the server Arena evaluator.

#### Scenario: Preview completes successfully

- **WHEN** a preview produces a valid trace and summary
- **THEN** it MAY persist preview detail, canonical SimulationRun/Trace, and governed preview evidence
- **AND** it SHALL NOT persist an Arena submission or official evaluation.

#### Scenario: Preview payload contains a client score

- **WHEN** a client sends a score, validity, or constraint claim with a preview request
- **THEN** the preview boundary SHALL ignore or reject the claim
- **AND** no official record SHALL be derived from it.

### Requirement: Black-box hidden inputs remain server-only

Arena preview SHALL use only the student-owned persisted experiment and registered identification model references allowed by the preview adapter. Hidden official plant parameters, hidden scenario sets, private model internals, reference trajectories, and evaluator tests SHALL NOT be sent to or returned by the client facade.

#### Scenario: Preview references a registered model

- **WHEN** a student-owned artifact references a registered identification model and dataset
- **THEN** the client request SHALL carry only authorized identity/hash and public preview inputs
- **AND** hidden official inputs SHALL remain inside the server-owned evaluator boundary.

#### Scenario: Client supplies a hidden field

- **WHEN** a preview request includes a hidden parameter or private model payload
- **THEN** validation SHALL fail closed before numerical execution or persistence
- **AND** the hidden value SHALL not be echoed.

### Requirement: Preview runtime failures are unavailable, not heuristic

If the client control-engine WASM is not ready, times out, fails, returns non-finite values, or violates its tolerance/constraint contract, the preview SHALL become controlled unavailable or invalid. It SHALL NOT continue with an old TS loop, stale result, zero result, or guessed metric.

#### Scenario: WASM is not ready

- **WHEN** a preview tick occurs before the client facade reaches `ready`
- **THEN** the preview scheduler SHALL pause or return unavailable
- **AND** it SHALL not advance the plant or write a completed preview.

#### Scenario: Rust result exceeds tolerance

- **WHEN** a migrated preview result falls outside its declared baseline tolerance
- **THEN** the preview SHALL report an invalid/unavailable result for review
- **AND** it SHALL not widen the tolerance or persist it as a successful official-like outcome.

