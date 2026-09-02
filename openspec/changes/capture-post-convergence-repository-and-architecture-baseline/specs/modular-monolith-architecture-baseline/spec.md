## MODIFIED Requirements

### Requirement: Architecture baseline is bound to one reproducible Git source
The project SHALL generate a modular-monolith architecture baseline from one clean, committed source revision and SHALL record the source commit, source tree, commit time, relevant tool versions, command scopes, and schema version. A post-convergence A2 capture SHALL be represented as an immutable successor identity that preserves the predecessor baseline identity and the predecessor current-head delta identity/digest; it SHALL not replace either predecessor or become the active baseline.

#### Scenario: Post-convergence successor is captured from the required source
- **WHEN** live Issues #1805–#1810 are all closed, carry `status:archived`, have their native `blockedBy` dependencies resolved, and the capture runs from the clean checked-out `origin/integration` HEAD
- **THEN** every successor record and projection SHALL identify the exact source commit and tree, commit time, tool/schema versions, predecessor baseline identity, predecessor current-head identity/digest, and successor capture identity
- **AND** the proposal or implementation-checkpoint revision SHALL not be recorded as the final capture source unless it is itself the later clean `origin/integration` HEAD satisfying those preconditions.

#### Scenario: Upstream coordination gate is unresolved
- **WHEN** any of Issues #1805–#1810 is open, lacks `status:archived`, has an unresolved native `blockedBy`, or the live state cannot be verified
- **THEN** this change SHALL remain unclaimable and unappliable and no implementation checkpoint or capture SHALL start
- **AND** the change artifacts SHALL not fabricate or assert a native Issue relationship.

#### Scenario: Successor qualification is distinct from activation
- **WHEN** the successor is marked `captured`, `digest-verified`, or `qualified-for-investigation`
- **THEN** those states SHALL remain distinct from `active-baseline`
- **AND** the successor SHALL not update `REQUIRED_BASELINE`, `REQUIRED_FITNESS_BUDGET`, test-command qualification, charter selectors, or any active baseline pointer.

#### Scenario: Capture source is dirty, mixed, unresolved, or not the required origin HEAD
- **WHEN** the source worktree is dirty, the repository/worktree identity is mixed, Git identity cannot be resolved, or the checked-out commit does not equal the declared clean `origin/integration` HEAD
- **THEN** successor generation SHALL fail closed before writing a qualified artifact
- **AND** it SHALL identify only the safe capture condition without silently selecting another revision or overwriting a predecessor.

### Requirement: Architecture inventories close their declared denominators
The successor SHALL declare and reconcile the complete `INVENTORY_KINDS` set and the predecessor manifest's complete stable kind set (currently 18 kinds) and SHALL add explicit derived aggregate slices for feature-to-App Router edges, deep imports, core infrastructure, strongly connected components, `src/lib` business surfaces, compatibility surfaces, duplicate-owner evidence, public entrypoints, single-implementation interfaces, delegate-only wrappers, and zero callers. All slices SHALL be projections of the existing deterministic census core and graph rather than a second census or registry.

#### Scenario: Layered and architectural inventories are complete
- **WHEN** the successor qualifies an inventory or material layer
- **THEN** hand-authored production, tests, tools/scripts, authored course content, generated runtime/release, active OpenSpec, archived OpenSpec, QA/browser evidence, build assets, and binary/media/model layers SHALL each declare include/exclude rules and discovered, represented, excluded, duplicate, and unresolved totals
- **AND** every item in the current `INVENTORY_KINDS` set and the predecessor manifest kind set SHALL appear exactly once in its primary observation or in a justified exclusion.

#### Scenario: Successor and predecessor kind sets differ
- **WHEN** the successor manifest kind set differs from the predecessor manifest kind set
- **THEN** qualification SHALL fail closed
- **AND** a new kind SHALL be accepted only when an explicit schema-versioned addition and migration rule declares and validates it; layer, code, payload, and relationship categories SHALL remain aggregate projections rather than inventory kinds.

#### Scenario: Dependency and derived slices are reconciled
- **WHEN** feature-to-App Router edges, deep imports, core-infrastructure paths, `src/lib` business paths, SCC members/edges, duplicate-owner records, public entrypoints, single-implementation interfaces, delegate-only wrappers, or zero-caller paths are discovered
- **THEN** each item SHALL retain a stable identity, source graph/evidence references, surface classification, and slice totals
- **AND** all forward edges, reverse edges, deep-import edges, SCC constituent edges, and derived records SHALL reconcile without disappearing into an aggregate count.

#### Scenario: An item has no primary observation or justified exclusion
- **WHEN** an item belongs to a declared denominator but is neither represented nor explicitly excluded
- **THEN** qualification SHALL fail with the slice and stable item identity
- **AND** the item SHALL not be hidden by a compact projection or a local/CI artifact boundary.

### Requirement: Ownership evidence preserves ambiguity
Each successor owner-residue observation SHALL record current-owner evidence, candidate target owner(s), resolution state, consumers, and repository-relative evidence without deriving semantic ownership solely from directory location. Duplicate-owner, public-entrypoint, single-implementation-interface, delegate-only-wrapper, and zero-caller observations SHALL remain evidence for later adjudication, not owner decisions.

#### Scenario: Ownership evidence agrees
- **WHEN** routes, contracts, persistence, events, tests, callers, and public entrypoints support one candidate target owner
- **THEN** the successor MAY record that candidate with all supporting evidence
- **AND** it SHALL retain the current-owner evidence and mark the record as an observation rather than silently transferring ownership.

#### Scenario: Ownership evidence conflicts or is incomplete
- **WHEN** different sources indicate multiple target owners, duplicate owners, a wrapper-only implementation, or no defensible owner/caller
- **THEN** the successor SHALL mark the record `ambiguous` or `unresolved`
- **AND** it SHALL preserve each conflict, consumer class, and deletion condition for B or the later refactor charter without selecting or migrating an owner.

### Requirement: Measurements distinguish scope, evidence strength, and capture identity
The successor SHALL record deterministic source-derived census facts separately from immutable environment-dependent measurement receipts. It SHALL include bounded test/build observations and a deterministic Top 50 hotspot vector using source bytes, function count, branch count, import breadth, fan-in/fan-out, change frequency, test density, and trust density, while treating all such measurements as observations rather than test qualification, architecture findings, or fitness budgets.

#### Scenario: A test or build command is measured
- **WHEN** a bounded typecheck, test, build, duration, memory, or related command is intentionally captured
- **THEN** the result SHALL reference an immutable receipt containing source identity, command/scope, platform/tool versions, cache mode, captured time, exit status, aggregate result, and bounded fingerprints
- **AND** a failing result SHALL remain an observation with limitations and SHALL not be labeled stale, accepted, quarantined, or a product defect by A.

#### Scenario: Hotspots are ranked
- **WHEN** the successor produces its Top 50 hotspot projection
- **THEN** each entry SHALL expose the declared metric vector, metric scope, evidence references, and stable tie-break identity
- **AND** missing inputs SHALL be explicit `unresolved` evidence, while file size, centrality, change frequency, or trust density SHALL not create or update a fitness budget.

#### Scenario: A measurement is rerun
- **WHEN** an environment-sensitive command is executed again
- **THEN** it SHALL create a new immutable receipt identity rather than overwrite an earlier receipt
- **AND** re-projection from the same census core and frozen receipt identities SHALL remain byte-identical.

### Requirement: Trust and compatibility observations retain their consequences
The successor SHALL inventory blocking validators, readiness-like states, aliases, facades, re-exports, old routes, feature flags, compatibility surfaces, and payload references without collapsing distinct authority or state semantics. Payload classification SHALL observe tracked bytes/blobs, duplicates, current runtime references, and archive-only references without deciding authority, materialization, retention, or deletion.

#### Scenario: A gate, compatibility surface, or readiness-like state is observed
- **WHEN** a validator, alias, facade, re-export, old route, feature flag, or readiness-like state is discovered
- **THEN** the observation SHALL identify its repository-relative location, protected boundary or relationship, current consumers, consequence/classification evidence, and unresolved status where applicable
- **AND** similar names SHALL remain separate until a later change proves they represent the same authoritative fact.

#### Scenario: Payload references or duplicate blobs are observed
- **WHEN** tracked payload classes include duplicate blobs, current runtime references, or archive-only references
- **THEN** the successor SHALL report bounded aggregate counts, blob/byte digests, classes, and locator references
- **AND** it SHALL not claim payload authority/materialization/retention or authorize deletion; those decisions belong to C and existing data-governance owners.

### Requirement: Baseline artifacts are deterministic, portable, and privacy minimized
Committed successor artifacts SHALL use repository-relative or logical identities, stable ordering, bounded evidence, and deterministic serialization. The compact package SHALL consist of `summary.md`, `baseline.json`, `owner-residue.md`, `hotspots.md`, `payload-classes.md`, and `test-baseline.md` under a successor-specific directory and SHALL record complete local/CI artifact locators, byte counts, and SHA-256 digests without committing the complete per-file ledger. The successor package SHALL never overwrite historical baseline/current-head artifacts.

#### Scenario: Compact package and detail artifact are emitted
- **WHEN** a successor is generated
- **THEN** `baseline.json` SHALL contain the successor/predecessor identities, status, schema/tool versions, aggregate layers and denominators, frozen receipt IDs, handoff contract, and an ordered locator/digest index for complete detail artifacts and projections
- **AND** the full reproducible per-file inventory SHALL be addressable as a logical local/CI artifact (for example `architecture-census/<successorCaptureId>/full-inventory.ndjson`) rather than copied into Git.

#### Scenario: Package is regenerated from the same frozen inputs
- **WHEN** the normalized census core, compact projections, and frozen receipt set are regenerated from the same source identity
- **THEN** the deterministic outputs and recorded artifact digests SHALL be byte-identical
- **AND** a changed source, changed artifact, missing locator, or digest mismatch SHALL fail closed instead of being repaired by substitution.

#### Scenario: Unsafe content is encountered
- **WHEN** an observation or emitted artifact contains a secret, learner identifier, raw answer/event payload, private content, media/screenshot/model body, complete command log, or machine-local absolute path
- **THEN** qualification SHALL fail before the successor is trusted
- **AND** the generator SHALL expose only a safe record identity and violation code.

### Requirement: Baseline capture does not change product or release state
The architecture census and successor projection SHALL be read-only with respect to application behavior, database state, CI settings, runtime and knowledge releases, OSS objects, GitHub coordination state, production selectors, active baseline selectors, fitness budgets, and test-command qualification. The successor SHALL provide only digest-bound read-only handoffs to B/C/D and N5.

#### Scenario: Successor generation runs
- **WHEN** baseline generation, current-head projection, payload classification, and qualification execute
- **THEN** they SHALL read repository source/configuration, Git metadata, existing immutable evidence, and bounded local receipts only
- **AND** they SHALL not query or mutate production services, databases, remote runtime objects, selectors, GitHub state, CI/runtime gates, or product code.

#### Scenario: A downstream change consumes the successor
- **WHEN** B, C, or D reads owner residue, payload classes, or test baseline
- **THEN** it SHALL require the exact successor identity and digest and fail closed on missing, stale, mixed, or drifted inputs
- **AND** N5 alone MAY later perform an atomic baseline+charter+fitness+test-qualification refresh after recapture or equivalence proof; A SHALL not activate it.
