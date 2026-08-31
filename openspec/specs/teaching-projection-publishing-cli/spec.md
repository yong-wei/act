# teaching-projection-publishing-cli Specification

## Purpose
TBD - created by archiving change extract-teaching-projection-publishing-cli. Update Purpose after archive.
## Requirements
### Requirement: One CLI owns the teaching projection publishing vertical

The repository SHALL expose one independently runnable tool entrypoint that
owns inventory/build, qualification, rebase, publication, and verification for
the teaching projection. No product module or second tool may implement a
parallel publish/qualify/rebase authority.

#### Scenario: A candidate is prepared

- **WHEN** an operator invokes the CLI with a captured source and an explicit
  projection scope
- **THEN** the CLI runs the complete ordered path and emits a candidate,
  manifest, and receipt from one tool authority
- **AND** the candidate remains non-selectable until the existing qualification
  and coordinated activation contracts are satisfied

### Requirement: Existing projection invariants and output contracts are preserved

The CLI SHALL preserve capture revision and hash binding, Authority and scope
checks, deterministic rebase output, complete resource-family denominators,
qualification gates, fail-closed behavior, and the existing manifest/receipt
formats defined by the canonical projection specifications.

#### Scenario: Source capture drifts

- **WHEN** an input capture revision, source hash, or projection scope differs
  from the declared contract
- **THEN** the CLI fails closed with a machine-readable receipt
- **AND** it emits no selectable projection or silently corrected output

### Requirement: Product consumers read published results only

The product TypeScript and runtime graphs SHALL import only the existing
projection consumer contracts/readers and published artifact or database
results. They SHALL NOT import CLI writers, source capture adapters,
qualification modules, rebase implementations, or publication command code.

#### Scenario: The web application renders a projection

- **WHEN** a runtime consumer resolves a teaching projection
- **THEN** it reads the immutable published manifest and projection through the
  runtime consumer boundary
- **AND** no publish, qualify, or rebase computation runs in the product graph

### Requirement: Migration retires the former implementation authority

After all direct callers and focused tests are migrated, the former
`src/lib/teaching-projection/publish`, `qualify`, and `rebase` implementation
modules SHALL be deleted. A forwarding facade or duplicate command path SHALL
not satisfy this requirement.

#### Scenario: The migration is complete

- **WHEN** the tool and product/test graphs are checked for imports
- **THEN** no direct caller reaches the retired subtrees
- **AND** the CLI is the only writer/qualification/rebase implementation

### Requirement: CLI execution is independently verifiable

The CLI SHALL have an independent typecheck/test command and SHALL emit a
revision-bound verification receipt containing command identity, input
fingerprints, output hashes, and failure status. Product typecheck success alone
is insufficient evidence for CLI correctness.

#### Scenario: A command is verified in isolation

- **WHEN** the tool graph runs its focused suite
- **THEN** the suite can execute without importing the product application graph
- **AND** the receipt records the exact source revision and output comparison

