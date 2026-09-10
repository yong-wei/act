## MODIFIED Requirements

### Requirement: Runtime publication is immutable and non-activating
The runtime-release tool SHALL be `runtime:publish`. It SHALL build an immutable content-addressed release with the local metadata index and CAS PUTs. Publication SHALL NOT change `current` or `previous`, deploy a host, or perform a coordinated cutover. Activation SHALL be the separate `runtime:activate` command.

#### Scenario: A runtime release is published
- **WHEN** the operator runs `runtime:publish` on a readable runtime tree and a usable local index
- **THEN** the resulting manifest and blob keys are written without selector mutation
- **AND** a later activation requires an explicit `runtime:activate`

#### Scenario: Ordinary publish cannot see the local index
- **WHEN** the publish index is missing or corrupt and `--bootstrap` is absent
- **THEN** the tool SHALL fail closed
- **AND** it SHALL NOT hash the whole tree

### Requirement: Standard release toolchains have explicit owners
The repository SHALL expose independent content-compiler, knowledge-release, and runtime-release entries. The runtime-release owner SHALL expose only `runtime:publish`, `runtime:publish -- --bootstrap`, `runtime:activate`, `runtime:rollback`, `runtime:doctor -- --full`, and `runtime:gc -- --dry-run`. Application deploy SHALL not own Runtime publication.

#### Scenario: A release command is selected
- **WHEN** an operator chooses a runtime publish or activate action
- **THEN** exactly one registered toolchain entry owns the action
- **AND** the product application graph is not required to import its writer implementation

### Requirement: Retired release entrypoints are removed
After this change, old Runtime publication facades SHALL be deleted rather than kept as compatibility adapters. Product imports SHALL resolve only to runtime readers and shared manifest/hash contracts. Historical cutover, publisher-bridge orchestration, lifecycle, host-state and source-proof entrypoints SHALL have zero daily callers.

#### Scenario: Toolchain migration is checked
- **WHEN** the independent tool, product, and test graphs are scanned
- **THEN** no product import reaches a release writer
- **AND** daily Runtime publication has one registered implementation
