# practice-lab-artifact-run-contract Specification

## Purpose
Define the shared ControllerArtifact and run identity contract that maps Practice, Arena preview, Arena official evaluation, and SimulationRun records without creating a second persistent run schema.
## Requirements
### Requirement: Artifact and run identities use one versioned mapping contract

The platform SHALL project `ControllerArtifact`, Practice outcomes, Arena preview records, Arena official evaluation/submission records, and `SimulationRun` into one versioned identity contract without creating a second persistent run schema. The contract SHALL include owner/authority, task id, spec hash, artifact or controller snapshot identity, protocol/runtime/model/controller schema revisions, `executor`, `authoritySource`, visibility, seed, checksum, and tolerance profile.

#### Scenario: Preview maps to a canonical simulation run

- **WHEN** an Arena preview is persisted
- **THEN** its Arena detail record and canonical `SimulationRun` SHALL carry the same task, artifact/controller, protocol/runtime/model, seed, checksum, and preview identity
- **AND** the mapping SHALL remain traceable in both directions.

#### Scenario: Practice run is projected

- **WHEN** a Practice live run produces an outcome
- **THEN** the outcome SHALL carry its own Practice source and owner mapping through the common contract
- **AND** it SHALL NOT be written as an Arena evaluation or submission.

### Requirement: Source owners and authorities remain distinct

The mapping SHALL preserve the source owner for `ArenaControllerArtifact`, `ArenaSubmission`, and `SimulationRun`, and SHALL preserve Arena evaluator/task authority for shared `ArenaEvaluationRun` records. An official evaluation SHALL be associated with a student owner only through an accepted `ArenaSubmission`, not by overwriting the shared evaluation owner semantics.

#### Scenario: Shared evaluation is referenced by two submissions

- **WHEN** two accepted submissions reference the same task/artifact/protocol evaluation run
- **THEN** each submission SHALL retain its own student owner
- **AND** the shared evaluation SHALL not be rewritten as either student's independent run.

#### Scenario: Orphan evaluation is projected

- **WHEN** an `ArenaEvaluationRun` has no uniquely accepted student submission
- **THEN** the projection SHALL mark it unbound for student evidence
- **AND** it SHALL NOT create a student completion, score, or leaderboard entry.

### Requirement: Preview and Practice are permanently non-official

Preview and Practice envelopes SHALL set `evaluationVisibility` to `preview` or `practice` respectively and SHALL set `officialEligible` to `false`. Only the server Arena evaluator processing an accepted submission MAY produce official score, validity, hard-constraint, or leaderboard inputs.

#### Scenario: Preview result reaches a downstream consumer

- **WHEN** a profile, evidence, teacher, or UI consumer reads a preview result
- **THEN** the result SHALL retain preview visibility and official ineligibility
- **AND** it SHALL not be interpreted as official score, validity, rank, or formal capability attainment.

#### Scenario: Consumer attempts to promote Practice

- **WHEN** a Practice writer or client submits a Practice envelope to an official Arena path
- **THEN** the server SHALL reject it before creating `ArenaSubmission` or `ArenaEvaluationRun`
- **AND** the Practice outcome SHALL remain in its own owner domain.

### Requirement: Virtual preview persistence is server-facade-owned

The `/api/arena/virtual-simulation-runs` route SHALL use the R1 server facade for persistence validation, Rust recomputation, trace/summary derivation, checksum calculation, and preview-run writes. Browser or worker facades SHALL be limited to non-persistent display output. The route SHALL reject client-provided `trace`, `summary`, or `checksum` fields before numerical execution or persistence.

#### Scenario: Browser facade renders a preview

- **WHEN** a browser or worker facade renders a supported preview
- **THEN** its envelope SHALL identify its actual `executor` and `authoritySource` and set the result as non-persistent
- **AND** it SHALL not call a run writer, checksum writer, or evidence writer.

#### Scenario: Server route recomputes and persists a preview

- **WHEN** `/api/arena/virtual-simulation-runs` receives an allowed task and artifact
- **THEN** the server facade SHALL validate the identity, execute the authorized Rust capability, derive trace/summary, calculate checksum, and write the existing preview records
- **AND** the envelope SHALL record `executor=server` and `authoritySource=control-engine-server-facade`.

#### Scenario: Client result fields are tampered

- **WHEN** a client includes or changes `trace`, `summary`, or `checksum` in the virtual-preview request
- **THEN** the route SHALL reject the request before calling the numerical executor or persistence writer
- **AND** no client-supplied result field SHALL be persisted or treated as authoritative.

### Requirement: Model relation claims are truthful and non-mixed

A fixed surrogate SHALL be represented with `modelRelation=surrogate`, governed teaching semantics, and `prohibitsMixedClaims=true`. An envelope SHALL claim `modelRelation=identified` only when the server resolves an authorized model parameter/snapshot and the Rust capability consumes it in the numerical request; metadata or a model hash alone SHALL NOT qualify.

#### Scenario: Surrogate result is projected

- **WHEN** a fixed surrogate is used for a Practice or preview result
- **THEN** the envelope SHALL include `modelRelation=surrogate`, `teachingSemantics`, and `prohibitsMixedClaims=true`
- **AND** the result SHALL not claim an identified model or official physical validity.

#### Scenario: Identified model parameters are authorized and consumed

- **WHEN** an identified-model result is requested
- **THEN** the server SHALL bind the request to an authorized model snapshot/parameter set and the Rust capability SHALL consume that set
- **AND** missing, mismatched, or metadata-only parameters SHALL produce an invalid/unavailable result with no persistent write.

#### Scenario: Identity does not participate in computation

- **WHEN** task, spec, artifact, or model identity changes while other numerical inputs remain equal
- **THEN** canonical request, cache/checksum binding, or result verification SHALL detect the identity change
- **AND** a result whose identity exists only in metadata SHALL not be reused.

### Requirement: Public contract excludes black-box hidden inputs

The public artifact/run contract SHALL exclude hidden scenario parameters, private datasets, identification-model internals, reference trajectories, raw answers, and high-frequency trace payloads. Server-only execution MAY retain those values behind a private boundary and SHALL expose only coarse identity, hashes, visibility, and compact summaries.

#### Scenario: Black-box preview is serialized

- **WHEN** a black-box preview envelope is returned to a client
- **THEN** it SHALL contain dataset/model/source hashes and safe summary metadata
- **AND** it SHALL NOT contain hidden plant parameters, private model coefficients, or hidden reference trajectories.

#### Scenario: Hidden field is supplied by a client

- **WHEN** a client attempts to include a hidden input in an artifact or run envelope
- **THEN** validation SHALL reject the envelope
- **AND** the hidden value SHALL not be persisted or echoed in the public response.

### Requirement: Evidence-bearing identities are replayable and immutable

Every evidence-bearing artifact or run SHALL bind spec, protocol, runtime, model, controller schema, seed, checksum, and tolerance identity from one revision-consistent input set. A mismatch SHALL fail closed without rewriting an accepted historical result.

#### Scenario: Replay metadata matches

- **WHEN** a run is replayed with the same identity fields and seed
- **THEN** the normalized summary SHALL verify against the stored checksum within the declared tolerance profile
- **AND** the run identity SHALL remain unchanged.

#### Scenario: Revision or checksum drifts

- **WHEN** the current model, protocol, spec, or checksum differs from the persisted envelope
- **THEN** verification SHALL report drift or mismatch
- **AND** it SHALL NOT silently merge the run with a new revision or recalculate official history.

### Requirement: Existing Artifact/Run contract is the sole consumer mapping seam
Practice live, Control Workbench, Manifest Runtime, Arena preview and canonical `SimulationRun` consumers SHALL use the existing versioned `practice-lab-artifact-run-contract` for identity, projection and validation. They SHALL NOT create a second persistent run schema or redeclare owner, authority, visibility, checksum or tolerance semantics in local mappers.

#### Scenario: Consumer projects an artifact or run
- **WHEN** a supported consumer needs an artifact/run envelope
- **THEN** it SHALL obtain the canonical identity and public projection through the existing contract API
- **AND** local view models SHALL not become a second source of identity or authority.

#### Scenario: Consumer mapping disagrees with the contract
- **WHEN** a local mapper omits or changes task/spec, artifact/controller, protocol/runtime/model, owner/authority, visibility, seed, checksum or tolerance identity
- **THEN** contract validation SHALL fail closed
- **AND** the consumer SHALL not write or promote the altered envelope.

### Requirement: Consumer migration preserves official and non-official boundaries
Adopting the existing contract SHALL preserve Practice/preview `officialEligible=false`, Arena evaluator ownership of official score/validity/constraints/leaderboard, and the distinction between browser/worker display output and server-facade persistence.

#### Scenario: Preview or Practice reaches a downstream consumer
- **WHEN** a profile, evidence, teacher, or UI consumer reads a preview or Practice result
- **THEN** it SHALL retain the source visibility and non-official status from the canonical contract
- **AND** it SHALL not interpret the result as official score, rank, validity or attainment.

#### Scenario: Virtual preview is persisted
- **WHEN** `/api/arena/virtual-simulation-runs` persists a preview
- **THEN** the existing server facade SHALL validate, recompute, summarize, checksum and write the existing records
- **AND** the browser/worker contract projection SHALL not write a run, evidence or official result.

### Requirement: Contract migration publishes readiness for bridge retirement
The migration SHALL provide a revision-bound caller matrix for every replaced local mapper, including production/test/operator consumers, replacement contract entry, zero-caller proof, deletion condition and rollback commit. C23 and C24 SHALL treat missing or ambiguous matrix entries as blocked.

#### Scenario: All consumers use the replacement
- **WHEN** every classified active consumer resolves through the existing contract and parity tests pass
- **THEN** the replaced mapper MAY be deleted
- **AND** the readiness evidence SHALL be sufficient for simulation-arena-workbench and Arena legacy-entrypoint retirement.

#### Scenario: An unclassified consumer remains
- **WHEN** a dynamic, compatibility, operator or test caller cannot be classified
- **THEN** the mapper SHALL remain retained with an explicit owner and deletion condition
- **AND** downstream bridge/entrypoint cleanup SHALL not claim completion.

