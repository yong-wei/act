# student-evidence-feature-cache Specification

## Purpose
Define the governed per-student evidence feature cache used by profile, recommendation, and teacher-insight consumers so derived evidence can be rebuilt deterministically from approved source facts and aggregates.

## Requirements
### Requirement: Student evidence feature cache is rebuildable
The system SHALL maintain a per-student evidence feature cache that is deterministically rebuildable from governed evidence.

#### Scenario: Full rebuild produces stable payload
- **WHEN** a full feature-cache rebuild is run against unchanged governed evidence
- **THEN** the generated feature payload for a student SHALL remain stable across repeated rebuilds
- **AND** the cache SHALL record the feature payload version used for generation.

#### Scenario: Per-student refresh updates changed evidence
- **WHEN** governed evidence changes for a student
- **THEN** the system SHALL support refreshing that student's cache entry without requiring unrelated student entries to be rewritten
- **AND** the refreshed entry SHALL expose the refresh timestamp.

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
The system SHALL provide a governed read boundary for student evidence features so profile and personalization consumers do not rescan raw source tables for core profile computation.

#### Scenario: Consumer reads feature service
- **WHEN** a profile, recommendation, or teacher-insight consumer needs student evidence features
- **THEN** it SHALL read from the governed feature cache service or governed facts
- **AND** raw source-table reads SHALL be limited to audit, debug, migration, or drilldown paths.

#### Scenario: Missing cache is handled explicitly
- **WHEN** a consumer requests features for a student whose cache is missing
- **THEN** the read service SHALL return an explicit missing or stale state
- **AND** it SHALL NOT silently synthesize high-confidence personalization features from incomplete evidence.
