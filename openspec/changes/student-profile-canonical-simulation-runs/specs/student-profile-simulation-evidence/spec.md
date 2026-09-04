## ADDED Requirements

### Requirement: Personal profile consumes canonical simulation runs
The system SHALL build the student's ordinary profile simulation statistics and recent activity from student-owned, displayable `SimulationRun` summaries.

#### Scenario: Completed standard run appears in profile
- **WHEN** a student-owned `SimulationRun` has completed status, explicit preview visibility, valid quality metrics, and a stable source reference
- **THEN** `/profile` SHALL include it in simulation count, duration, quality aggregate, and recent simulation activity

#### Scenario: Incomplete run is not presented as training evidence
- **WHEN** a `SimulationRun` is pending, lacks required quality metrics, or fails the displayability contract
- **THEN** the profile SHALL exclude it from completed training statistics and SHALL preserve an explicit empty or unavailable state when no displayable evidence remains

### Requirement: Profile preserves compatibility with legacy simulation logs
The system SHALL include eligible historical `SimulationLog` records when no equivalent canonical `SimulationRun` is available, while preserving the same student ownership and displayability rules.

#### Scenario: Eligible historical log remains visible
- **WHEN** a legacy `SimulationLog` has confirmed student ownership, simulation semantics, completion information, and displayable summary metrics
- **THEN** the profile SHALL expose a student-safe simulation summary for that record

#### Scenario: Legacy and canonical representations refer to one run
- **WHEN** a `SimulationLog` and a `SimulationRun` identify the same underlying simulation artifact
- **THEN** the projection SHALL expose one record and SHALL NOT count the artifact twice

### Requirement: Profile simulation projection preserves learning evidence boundaries
The system SHALL keep simulation profile summaries user-isolated and shall distinguish training evidence from official evaluation and capability attainment.

#### Scenario: Student reads own simulation evidence
- **WHEN** an authenticated student opens `/profile` or `/profile/portfolio`
- **THEN** the response SHALL contain only that student's authorized summaries and SHALL omit raw trace, input payload, and other-user data

#### Scenario: Preview remains non-official
- **WHEN** a displayed simulation record is preview-only
- **THEN** the profile SHALL identify it as training evidence and SHALL NOT count it as an official submission, leaderboard result, or formal capability completion

#### Scenario: Evidence source is unavailable
- **WHEN** the canonical or compatibility source cannot be read or lacks required identity or quality fields
- **THEN** the profile SHALL expose `unavailable` or `empty` semantics and SHALL NOT fabricate zero counts, zero scores, or completion claims

### Requirement: Portfolio simulation records use the same projection
The system SHALL use the same canonical student-safe simulation projection for the simulation section of `/profile/portfolio` as for ordinary profile statistics.

#### Scenario: Portfolio and profile agree
- **WHEN** a student opens both ordinary profile and simulation portfolio views after a displayable run is recorded
- **THEN** both views SHALL refer to the same source identity and SHALL agree on the record's time, quality summary, and preview boundary
