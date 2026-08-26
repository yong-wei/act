# QA Evidence Artifact Lifecycle

## ADDED Requirements

### Requirement: QA evidence has explicit lifecycle classes

QA evidence SHALL be classified as a deterministic representative fixture, a
portable manifest/receipt, a run-specific output, or a canonical audit/closure
document. Each item SHALL have a source revision, owner, privacy class, and
retention decision; unclassified evidence SHALL fail closed.

#### Scenario: A new screenshot is produced

- **WHEN** a capture run emits a screenshot, trace, HAR, or log
- **THEN** it is recorded as a run-specific output with a content hash and
  external storage reference
- **AND** it is not silently treated as a product fixture

### Requirement: Product runtime cannot import run-specific evidence

The web, runtime, simulation, and control-workbench graphs SHALL NOT import
timestamped run directories, screenshots, traces, HARs, logs, or local
`artifacts/` paths. They MAY consume deterministic fixtures or validated typed
manifest metadata through an approved evidence package.

#### Scenario: A review page renders evidence

- **WHEN** a review page or product surface needs visual evidence
- **THEN** it resolves a deterministic fixture or a validated published package
  by manifest identity
- **AND** a local/nightly run output is not a runtime dependency

### Requirement: Evidence manifests are revision-bound and portable

Every accepted evidence manifest or receipt SHALL bind route, theme, viewport,
role, browser/tool version, source/tree revision, capture revision, output
hash/reference, privacy class, and status. Paths SHALL be portable relative
paths or content-addressed external references and SHALL NOT expose credentials,
user identifiers, or private raw evidence.

#### Scenario: A stale output is supplied

- **WHEN** a manifest's source/capture revision or output hash does not match the
  declared run
- **THEN** governance verification fails closed
- **AND** the stale artifact cannot satisfy a product or release gate

### Requirement: Large run outputs are externalized

Screenshots, traces, HARs, logs, and temporary staging outputs SHALL be stored
in CI artifact storage or approved object storage, with repository manifests and
necessary representative fixtures retained as the source-controlled index.

#### Scenario: CI evidence is published

- **WHEN** a visual QA run completes
- **THEN** the repository receives only the manifest/receipt and any deliberately
  retained representative fixture
- **AND** the large output can be fetched and hash-verified from its external
  reference

### Requirement: Privacy and retention gates are fail closed

Evidence publication SHALL reject credentials, cookies, local absolute paths,
learner/user identifiers, raw answers, private audit evidence, and unknown
retention classes. Deletion or retention decisions SHALL be explicit and
auditable.

#### Scenario: Private content is found in a run output

- **WHEN** a privacy scan detects a forbidden value or missing retention class
- **THEN** publication fails before the output becomes a public/runtime input
- **AND** the receipt records the failure without reproducing the secret

### Requirement: Migration removes obsolete run artifacts with receipts

After all product references are migrated, obsolete tracked run outputs SHALL be
deleted only from an explicit, hashed deletion/retention manifest. Canonical
fixtures and audit-ledger documents SHALL be retained according to their owner.

#### Scenario: A historical run output is retired

- **WHEN** its consumers resolve a fixture or external reference and its
  retention decision permits removal
- **THEN** the exact path and hash are recorded in a deletion receipt
- **AND** no unclassified artifact is deleted

