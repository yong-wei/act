## Hard Dependencies

已 qualified 的 `restore-trustworthy-test-command-contracts` 是本 capability 的硬前置；其 command/discovery receipt、scope 和 failure semantics 必须可追溯，前置未 qualified 时不得 qualify，依赖方向不回指本 capability。

## ADDED Requirements

### Requirement: Mandatory red failures have an explicit revision-bound disposition
Every failure in a mandatory test scope SHALL be classified by a revision-bound inventory and SHALL have one owner, one evidence-backed disposition, and one closure condition.

#### Scenario: The current unit command is red
- **WHEN** `test:unit` reports failures or unhandled errors
- **THEN** each failure fingerprint SHALL be recorded with source revision/tree, command, test identity, error class, owner, and disposition
- **AND** the result SHALL NOT be labeled historical or accepted without independent evidence.

#### Scenario: A failure repeats under the same root cause
- **WHEN** multiple fingerprints share one demonstrated root cause
- **THEN** they MAY share one remediation record
- **AND** every affected fingerprint SHALL remain traceable until its closure proof is verified.

### Requirement: Real product and test defects are repaired at their source
An in-scope product or test defect SHALL be fixed with a behavior-preserving regression proof rather than masked by assertion or runner changes.

#### Scenario: A real defect is identified
- **WHEN** a failure is reachable under the current product/test contract
- **THEN** the implementation SHALL add or retain a minimal regression test and repair the root cause
- **AND** the original fingerprint SHALL disappear from the mandatory receipt without widening assertions or changing authority semantics.

### Requirement: Invalid tests are removed only with retirement evidence
A test that no longer represents a supported capability SHALL be deleted or replaced only when its retirement, replacement, owner, and call-site evidence are recorded.

#### Scenario: A historical test is obsolete
- **WHEN** a test asserts a retired capability, historical prose, stale fixed hash, or run artifact with no current authority
- **THEN** the disposition SHALL record the replacement or retirement evidence and deletion condition
- **AND** the test SHALL not remain as a permanently skipped or quarantined default test.

### Requirement: Run-specific evidence is moved to an explicit release input
Evidence whose validity depends on a capture run, release artifact, external service, or source revision SHALL be validated by the release-qualification command and SHALL not determine the product test result.

#### Scenario: Default product tests encounter stale evidence
- **WHEN** `npm test` or `test:unit` sees missing, stale, or revision-mismatched run-specific evidence
- **THEN** the evidence dependency SHALL be removed from that product command
- **AND** `test:release` SHALL fail closed when the required qualification manifest is missing or invalid.

#### Scenario: Release evidence is migrated
- **WHEN** an evidence check moves to release qualification
- **THEN** its manifest SHALL bind artifact identity, source revision/tree, schema, hash, scope, owner, and freshness
- **AND** the migration SHALL preserve the protected release fact rather than weakening the check.

### Requirement: The default PR baseline has no accepted failure state
The mandatory PR test receipt SHALL qualify only when its failures, unhandled errors, unregistered skips, and unresolved discovery gaps are zero.

#### Scenario: A proposed workaround hides a failure
- **WHEN** a change uses skip, flaky retry, permanent quarantine, wider assertion, timeout inflation, or silent filtering to avoid a mandatory failure
- **THEN** the disposition validator SHALL reject the receipt
- **AND** the failure SHALL remain blocking until fixed, removed with evidence, or moved to its explicit non-PR command.

#### Scenario: All mandatory work is closed
- **WHEN** every mandatory fingerprint has a verified fix/removal/release-input proof and the command receipt is green
- **THEN** the baseline SHALL be marked qualified for that source revision/tree
- **AND** the qualification SHALL not be generalized to later revisions without a new receipt.

### Requirement: External blockers remain honest blockers
An external service, permission, or plan limitation SHALL be recorded as a bounded blocker and SHALL not be converted into a passing test or claimed protection.

#### Scenario: A required external check returns forbidden
- **WHEN** a required GitHub or release service operation returns a permission/plan error
- **THEN** the receipt SHALL record the safe response class, affected gate, source revision, and resolution condition
- **AND** it SHALL not report that the external gate is active or passed.
