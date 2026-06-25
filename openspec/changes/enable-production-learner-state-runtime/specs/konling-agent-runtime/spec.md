## ADDED Requirements

### Requirement: Konling degrades personalization without blocking cited replies
Konling SHALL use learner-state and path-execution data when available, but missing personalization data SHALL not prevent content-grounded cited answers.

#### Scenario: Learner-state is available
- **WHEN** Konling answers a student and the Learner State Service returns authorized learner-state data
- **THEN** Konling SHALL use that data to shape answer scope, style, emphasis, and personalized recommendations
- **AND** learner-state citation metadata SHALL be available to the response guard.

#### Scenario: Learner-state is missing
- **WHEN** Konling answers a student and learner-state data is sparse, missing, or low confidence
- **THEN** Konling SHALL still generate a response with verified teaching-content citations when content citations are available
- **AND** the response SHALL mark personalization as limited rather than failing retrieval.

#### Scenario: Path execution is missing
- **WHEN** Konling answers outside an active path execution context or the learner has no path execution records
- **THEN** Konling SHALL not require path-execution citations for ordinary concept explanations
- **AND** path advice or personalized recommendation responses SHALL disclose the missing path-execution context as a personalization limitation.

#### Scenario: Production learner-state service is disabled
- **WHEN** production Konling detects that the learner-state service flag is disabled
- **THEN** the runtime SHALL record an operational missing-context diagnostic
- **AND** it SHALL still answer with available teaching-content citations where possible instead of treating the disabled flag as a content citation failure.
