## ADDED Requirements

### Requirement: Students edit unified responses with ordered attachments
The student assignment detail SHALL provide one question-level response editor that combines the shared embedded Markdown editor with an ordered independent-attachment list and the authoritative question submission state.

#### Scenario: Student edits response text
- **WHEN** the student enters Markdown or inserts an image through file selection, drag-and-drop, or paste
- **THEN** the response editor SHALL use the shared embedded content editor
- **AND** it SHALL display the combined embedded-image and independent-attachment count against the ten-asset limit.

#### Scenario: Student adds independent attachments
- **WHEN** the student selects or drags supported files onto the question response
- **THEN** each file SHALL appear in the same question's attachment list with a clear upload state
- **AND** the list SHALL display explicit sequence numbers.

#### Scenario: Student reorders attachments
- **WHEN** the student drags an attachment or uses keyboard-operable move controls
- **THEN** the editor SHALL submit the complete new order against the current answer revision
- **AND** it SHALL explain that automatic grading reads independent attachments in that order and recommend ordering them by importance.

#### Scenario: Client detects an upload problem
- **WHEN** a selected file has an unsupported format, exceeds the existing per-file size limit, or would exceed ten combined assets
- **THEN** the editor SHALL reject it before upload and identify the specific problem in Chinese
- **AND** it SHALL display the allowed format set and the applicable limit.

#### Scenario: Server rejects an upload or answer mutation
- **WHEN** the server returns a structured format, size, count, ownership, integrity, conflict, or quota error
- **THEN** the editor SHALL associate a Chinese message with the affected file or question control
- **AND** it SHALL NOT expose `invalid-payload` or another internal error code as the student-visible message.

#### Scenario: Attachment state changes
- **WHEN** an attachment is waiting, uploading, finalized, failed, retrying, or being removed
- **THEN** the list SHALL expose that state through text and accessible status
- **AND** failure recovery SHALL preserve other completed attachments and response text.

#### Scenario: Student submits the question
- **WHEN** the response contains non-empty text or at least one eligible attachment and no upload is incomplete
- **THEN** the editor SHALL allow `提交本题`, expose submitting and submitted states, and move focus to the result
- **AND** an empty response or incomplete upload SHALL produce an error summary linked to the first affected control.

#### Scenario: Unified editor renders on mobile
- **WHEN** the response editor renders at 320px or 375px
- **THEN** text editing, file selection, sequence, move controls, validation, and `提交本题` SHALL remain reachable without horizontal page scrolling.

