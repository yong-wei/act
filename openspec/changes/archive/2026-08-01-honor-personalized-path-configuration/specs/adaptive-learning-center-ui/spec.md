## ADDED Requirements

### Requirement: Adaptive path comparison exposes configuration fulfillment
The adaptive learning center SHALL render a student-safe configuration-fulfillment summary with generated path options. The summary SHALL identify which requested settings were applied, their planning effect where available, and which settings were unmet with an actionable reason; it SHALL not expose internal reason codes or raw free-text input.

#### Scenario: Generated options honor configuration
- **WHEN** path generation returns one or more options with fulfilled configuration entries
- **THEN** the comparison interface SHALL show the applied settings and their path effect in student-facing language
- **AND** the information SHALL remain associated with the generation result rather than only server diagnostics.

#### Scenario: Configuration or intent is unmet
- **WHEN** the planner returns an unmet configuration or unsupported free-text intent entry
- **THEN** the interface SHALL show a student-safe explanation and a corrective action where one exists
- **AND** it SHALL not claim that the unmet entry personalized the displayed options.

#### Scenario: Option count is reduced for lack of diversity
- **WHEN** the planner returns fewer than the preferred number of options because no meaningful alternative is feasible
- **THEN** the interface SHALL present the retained options as valid choices
- **AND** it SHALL explain the reduced count without rendering cosmetic placeholder options.

#### Scenario: Requested time is insufficient
- **WHEN** generation returns a minimum executable duration that exceeds the student's requested budget
- **THEN** the interface SHALL show the requested and minimum durations in student-facing language
- **AND** it SHALL offer an adjustment action without implying that the requested budget was silently changed.
