## ADDED Requirements

### Requirement: Architecture baseline is bound to one reproducible Git source
The project SHALL generate the modular-monolith architecture baseline from one clean, committed source revision and SHALL record the source commit, source tree, commit time, relevant tool versions, command scopes, and schema version.

#### Scenario: Baseline is captured from a clean revision
- **WHEN** the architecture census runs from a clean committed source revision
- **THEN** every output SHALL identify that source commit and tree
- **AND** a collaborator with the same revision and supported tool versions SHALL be able to reproduce the normalized observations.

#### Scenario: Capture source is dirty or unresolved
- **WHEN** the source worktree is dirty, the Git identity cannot be resolved, or observations mix multiple worktrees
- **THEN** baseline generation SHALL fail before writing a qualified artifact
- **AND** it SHALL identify the unresolved capture condition without silently selecting another revision.

### Requirement: Architecture inventories close their declared denominators
The baseline SHALL declare and reconcile denominators for product entrypoints, routes and APIs, Prisma models and access sites, event contracts, worker and scheduler entrypoints, scripts, tests, registries, OpenSpec capabilities, the declared source dependency-edge graph, reverse dependencies, cross-domain deep imports, strongly connected components, compatibility surfaces, validation gates, and registered oversized change centers.

#### Scenario: Inventory is complete
- **WHEN** the baseline qualifies an inventory kind
- **THEN** every item discovered by that kind's declared include and exclude rules SHALL appear exactly once in its primary inventory
- **AND** discovered, represented, excluded, duplicate, and unresolved totals SHALL reconcile.

#### Scenario: Discovery leaves an unaccounted item
- **WHEN** an item belongs to a declared denominator but has no primary observation or justified exclusion
- **THEN** qualification SHALL fail with the inventory kind and stable item identity
- **AND** the item SHALL NOT disappear from aggregate totals.

#### Scenario: Dependency graph contains a cross-domain cycle
- **WHEN** the declared source graph contains bidirectional or longer cross-domain dependency paths
- **THEN** every constituent edge and reverse edge SHALL reconcile into the dependency denominator
- **AND** the complete strongly connected component SHALL be emitted as a cycle observation with its member and edge identities.

#### Scenario: Cross-domain deep import is discovered
- **WHEN** a source file imports an internal path owned by another candidate domain rather than its declared public boundary
- **THEN** the edge SHALL appear in the deep-import denominator and the full dependency graph
- **AND** it SHALL remain visible even when no cycle is formed.

### Requirement: Ownership evidence preserves ambiguity
Each capability and architecture observation SHALL record its current owner evidence, candidate target owner, resolution state, and repository-relative evidence references without deriving semantic ownership solely from directory location.

#### Scenario: Ownership evidence agrees
- **WHEN** routes, contracts, persistence, events, tests, and callers support one candidate target owner
- **THEN** the observation MAY record that candidate owner
- **AND** it SHALL retain the evidence used for the determination.

#### Scenario: Ownership evidence conflicts
- **WHEN** different sources indicate multiple target owners or no defensible owner
- **THEN** the baseline SHALL mark the observation as ambiguous
- **AND** it SHALL preserve each conflict for adjudication by the refactor charter rather than silently choosing the nearest directory.

### Requirement: Measurements distinguish scope, evidence strength, and capture identity
The baseline SHALL record TypeScript, test, CI, dependency, import, size, registry, compatibility, and gate observations with the exact command scope, environment-dependent limitations, and evidence classification required to interpret them. Environment-sensitive command results SHALL be stored as immutable measurement receipts separate from the deterministic source-derived census core.

#### Scenario: Test command is red
- **WHEN** a baseline test command fails
- **THEN** the artifact SHALL record bounded failure fingerprints, failing and passing totals, unhandled error totals, and command identity
- **AND** it SHALL NOT classify failures as stale, accepted, implementation defects, or quarantine candidates without separate adjudication evidence.

#### Scenario: Import or size metric is recorded
- **WHEN** the census reports a cross-layer import, Prisma dependency, or oversized source file
- **THEN** it SHALL distinguish production, test, compatibility, generated, and framework-convention contexts where applicable
- **AND** it SHALL NOT treat count or size alone as proof of an architecture violation.

#### Scenario: Machine-dependent measurement is recorded
- **WHEN** the census records peak memory, duration, or another environment-sensitive result
- **THEN** it SHALL create a distinct receipt identity containing source revision, command and scope, platform and tool versions, declared cache mode, captured time, exit status, aggregate result, and bounded fingerprints
- **AND** later projection SHALL consume that frozen receipt without silently rerunning or replacing it
- **AND** the result SHALL remain an observation rather than a universal enforcement threshold.

### Requirement: Trust and compatibility observations retain their consequences
The baseline SHALL inventory blocking validators, readiness-like states, aliases, facades, re-exports, old routes, feature flags, and other compatibility surfaces without collapsing distinct authority or state semantics.

#### Scenario: Blocking validator is inventoried
- **WHEN** a hard or potentially hard gate is discovered
- **THEN** its observation SHALL identify the validator, protected boundary, protected fact, threat or corruption mode, failure consequence, and current consumers where evidence exists
- **AND** missing classification evidence SHALL remain explicit.

#### Scenario: Similar readiness states are discovered
- **WHEN** multiple states use names such as ready, qualified, reviewed, approved, or publishable
- **THEN** the baseline SHALL retain them as separate observations until a later change proves they represent the same authoritative fact
- **AND** it SHALL not merge release authority, recommendation confidence, and presentation availability.

### Requirement: Baseline artifacts are deterministic, portable, and privacy minimized
Committed architecture baseline artifacts SHALL use repository-relative identities, stable ordering, bounded evidence, and deterministic serialization and SHALL exclude secrets, machine-local absolute paths, learner identifiers, raw answers, raw event payloads, private content, media, screenshots, and complete command logs. Determinism SHALL apply to the source-derived census core and to projections over an explicitly frozen set of measurement receipt identities, not to independently rerun timing or memory measurements.

#### Scenario: Baseline is regenerated
- **WHEN** the normalized census core is generated twice from the same clean source revision with the same supported parser/tool contract
- **THEN** the census core SHALL be byte-identical
- **AND** projections generated from that core and the same frozen measurement receipt identities SHALL also be byte-identical.

#### Scenario: A measurement is rerun
- **WHEN** an environment-sensitive command is intentionally executed again
- **THEN** it SHALL create a new immutable receipt identity rather than overwrite an earlier receipt
- **AND** existing baseline projections SHALL remain reproducible from their originally frozen receipt set.

#### Scenario: Unsafe content is detected
- **WHEN** an observation contains a secret, forbidden learner or content payload, or a machine-local absolute path
- **THEN** qualification SHALL fail before the artifact is committed
- **AND** the generator SHALL report only the safe record identity and violation code.

### Requirement: Baseline capture does not change product or release state
The architecture census SHALL be read-only with respect to application behavior, database state, CI settings, runtime and knowledge releases, OSS objects, GitHub coordination state, and production selectors.

#### Scenario: Census runs
- **WHEN** baseline generation and qualification execute
- **THEN** they SHALL read only repository-owned source, configuration, Git metadata, and bounded local command results
- **AND** they SHALL NOT query or mutate production services, production databases, remote runtime objects, selectors, or GitHub settings.

#### Scenario: Baseline is accepted
- **WHEN** the change is completed
- **THEN** no application route, test selection, TypeScript program, CI workflow, import rule, database schema, runtime selector, or production behavior SHALL change as a consequence of the baseline itself.
