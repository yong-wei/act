## ADDED Requirements

### Requirement: Derivation answers preserve reveal context
Responses collected from a derivation stage SHALL preserve the reveal step context in which the student answered.

#### Scenario: Student answers during a reveal step
- **WHEN** a student submits an answer from a derivation stage
- **THEN** the response payload SHALL include the active reveal step id, max reveal step seen, visited reveal step ids, and referenced formula block ids when applicable
- **AND** scoring and teacher review SHALL NOT treat answers from different reveal contexts as indistinguishable.

#### Scenario: Student revises after more reveal steps
- **WHEN** a student submits again after additional reveal steps become visible
- **THEN** the response evidence SHALL preserve the earlier reveal-context answer and the later reveal-context answer
- **AND** teacher diagnostics SHALL be able to show where understanding changed.
