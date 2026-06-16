## ADDED Requirements

### Requirement: Konling path generation uses panel parameters
Konling path-advisor tools SHALL consume the generation panel's structured parameters when assisting path generation or revision.

#### Scenario: Student asks Konling to adjust a path
- **WHEN** the student uses `请控灵调整` from the generation panel or option comparison view
- **THEN** Konling SHALL call the governed path tool with the current form parameters and sanitized natural-language intent
- **AND** it SHALL NOT replace the panel with a generic chat-only workflow.

#### Scenario: Textarea input is provided
- **WHEN** the student types natural-language intent in the panel textarea
- **THEN** the content SHALL be included as a redacted intent summary for the path tool
- **AND** the textarea SHALL be editable in the UI.
