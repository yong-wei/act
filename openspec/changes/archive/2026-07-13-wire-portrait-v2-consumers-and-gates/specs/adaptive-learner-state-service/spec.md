## ADDED Requirements

### Requirement: Learner portrait consumers use portrait v2
Learner-state consumers SHALL treat portrait v2 as the primary learner portrait
for student-facing and personalization-facing behavior.

#### Scenario: Student profile is rendered
- **WHEN** a student profile or growth surface displays learner portrait data
- **THEN** it SHALL render the seven portrait v2 dimensions
- **AND** it SHALL show migrated-data limitations when values are compatibility-derived.

#### Scenario: Learner context is produced
- **WHEN** learner-state context is prepared for adaptive planning, Konling, or diagnostics
- **THEN** weak dimensions, strengths, limitations, and evidence summaries SHALL use portrait v2 ids
- **AND** legacy six-dimensional ids SHALL appear only in compatibility metadata.

#### Scenario: Evidence feature cache is used as fallback
- **WHEN** learner-state service reads `StudentEvidenceFeatureCache` or approved aggregate fallback data
- **THEN** portrait v2 payloads SHALL be versioned or marked as native portrait v2
- **AND** legacy six-dimensional `competencyVector` values SHALL NOT re-enter learner-state as primary portrait dimensions.

#### Scenario: Recommendations are generated
- **WHEN** profile or learner-state code generates personalized recommendations or `LearningRecommendation` rationale
- **THEN** weak-dimension references SHALL use portrait v2 ids, confidence, freshness, and limitation metadata
- **AND** recommendation records SHALL NOT persist legacy six-dimensional ids as primary portrait rationale.
