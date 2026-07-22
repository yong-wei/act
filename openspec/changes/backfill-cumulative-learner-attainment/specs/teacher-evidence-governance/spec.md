## ADDED Requirements

### Requirement: Teacher attainment views default to cumulative scope
Teacher class insight and heatmap APIs SHALL accept `scope=cumulative|recent`
and SHALL use `cumulative` when scope is omitted. They SHALL preserve existing
class authorization for both scopes.

#### Scenario: Teacher opens an attainment view without scope
- **WHEN** an authorized teacher requests class insights or heatmap without a
  scope query parameter
- **THEN** the API SHALL return cumulative attainment based on the separately
  versioned cumulative class snapshot and current native portraits.

#### Scenario: Teacher explicitly requests recent scope
- **WHEN** an authorized teacher requests `scope=recent`
- **THEN** the API SHALL retain the existing recent evidence window and its
  activity, risk, classroom-quality, and trend semantics.

### Requirement: Cumulative teacher views distinguish attainment from recent signals
Teacher pages and API payloads SHALL label cumulative capability results as
"累计能力达成" and SHALL not manufacture a near-stage change for that scope.

#### Scenario: Cumulative heatmap is shown
- **WHEN** a teacher views the cumulative heatmap
- **THEN** it SHALL show all-history capability values and coverage state
- **AND** it SHALL represent near-stage change as not applicable.

#### Scenario: Recent indicators accompany cumulative attainment
- **WHEN** a cumulative class insight includes risk, classroom-quality, or
  activity indicators
- **THEN** those fields SHALL be explicitly not applicable in the cumulative
  API payload and their risk or spotlight conclusions SHALL be hidden
- **AND** the page SHALL direct the teacher to switch to recent scope for
  recent risk, classroom quality, activity, and trend conclusions.
