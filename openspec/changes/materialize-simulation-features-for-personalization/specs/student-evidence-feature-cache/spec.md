## MODIFIED Requirements

### Requirement: Student evidence feature cache is rebuildable
The system SHALL maintain a per-student evidence feature cache that is deterministically rebuildable from governed evidence, including governed simulation and Arena learning facts and compact trace summaries.

#### Scenario: Full rebuild produces stable payload
- **WHEN** a full feature-cache rebuild is run against unchanged governed evidence
- **THEN** the generated feature payload for a student SHALL remain stable across repeated rebuilds
- **AND** the cache SHALL record the feature payload version used for generation.

#### Scenario: Per-student refresh updates changed evidence
- **WHEN** governed evidence changes for a student
- **THEN** the system SHALL support refreshing that student's cache entry without requiring unrelated student entries to be rewritten
- **AND** the refreshed entry SHALL expose the refresh timestamp.

#### Scenario: Simulation summary evidence is rebuilt
- **WHEN** governed simulation or Arena learning facts contain trace references, summary metrics, source ids, protocol versions, and replay confidence
- **THEN** the rebuilt feature payload SHALL derive deterministic compact simulation/Arena features without scanning raw high-frequency trace payloads

### Requirement: Normal consumers use governed feature reads
The system SHALL provide a governed read boundary for student evidence features so profile, recommendation, and teacher-insight consumers do not rescan raw source tables or raw simulation traces for core profile computation.

#### Scenario: Consumer reads feature service
- **WHEN** a profile, recommendation, or teacher-insight consumer needs student evidence features
- **THEN** it SHALL read from the governed feature cache service or governed facts
- **AND** raw source-table reads SHALL be limited to audit, debug, migration, or drilldown paths.

#### Scenario: Missing cache is handled explicitly
- **WHEN** a consumer requests features for a student whose cache is missing
- **THEN** the read service SHALL return an explicit missing or stale state
- **AND** it SHALL NOT silently synthesize high-confidence personalization features from incomplete evidence.

#### Scenario: Raw trace is not a normal feature source
- **WHEN** a normal profile, recommendation, or teacher-insight consumer needs simulation-derived features
- **THEN** it SHALL use governed summaries, facts, or feature cache entries instead of directly scanning high-frequency trace samples
