## MODIFIED Requirements

### Requirement: Student evidence feature cache is rebuildable
The system SHALL maintain a per-student evidence feature cache that is deterministically rebuildable from governed evidence, learner-state source records, assessment records, ResourceNode execution, path feedback, and prerequisite-provided simulation/Arena feature groups, including governed simulation/Arena learning facts and compact trace summaries.

#### Scenario: Full rebuild produces stable payload
- **WHEN** a full feature-cache rebuild is run against unchanged governed evidence
- **THEN** the generated feature payload for a student SHALL remain stable across repeated rebuilds
- **AND** the cache SHALL record the feature payload version used for generation.

#### Scenario: Simulation and Arena features are consumed from prerequisites
- **WHEN** the cache includes simulation or Arena features
- **THEN** it SHALL consume the feature groups exposed by `materialize-simulation-features-for-personalization`
- **AND** it SHALL preserve prerequisite semantics for compact feature derivation, source ids, protocol versions, launch provenance, replay confidence, official versus preview provenance, weak metric summaries, and low-confidence reasons
- **AND** it SHALL NOT redefine trace, replay, coverage, or Arena evaluation semantics in this change.

#### Scenario: Simulation summary evidence is rebuilt
- **WHEN** governed simulation or Arena learning facts contain trace references, summary metrics, source ids, protocol versions, launch provenance, official or preview provenance, and replay confidence
- **THEN** the rebuilt feature payload SHALL derive deterministic compact simulation/Arena features from prerequisite-provided summaries and feature groups
- **AND** it SHALL NOT scan raw high-frequency trace payloads during normal feature rebuild.

#### Scenario: Per-student refresh updates changed evidence
- **WHEN** governed evidence changes for a student
- **THEN** the system SHALL support refreshing that student's cache entry without requiring unrelated student entries to be rewritten
- **AND** the refreshed entry SHALL expose the refresh timestamp.

### Requirement: Cache exposes freshness and evidence coverage
The system SHALL expose freshness, coverage, and confidence metadata with each student evidence feature cache entry, including learner-state, resource-preference, media-absorption, path-execution, and intervention-outcome feature groups.

#### Scenario: Feature entry includes source windows
- **WHEN** a student evidence feature cache entry is read
- **THEN** it SHALL include evidence windows, source counts, source coverage, and last refresh time for the features it contains.

#### Scenario: Partial evidence is marked
- **WHEN** a student's governed evidence is missing, stale, partial, or low confidence
- **THEN** the feature cache SHALL mark that state explicitly
- **AND** downstream consumers SHALL be able to distinguish low-confidence features from complete evidence.

### Requirement: Normal consumers use governed feature reads
The system SHALL provide a governed read boundary for student evidence features so profile, learner-state, path-planning, personalization, Konling, and teacher-insight consumers do not rescan raw source tables for core profile computation.

#### Scenario: Consumer reads feature service
- **WHEN** a profile, recommendation, learner-state, path-planning, Konling, or teacher-insight consumer needs student evidence features
- **THEN** it SHALL read from the governed feature cache service or governed facts
- **AND** raw source-table reads SHALL be limited to audit, debug, migration, or drilldown paths.

#### Scenario: Raw trace is not a normal feature source
- **WHEN** a normal profile, recommendation, learner-state, path-planning, Konling, or teacher-insight consumer needs simulation-derived features
- **THEN** it SHALL use governed summaries, facts, or feature cache entries instead of directly scanning high-frequency trace samples
- **AND** any drilldown that resolves trace references SHALL remain scoped by privacy, teacher authorization, and hidden official-evaluation boundaries.

#### Scenario: Missing cache is handled explicitly
- **WHEN** a consumer requests features for a student whose cache is missing
- **THEN** the read service SHALL return an explicit missing or stale state
- **AND** it SHALL NOT silently synthesize high-confidence personalization features from incomplete evidence.

### Requirement: Feature cache refreshes after governed evidence changes
The system SHALL refresh or enqueue refresh of a student evidence feature cache entry after governed facts, snapshots, assessment records, ResourceNode execution, path feedback, intervention outcomes, or learner-state source records change for that student.

#### Scenario: Snapshot job refreshes cache
- **WHEN** a student snapshot job completes successfully
- **THEN** the corresponding StudentEvidenceFeatureCache entry is refreshed with updated timestamp and source windows.

#### Scenario: Path feedback refreshes cache
- **WHEN** a student adopts, completes, skips, or rates a learning path node
- **THEN** the student's feature cache SHALL be refreshed or queued for refresh
- **AND** downstream path and Konling consumers SHALL be able to see the updated execution evidence.

### Requirement: Feature cache exposes recent and all-time windows
The cache SHALL distinguish recent learner-facing evidence windows from all-time audit windows for activity, competency contribution, mastery, resource preference, media absorption, path execution, and intervention outcome features.

#### Scenario: Thirty-day and all-time features are present
- **WHEN** a cache entry is rebuilt
- **THEN** it includes recent and all-time activity and competency contribution summaries
- **AND** it includes recent and all-time summaries for adaptive-learning feature groups where source evidence exists.
