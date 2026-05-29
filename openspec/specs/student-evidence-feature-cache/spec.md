# student-evidence-feature-cache Specification

## Purpose
Define the governed per-student evidence feature cache used by profile, recommendation, and teacher-insight consumers so derived evidence can be rebuilt deterministically from approved source facts and aggregates.
## Requirements
### Requirement: Student evidence feature cache is rebuildable
The system SHALL maintain a per-student evidence feature cache that is deterministically rebuildable from governed evidence, assessment records, learner-state source records, ResourceNode execution, path feedback, intervention outcomes, and prerequisite-provided simulation/Arena feature groups.

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

#### Scenario: Simulation and Arena features are consumed
- **WHEN** the cache includes simulation or Arena feature groups
- **THEN** it SHALL consume the outputs of `materialize-simulation-features-for-personalization`
- **AND** it SHALL NOT redefine trace, replay, coverage, or Arena evaluation semantics.

### Requirement: Cache exposes freshness and evidence coverage
The system SHALL expose freshness, coverage, and confidence metadata with each student evidence feature cache entry.

#### Scenario: Feature entry includes source windows
- **WHEN** a student evidence feature cache entry is read
- **THEN** it SHALL include evidence windows, source counts, source coverage, and last refresh time for the features it contains.

#### Scenario: Partial evidence is marked
- **WHEN** a student's governed evidence is missing, stale, partial, or low confidence
- **THEN** the feature cache SHALL mark that state explicitly
- **AND** downstream consumers SHALL be able to distinguish low-confidence features from complete evidence.

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

### Requirement: Feature cache refreshes after governed evidence changes
The system SHALL refresh or enqueue refresh of a student evidence feature cache entry after governed facts or snapshots change for that student.

#### Scenario: Snapshot job refreshes cache
- **WHEN** a student snapshot job completes successfully
- **THEN** the corresponding StudentEvidenceFeatureCache entry is refreshed with updated timestamp and source windows

### Requirement: Feature cache exposes recent and all-time windows
The cache SHALL distinguish recent learner-facing evidence windows from all-time audit windows.

#### Scenario: Thirty-day and all-time features are present
- **WHEN** a cache entry is rebuilt
- **THEN** it includes recent and all-time activity and competency contribution summaries

### Requirement: Cache exposes adaptive-learning freshness and coverage
The system SHALL expose freshness, source coverage, and confidence metadata for adaptive learner-state feature groups.

#### Scenario: Feature entry is read
- **WHEN** a student evidence feature cache entry is read for learner state
- **THEN** it SHALL include evidence windows, source counts, source coverage, last refresh time, and confidence markers for the features it contains.

### Requirement: Feature cache consumes materialized simulation and agent evidence
Student evidence feature cache SHALL consume materialized SimulationRun, Arena preview, and AgentToolRun evidence through governed facts, summaries, or drafts rather than raw traces or raw memory.

#### Scenario: Cache rebuild includes simulation-agent evidence
- **WHEN** the feature cache rebuilds for a student with materialized simulation or agent evidence
- **THEN** it SHALL derive deterministic feature groups from owner-scoped LearningFacts, evidence drafts, run summaries, replay confidence, and source provenance
- **AND** it SHALL NOT scan raw high-frequency trace samples for normal profile features.

#### Scenario: Cache rebuild is cross-user safe
- **WHEN** the cache rebuilds for one student
- **THEN** it SHALL use only evidence owned by that student unless a future shared-team evidence spec explicitly allows another scope.

### Requirement: Feature cache marks simulation-agent confidence
Student evidence feature cache SHALL expose confidence, freshness, source coverage, preview/official provenance, and low-evidence markers for simulation and agent-derived feature groups.

#### Scenario: Preview-only evidence contributes context
- **WHEN** preview-only Arena or simulation evidence is present
- **THEN** the feature cache SHALL mark it as preview-only context or low-confidence competency evidence according to materialization policy.
