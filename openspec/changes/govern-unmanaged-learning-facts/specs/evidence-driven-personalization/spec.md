## MODIFIED Requirements

### Requirement: Personalization reads governed evidence
The system SHALL use governed evidence, snapshots, summaries, or student evidence feature cache data, including simulation/Arena-derived features, for core profile and recommendation decisions.

#### Scenario: Recommendation consumer reads governed feature data
- **WHEN** a recommendation or profile consumer needs student learning evidence
- **THEN** it SHALL read governed facts, snapshots, summaries, or evidence feature cache data for core profile computation
- **AND** raw source-table reads SHALL be limited to audit, debug, migration, or drilldown paths

#### Scenario: Unmanaged LearningFact is excluded from personalization
- **WHEN** a LearningFact lacks complete evidence governance
- **THEN** recommendation activity, evidence coverage, feature-cache aggregation, and learner-state preference inputs SHALL exclude it
- **AND** it SHALL not become the basis of a personalized claim

#### Scenario: Existing scope is preserved
- **WHEN** personalization consumers are upgraded to governed evidence
- **THEN** the change SHALL preserve the existing recommendation scope and competency model
- **AND** it SHALL NOT introduce a new AI recommendation engine
