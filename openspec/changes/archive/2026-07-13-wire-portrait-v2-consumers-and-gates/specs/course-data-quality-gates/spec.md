## ADDED Requirements

### Requirement: Legacy six-dimensional primary usage is gated
Repository gates SHALL prevent new primary learner portrait writes or exposed
student-facing contracts from reverting to the legacy six-dimensional model.

#### Scenario: New primary write uses legacy model
- **WHEN** a gate scans changed learner portrait code
- **AND** it finds a new primary write of six-dimensional `CompetencyVector` outside an approved compatibility adapter
- **THEN** the gate SHALL fail with the file and symbol responsible.

#### Scenario: Student-facing contract exposes legacy primary model
- **WHEN** a profile, learner-state, planner, or Konling contract exposes learner portrait data
- **THEN** the gate SHALL verify that portrait v2 is primary
- **AND** legacy dimensions SHALL be allowed only as explicit compatibility metadata.

#### Scenario: Recommendation or cache contract exposes legacy primary model
- **WHEN** recommendation generation, `LearningRecommendation` persistence, or `StudentEvidenceFeatureCache` payloads expose portrait-related rationale or aggregates
- **THEN** the gate SHALL verify portrait v2 ids, confidence, freshness, and limitation metadata are primary
- **AND** legacy six-dimensional values SHALL be allowed only inside explicitly named compatibility fields.

#### Scenario: Class-level portrait aggregation is checked
- **WHEN** class competency snapshots, teacher insights, or analytics dashboards expose class portrait summaries
- **THEN** the gate SHALL verify portrait v2 dimension labels and limitation metadata
- **AND** it SHALL fail if teacher-facing aggregation silently uses six-dimensional labels as the current primary model.
