## ADDED Requirements

### Requirement: Current-head evidence is bound to one clean source identity

The current-head consolidation delta SHALL be generated from one clean, committed source revision and SHALL record the current commit, current tree, capture time, predecessor baseline identity, schema version, command scope, and relevant tool versions.

#### Scenario: Current HEAD is clean and resolvable

- **WHEN** the delta capture runs against a clean worktree whose Git commit and tree resolve
- **THEN** every emitted record and projection SHALL identify that commit and tree
- **AND** the predecessor baseline SHALL remain referenced as historical input rather than overwritten.

#### Scenario: Capture identity is dirty or mixed

- **WHEN** the worktree is dirty, Git identity cannot be resolved, or observations come from more than one revision/worktree
- **THEN** qualification SHALL fail before writing a qualified delta
- **AND** the implementation SHALL report the unresolved capture condition without substituting another revision.

### Requirement: Owner, retirement, and hotspot evidence share one bounded delta denominator

The delta SHALL combine owner conflicts, retirement candidates, and hotspot priorities in one normalized record set with stable record ids, category, current-owner evidence, candidate target owner(s), consumer classification, deletion condition, rollback reference, and repository-relative evidence.

#### Scenario: A cross-domain surface is inventoried

- **WHEN** routes, APIs, workers, scripts, tests, imports, persistence, or registries indicate competing ownership or a migration-relevant hotspot
- **THEN** the record SHALL preserve all defensible candidate owners and its evidence references
- **AND** the record SHALL distinguish an observation from a blocking finding until a later owner decision proves the consequence.

#### Scenario: A retirement candidate has no safe deletion proof

- **WHEN** a facade, alias, bridge, old entrypoint, or compatibility surface has a possible replacement but current consumer proof is incomplete
- **THEN** the record SHALL remain unresolved with an explicit deletion condition
- **AND** the delta SHALL not claim that the path is deletable.

### Requirement: Consumer and OpenSpec conflict evidence is current and classified

The delta SHALL enumerate production, test-only, toolchain, dynamic-load, re-export, and documentation consumers for in-scope surfaces, and SHALL project overlap with current non-archived OpenSpec changes while treating archived artifacts as historical evidence only.

#### Scenario: A production consumer is found

- **WHEN** a current route, worker, script, or production module imports, loads, re-exports, or calls an in-scope surface
- **THEN** the consumer SHALL appear with its repository-relative path and relationship kind
- **AND** the retirement record SHALL remain open until a later migration proves zero production consumers.

#### Scenario: Only a historical artifact mentions a surface

- **WHEN** a surface is mentioned only by an archived change, closed Issue reference, or historical test/documentation record
- **THEN** the evidence SHALL be classified as historical
- **AND** it SHALL not be used as proof of a current production consumer or implementation.

#### Scenario: Active changes overlap

- **WHEN** two or more current non-archived changes touch the same owner, contract, path, or deletion set
- **THEN** the conflict matrix SHALL record the change ids, overlap kind, dependency/order implication, and resolution condition
- **AND** the capture SHALL not modify or claim any of those changes.

### Requirement: Delta output is deterministic, portable, and privacy minimized

The qualified delta SHALL use stable ordering and repository-relative identities, reconcile discovered/represented/excluded/unresolved totals for each declared slice, and exclude secrets, learner identifiers, raw answers/events, private content, media, screenshots, absolute machine paths, and unbounded command logs.

#### Scenario: Same source and inputs are captured twice

- **WHEN** the delta is generated twice from the same source identity and the same frozen predecessor inputs
- **THEN** the normalized package SHALL be byte-identical
- **AND** equivalent records SHALL have stable ids and ordering.

#### Scenario: Unsafe evidence is encountered

- **WHEN** a proposed record contains forbidden content or an absolute machine-local path
- **THEN** qualification SHALL fail closed before the package is accepted
- **AND** the failure SHALL expose only a safe record identity and violation code.

### Requirement: Current-head capture is governance-only

The delta capture SHALL not change application behavior, tests, TypeScript programs, dependency rules, database state, runtime releases, production selectors, or GitHub coordination state.

#### Scenario: Capture completes

- **WHEN** the current-head package is written and qualified
- **THEN** only the bounded evidence artifacts and their deterministic integrity metadata MAY change
- **AND** no product, release, database, deployment, or coordination action SHALL be implied or performed.
