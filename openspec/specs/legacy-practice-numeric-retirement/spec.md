# legacy-practice-numeric-retirement Specification

## Purpose
R3-R5 之后，Practice/Simulation 的 raw WASM loader 与已迁移 TypeScript 数值步进按四类分母退役。可删项必须具备替换身份、zero-caller 证明和运行时收据；`SimulationSession`/`SimulationLog`、generated WASM 包以及旧驱逐舰单体不得借机删除。
## Requirements
### Requirement: Legacy retirement uses four frozen denominators

The retirement process SHALL freeze and reconcile four separate denominators: the nine raw business control-engine loaders, the migrated TypeScript numerical implementation list, all `SimulationSession`/`SimulationLog` legacy persistence surfaces, and generated control-engine artifacts. The nine raw-loader denominator SHALL include `src/features/interactive/unit-5-5-policy-learning-entry-risk/rl-training-runtime.ts`. A result for one denominator SHALL NOT be used to claim retirement of another.

#### Scenario: Raw-loader denominator is reconciled

- **WHEN** retirement is evaluated after R3-R5 migration
- **THEN** all nine raw business-loader paths, including Unit 5-5 `rl-training-runtime.ts`, and their static, dynamic, worker, server, test, and compatibility callers SHALL be represented
- **AND** a zero active caller result SHALL be distinct from protected or test-only readers.

#### Scenario: Generated artifact denominator is evaluated

- **WHEN** migrated consumers are checked for cleanup
- **THEN** generated JS, declarations, WASM, hash metadata, and build inputs SHALL remain represented as required runtime artifacts
- **AND** their presence SHALL not be counted as legacy loader debt.

### Requirement: Raw loaders and migrated TypeScript numerics require replacement and zero-caller proof

A raw loader or TypeScript numerical implementation SHALL be deleted only after a revision-bound replacement identity, complete caller denominator, zero active client/browser/server caller proof, static architecture guard, and relevant runtime/replay/tolerance receipts are present. A retained entry SHALL be compatibility-only with an owner and explicit deletion condition; a permanent compat facade is prohibited.

#### Scenario: A server loader has a qualified replacement

- **WHEN** a server raw loader is replaced by the stable server facade and all active callers are migrated
- **THEN** the loader MAY be deleted with a tested rollback commit
- **AND** generated artifacts and the stable facade SHALL remain available.

#### Scenario: A TypeScript numerical helper still has a caller

- **WHEN** a migrated TS numerical helper is still reached by a scene, worker, dynamic import, test-backed runtime, or compatibility path
- **THEN** the helper SHALL remain or be marked blocked with its caller and removal condition
- **AND** the project SHALL not claim that numerical authority has been retired.

### Requirement: Runtime and browser/server verification gates deletion

Retirement SHALL require client/worker/browser and server runtime verification appropriate to the deleted entry, including generated identity, WASM unavailable/error behavior, fixed-step scheduling, finite numerical output, replay checksum, and official/preview/Practice boundary checks.

#### Scenario: Deletion passes runtime verification

- **WHEN** zero-caller proof and replacement tests pass for a candidate
- **THEN** browser/client/worker and server smoke SHALL pass with the stable facade
- **AND** the deletion receipt SHALL identify the runtime/model/protocol and rollback commit.

#### Scenario: Runtime verification fails

- **WHEN** a browser/server smoke, replay checksum, tolerance, or generated identity check fails after deletion
- **THEN** the deletion SHALL be reverted or marked blocked
- **AND** the system SHALL not restore a second TypeScript numerical authority as an untracked fallback.

### Requirement: Virtual preview cleanup preserves server authority and truthful model identity

Retirement SHALL preserve the rule that `/api/arena/virtual-simulation-runs` validates, recomputes, checksums, and writes through the R1 server facade. Browser or worker facade output SHALL remain non-persistent. The route SHALL reject client-provided `trace`, `summary`, or `checksum`. Cleanup receipts SHALL include the actual `executor` and `authoritySource`; fixed surrogates SHALL retain `modelRelation=surrogate`, teaching semantics, and `prohibitsMixedClaims=true`, while an identified-model claim SHALL require an authorized model parameter set consumed by the Rust capability.

#### Scenario: Tampered client preview is presented during cleanup

- **WHEN** a client submits a preview trace, summary, checksum, or forged executor/authority source to `/api/arena/virtual-simulation-runs`
- **THEN** the route SHALL reject it before numerical execution or persistence
- **AND** the retirement proof SHALL not count the rejected payload as a valid caller or result.

#### Scenario: Identity is not part of a retired computation

- **WHEN** task, spec, artifact, dataset, or model identity changes while numerical inputs remain equal
- **THEN** the canonical request, cache/checksum binding, or result verification SHALL detect the change
- **AND** cleanup SHALL not authorize reuse of a result whose identity was only metadata.

#### Scenario: Surrogate claims identified model

- **WHEN** a fixed surrogate is labeled as an identified model during or after raw-loader cleanup
- **THEN** validation SHALL retain `modelRelation=surrogate`, teaching semantics, and `prohibitsMixedClaims=true`
- **AND** it SHALL reject the identified claim unless authorized parameters were consumed by Rust.

### Requirement: Legacy persistence and protected historical surfaces are retained

`SimulationSession`, `SimulationLog`, their writers/readers/materializers, historical evidence, audit/report/seed consumers, and protected scene files SHALL NOT be deleted by this change merely because new `SimulationRun` paths exist. `src/resources/simulations/destroyer-simulation.tsx` SHALL remain protected until its separate historical conditions are explicitly released.

#### Scenario: Legacy persistence has no new live writer

- **WHEN** all new Practice live runs use the canonical run contract
- **THEN** the retirement ledger SHALL still record legacy `SimulationSession`/`SimulationLog` readers, history, and removal conditions
- **AND** this change SHALL not drop or rewrite those models or records.

#### Scenario: Legacy destroyer file has no product route caller

- **WHEN** static inventory finds no product route caller for the old destroyer monolith
- **THEN** the file SHALL remain as `protected-not-delete` while historical spec/tests reference it
- **AND** no zero-caller result SHALL authorize its deletion.

### Requirement: Official and evidence authorities remain intact after retirement

Retirement SHALL preserve the stable facade as the only active numerical authority, Practice/preview non-official visibility, server-only black-box evaluation, and immutable evidence-bearing run identity. Deletion SHALL NOT alter official score, validity, constraints, leaderboard, or historical replay evidence.

#### Scenario: Preview and Practice are checked after cleanup

- **WHEN** a preview or Practice run is executed after a legacy numeric deletion
- **THEN** it SHALL retain its owner, task/spec, controller/model, seed, checksum, preview/practice visibility, and `officialEligible=false`
- **AND** it SHALL not create an official Arena submission/evaluation or leaderboard row.

#### Scenario: Historical official result is read after cleanup

- **WHEN** an accepted Arena evaluation/submission or SimulationRun is read after retirement
- **THEN** its stored protocol, score/validity, owner, summary, and checksum SHALL remain unchanged
- **AND** cleanup SHALL not trigger a historical recomputation.

