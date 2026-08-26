## Hard Dependencies

`capture-modular-monolith-refactor-baseline` 与已 qualified 的 `establish-modular-monolith-refactor-charter` 是本 capability 的硬前置；charter 是 baseline 之外的独立 prerequisite。任一前置缺失、drift 或分母不完整时不得 qualify。

## ADDED Requirements

### Requirement: Test commands have one explicit scope and failure contract
The project SHALL define one authoritative semantic contract for the default, unit, contract, integration, critical E2E, release-qualification, and nightly test commands.

#### Scenario: A command is invoked
- **WHEN** a caller runs one of the governed test commands
- **THEN** the command SHALL declare its scope, required inputs, excluded scopes, output receipt, and exit conditions
- **AND** it SHALL NOT silently delegate to an unrelated historical script bundle.

#### Scenario: The default command is used for a pull request
- **WHEN** `npm test` runs in the PR lane
- **THEN** it SHALL execute the deterministic, fast, mandatory PR test set
- **AND** every failure, unhandled error, unregistered skip, or discovery gap SHALL produce a non-zero result.

### Requirement: Test discovery closes the declared denominator automatically
Test discovery SHALL independently enumerate the repository-level version-controlled test universe from supported naming conventions and explicit exclusions, then reconcile it in both directions with every declared application, domain, contract, integration, E2E, release, and nightly root and classification.

#### Scenario: A new domain test is added
- **WHEN** a test file is created under a declared test root with the supported naming contract
- **THEN** the applicable domain command SHALL discover and classify it without a manually edited Vitest include list
- **AND** the discovery receipt SHALL include its stable repository-relative identity.

#### Scenario: A test appears in a new or undeclared directory
- **WHEN** a version-controlled file matches the repository test naming convention but is outside all currently declared test roots or has no layer/classification
- **THEN** the independent test universe SHALL include the file in the denominator
- **AND** qualification SHALL fail with the missing root/classification rather than ignore the file.

#### Scenario: Declared roots contain no independently discovered test
- **WHEN** a declared test root or classification has no corresponding member in the independently enumerated universe
- **THEN** discovery SHALL report the unmatched declaration and fail the affected qualification
- **AND** a manually maintained include entry SHALL not conceal the mismatch.

#### Scenario: A discovered file has no classification
- **WHEN** a candidate test is inside a declared root but has no owner, layer, or disposition
- **THEN** discovery SHALL report it as unresolved and fail the affected qualification
- **AND** it SHALL NOT omit the file from the denominator.

#### Scenario: A file is intentionally excluded
- **WHEN** a candidate is excluded by a repository rule
- **THEN** the receipt SHALL record the exclusion rule, reason, owner, and removal condition where applicable
- **AND** a broad glob or undocumented path omission SHALL NOT count as a valid exclusion.

### Requirement: Test results use revision-bound receipts
Every qualified command result SHALL be represented by a receipt bound to one source revision and source tree, with deterministic result data separated from environment-sensitive measurements.

#### Scenario: A current test observation is recorded
- **WHEN** a command records pass, failure, skip, unhandled error, duration, or memory data
- **THEN** the receipt SHALL include command ID, scope, source revision/tree, tool versions, cache mode, exit status, counts, and bounded fingerprints
- **AND** a current observation SHALL NOT be encoded as an unqualified permanent constant.

#### Scenario: The same source is qualified again
- **WHEN** the source-derived discovery and result core are regenerated from the same revision and declared inputs
- **THEN** the deterministic portion SHALL be byte-identical
- **AND** a new duration or memory measurement SHALL create a new immutable receipt rather than overwrite the earlier one.

### Requirement: Mandatory test scopes cannot accept hidden failures
Mandatory test commands SHALL fail closed for assertion failures, unhandled errors, unregistered skips, unresolved discovery, receipt drift, and accepted failures.

#### Scenario: A test fails in a mandatory scope
- **WHEN** a test or setup hook fails or emits an unhandled error
- **THEN** the command SHALL return a failing result with a bounded fingerprint and disposition status
- **AND** it SHALL NOT use a retry, widened assertion, silent quarantine, or accepted-failure marker to report green.

#### Scenario: A test is skipped
- **WHEN** a mandatory test is skipped or filtered
- **THEN** the command SHALL report the skip and its reason
- **AND** it SHALL fail unless the skip is an explicit, revision-bound scope exclusion approved by the command contract.

### Requirement: Run-specific evidence is an explicit release qualification input
Run-specific visual, runtime, knowledge, OSS, and deployment evidence SHALL be consumed by the release-qualification command rather than by the default product test command.

#### Scenario: Release qualification consumes evidence
- **WHEN** `test:release` receives a qualification manifest
- **THEN** it SHALL validate each evidence artifact's source revision/tree, schema, hash, scope, and freshness contract
- **AND** missing, stale, or drifted evidence SHALL block release qualification.

#### Scenario: Product tests run without release evidence
- **WHEN** `npm test`, `test:unit`, or `test:contract` runs without a release manifest
- **THEN** those commands SHALL test product behavior within their declared scope
- **AND** they SHALL not silently read or rewrite run-specific release evidence.

### Requirement: CI checks map one-to-one to local command contracts
Each required CI check SHALL invoke exactly one governed local command or one documented composition of governed commands with the same scope and receipt semantics.

#### Scenario: A CI check is configured
- **WHEN** a PR, integration, main/release, or nightly workflow declares a required test check
- **THEN** its command ID, scope, inputs, and failure policy SHALL resolve to the local command contract
- **AND** a workflow-only variant with weaker semantics SHALL fail contract validation.

### Requirement: A qualified charter is a hard prerequisite for test qualification
Test command qualification SHALL consume the qualified modular-monolith charter in addition to the architecture baseline and SHALL not infer owner or authority from the baseline alone.

#### Scenario: The charter is absent or unqualified
- **WHEN** a command/discovery qualification has a valid baseline but the charter is missing, unqualified, drifted, or denominator-incomplete
- **THEN** qualification SHALL return a blocked result with the charter identity and failure condition
- **AND** it SHALL not write a qualified command receipt.

#### Scenario: Baseline and charter identities agree
- **WHEN** both hard prerequisites are qualified and their declared source identities are compatible
- **THEN** the command receipt SHALL retain both identities as inputs
- **AND** later command consumers SHALL be able to trace scope and classification to both records.
