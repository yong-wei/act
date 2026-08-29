# superseded-resource-governance-retirement Specification

## Purpose

Define evidence-gated deletion of resource-governance entrypoints actually replaced by the generated identity/index, independent eligibility contract, and versioned knowledge read contract.

## ADDED Requirements

### Requirement: Retirement requires a complete immutable evidence set

The system SHALL refuse deletion of a resource-governance entrypoint unless an immutable retirement manifest binds the candidate identity, complete consumer denominator, replacement contract and revision, migration evidence, zero-caller receipt, protected-surface result, and digest-verified rollback archive.

#### Scenario: Evidence is incomplete

- **WHEN** the denominator, replacement revision, zero-caller scan, protected-surface scan, or rollback identity is missing, stale, mixed, or mismatched
- **THEN** retirement SHALL remain blocked
- **AND** no old identity, eligibility, registry-read, or knowledge-resource projection entrypoint SHALL be deleted.

#### Scenario: A candidate is not replaced by R1/R2/R3

- **WHEN** an entrypoint has no implemented matching ResourceIndex, eligibility, or knowledge read replacement
- **THEN** it SHALL remain retained with an explicit deletion condition
- **AND** a renamed wrapper or permanent facade SHALL not satisfy replacement evidence.

### Requirement: Consumer denominator and zero callers are closed

The retirement validator SHALL account for production, test, generated, compatibility, framework, route/API, model, script, browser, reverse, dynamic, historical, and rollback callers at the captured revision. Zero-caller evidence SHALL refer to the exact candidate path/symbol and scan rules. The closed scan SHALL include `.yaml` and `.yml` files under the same roots as Markdown and JSON.

#### Scenario: A hidden caller remains

- **WHEN** a route convention, dynamic import, package script, generated artifact, compatibility alias, test, rollback reader, or YAML/YML source still reaches the candidate
- **THEN** the zero-caller gate SHALL fail
- **AND** the candidate SHALL not be deleted.

#### Scenario: All callers migrate

- **WHEN** every classified caller uses the revision-matching R1 RegistryIndex, R2 eligibility contract, or R3 knowledge read contract and the post-migration scan is empty
- **THEN** the candidate MAY pass the zero-caller gate
- **AND** the exact denominator hash and scan receipt SHALL be stored in the manifest.

#### Scenario: Frozen callers are bound to the capture revision

- **WHEN** a caller denominator is frozen at `captureRevision`
- **THEN** every frozen caller path SHALL exist in that Git tree
- **AND** freeze coverage SHALL be recomputed from that tree rather than an unrelated later worktree.

### Requirement: Replacement and migration are revision-bound

Every deletion candidate SHALL name an implemented replacement and prove at one captured revision that identity, source ownership, role, authorization, scope, requested revision, optional degradation, formal fail-closed behavior, cache, and public response semantics are preserved by the replacement.

#### Scenario: Replacement parity passes

- **WHEN** all candidate callers resolve through the generated index, independent eligibility result, or composite knowledge response with matching revision identities
- **THEN** deletion MAY proceed after the remaining retirement gates pass
- **AND** the new contract SHALL remain the only active public entrypoint for those callers.

#### Scenario: Only a facade is added

- **WHEN** the old reader or table remains authoritative behind a re-export, renamed wrapper, flag, or no-op adapter
- **THEN** replacement qualification SHALL fail
- **AND** the ledger SHALL retain the old entry with its actual consumers and deletion condition.

### Requirement: Protected historical and immutable surfaces cannot be retired

Retirement SHALL preserve Legacy knowledge display, historical Authority/runtime snapshots, crosswalks, audit manifests, rollback archives, immutable Runtime Release readers, immutable Teaching Projection readers, and the contracts owned by #1498, #1503, #1509, #1515, and #1543.

#### Scenario: Candidate is used by history or rollback

- **WHEN** a proposed old entrypoint is required to read retained history, crosswalk/audit evidence, or the digest-verified rollback archive
- **THEN** it SHALL be retained or split into an explicit historical adapter
- **AND** current-reader retirement SHALL not delete the protected artifact.

#### Scenario: Legacy view is displayed

- **WHEN** a user requests the retained Legacy knowledge view
- **THEN** its historical reader and display behavior SHALL remain available and clearly distinct from active/candidate reads
- **AND** it SHALL not be counted as a migrated active caller.

### Requirement: Allowlist and deprecation state only decrease

The retirement validator SHALL compare the current architecture allowlist and deprecation ledger with the prior manifest and SHALL permit only entry removal or narrowing to an explicitly retained historical adapter. It SHALL reject new exceptions, broadened patterns, hidden callers, or unexplained resurrection of a retired entry. Prior ledger evidence SHALL have a matching digest before monotonic comparison.

#### Scenario: One entry is deleted

- **WHEN** a candidate is deleted with valid zero-caller and rollback evidence
- **THEN** the ledger and allowlist SHALL record the reduced entry/edge set and deletion receipt
- **AND** the receipt reduced ledger SHALL mark those entries `deleted` with empty consumers
- **AND** the new state SHALL not add a replacement exception for the same old path.

#### Scenario: Deletion is not bound to a retained ledger entry

- **WHEN** a candidate has no current ledger row or the row is not `retained`
- **THEN** deletion SHALL not be authorized
- **AND** the candidate SHALL remain recorded until a later monotonic ledger update.

#### Scenario: Ledger row identity does not match the candidate

- **WHEN** a retained ledger row shares a candidate id but differs in `sourcePath`, owner, replacement contract, or migration revision
- **THEN** deletion SHALL not be authorized
- **AND** reduced-ledger recording SHALL require the deleted identity, not path-only matching.

#### Scenario: A new exception is proposed

- **WHEN** a migration adds an allowlist entry or broadens a compatibility pattern to avoid deletion
- **THEN** monotonic validation SHALL fail
- **AND** the candidate SHALL remain retained until its actual caller or replacement is resolved.

#### Scenario: Prior ledger is omitted for a reduced or excepted ledger

- **WHEN** the current ledger has allowlist exceptions or `deleted` / `historical-adapter` entries and no prior ledger is supplied
- **THEN** monotonic validation SHALL fail
- **AND** a genesis ledger of only `retained` / `already-absent` entries with an empty allowlist MAY omit prior.

### Requirement: Deletion and rollback do not activate releases

The retirement operation SHALL delete only explicitly listed superseded source entrypoints after validation and SHALL not write Authority, Teaching Projection, Runtime Release, consumer selectors, production deployment state, learning records, or historical artifacts. Rollback SHALL restore the exact archived pre-delete revision without creating a permanent live fallback.

#### Scenario: Deletion succeeds

- **WHEN** all retirement gates pass
- **THEN** only the listed old entrypoints MAY be removed and a post-delete zero-caller/build/test receipt SHALL be emitted
- **AND** production deletion SHALL hold a real worktree lock from final recapture through unlink
- **AND** all protected readers, records, and selectors SHALL remain unchanged.

#### Scenario: A later listed path fails after an earlier unlink

- **WHEN** one listed entrypoint has already been unlinked and a later listed path fails the pre-unlink digest check or a later post-delete gate
- **THEN** the command SHALL restore every path it already unlinked from the digest-verified archive
- **AND** the receipt SHALL be blocked with no reduced ledger.

#### Scenario: Rollback is required

- **WHEN** the post-delete verification or a later controlled check requires restoration
- **THEN** the exact digest-verified pre-delete revision SHALL be restorable
- **AND** rollback SHALL consume only a successful `deleted` receipt whose digest, reduced ledger, `retirementId`, and `manifestDigest` authenticate the restored paths
- **AND** that manifest SHALL bind the same `rollbackArchiveDigest` as the graph archive being restored
- **AND** rollback SHALL restore only that receipt's `deletedPaths`
- **AND** rollback SHALL not mutate or relabel active production authority.
