## ADDED Requirements

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
