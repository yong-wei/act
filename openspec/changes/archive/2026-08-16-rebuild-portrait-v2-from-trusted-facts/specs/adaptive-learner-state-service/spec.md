## MODIFIED Requirements

### Requirement: Learner portrait consumers use portrait v2
Learner-state consumers SHALL treat portrait v2 as the primary learner portrait
for student-facing and personalization-facing behavior. When the current
cumulative portrait is `NO_EVIDENCE`, consumers SHALL fail closed and SHALL NOT
fall back to a legacy snapshot, feature cache, old
`StudentCompetencySnapshot`, or old competency vector.

#### Scenario: Student profile is rendered
- **WHEN** a student profile or growth surface displays learner portrait data
- **THEN** it SHALL render the seven portrait v2 dimensions
- **AND** it SHALL show migrated-data limitations when values are compatibility-derived
- **AND** it SHALL render `NO_EVIDENCE` when the current portrait has no trusted evidence.

#### Scenario: Learner context is produced
- **WHEN** learner-state context is prepared for adaptive planning, Konling, or diagnostics
- **THEN** weak dimensions, strengths, limitations, and evidence summaries SHALL use portrait v2 ids
- **AND** legacy six-dimensional ids SHALL appear only in compatibility metadata.

#### Scenario: Evidence feature cache is used as fallback
- **WHEN** learner-state service reads `StudentEvidenceFeatureCache` or approved aggregate fallback data
- **THEN** portrait v2 payloads SHALL be versioned or marked as native portrait v2
- **AND** legacy six-dimensional `competencyVector` values SHALL NOT re-enter learner-state as primary portrait dimensions
- **AND** fallback data SHALL NOT replace a current `NO_EVIDENCE` state unless it is trusted governed evidence.

#### Scenario: Recommendations are generated
- **WHEN** profile or learner-state code generates personalized recommendations or `LearningRecommendation` rationale
- **THEN** weak-dimension references SHALL use portrait v2 ids, confidence, freshness, and limitation metadata
- **AND** recommendation records SHALL NOT persist legacy six-dimensional ids as primary portrait rationale
- **AND** if the current portrait is `NO_EVIDENCE`, personalized recommendations SHALL fail closed.

#### Scenario: NO_EVIDENCE is read as current state
- **WHEN** learner-state returns `NO_EVIDENCE` as the current trusted portrait
- **THEN** consumers SHALL NOT read legacy `StudentPortraitV2Snapshot`, `StudentEvidenceFeatureCache`, `StudentCompetencySnapshot`, or legacy competency vector values as portrait input
- **AND** the learner SHALL be treated as having no trusted evidence for personalization.

### Requirement: Learner portrait is cumulative and evidence-triggered
The learner-state service SHALL expose one canonical cumulative portrait v2
formed from all trusted eligible learning facts for the learner. The portrait
SHALL remain usable until trusted governed evidence or a calculation-version
change produces a replacement state. Elapsed calendar time and activity-window
membership SHALL NOT create, replace, expire, or suppress that state.

#### Scenario: Portrait is read without newer evidence
- **WHEN** a learner has a valid cumulative portrait and no newer eligible trusted fact
- **THEN** student, teacher, diagnosis, and class consumers SHALL receive the same portrait values
- **AND** the response SHALL expose the evidence cutoff without marking the portrait unavailable because of age.

#### Scenario: New eligible evidence is accepted
- **WHEN** a new trusted fact passes governance and has an explicit portrait contribution
- **THEN** the learner's cumulative portrait SHALL be incrementally updated
- **AND** the update SHALL preserve unaffected dimensions and evidence lineage.

#### Scenario: Fact has no portrait contribution
- **WHEN** a trusted fact is valid for activity history but cannot map to a portrait dimension, trend, or risk
- **THEN** it SHALL NOT change the cumulative portrait
- **AND** it SHALL NOT be counted as portrait-supporting evidence.

#### Scenario: Trusted and non-trusted facts coexist
- **WHEN** a learner has both trusted and non-trusted LearningFacts
- **THEN** the cumulative portrait SHALL be built only from trusted facts
- **AND** non-trusted facts SHALL NOT affect scores, confidence, trend, risk, or portrait lineage.

#### Scenario: Only non-trusted facts exist
- **WHEN** a learner has only non-trusted LearningFacts or no trusted facts
- **THEN** the current portrait SHALL be `NO_EVIDENCE` with an explicit availability reason
- **AND** no dimension score SHALL be derived from non-trusted facts.
