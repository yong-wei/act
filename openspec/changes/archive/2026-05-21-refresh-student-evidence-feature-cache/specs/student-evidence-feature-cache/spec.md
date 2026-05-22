## ADDED Requirements

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
