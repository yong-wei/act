## MODIFIED Requirements

### Requirement: Personalization reads governed evidence
The system SHALL use governed evidence, snapshots, summaries, or student evidence feature cache data, including simulation/Arena-derived features, for core profile and recommendation decisions.

#### Scenario: Recommendation consumer reads governed feature data
- **WHEN** a recommendation or profile consumer needs student learning evidence
- **THEN** it SHALL read governed facts, snapshots, summaries, or evidence feature cache data for core profile computation
- **AND** raw source-table reads SHALL be limited to audit, debug, migration, or drilldown paths.

#### Scenario: Existing scope is preserved
- **WHEN** personalization consumers are upgraded to governed evidence
- **THEN** the change SHALL preserve the existing recommendation scope and competency model
- **AND** it SHALL NOT introduce a new AI recommendation engine.

#### Scenario: Simulation features contribute to weak-area rationale
- **WHEN** simulation or Arena-derived feature cache data identifies weak metrics, repeated constraint failures, low replay confidence, or incomplete evidence
- **THEN** personalization output SHALL be able to reference those governed features as rationale with source coverage and confidence metadata

### Requirement: Recommendations expose evidence rationale
The system SHALL expose reason metadata for evidence-driven profile and recommendation outputs, including whether simulation/Arena evidence came from official evaluation, course-launched simulation, standalone simulation, or preview-only activity.

#### Scenario: Recommendation includes reason metadata
- **WHEN** the system returns a recommendation or profile claim based on governed evidence
- **THEN** it SHALL include reason code, evidence window, evidence count, and source coverage metadata where relevant
- **AND** the rationale SHALL be derived from the same governed evidence used for the decision.

#### Scenario: Context-only evidence is not overstated
- **WHEN** passive views, navigation, leaderboard browsing, or other context-only activity appears in a recommendation rationale
- **THEN** the output SHALL identify it as context rather than direct competency improvement evidence
- **AND** it SHALL NOT present context-only events as the sole basis for a high-confidence competency claim.

#### Scenario: Preview-only simulation evidence is used
- **WHEN** a recommendation uses preview-only simulation or Arena evidence
- **THEN** the rationale SHALL identify it as preview-only and SHALL NOT present it as an official evaluation result
