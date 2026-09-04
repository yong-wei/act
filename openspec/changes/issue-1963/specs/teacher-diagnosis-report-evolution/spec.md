## ADDED Requirements

### Requirement: Class diagnosis reports expose a frozen metric evolution board

The interactive teacher class page SHALL render a class-level report evolution board whose data points come exclusively from server-frozen metric snapshots attached to immutable diagnosis reports, never from model prose, summary parsing, or page-load recomputation.

#### Scenario: Board renders the three-layer structure

- **WHEN** a teacher opens the class diagnosis history surface and at least two comparable snapshots exist
- **THEN** the board SHALL show key numeric deltas of the latest report versus the previous one, a switchable single-metric trend chart covering ability dimensions, scores, risk, and weak knowledge points, and a detail list of the most recent 6 snapshots
- **AND** each snapshot entry SHALL show generation time, evidence cutoff time, included-member counts, and metric schema/computation versions.

#### Scenario: Trend points are frozen

- **WHEN** any trend value or delta is displayed
- **THEN** it SHALL be read from a persisted metric snapshot traceable to the same generation job and evidence cutoff as its report
- **AND** it SHALL NOT be derived from report narrative, findings text, or client-side aggregation of current database state.

#### Scenario: Default window is the last six same-scope reports

- **WHEN** the board loads
- **THEN** it SHALL default to the most recent 6 snapshots of the same report scope
- **AND** earlier reports SHALL remain reachable through the existing full report history.

#### Scenario: Evolution stays out of non-interactive deliverables

- **WHEN** a teacher delivery view, print view, student-safe view, or PDF export is produced
- **THEN** the evolution board SHALL NOT be included
- **AND** only the interactive teacher page SHALL render it.

### Requirement: Metric comparability is explicit and fail-closed

Adjacent snapshots SHALL form a continuous trend only when report scope, class member-set identity, evidence coverage basis, metric schema version, and computation version all match; any mismatch SHALL break the trend and disclose the reason.

#### Scenario: Incomparable neighbors break the trend

- **WHEN** two adjacent snapshots differ in member-set identity, coverage basis, or metric schema/computation version
- **THEN** the trend line SHALL break between them
- **AND** the board SHALL state that member scope, coverage, or version changed
- **AND** both reports SHALL remain individually viewable.

#### Scenario: No automatic efficacy claims

- **WHEN** any delta or trend is presented
- **THEN** the board SHALL NOT label it as improvement, deterioration, or teaching effectiveness.

#### Scenario: Legacy reports without snapshots degrade explicitly

- **WHEN** a historical report predates metric snapshots
- **THEN** the board SHALL show that historical metrics are unavailable for it
- **AND** the report body and history identity SHALL be preserved without backfilling or recomputing trend points.

### Requirement: Evolution reads are teacher-authorized and privacy-safe

The evolution read path SHALL enforce teacher class authorization and SHALL NOT expose student identities in snapshot member-set data or board output.

#### Scenario: Teacher requests the evolution board

- **WHEN** an authenticated teacher requests class report evolution data for a class they are authorized for
- **THEN** the server SHALL return only snapshot metrics already frozen at generation time
- **AND** member-set identity SHALL be a class-scoped set fingerprint that does not reveal individual learner ids.

#### Scenario: Unauthorized request is rejected

- **WHEN** a requester lacks teacher authorization for the class
- **THEN** the evolution read SHALL fail closed without returning snapshot data.
