# eliminate-accepted-red-test-baseline Specification

## Purpose
TBD - created by archiving change eliminate-accepted-red-test-baseline. Update Purpose after archive.
## Requirements
### Requirement: Current clean-head failures have a complete planned-disposition inventory
The project SHALL create a revision-bound, per-lane inventory for every failure, unhandled error, unregistered skip, unresolved discovery item, and unavailable registered scope observed in the current governed run. Each fingerprint SHALL retain the exact A subject identity, distinct generator identity, command and lane, stable test identity, error stage/class, root-cause evidence, owner, planned disposition, closure condition, and applicable expiry; repeated fingerprints MAY share a root-cause record without losing member traceability. Each lane SHALL retain its own denominator and status rather than relying on a global aggregate.

#### Scenario: A governed scope produces a current failure
- **WHEN** any registered default, unit, contract, integration, critical E2E, release, nightly, Rust/WASM, OpenSpec, commercial-UI, or other governed scope reports a failure or unhandled error
- **THEN** the inventory SHALL include a stable fingerprint and all required evidence fields for that current subject/tool pair and lane
- **AND** the observation SHALL not be replaced by proposal-time counts, historical labels, or an accepted-failure constant.

#### Scenario: A fingerprint is assigned a planned disposition
- **WHEN** an owner classifies a current fingerprint for later work
- **THEN** the disposition SHALL be exactly one of `FIX`, `DELETE`, `QUARANTINE`, or `BLOCKED`
- **AND** `FIX`/`DELETE`/`QUARANTINE`/`BLOCKED` SHALL retain owner, evidence, lane, and closure/resolution metadata appropriate to the class.

#### Scenario: A release-input or external limitation is recorded
- **WHEN** a failure depends on capture-bound release evidence or an external service/permission/plan limitation
- **THEN** `release-input` SHALL be recorded as a `QUARANTINE` subtype tied to a named non-default release qualification lane, owner, reason, expiry, and migration condition, while `external-blocker` SHALL be recorded as a `BLOCKED` reason with a safe response class and resolution condition
- **AND** neither subtype SHALL qualify the default PR lane as green.

#### Scenario: A planned disposition lacks closure metadata
- **WHEN** a fingerprint has no owner, root-cause evidence, lane, closure condition, applicable expiry, or valid disposition value
- **THEN** it SHALL remain unresolved and blocking
- **AND** it SHALL not be represented as accepted, silently skipped, flaky-retried, or permanently quarantined.

### Requirement: Default and non-default conclusions are explicit
The reconciliation SHALL produce per-lane conclusions bound to the current subject and generator identities. The default PR lane SHALL produce a clean certificate only from scopes and required inputs that the existing registry declares as default mandatory, when those scopes execute under their declared denominator and failures, unhandled errors, unregistered skips, unresolved discovery, subject/tool/receipt drift, and unclosed dispositions are zero; otherwise it SHALL produce a non-clean blocker package. Release, nightly, PostgreSQL, full Playwright, and other non-default lanes SHALL independently produce pass, non-clean, or BLOCKED conclusions.

#### Scenario: Default PR inputs are all closed
- **WHEN** every registry-declared default mandatory scope and required input has a valid receipt and all required blocker counts are zero
- **THEN** the result MAY be a clean certificate for that exact subject/tool revision/tree and A successor digest
- **AND** the certificate SHALL not be generalized to any later revision.

#### Scenario: Any blocker remains
- **WHEN** a registry-declared default mandatory scope is missing, a required failure/discovery/skip/unhandled count is non-zero, a subject/tool/receipt or A input drifts, or a planned disposition remains open
- **THEN** the default result SHALL be a non-clean blocker package listing the bounded blocker identity, owner, lane, evidence locator, and closure/resolution condition
- **AND** the project SHALL not claim default PR cleanliness.

#### Scenario: Quarantine has not moved to its named lane
- **WHEN** a `QUARANTINE` item, including `release-input`, remains in a default scope or lacks a valid non-default lane/expiry
- **THEN** it SHALL continue to block the default PR conclusion
- **AND** it SHALL not be treated as a passed, accepted, or permanently deferred result.

#### Scenario: A non-default lane is incomplete
- **WHEN** a release manifest is missing, a nightly lane is `nightly-not-run`, or PostgreSQL/full Playwright/another non-default lane is unavailable or unrun
- **THEN** that lane SHALL emit its own non-clean or BLOCKED conclusion with its own denominator and status
- **AND** the condition SHALL not contaminate a valid default clean result or be hidden by a global summary.

#### Scenario: A cross-lane dependency is explicit
- **WHEN** the existing registry explicitly declares that one lane requires another lane's result or input
- **THEN** the dependent lane SHALL retain the referenced lane identity, status, and blocker in its receipt
- **AND** no undeclared cross-lane dependency SHALL affect either conclusion.

### Requirement: Mandatory red failures have an explicit revision-bound disposition
Every failure in a mandatory test scope SHALL be classified by a revision-bound inventory tied to the exact A subject identity and distinct generator identity and SHALL have one owner, one evidence-backed planned disposition, one lane, and one closure condition; a quarantine expiry SHALL be present when applicable.

#### Scenario: The current unit command is red
- **WHEN** `test:unit` reports failures or unhandled errors
- **THEN** each failure fingerprint SHALL be recorded with subject revision/tree, generator revision/tree, successor digest, command and lane, test identity, error class, root-cause evidence, owner, and planned disposition
- **AND** the result SHALL NOT be labeled historical or accepted without independent evidence.

#### Scenario: A failure repeats under the same root cause
- **WHEN** multiple fingerprints share one demonstrated root cause
- **THEN** they MAY share one remediation record
- **AND** every affected fingerprint SHALL remain traceable with its own identity and closure state until its proof is verified.

#### Scenario: A disposition is not one of the governed values
- **WHEN** a receipt contains `accepted`, an unqualified `release-input`, silent skip, flaky retry, or another unregistered disposition
- **THEN** the disposition validator SHALL reject the receipt
- **AND** the fingerprint SHALL remain a blocking `FIX`, `DELETE`, `QUARANTINE`, or `BLOCKED` investigation item.

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
Evidence whose validity depends on a capture run, release artifact, external service, or source revision SHALL be validated by the release-qualification command and SHALL not determine the product test result. Within this reconciliation, its planned disposition SHALL be the governed `QUARANTINE` subtype `release-input` until it is actually migrated and qualified in a named non-default lane; the evidence receipt SHALL retain both subject and generator identities.

#### Scenario: Default product tests encounter stale evidence
- **WHEN** `npm test` or `test:unit` sees missing, stale, or revision-mismatched run-specific evidence
- **THEN** the product result SHALL use only registry-declared default mandatory inputs, while the release lane SHALL emit its own blocker/planned release-input unless an explicit registry dependency makes it required by that product lane
- **AND** `test:release` SHALL fail closed when the required qualification manifest is missing or invalid.

#### Scenario: Release evidence is migrated
- **WHEN** an evidence check moves to release qualification
- **THEN** its manifest SHALL bind artifact identity, A/subject revision/tree, generator revision/tree, schema/version, entry-bundle digest, hash, scope, owner, freshness, named non-default lane, and migration/closure condition
- **AND** the migration SHALL preserve the protected release fact rather than weakening the check.

#### Scenario: Release input is still in the default scope
- **WHEN** a `release-input` subtype remains in a registry-declared default mandatory scope or an explicit registry dependency still makes it a default input, and it has not actually moved to and passed its named non-default release qualification lane
- **THEN** it SHALL remain blocking for the default PR conclusion
- **AND** an expiry-less, owner-less, or permanent quarantine SHALL be rejected.

### Requirement: The default PR baseline has no accepted failure state
The mandatory PR test receipt SHALL qualify only when its failures, unhandled errors, unregistered skips, unresolved discovery gaps, subject/tool/receipt drift, and unclosed planned dispositions are zero.

#### Scenario: A proposed workaround hides a failure
- **WHEN** a change uses skip, flaky retry, permanent quarantine, wider assertion, timeout inflation, or silent filtering to avoid a mandatory failure
- **THEN** the disposition validator SHALL reject the receipt
- **AND** the failure SHALL remain blocking until fixed, removed with evidence, moved and qualified in its explicit non-PR command, or recorded as a bounded external blocker.

#### Scenario: All mandatory work is closed
- **WHEN** every registry-declared default mandatory fingerprint has a verified fix/removal/release-input proof, every default mandatory receipt is current, and the command receipt is green for the subject/tool pair
- **THEN** the baseline conclusion MAY be marked qualified for that subject revision/tree, generator revision/tree, and A successor digest
- **AND** the qualification SHALL not be generalized to later revisions or written into `REQUIRED_BASELINE`.

### Requirement: External blockers remain honest blockers
An external service, permission, plan limitation, missing A handoff, or unresolved coordination gate SHALL be recorded as a bounded `BLOCKED` item and SHALL not be converted into a passing test or claimed protection.

#### Scenario: A required external check returns forbidden
- **WHEN** a required GitHub or release service operation returns a permission/plan error
- **THEN** the receipt SHALL record the safe response class, affected gate/lane, subject identity, generator identity, owner, and resolution condition
- **AND** it SHALL not report that the external gate is active or passed.

#### Scenario: The A successor or coordination gate cannot be verified
- **WHEN** Issue #1876 is not verified as closed and archived with native dependencies resolved, or the A successor identity/digest/locator is missing or drifted
- **THEN** the B result SHALL be `BLOCKED` with a bounded gate/input reason
- **AND** it SHALL not start a test execution, issue a clean certificate, or substitute a historical baseline.
