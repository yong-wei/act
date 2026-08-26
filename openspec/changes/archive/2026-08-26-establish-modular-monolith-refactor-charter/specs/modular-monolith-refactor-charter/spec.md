## ADDED Requirements

### Requirement: The refactor charter consumes one qualified baseline identity
The project SHALL build the modular-monolith charter only from a qualified `capture-modular-monolith-refactor-baseline` artifact set and SHALL preserve its source commit, source tree, schema version, and frozen measurement receipt identities.

#### Scenario: Charter input is qualified
- **WHEN** the predecessor baseline is clean, denominator-reconciled, and identified by one source commit and tree
- **THEN** charter generation SHALL record that identity in every generated architecture document
- **AND** later readers SHALL be able to trace each charter decision to repository-relative baseline evidence.

#### Scenario: Charter input is missing or drifts
- **WHEN** the baseline is missing, dirty, mixed-worktree, denominator-incomplete, or no longer matches the declared source identity
- **THEN** charter qualification SHALL fail before writing a qualified result
- **AND** it SHALL NOT silently recapture or substitute another revision.

### Requirement: Every inventoried capability has one accountable target owner
The charter SHALL assign exactly one target domain owner to every capability and inventoried route, API, persistence model, event, worker, script, registry, and test surface, while preserving current-owner evidence and any conflict record. Qualification SHALL fail whenever an item has no target owner or more than one candidate target owner.

#### Scenario: Ownership evidence supports one domain
- **WHEN** the baseline evidence supports one target domain for an inventory record
- **THEN** the charter SHALL record one stable owner ID and its evidence references
- **AND** every projection SHALL use that same owner ID.

#### Scenario: Ownership evidence conflicts
- **WHEN** evidence indicates multiple owners or no defensible target owner
- **THEN** charter qualification SHALL fail and retain the conflicting evidence as a blocking record
- **AND** the record SHALL not count as a qualified exception or permit a qualified charter to be emitted.

#### Scenario: Baseline fixture has multiple candidate owners
- **WHEN** a baseline fixture reports one capability with two or more candidate target owners
- **THEN** the qualification test SHALL fail with the stable record identity, candidate owner IDs, evidence references, accountable owner, and resolution condition
- **AND** the blocking record SHALL remain non-qualified until exactly one candidate owner is adjudicated.

### Requirement: Charter projections are mutually consistent
The project SHALL generate `docs/architecture/refactor-charter.md`, `bounded-context-map.md`, `dependency-rules.md`, `trust-boundary-matrix.md`, and `deprecation-ledger.md` as deterministic projections of one normalized charter record set.

#### Scenario: The five documents are generated
- **WHEN** the charter record set is qualified
- **THEN** all five documents SHALL be emitted with stable ordering and the same charter identity
- **AND** owner, gate, dependency, and compatibility references SHALL resolve across projections.

#### Scenario: A projection diverges
- **WHEN** a document contains an unknown ID, conflicting owner, mismatched count, or different source identity
- **THEN** validation SHALL fail
- **AND** the divergent document SHALL not be treated as an authoritative charter.

### Requirement: Hard gates include evidence-based consequences
Each chartered hard gate SHALL identify its protected boundary and fact, threat or corruption mode, failure consequence, sole authoritative validator, current consumers, and rationale for blocking behavior.

#### Scenario: A hard gate is retained
- **WHEN** a gate protects identity, privacy, authoritative scoring, persistence integrity, authority ingress, release activation, numerical safety, or an equivalent high-consequence fact
- **THEN** the trust-boundary matrix SHALL record the threat, consequence, validator, and consumers
- **AND** the charter SHALL distinguish it from one-time contract validation and optional degradation.

#### Scenario: A duplicate or misplaced defense is found
- **WHEN** an internal duplicate check, receipt, state, or observation is not the sole validator for a protected fact
- **THEN** the charter SHALL mark it as a removable or consolidation candidate with owner and evidence
- **AND** it SHALL not create another blocking gate merely to preserve historical behavior.

### Requirement: Every compatibility surface has a deletable retirement record
The deprecation ledger SHALL include every discovered facade, alias, re-export, old route, feature flag, migration exception, and compatibility entry with owner, consumers, replacement, deletion condition, follow-up change, and verification evidence.

#### Scenario: A compatibility entry is discovered
- **WHEN** the baseline identifies a compatibility surface
- **THEN** the ledger SHALL give it a stable record ID and an explicit deletion condition
- **AND** the entry SHALL remain visible until the condition is verified by a later change.

#### Scenario: A new compatibility layer is proposed
- **WHEN** a later implementation needs a temporary compatibility entry
- **THEN** it SHALL be rejected unless its deletion condition, owner, consumer set, and follow-up change are recorded
- **AND** the charter SHALL not treat an undated facade or re-export as a permanent API.

### Requirement: Charter qualification is governance-only
Charter generation and validation SHALL not change product behavior, tests, TypeScript programs, import enforcement, database state, runtime releases, deployment state, GitHub coordination, or production selectors.

#### Scenario: The charter is generated
- **WHEN** the charter command runs
- **THEN** it SHALL read repository-owned baseline and configuration evidence only
- **AND** it SHALL not claim work, deploy, activate, or mutate production or remote coordination state.
