# split-production-tooling-test-typescript-graphs Specification

## Purpose
TBD - created by archiving change split-production-tooling-test-typescript-graphs. Update Purpose after archive.
## Requirements
### Requirement: Production TypeScript graphs exclude non-production sources
The production Web and worker TypeScript programs SHALL include only their declared runtime entrypoints and source dependencies, and SHALL exclude tests, tooling, OpenSpec, documentation, artifacts, generated outputs, and one-off scripts.

#### Scenario: Production typecheck runs
- **WHEN** the default production typecheck executes
- **THEN** its graph manifest SHALL enumerate included roots, excluded roots, compiler options, and stable file identities
- **AND** `scripts/`, `tests/`, OpenSpec, docs, artifacts, evaluate, one-off migration/backfill tools, and test files SHALL not enter the production Program unless an explicit framework/runtime owner record proves necessity.

#### Scenario: A production file imports tooling or tests
- **WHEN** a production dependency edge reaches a tooling, test, OpenSpec, or one-off source
- **THEN** graph qualification SHALL fail with the source, target, edge class, and replacement boundary
- **AND** increasing heap or adding a broad exclude SHALL not make the edge compliant.

### Requirement: Each graph has an independent strict command
The project SHALL provide independent strict, no-emit commands for Web production, worker production, tooling, and test graphs, with the aggregate `typecheck` command representing production qualification; tooling and test graph results SHALL be mandatory quality inputs before release.

#### Scenario: A caller runs the aggregate typecheck
- **WHEN** `npm run typecheck` is invoked
- **THEN** it SHALL execute the declared production Web/worker projects and their references
- **AND** it SHALL not silently compile or omit tooling/test graphs as part of its success claim.

#### Scenario: A tooling or test graph fails
- **WHEN** `typecheck:tools` or `typecheck:test` fails
- **THEN** that command SHALL return a failing receipt for its own graph
- **AND** the failure SHALL not be relabeled as a production pass or hidden as an aggregate exclusion.

### Requirement: Tooling and test graphs are mandatory quality inputs
The PR or integration quality layer SHALL run and require passing `typecheck:tools` and `typecheck:test` receipts, and main/release qualification SHALL reject missing, stale, or failing receipts; nightly SHALL not substitute for either graph.

#### Scenario: A PR or integration run checks graph health
- **WHEN** the PR or integration layer qualifies TypeScript health
- **THEN** it SHALL execute `typecheck:tools` and `typecheck:test` in addition to production graph commands
- **AND** an error found only in either graph SHALL make the layer fail.

#### Scenario: Main or release lacks a graph receipt
- **WHEN** main/release qualification has no current passing tools or test graph receipt, or either receipt is stale or failed
- **THEN** release qualification SHALL fail closed
- **AND** a nightly result SHALL not repair or replace the missing mandatory input.

### Requirement: Shared contracts have one compile owner
Shared DTOs, schemas, event envelopes, manifest/bundle contracts, and other cross-graph types SHALL have one owner graph and SHALL be consumed through a stable declaration/reference boundary.

#### Scenario: Web and worker consume one shared contract
- **WHEN** both production graphs need the same contract
- **THEN** the owner registry SHALL identify one compilation owner and one versioned boundary
- **AND** consumers SHALL not duplicate the contract source in separate include roots.

#### Scenario: A shared contract has no owner or multiple owners
- **WHEN** graph analysis finds an unowned or multiply compiled shared contract
- **THEN** qualification SHALL fail with the contract identity and candidate owners
- **AND** it SHALL not create a second parallel type definition as a workaround.

### Requirement: Graph measurements are revision-bound observations
Cold/warm duration, RSS, file count, compiler version, cache state, and platform data SHALL be recorded as immutable measurement receipts separate from the deterministic graph core.

#### Scenario: A cold typecheck is measured
- **WHEN** a cold production or tooling typecheck records time or memory
- **THEN** its receipt SHALL include source revision/tree, command, graph scope, tool/platform versions, cache mode, exit status, and bounded aggregate result
- **AND** the measurement SHALL remain an observation rather than an unqualified universal constant.

#### Scenario: The deterministic graph is regenerated
- **WHEN** the same source revision and graph contract are analyzed again
- **THEN** the graph manifest and owner/classification data SHALL be byte-identical
- **AND** a new environment measurement SHALL receive a new receipt identity without overwriting the prior one.

### Requirement: Strictness is preserved while graph boundaries change
Splitting programs SHALL preserve the production compiler strictness and module-resolution contract and SHALL not use compiler weakening as a graph migration strategy.

#### Scenario: A graph split exposes a type error
- **WHEN** a source becomes visible in its correct graph and fails strict typecheck
- **THEN** the error SHALL be fixed, explicitly owned as a non-qualified blocker, or handled by a real contract boundary
- **AND** `skipLibCheck`, `any` widening, suppressed diagnostics, or a wider heap SHALL not be the default disposition.

### Requirement: Heap configuration cannot replace graph separation
Memory configuration MAY support execution but SHALL NOT be the sole evidence that production, tooling, and test compilation have been separated.

#### Scenario: A typecheck only passes with a larger heap
- **WHEN** changing `NODE_OPTIONS` is the only modification that avoids a graph failure or timeout
- **THEN** the architecture check SHALL report the missing graph boundary
- **AND** the result SHALL not qualify the production/tooling/test split.

### Requirement: Each TypeScript graph exposes a tsc-only failure fixture
The graph contract SHALL include one fixture per Web, worker, tooling, and test graph whose type error is discoverable by the corresponding `tsc` command and not by runtime tests or unrelated graph commands.

#### Scenario: A graph-specific fixture is injected
- **WHEN** the fixture for one graph is made invalid
- **THEN** that graph's `tsc` command SHALL fail and produce a failing graph receipt
- **AND** passing runtime tests, lint, or another graph's command SHALL not qualify the affected graph.

#### Scenario: All graph fixtures are valid
- **WHEN** the four graph-specific fixtures satisfy their declared contracts
- **THEN** each corresponding `tsc` command SHALL report the fixture as covered
- **AND** the gate SHALL retain the fixture identity in its verification evidence.

