## MODIFIED Requirements

### Requirement: AI tasks must produce scoped outputs
The system SHALL map audited AI and Prompt actions to explicit task outputs such as practice tasks, feedback writeback, prompt evaluation results, or portfolio drafts. A portfolio reflection candidate becomes durable only when the authenticated student explicitly saves its bounded displayed content; the persisted result SHALL remain a candidate draft and SHALL not automatically write a formal portfolio record, learning fact, learner portrait, or official score.

#### Scenario: Report feedback AI creates practice task candidates
- **WHEN** AI is invoked for report feedback remediation
- **THEN** the UI shows scoped practice task candidates and an adopt/discard/writeback path

#### Scenario: Portfolio reflection creates draft
- **WHEN** a student uses Copilot or portfolio reflection create intent
- **THEN** the system creates or displays a draft/candidate object rather than returning to a generic AI page

#### Scenario: Student explicitly saves a portfolio reflection candidate
- **WHEN** a student saves the displayed portfolio reflection candidate
- **THEN** the system stores a learner-scoped candidate draft that can be reopened without promoting it to formal learning evidence
