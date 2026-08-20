## RENAMED Requirements

- FROM: `### Requirement: The v0.18 rebase freezes the complete active reference denominator`
- TO: `### Requirement: The v0.22 rebase freezes the complete active reference denominator`

## MODIFIED Requirements

### Requirement: Successor resolution uses identity evidence only

An unchanged stable ID MAY carry forward. Every changed predecessor MUST use an
explicit reviewed mapping bound to the predecessor object in the captured
active selection, the v0.22 successor set, disposition, evidence, and capture.
Predecessor objects come from the currently active production release and any
residual older-release bindings present in the captured denominator, such as
the retiring v0.9-bound domain-catalog memberships. Names, labels, aliases,
lexical similarity, embeddings, and graph distance MUST NOT select a successor.

#### Scenario: One reviewed successor exists

- **WHEN** a mapping record identifies one type-compatible v0.22 successor and
  all pinned evidence matches
- **THEN** the reference SHALL rebase deterministically to that successor

#### Scenario: A split, merge, deletion, or ambiguity remains

- **WHEN** no single reviewed disposition closes the predecessor reference
- **THEN** the item SHALL be `REVIEW_REQUIRED` and no candidate may be activated

### Requirement: Existing references close while new teaching coverage remains incremental

Every captured existing ACT reference MUST resolve or receive an explicit
reviewed non-semantic disposition. New v0.22 nodes are not required to receive
teaching relations for this rebase, missing teaching coverage MUST NOT block
the Authority cutover, and later reviewed relations MAY be added through a new
complete Projection release.

#### Scenario: A new engineering node has no ACT teaching relation

- **WHEN** no captured existing ACT reference targets that node
- **THEN** its absence from the Teaching Projection SHALL NOT block rebase
  completion or Authority cutover readiness

#### Scenario: An existing reference is unresolved

- **WHEN** a captured ACT reference has neither a valid successor nor an
  explicit reviewed non-semantic disposition
- **THEN** rebase readiness MUST remain blocked

### Requirement: Rebase output is complete, deterministic, and inactive

The builder MUST produce complete content-addressed Teaching Projection and
prerequisite releases bound to the pinned v0.22 composite candidate envelope,
the captured denominator, approved mapping set, and policy version. Two builds
MUST match, and current production pointers MUST remain on the currently
active release.

#### Scenario: All mapping work is resolved

- **WHEN** the complete captured denominator closes and both rebuilds match
- **THEN** the new Projection and prerequisite publication SHALL be available as
  inactive candidates without changing any consumer selector

### Requirement: Candidate admission and database observation are fail-closed

The rebase MUST bind its output to the candidate-admitted inactive v0.22
release, release-set, bundle, snapshot, capture revision, and admission receipt
produced by the v0.22 composite candidate import. The builder MUST obtain its
database observation through the candidate-import helper when a local loopback
development `DATABASE_URL` is available. The helper MUST create and drop a
schema-only disposable candidate database, import the pinned Bundle, and
execute the frozen object/prerequisite queries in a repeatable read-only
transaction. An explicit observation file MAY be supplied for replay. Every
observation MUST freeze logical schema/environment identity, query-contract
hash, parameters, deterministic object/prerequisite rows, result digest, and
counts. Missing, unsafe, or drifting observation evidence MUST block readiness
and MUST NOT be replaced by an invented live result.

#### Scenario: Candidate is generated without database credentials

- **WHEN** no disposable candidate-admission observation is supplied
- **THEN** the command SHALL attempt the local disposable observation path;
  if no safe loopback credentials are available, it SHALL emit a blocking
  receipt with `database-observation-unavailable` (or the specific fail-closed
  source/query finding), while any staged output remains explicitly
  `unqualified` and `nonActivation`

#### Scenario: Local disposable candidate-admission observation succeeds

- **WHEN** the configured URL targets a loopback PostgreSQL development
  service and the pinned v0.22 candidate Bundle imports into a disposable
  schema
- **THEN** the command SHALL record sorted object and prerequisite endpoint
  rows, their query-contract and result digests, and a READY observation check
  without persisting the physical disposable schema or changing any selector

### Requirement: Existing selectors remain byte-stable

The candidate builder MUST write only a scoped content-addressed output root.
It MUST snapshot all current production pointer bytes before and after
generation and reject any change; qualification, activation, consumer, and
production selectors MUST NOT consume the candidate output.

#### Scenario: Inactive candidate is staged

- **WHEN** complete projection and prerequisite releases are generated twice
- **THEN** their identities and bytes SHALL match, all current production
  pointer bytes SHALL remain unchanged, and the receipt SHALL retain
  `nonActivation: true`
