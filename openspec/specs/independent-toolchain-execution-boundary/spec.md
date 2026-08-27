# independent-toolchain-execution-boundary Specification

## Purpose
Define ACT's independent toolchain execution boundary: captured Git source denominators, a revision-bound tool registry, public versus private outputs, product-to-tool import fail-closed checks, and mapping onto the existing tools and test TypeScript graphs.
## Requirements
### Requirement: Source denominators are captured tracked Git entries

Every source denominator SHALL be the exact set of tracked entries returned by
`git ls-files -- <path>` for the declared captured Git tree and source revision.
Ignored, untracked, generated, and runtime-created files SHALL be excluded,
including `__pycache__/` and `*.pyc`. A generated or untracked input that is
strictly required in the future SHALL be recorded as a separate
`generated-input` category with producer/version, path class, content digest,
and source revision; it SHALL NOT be added to the source denominator.

#### Scenario: A denominator is frozen

- **WHEN** a tool inventory is characterized at a captured source revision
- **THEN** its denominator is reproducible from the tracked Git entry list
- **AND** ignored, untracked, generated, and runtime-created files are absent
  from the denominator fixture

#### Scenario: A generated input is required

- **WHEN** a command needs a generated or untracked input that is not in the
  captured tree
- **THEN** the input is recorded separately with its producer/version, class,
  digest, and source revision
- **AND** the source denominator and its count remain unchanged

### Requirement: Toolchain execution has one explicit boundary and owner
The repository SHALL expose every content, knowledge/runtime release, evidence/visual QA, migration/backfill, and competition-material command through one revision-bound tool registry. Each record SHALL have one owner, one command identity, one tool class, an input denominator, a declared output contract, a source revision/tree, an independent verification command, a privacy class, and a retirement condition. Unknown, duplicate, ownerless, or denominator-incomplete records SHALL fail qualification.

#### Scenario: A known tool is registered
- **WHEN** a tool command is discovered in the frozen repository inventory
- **THEN** the registry SHALL assign exactly one class and owner and SHALL bind its command, source, inputs, outputs, verification, privacy, and retirement fields
- **AND** the record SHALL be reproducible from the captured source identity.

#### Scenario: A command is unclassified or multiply owned
- **WHEN** inventory finds a command without a class/owner or with more than one authoritative record
- **THEN** boundary qualification SHALL fail with the command path and competing records
- **AND** a path rename or compatibility facade SHALL not satisfy the missing ownership.

### Requirement: Tool outputs are revision-bound and contract-separated
Every tool run SHALL emit an immutable receipt that binds source revision/tree, command identity, input manifest/digest, output manifest/digest, validator version, exit status, and relevant safety/privacy state. Public runtime bundles and database results SHALL be distinguishable from private run evidence, and neither output class SHALL contain an absolute local path, credential, raw user identifier, or undeclared external input.

#### Scenario: A public bundle is produced
- **WHEN** a tool publishes a runtime, knowledge, content, or other product-consumable result
- **THEN** its manifest and receipt SHALL bind the exact source/input identities and portable logical paths
- **AND** a consumer SHALL be able to verify the bytes without reading the tool working directory.

#### Scenario: A run-specific diagnostic is produced
- **WHEN** a command emits screenshots, traces, logs, review packs, or other run-specific evidence
- **THEN** the receipt SHALL reference the evidence separately from the public bundle
- **AND** the product runtime SHALL not treat that evidence as a product input.

### Requirement: Product compilation and runtime cannot import tool implementations
The product Web/worker graph and production runtime SHALL consume only declared public bundle, manifest, or database-result contracts. A static import, dynamic import, path read, generated-module import, or package dependency from product code to a tool implementation, tool staging directory, one-off script, or private run evidence SHALL make the boundary check fail closed.

#### Scenario: A production module imports a tool
- **WHEN** dependency analysis reaches a tool implementation or private evidence path from Web/worker production code
- **THEN** qualification SHALL report the source, target, edge class, and public replacement contract
- **AND** increasing heap, adding an exclude, or adding a re-export SHALL not make the edge compliant.

#### Scenario: A product consumer reads a published result
- **WHEN** a product route or worker needs a tool-produced fact
- **THEN** it SHALL read the declared immutable bundle/manifest or database projection through its existing consumer contract
- **AND** it SHALL not import the generator or discover a result by scanning a run directory.

### Requirement: Tool verification is independent and mandatory
Every registered tool class SHALL have an independent strict typecheck/test command mapped to the qualified tooling/test graph. A tool receipt SHALL identify the graph, command, test discovery scope, and result. Missing, stale, or failing tool/test receipts SHALL not be represented as a production pass, and nightly evidence SHALL not replace a required receipt.

#### Scenario: A tool graph passes
- **WHEN** the declared tooling and test commands complete for a source revision
- **THEN** the receipts SHALL record the graph scope, command identity, exit status, and input/output identities
- **AND** the boundary registry SHALL be eligible for downstream release-gate consumption.

#### Scenario: A tool graph fails
- **WHEN** a tool-only type error, contract failure, or test failure occurs
- **THEN** the corresponding receipt SHALL fail and identify the affected tool class
- **AND** the aggregate production typecheck SHALL not hide or relabel that failure.

### Requirement: Boundary migration removes old authority rather than adding a facade
After a tool has a qualified replacement, its old implementation/forwarder SHALL either be deleted or be recorded as a bounded compatibility entry with current consumers, owner, removal condition, and rollback evidence. A proposal or implementation SHALL not claim isolation while both paths remain unbounded authorities.

#### Scenario: A migrated entry has no remaining consumer
- **WHEN** characterization proves all callers use the qualified tool entry
- **THEN** the old implementation or forwarding module SHALL be removed
- **AND** the deletion and replacement identities SHALL be recorded in the migration receipt.

#### Scenario: A legacy adapter remains necessary
- **WHEN** an external or production adapter still requires an old path during a staged migration
- **THEN** the registry SHALL mark it as compatibility-only with an explicit removal condition and owner
- **AND** it SHALL not be selectable as a second tool authority.

