## ADDED Requirements

### Requirement: Recommendation explanations expose verifiable learning events
The adaptive learning center SHALL display student-safe event references within candidate-path recommendation explanations, including event type, occurrence time, readable summary, affected judgment, affected resources, and a valid student navigation action.

#### Scenario: Candidate path has sufficient event evidence
- **WHEN** a student expands recommendation provenance containing event references
- **THEN** the center displays each reference's type, occurrence time, summary, affected judgment and affected resources
- **AND** provides the source-specific safe navigation action

#### Scenario: Candidate path has low-confidence evidence
- **WHEN** event references exist but the associated judgment is low confidence
- **THEN** the center labels the evidence limitation and does not claim that the event directly selected a specific resource

#### Scenario: Candidate path has no verifiable event reference
- **WHEN** provenance contains only aggregate evidence or no evidence
- **THEN** the center explains that no verifiable event-level record is available
- **AND** does not present unrelated recent learning records as recommendation evidence

#### Scenario: Event reference is opened
- **WHEN** a student activates an event reference action
- **THEN** navigation uses the existing safe destination for that evidence source
- **AND** never exposes an internal source identifier in the URL

### Requirement: Active path nodes expose their historical event basis
The adaptive learning center SHALL display persisted event references in an active node's historical selection explanation separately from current readiness and latest adjustment state.

#### Scenario: Active node contains historical event references
- **WHEN** a student expands an active node whose selection basis includes event references
- **THEN** the center displays those references under the historical selection explanation
- **AND** current lock, completion, skip, or adjustment state is displayed separately

#### Scenario: Active node predates event-reference support
- **WHEN** a student expands an active node without persisted event references
- **THEN** the center shows the existing legacy evidence limitation without inventing event history

#### Scenario: Event evidence is viewed at supported widths
- **WHEN** candidate or active-node event evidence is rendered at desktop width or 320px mobile width
- **THEN** labels, timestamps, summaries and actions remain readable without overlap or horizontal clipping
