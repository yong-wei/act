## ADDED Requirements

### Requirement: Active tooling is represented by one revision-bound inventory

The repository SHALL maintain a complete source-bound inventory of active, compatibility, retired, and unknown tooling/CLI entries, with owner, authority, scope, inputs, outputs, verification command, receipt/privacy class, and deletion condition.

#### Scenario: An operator command is discovered

- **WHEN** a package script, CI hook, shell/TS/JS/Python tool, worker command, or documented alias is scanned
- **THEN** the inventory SHALL classify it and bind it to a canonical owner and source identity
- **AND** directory presence or command name alone SHALL not qualify it as active.

#### Scenario: A command cannot be classified safely

- **WHEN** caller, owner, input identity, or side effects remain uncertain
- **THEN** the entry SHALL remain `unknown`
- **AND** consolidation SHALL not delete it or treat it as retired without explicit evidence.

### Requirement: Each operation has one canonical command owner

Every active operation SHALL resolve to one existing canonical command/toolchain owner; aliases MAY remain only as thin compatibility adapters that preserve arguments, exit status, receipt identity, and non-authoritative status.

#### Scenario: Two scripts perform the same operation

- **WHEN** before/after evidence proves two entries have equivalent inputs, outputs, side effects, and failure semantics
- **THEN** one entry SHALL become the canonical owner and the other SHALL be retired or reduced to a documented thin adapter
- **AND** a new universal dispatcher SHALL not replace them.

#### Scenario: A compatibility alias changes semantics

- **WHEN** an alias alters graph scope, source denominator, receipt, exit code, write behavior, or security authority
- **THEN** it SHALL not be treated as a harmless alias
- **AND** it SHALL remain separately classified until an owner-approved migration exists.

### Requirement: Delivery and graph gates remain explicit

CLI consolidation SHALL preserve independent Web, worker, tooling, and test graphs and SHALL keep `verify:commit`, `verify:push`, and aggregate `typecheck` semantics explicit.

#### Scenario: A tooling graph fails

- **WHEN** `typecheck:tools` or `typecheck:test` fails
- **THEN** its failure SHALL remain visible to the declared quality/release layer
- **AND** a broader wrapper SHALL not relabel it as a production pass.

#### Scenario: A commit or push gate runs

- **WHEN** `verify:commit` or `verify:push` is invoked
- **THEN** the canonical command map SHALL preserve the existing checks and failure propagation
- **AND** it SHALL not silently skip typecheck, privacy, or architecture evidence.

### Requirement: Release and runtime publication remain non-activating

Active tooling SHALL preserve immutable, source/release-bound receipts and SHALL keep content/knowledge/runtime publication separate from deployment, selector mutation, cutover, and database business writes.

#### Scenario: A release artifact is published

- **WHEN** a content, knowledge, or runtime tool materializes an output
- **THEN** it SHALL record the existing source/release/manifest identity and verification receipt
- **AND** it SHALL not activate a production selector or deploy a host.

#### Scenario: Release or rollback safety is checked

- **WHEN** a release or rollback operation requires security validation
- **THEN** the existing unique security validator SHALL remain the authority
- **AND** inventory or alias consolidation SHALL not add a second validator or bypass it.

### Requirement: Tooling output is portable and privacy-safe

Inventory and command receipts SHALL exclude credentials, user identifiers, raw answers, private payloads, machine absolute paths, and provider secrets while retaining enough identity for deterministic replay and audit.

#### Scenario: A command fails with sensitive provider or database data

- **WHEN** tooling records an error or receipt
- **THEN** it SHALL use the existing redaction and portable identity contracts
- **AND** raw sensitive payloads SHALL not enter inventory, logs intended for publication, or release evidence.
