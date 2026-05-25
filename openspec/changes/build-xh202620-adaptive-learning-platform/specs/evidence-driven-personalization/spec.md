## MODIFIED Requirements

### Requirement: Personalization reads governed evidence
The system SHALL use governed evidence, snapshots, summaries, student evidence feature cache data, learner state, path-plan context, and prerequisite-provided simulation/Arena-derived features for core profile, recommendation, and path-compatible personalization decisions.

#### Scenario: Recommendation consumer reads governed feature data
- **WHEN** a recommendation, profile, learner-state, or path-compatible personalization consumer needs student learning evidence
- **THEN** it SHALL read governed facts, snapshots, summaries, evidence feature cache data, or Learner State Service output for core computation
- **AND** raw source-table reads SHALL be limited to audit, debug, migration, or drilldown paths.

#### Scenario: Existing recommendation scope is preserved
- **WHEN** adaptive path planning is introduced
- **THEN** existing recommendation-card consumers SHALL remain compatible
- **AND** the new path planner SHALL be introduced as a distinct path-plan capability rather than silently changing legacy recommendation semantics.

#### Scenario: Path-compatible personalization is available
- **WHEN** learner state and ResourceNode graph data are sufficient
- **THEN** personalization output SHALL be able to provide path-compatible reason metadata, candidate node hints, and confidence state
- **AND** it SHALL identify whether the output is a legacy recommendation card, a path-planner explanation, or a fallback suggestion.

#### Scenario: Simulation features contribute to weak-area rationale
- **WHEN** prerequisite-provided simulation or Arena-derived feature cache data identifies weak metrics, repeated constraint failures, low replay confidence, preview-only provenance, or incomplete evidence
- **THEN** personalization and path-compatible output SHALL be able to reference those governed features as rationale with source coverage, provenance, and confidence metadata
- **AND** it SHALL NOT reinterpret preview-only or low-confidence simulation/Arena evidence as official high-confidence mastery evidence.

### Requirement: Recommendations expose evidence rationale
The system SHALL expose reason metadata for evidence-driven profile, recommendation, and path-compatible outputs, including whether simulation/Arena evidence came from official evaluation, course-launched simulation, standalone simulation, or preview-only activity.

#### Scenario: Recommendation includes reason metadata
- **WHEN** the system returns a recommendation or profile claim based on governed evidence
- **THEN** it SHALL include reason code, evidence window, evidence count, and source coverage metadata where relevant
- **AND** the rationale SHALL be derived from the same governed evidence used for the decision.

#### Scenario: Path explanation includes reason metadata
- **WHEN** the system returns a path node explanation
- **THEN** it SHALL include learner-state deficit, ResourceNode role, prerequisite reason, evidence basis, confidence, source coverage, and alternative-resource reason metadata where relevant.

#### Scenario: Context-only evidence is not overstated
- **WHEN** passive views, navigation, leaderboard browsing, or other context-only activity appears in a recommendation or path rationale
- **THEN** the output SHALL identify it as context rather than direct competency improvement evidence
- **AND** it SHALL NOT present context-only events as the sole basis for a high-confidence competency claim.

#### Scenario: Preview-only simulation evidence is used
- **WHEN** a recommendation, learner-state claim, or path explanation uses preview-only simulation or Arena evidence
- **THEN** the rationale SHALL identify it as preview-only
- **AND** it SHALL NOT present it as an official evaluation result or as the sole basis for a high-confidence competency or mastery claim.

### Requirement: Low-confidence personalization is explicit
The system SHALL mark missing, stale, partial, or low-confidence evidence in profile, recommendation, learner-state, and path-compatible outputs.

#### Scenario: Missing or stale features produce fallback state
- **WHEN** governed evidence features are missing, stale, partial, or low confidence for a student
- **THEN** personalization output SHALL expose a low-confidence or fallback state
- **AND** it SHALL NOT present the output as a complete precise diagnosis.

#### Scenario: Teacher/admin explanation can inspect confidence
- **WHEN** teacher or admin-facing services expose recommendation, profile, learner-state, or path rationale
- **THEN** they SHALL include enough confidence and source coverage metadata to explain why the recommendation or path claim is strong, weak, stale, or incomplete.
