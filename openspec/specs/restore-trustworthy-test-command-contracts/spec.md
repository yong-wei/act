# restore-trustworthy-test-command-contracts Specification

## Purpose
TBD - created by archiving change restore-trustworthy-test-command-contracts. Update Purpose after archive.
## Requirements
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

### Requirement: Current-head reconciliation requires an immutable successor identity
The project SHALL permit a current clean-head test-denominator reconciliation only after the parent coordination layer has verified that Issue #1876 is closed, carries `status:archived`, and has its native `blockedBy` dependencies resolved. The reconciliation SHALL consume one immutable A subject identity (`successorCaptureId`, `sourceCommit`, `sourceTree`, and successor digest) and complete artifact locator/digest, and SHALL record a distinct generator identity (`toolCommit`, `toolTree`, schema/version, and entry-bundle digest). It SHALL fail closed when any gate, subject, generator, or artifact identity is absent, stale, mixed, or drifted.

#### Scenario: The A coordination gate is unresolved
- **WHEN** Issue #1876 is open, lacks `status:archived`, has an unresolved native `blockedBy`, or its live state cannot be verified
- **THEN** the reconciliation SHALL remain blocked and SHALL NOT claim/apply the change, start an implementation checkpoint, execute a test scope, or write a qualified receipt
- **AND** the change SHALL NOT fabricate the native Issue relationship or substitute a historical baseline.

#### Scenario: A successor and generator are consumed
- **WHEN** the gate is satisfied and A provides an immutable successor envelope
- **THEN** every discovery manifest, result receipt, measurement receipt, failure inventory, and conclusion SHALL retain the exact subject identity, distinct generator identity, schema/version, entry-bundle digest, and verified locator/digest
- **AND** the A successor SHALL remain distinct from `active-baseline`.

#### Scenario: The generator is changed
- **WHEN** B changes a collector, projector, or validator
- **THEN** the change SHALL first produce a clean tool implementation checkpoint and record `toolCommit`, `toolTree`, schema/version, and entry-bundle digest before governed execution
- **AND** the final artifact commit SHALL not be recorded as the subject identity.

#### Scenario: The generator is unchanged
- **WHEN** B reuses the existing collector, projector, and validator without source changes
- **THEN** the generator identity MAY equal the A subject identity
- **AND** both `toolCommit`/`toolTree` and subject fields SHALL still be explicitly present in every relevant receipt.

#### Scenario: Source or successor input drifts
- **WHEN** the clean subject checkout differs from A, the tool checkout differs from its recorded generator identity, either worktree is dirty or mixed, a second subject/tool identity read changes, an artifact locator is missing, or a digest does not match
- **THEN** qualification SHALL fail closed before writing a qualified artifact
- **AND** it SHALL not retarget another HEAD, overwrite an immutable receipt, or use a best-effort fallback.

### Requirement: Test discovery closes the declared denominator automatically
Test discovery SHALL independently enumerate the repository-level version-controlled test universe from supported naming conventions and explicit exclusions, then reconcile it in both directions with every declared application, domain, contract, integration, E2E, release, nightly, Rust/WASM, OpenSpec, commercial-UI, and other registered test root/classification. The reconciliation SHALL be bound to the exact A subject identity and the distinct generator identity used by the run.

#### Scenario: A new domain test is added
- **WHEN** a test file is created under a declared test root with the supported naming contract
- **THEN** the applicable domain command SHALL discover and classify it without a manually edited Vitest include list
- **AND** the discovery receipt SHALL include its stable repository-relative identity, subject identity, and generator identity.

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

#### Scenario: A registered scope is not executed or cannot close its denominator
- **WHEN** a command is registered for the current run but its discovery/result receipt is missing, stale, source-mismatched, or unresolved
- **THEN** the scope SHALL be represented as a blocker in the denominator and SHALL fail qualification
- **AND** the affected lane SHALL not claim that its denominator is complete; the default PR denominator SHALL be affected only when that scope is default mandatory or an explicit registry dependency requires it.

### Requirement: Lane qualification remains isolated by the existing registry
The reconciliation SHALL derive the default PR conclusion only from scopes and required inputs that the existing command registry declares as default mandatory. Release, nightly, PostgreSQL, full Playwright, and other non-default lanes SHALL retain independent denominators and pass, non-clean, or BLOCKED conclusions, each bound to the same subject and generator identities; a lane SHALL affect another lane only through an explicit registry-declared dependency.

#### Scenario: The default PR lane is evaluated
- **WHEN** the registry declares a set of default mandatory scopes and required inputs
- **THEN** only those scopes and inputs SHALL determine the default PR clean/non-clean result
- **AND** non-default lane results SHALL not be implicitly added to or removed from the default denominator.

#### Scenario: A non-default lane is incomplete
- **WHEN** release manifest input is missing, a nightly run is `nightly-not-run`, or PostgreSQL/full Playwright/another non-default lane is unavailable or unrun
- **THEN** that lane SHALL emit its own non-clean or BLOCKED result with its own denominator
- **AND** the condition SHALL neither contaminate a valid default clean result nor disappear from the global summary.

#### Scenario: A cross-lane dependency is declared
- **WHEN** the registry explicitly declares that one lane requires another lane's result or input
- **THEN** the dependent lane SHALL retain the referenced lane identity, status, blocker, subject identity, and generator identity in its receipt
- **AND** no undeclared cross-lane dependency SHALL be inferred from shared names, files, or a global aggregate.

### Requirement: Test results use revision-bound receipts
Every qualified command result SHALL be represented by an immutable receipt bound to one subject revision/tree and exact A successor identity/digest plus the distinct generator revision/tree, schema/version, and entry-bundle digest, with deterministic result data separated from environment-sensitive measurements.

#### Scenario: A current test observation is recorded
- **WHEN** a command records pass, failure, skip, unhandled error, duration, or memory data
- **THEN** the receipt SHALL include command ID, scope, subject identity, generator identity, schema/version, entry-bundle digest, tool versions, cache mode, exit status, counts, and bounded fingerprints
- **AND** a current observation SHALL NOT be encoded as an unqualified permanent constant.

#### Scenario: The same source is qualified again
- **WHEN** the source-derived discovery and result core are regenerated from the same subject, generator, successor digest, and declared inputs
- **THEN** the deterministic portion SHALL be byte-identical
- **AND** a new duration or memory measurement SHALL create a new immutable receipt rather than overwrite the earlier one.

#### Scenario: Subject, generator, or receipt inputs are inconsistent
- **WHEN** a command receipt, discovery manifest, measurement receipt, command documentation, or A artifact refers to a different subject/tool tree, successor digest, schema, entry-bundle digest, or command scope
- **THEN** the qualification SHALL report drift and fail closed
- **AND** it SHALL not merge the records by filename, current HEAD, or a historical count.

### Requirement: Mandatory test scopes cannot accept hidden failures
Mandatory test commands SHALL fail closed for assertion failures, unhandled errors, unregistered skips, unresolved discovery, subject/tool/receipt drift, and accepted failures. A planned `FIX`, `DELETE`, `QUARANTINE`, or `BLOCKED` disposition SHALL remain visible until a later authorized change supplies its closure proof.

#### Scenario: A test fails in a mandatory scope
- **WHEN** a test or setup hook fails or emits an unhandled error
- **THEN** the command SHALL return a failing result with a bounded fingerprint and planned disposition status
- **AND** it SHALL NOT use a retry, widened assertion, silent quarantine, or accepted-failure marker to report green.

#### Scenario: A test is skipped
- **WHEN** a mandatory test is skipped or filtered
- **THEN** the command SHALL report the skip and its reason
- **AND** it SHALL fail unless the skip is an explicit, revision-bound scope exclusion approved by the command contract.

#### Scenario: A planned disposition is incomplete
- **WHEN** a failure fingerprint lacks owner, root-cause evidence, lane, closure condition, or an applicable quarantine expiry
- **THEN** the disposition validator SHALL keep it unresolved and blocking
- **AND** it SHALL not emit a clean certificate or convert the item to accepted, silent skip, or permanent quarantine.

### Requirement: Run-specific evidence is an explicit release qualification input
Run-specific visual, runtime, knowledge, OSS, deployment, and other capture-bound evidence SHALL be consumed by the release-qualification command rather than by the default product test command. In B's planned disposition model, `release-input` SHALL be represented only as a governed `QUARANTINE` subtype with an explicit non-default release lane and expiry/owner metadata; its lane result SHALL remain separate from default PR qualification.

#### Scenario: Release qualification consumes evidence
- **WHEN** `test:release` receives a qualification manifest
- **THEN** it SHALL validate each evidence artifact's subject revision/tree, successor identity where applicable, generator revision/tree, schema/version, entry-bundle digest, hash, scope, owner, and freshness contract
- **AND** missing, stale, or drifted evidence SHALL block release qualification.

#### Scenario: Product tests run without release evidence
- **WHEN** `npm test`, `test:unit`, or `test:contract` runs without a release manifest
- **THEN** those commands SHALL test product behavior within their declared scope
- **AND** they SHALL not silently read or rewrite run-specific release evidence.

#### Scenario: Release input is planned for a non-default lane
- **WHEN** a failure is classified as `release-input`
- **THEN** the inventory SHALL record it as `QUARANTINE` with a named non-default release lane, owner, reason, expiry, and migration/closure condition
- **AND** it SHALL continue to block the default lane only when the fingerprint is in a default mandatory scope or an explicit registry dependency makes it required there; otherwise it SHALL block only its named release lane.

#### Scenario: A non-default release lane is not run
- **WHEN** the release manifest is absent or the registered release lane cannot run
- **THEN** the release lane SHALL report its own BLOCKED/non-clean receipt
- **AND** the default product result SHALL be determined only by its registry-declared mandatory inputs, without hiding the release blocker.

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
