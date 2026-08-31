# content-knowledge-runtime-release-toolchains Specification

## Purpose
Isolate content export, locked knowledge publication, and immutable runtime publication behind independently runnable toolchain entries bound to captured Git `ls-files` denominators, without activating selectors or deploying production.
## Requirements
### Requirement: Release source denominators are captured tracked entries

Every content, knowledge, and runtime source denominator SHALL be the exact set
of tracked entries returned by `git ls-files -- <path>` for the declared
captured Git tree and source revision. Ignored, untracked, generated, and
runtime-created files SHALL be excluded, including `__pycache__/` and `*.pyc`.
A future generated or untracked input SHALL be a separate `generated-input`
record containing producer/version, path class, content digest, and source
revision; it SHALL NOT alter the tracked source denominator.

#### Scenario: A release denominator is characterized

- **WHEN** a content, knowledge, or runtime tool freezes its source inventory
- **THEN** the characterization fixture contains the captured-tree identity and
  the exact tracked entry list or digest
- **AND** ignored, untracked, generated, and runtime-created entries are
  excluded from the denominator

#### Scenario: A generated release input is needed

- **WHEN** a release command needs an input outside the captured tracked tree
- **THEN** the input is recorded separately with producer/version, class, digest,
  and source revision
- **AND** it cannot change the tracked denominator or its count

### Requirement: Standard release toolchains have explicit owners

The repository SHALL expose independent content-compiler, knowledge-release,
and runtime-release entries under the toolchain registry. Each entry SHALL
declare its inputs, outputs, caller boundary, verification command, and receipt
owner.

#### Scenario: A release command is selected

- **WHEN** an operator chooses a content, knowledge, or runtime release action
- **THEN** exactly one registered toolchain entry owns the action
- **AND** the product application graph is not required to import its writer
  implementation

### Requirement: Content export preserves the authoring and runtime contract

The content compiler SHALL consume reviewed authoring content and emit the
existing runtime content shape, provenance, validation result, and source
identity. It SHALL NOT make authoring media a runtime read path or activate a
production selector.

#### Scenario: Reviewed content is exported

- **WHEN** the content tool receives a reviewed authoring revision
- **THEN** it emits a deterministic runtime artifact and receipt bound to that
  revision
- **AND** a failed review or provenance check produces no selectable runtime
  output

### Requirement: Knowledge publication consumes a locked bundle

The knowledge-release tool SHALL require the existing explicit ReleaseSet and
Bundle identity, preserve Authority and Teaching Projection binding, and emit
lossless public artifacts plus qualification evidence. Incomplete, conflicting,
or drifted inputs SHALL fail closed and remain non-selectable.

#### Scenario: A knowledge candidate is published

- **WHEN** a locked ReleaseSet/Bundle passes its existing integrity checks
- **THEN** the tool emits the canonical bundle, manifest, projection result, and
  qualification receipt
- **AND** coordinated activation remains outside this tool

### Requirement: Runtime publication is immutable and non-activating

The runtime-release tool SHALL build and inspect an immutable content-addressed
release using the existing manifest-last and lifecycle rules. Publication SHALL
NOT change a production selector, deploy a host, or perform a coordinated
cutover.

#### Scenario: A runtime release is materialized

- **WHEN** a qualified input bundle is materialized
- **THEN** the resulting manifest and artifact hashes are recorded in a portable
  receipt
- **AND** a later activation requires the existing explicit operator and
  coordination contracts

### Requirement: Release identities and database results remain coherent

Content, knowledge, projection, and runtime outputs SHALL carry one coherent
source/release identity and SHALL reject joins or reads whose capture,
manifest, or bundle hashes do not match. Receipts SHALL use portable paths and
must not expose credentials, user identifiers, or private evidence.

#### Scenario: A stale result is supplied

- **WHEN** a database result or artifact references a different source or
  release identity than the command input
- **THEN** the tool fails closed with the mismatch in its receipt
- **AND** it does not merge the stale result into a public release

### Requirement: Retired release entrypoints are removed

After vertical migration, old content/knowledge/runtime publication entrypoints
and facades SHALL be deleted or explicitly retained only as operator adapters
with no duplicate publication authority. Product imports SHALL resolve only to
runtime readers and shared contracts.

#### Scenario: Toolchain migration is checked

- **WHEN** the independent tool, product, and test graphs are scanned
- **THEN** no product import reaches a release writer
- **AND** each publication operation has one registered implementation

### Requirement: Each toolchain produces independent verification evidence

The content, knowledge, and runtime entries SHALL each have an independently
runnable typecheck/test path and SHALL emit a revision-bound receipt recording
inputs, output hashes, verification commands, and failure status.

#### Scenario: A release is verified outside the web graph

- **WHEN** a toolchain's focused verification command runs
- **THEN** it executes without the product application graph
- **AND** its receipt is sufficient to identify the exact source and release
  artifacts tested

