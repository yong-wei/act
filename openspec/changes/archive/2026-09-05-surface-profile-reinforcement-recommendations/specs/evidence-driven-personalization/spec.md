## MODIFIED Requirements

### Requirement: Recommendations expose evidence rationale
The system SHALL expose reason metadata for evidence-driven profile and recommendation outputs, including whether simulation/Arena evidence came from official evaluation, course-launched simulation, standalone simulation, or preview-only activity. Any profile projection of those recommendations SHALL preserve the recommendation rationale needed to explain the resource and how strong or limited the evidence is.

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

#### Scenario: Profile projects an evidence-backed recommendation
- **WHEN** a governed recommendation is mapped to a student's profile resource card
- **THEN** the card SHALL retain the recommendation reason, confidence state, evidence window, evidence count, source coverage, and owner scope
- **AND** the profile SHALL not replace the recommendation with an unscoped or hardcoded resource.

#### Scenario: Evidence is insufficient for a profile recommendation
- **WHEN** the recommendation is based on missing, stale, partial, low-confidence, or fallback evidence
- **THEN** the profile projection SHALL preserve the limiting state
- **AND** the UI SHALL describe the limitation in student-facing language and offer a bounded next action.
