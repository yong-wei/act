## ADDED Requirements

### Requirement: Standalone Copilot entry presentation matches governed learning context
The standalone `/ai/copilot` page SHALL derive its welcome copy, capability statements, suggested questions, input example, limitation state and adjacent actions from the current server-governed task context and available student-safe projections. The page MUST NOT present a fixed simulation, control method, engineering standard, runtime state or personal evidence as the current student's context when that context is not bound and authorized.

#### Scenario: Student opens Copilot without a bound task
- **WHEN** an authenticated student opens `/ai/copilot` without a registered task context
- **THEN** the page SHALL present a neutral learning-assistance state with general concept, reflection and planning actions
- **AND** it SHALL state that no specific course step, simulation state or personal evidence is currently bound.

#### Scenario: Generic entry has no simulation runtime
- **WHEN** the neutral entry has no authorized simulation state or simulation tool binding
- **THEN** the welcome copy, suggested questions and input example SHALL NOT claim current simulation access, ship-control context, PID tuning, Nomoto data or CCS review
- **AND** selecting a suggested question SHALL NOT request unavailable simulation runtime data.

#### Scenario: Student enters portfolio reflection
- **WHEN** the current registered task is `portfolio-reflection`
- **THEN** the page SHALL present reflection-specific goals, candidate-draft questions and the existing explicit portfolio action
- **AND** it SHALL NOT describe the candidate as an already saved learning record.

#### Scenario: Student enters Evidence Copilot
- **WHEN** the current registered task is `evidence-copilot`
- **THEN** the page SHALL align its copy and suggested questions with the server-authorized evidence projection
- **AND** missing or unavailable evidence SHALL produce a limitation state and a real adjacent evidence-creation or learning action.

#### Scenario: Client supplies an unregistered context value
- **WHEN** the URL contains an unsupported `context`, `source`, `assignment` or `intent` combination
- **THEN** the page SHALL fall back to the neutral entry or reject the invalid task descriptor
- **AND** it SHALL NOT present the client text as verified learning context, evidence or capability.

#### Scenario: Entry presentation is verified in the browser
- **WHEN** representative neutral, reflection and evidence states are rendered at desktop and 320px widths
- **THEN** each visible capability and adjacent action SHALL be executable in that state
- **AND** the page SHALL preserve keyboard focus, readable text and no horizontal overflow.

