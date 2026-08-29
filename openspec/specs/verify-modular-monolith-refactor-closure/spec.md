# verify-modular-monolith-refactor-closure Specification

## Purpose
TBD - created by archiving change verify-modular-monolith-refactor-closure. Update Purpose after archive.

## Requirements

### Requirement: Closure consumes one explicit, qualified source identity

The closure validator SHALL consume only a declared input manifest whose
baseline, charter/deprecation ledger, dependency contract, fitness report,
test/toolchain receipts, QA evidence manifests, and domain terminal receipts
all prove the same `sourceCommit` and `sourceTree`. It SHALL reject branch-name
inference, directory-based "latest" selection, proposal text, closed Issues,
checked tasks, archive paths, and historical receipts as substitutes for a
current-revision input.

#### Scenario: Every input has one source identity

- **WHEN** the validator loads the explicit input manifest
- **THEN** every input receipt identity SHALL include `receiptId`,
  `contentDigest`, `schemaVersion`, `owner`, `sourceCommit`, `sourceTree`,
  scope, and status
- **AND** all source identities SHALL equal the qualified baseline identity
  before any result can be `qualified`.

#### Scenario: The source is dirty, mixed, or drifted

- **WHEN** the current capture is dirty, Git identity is unresolved, the
  source/tree differs, `GIT_WORK_TREE` or Git toplevel indicates a mixed
  worktree, or any receipt reports a different identity
- **THEN** validation SHALL fail closed with `status: unresolved`
- **AND** it SHALL preserve the offending stage and safe identity without
  silently recapturing or substituting another revision.

### Requirement: Every declared input denominator is closed and preserved

Each input stage SHALL provide stable observation records classified as
`included`, `excluded`, `duplicate`, or `unresolved`, together with
`discovered`, `included`, `excluded`, `duplicate`, and `unresolved` totals. The
validator SHALL require `discovered = included + excluded + duplicate +
unresolved` for every stage and for the global sum. Excluded, duplicate, and
unresolved records SHALL remain visible in the normalized receipt and count in
the denominator.

#### Scenario: An input denominator is complete

- **WHEN** every observation is represented exactly once and its stage totals
  reconcile
- **THEN** the stage SHALL contribute its records and totals to the global
  receipt
- **AND** the global totals SHALL be the deterministic sum of the stage totals.

#### Scenario: An item is missing from the denominator

- **WHEN** a declared-scope item has no observation, justified exclusion, or
  stable record identity
- **THEN** validation SHALL report the stage and item as unresolved
- **AND** the item SHALL not disappear from the aggregate or be replaced with a
  zero count.

#### Scenario: Main and isolated worktrees disagree on one path

- **WHEN** main and isolated observations contain the same path with different
  content digests
- **THEN** both observations SHALL be retained under distinct
  `worktreeRole:path:contentDigest` identities
- **AND** the identity conflict SHALL enter the duplicate/unresolved totals and
  prevent qualification; the validator SHALL not choose one silently.

### Requirement: Terminal coverage is one-to-one and revision-bound

The closure manifest SHALL declare every required stage and SHALL map exactly
one current terminal receipt to each stage. The required stage IDs SHALL be
`governance-1548`, `quality-1554`, `toolchain-1557`, `toolchain-1558`,
`toolchain-1559`, `assessment-personalization-1567`, `course-classroom-1576`,
`learning-record-1587`, `knowledge-resource-1592`, `practice-1602`,
`assignment-retirement-1607`, and `generated-content-reconciliation-1608`.
Native child Issues #1607 and #1608 identify the last two stages; tracking
parent #1603 is coordination metadata only and is not a blocker or terminal
evidence. Issue existence or number never substitutes for a current receipt.

#### Scenario: All attachments map to current terminal receipts

- **WHEN** each required stage has one schema-valid receipt whose source,
  input digest, producer revision, and current/supersession proof match the
  manifest
- **THEN** `terminalCoverage.present` SHALL contain one mapping per stage
- **AND** the receipt's conclusion and totals SHALL be available to status
  evaluation without copying raw evidence.

#### Scenario: A terminal receipt is missing, duplicated, or stale

- **WHEN** a required stage has no current receipt, more than one competing
  identity, an old/superseded receipt, or a receipt from another source tree
- **THEN** the validator SHALL preserve the stage in `missing`, `duplicate`, or
  `stale` coverage records
- **AND** it SHALL fail closed as `unresolved`; an archive file, closed Issue,
  checked task, or old receipt SHALL not satisfy the stage.

### Requirement: Before and after metrics reference their sole authority

The normalized receipt SHALL include `beforeMetrics` and `afterMetrics` with
`metricId`, `scope`, `unit`, `value`, `sourceReceiptId`, `sourceField`, and
status. Structural dependency/SCC/deep-import/file/center and compile-budget
facts SHALL come from the fitness authority; command/test/tool facts SHALL come
from their command or toolchain authority; domain migration facts SHALL come
from the domain terminal receipt. The closure validator SHALL join and verify
these facts but SHALL NOT recompute them.

#### Scenario: A metric has a valid before/after pair

- **WHEN** both values use the same metric identity, scope, unit, source
  receipt, and declared interpretation
- **THEN** the pair SHALL be retained with its authority identity and totals
- **AND** the global report SHALL expose the pair without changing its value.

#### Scenario: A metric is missing, duplicated, or mismatched

- **WHEN** an after value, unit, source field, authority identity, or matching
  before value is absent, duplicated, or inconsistent
- **THEN** the metric conflict SHALL be retained as unresolved
- **AND** the validator SHALL not infer zero, no-change, ownership, budget
  compliance, or migration completion.

### Requirement: Existing authorities remain the only owners of their facts

The closure capability SHALL use the charter as the sole owner and deprecation
ledger authority, the dependency contract as the sole graph/allowlist
authority, the fitness report as the sole structure-metric/budget authority,
the test/toolchain contracts as the sole command and test-inventory authority,
the QA lifecycle as the sole evidence-class/privacy/retention authority, and
each domain owner as the sole migration/deletion authority. The capability
SHALL NOT create a second graph, owner catalog, ledger, budget, test inventory,
QA lifecycle, or AI state machine.

#### Scenario: The closure joins an upstream fact

- **WHEN** an input is accepted from an authority listed above
- **THEN** the receipt SHALL retain its immutable identity, conclusion, safe
  totals, and owner reference
- **AND** it SHALL not restate or adjudicate the authority's underlying records.

#### Scenario: An alternative aggregator or façade is discovered

- **WHEN** characterization finds another global closure summary, competing
  aggregator, unbounded re-export, or façade claiming the same authority
- **THEN** the candidate SHALL be recorded as an unresolved duplicate authority
- **AND** qualification SHALL fail until only the canonical closure command and
  reader remain; the façade SHALL not count as evidence.

### Requirement: The normalized closure receipt is deterministic and portable

The capability SHALL emit one canonical normalized receipt containing
`schemaVersion`, `sourceIdentity`, sorted `inputReceiptIdentities`,
`beforeMetrics`, `afterMetrics`, `totals`, `terminalCoverage`,
`remainingCompatibilityRecords`, `blockedRecords`, and exactly one status from
`qualified`, `blocked`, `observed`, or `unresolved`. Arrays and keys SHALL be
serialized in stable order, and the receipt identity SHALL be derived from the
normalized bytes. The receipt SHALL contain only portable identities, safe
conclusions, references, and totals; it SHALL not copy raw evidence, secrets,
credentials, user identifiers, answers, cookies, absolute paths, screenshots,
traces, HARs, or logs.

#### Scenario: The same inputs are normalized twice

- **WHEN** source identity, input bytes, receipt identities, and serializer
  version are unchanged
- **THEN** normalized receipt bytes and their digest SHALL be byte-identical
- **AND** no timestamp, random ID, machine path, or newly observed environment
  value may alter the result.

#### Scenario: A new measurement is captured

- **WHEN** a test, toolchain, QA, or domain producer intentionally reruns its
  command
- **THEN** it SHALL provide a new immutable upstream receipt identity
- **AND** the prior closure receipt SHALL remain reproducible and unmodified.

### Requirement: Status and remaining records fail closed

The validator SHALL preserve `remainingCompatibilityRecords` and
`blockedRecords` with record identity, owner, source receipt, reason, and
deletion or resolution condition. It SHALL use these status rules: identity,
freshness, duplicate, denominator, or unresolved-input defects produce
`unresolved`; structurally valid blocked terminals or in-scope blocking
compatibility records produce `blocked`; complete but non-qualifying
observations produce `observed`; only complete, current, all-qualified,
compatibility-closed inputs produce `qualified`.

#### Scenario: A terminal is blocked or compatibility remains

- **WHEN** an otherwise valid input has a `blocked` terminal or an in-scope
  compatibility record without deletion proof
- **THEN** the record SHALL remain in the receipt and status SHALL be `blocked`
- **AND** it SHALL not be promoted to `qualified` by an owner field, extra
  evidence reference, renamed record, or issue closure.

#### Scenario: An input is observed but not qualified

- **WHEN** all identities and denominators are valid but one required conclusion
  is only observational or non-terminal
- **THEN** status SHALL be `observed`
- **AND** the receipt SHALL not imply that the refactor closure or production
  readiness has been established.

### Requirement: Closure validation is read-only and has a narrow consumer

The command and reader SHALL only read declared repository/CI inputs and write
derived receipt, digest, and reader artifacts. They SHALL not mutate upstream
receipts, delete or archive source files, claim work, create or close Issues,
write the database, emit events, deploy, activate runtime, or switch selectors.
The canonical reader SHALL be available to the quality/review control plane
only; product Web/worker, course runtime, Arena, and database code SHALL not
import the closure implementation or private evidence.

#### Scenario: Validation fails or is rolled back

- **WHEN** an identity, terminal, privacy, denominator, or authority check fails
  or the change is rolled back
- **THEN** only a non-qualified derived receipt, its digest, reader, and command
  mapping MAY be removed or replaced
- **AND** all baseline, charter, fitness, QA, toolchain, and domain artifacts
  SHALL remain immutable and unchanged.

#### Scenario: A closure receipt is produced

- **WHEN** the canonical command emits a receipt
- **THEN** its status SHALL describe evidence qualification only
- **AND** receipt production SHALL not be interpreted as production activation
  or completion of work outside the declared closure scope.
