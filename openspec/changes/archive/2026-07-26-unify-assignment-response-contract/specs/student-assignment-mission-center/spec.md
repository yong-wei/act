## MODIFIED Requirements

### Requirement: Every question has an independent answer and asset lifecycle
The system SHALL persist Markdown text, embedded image assets, ordered independent attachments, draft state, upload state, submitted state, and attempt history separately for each assignment question.

#### Scenario: Student saves one question
- **WHEN** a student saves text, inserted images, uploaded attachments, or attachment order for one question
- **THEN** only that question answer version SHALL change
- **AND** other question drafts or submitted answers SHALL remain unchanged.

#### Scenario: Student uploads a document answer
- **WHEN** a student uploads PDF, DOC, DOCX, PPTX, PNG, JPEG, Markdown, or plain text for a question
- **THEN** the upload SHALL be bound to that question answer with ownership, object reference, MIME, size, checksum, scan state, timestamps, and order
- **AND** raw attachment bytes SHALL NOT be embedded in generic JSON workflow records or application logs.

#### Scenario: Student inserts an image in response text
- **WHEN** the embedded response editor creates an image asset reference
- **THEN** that image SHALL be bound to the same question answer as a submission asset
- **AND** it SHALL count toward the same attachment limit as independent uploads.

#### Scenario: Student replaces a draft attachment
- **WHEN** a student selects another file before formally submitting the question
- **THEN** the system SHALL create a new object and asset version
- **AND** it SHALL NOT overwrite a finalized or previously submitted object.

#### Scenario: Student attempts a whole-assignment upload
- **WHEN** a client attempts to attach one document without a target assignment question
- **THEN** the system SHALL reject the upload contract
- **AND** it SHALL NOT segment or infer question ownership from the document.

#### Scenario: Student reorders attachments
- **WHEN** the student submits a complete ordered list of the current question's independent attachment identities against the current answer revision
- **THEN** the server SHALL atomically persist that order
- **AND** it SHALL reject missing, duplicate, foreign, or stale asset lists without partially reordering the answer.

### Requirement: Each question is submitted and sealed independently
The system SHALL provide a question-level submit action that validates and atomically seals one explicit unified answer version into a numbered question attempt.

#### Scenario: One question answer is ready
- **WHEN** the student submits a response containing non-empty text, at least one eligible attachment, or both before or according to deadline policy
- **THEN** the system SHALL seal only that question's text snapshot, attachment identities, and attachment order
- **AND** it SHALL record the attempt and submitted timestamp while leaving other question drafts unchanged.

#### Scenario: Question answer or asset is incomplete
- **WHEN** the selected question has neither non-empty text nor an eligible attachment, an upload is unfinished, or an asset failed validation
- **THEN** that question submission SHALL fail without sealing an attempt
- **AND** the response SHALL identify the required correction without mutating other questions.

#### Scenario: Question submission request is repeated
- **WHEN** the same valid question-submission idempotency key is received more than once
- **THEN** the system SHALL return the original question attempt rather than creating duplicates.

#### Scenario: All required questions are submitted
- **WHEN** every required assignment question has a valid submitted attempt
- **THEN** the server SHALL derive the aggregate assignment state as `已提交` without requiring a second whole-assignment sealing action.

### Requirement: Submission assets use a private S3-compatible object-store contract
The system SHALL provide a production S3-compatible private object-store adapter, quarantine/finalization lifecycle, immutable asset versions, and purpose-bound signed access; a local filesystem adapter SHALL be limited to test and local development.
Active upload signing, finalization, and submission SHALL consume the unified response contract, while legacy response-type fields SHALL remain audit-only.

#### Scenario: Server signs an upload
- **WHEN** assignment, audience, question, unified-answer ownership, combined attachment count, allowed format, length, MIME, and checksum intent pass validation
- **THEN** the server SHALL generate an opaque quarantine object key and a method/object/purpose-bound upload URL with a maximum ten-minute TTL
- **AND** it SHALL NOT require or branch on a legacy `TEXT`, `FILE`, or response-type value
- **AND** it SHALL NOT persist or log the complete bearer URL.

#### Scenario: Client finalizes an upload
- **WHEN** the client requests asset finalization
- **THEN** the server SHALL reauthorize the unified question answer and verify object key, expected owner intent, combined attachment limit, allowed format, size, MIME, checksum, and scan state through object metadata before recording an immutable finalized asset
- **AND** a legacy response-type field SHALL NOT make an otherwise valid unified attachment ineligible.

#### Scenario: Authorized actor reads an object
- **WHEN** an authorized student, teacher, or worker requests a source object for an allowed purpose
- **THEN** the server SHALL perform a fresh assignment/answer/purpose authorization check and issue access with a maximum ten-minute TTL
- **AND** original documents SHALL use attachment download or isolated preview with trusted content headers, `nosniff`, and private no-store caching.

#### Scenario: Quarantine object is unsafe or abandoned
- **WHEN** an upload fails validation, scanning, finalization, or the configured quarantine window
- **THEN** it SHALL NOT become a submission asset and SHALL be revoked and garbage-collected with an auditable tombstone.

## ADDED Requirements

### Requirement: Unified response attachments are bounded and format-governed
The system SHALL allow at most ten attachment assets per question answer, counting embedded images and independent attachments together, and SHALL preserve the existing per-file size limit.

#### Scenario: Attachment set is within policy
- **WHEN** the combined unique embedded-image and independent-attachment count is ten or fewer and every asset satisfies the per-file limit and allowed format
- **THEN** the answer draft MAY retain those assets subject to ownership, integrity, and scan-state checks.

#### Scenario: Attachment count exceeds policy
- **WHEN** signing, finalization, editor save, reorder, or submission would make the combined unique attachment count exceed ten
- **THEN** the server SHALL reject that mutation without partially changing the answer
- **AND** it SHALL return a structured error that identifies the attachment-count limit.

#### Scenario: Attachment format is not supported
- **WHEN** an asset is ODT, XLS, XLSX, or otherwise outside PDF, DOC, DOCX, PPTX, PNG, JPEG, Markdown, and plain text
- **THEN** signing or finalization SHALL reject the asset
- **AND** the structured error SHALL include the teacher- and student-visible allowed-format set without exposing an internal error code as the message.

### Requirement: Legacy response rules migrate without rewriting frozen history
The system SHALL provide one compatibility projection that treats legacy `TEXT`, `FILE`, and equivalent published response rules as unified responses while preserving frozen publication and attempt history and recording attachment-order provenance.

#### Scenario: Existing revision is read through compatibility projection
- **WHEN** an existing published question contains a legacy response rule
- **THEN** teacher and student APIs SHALL expose unified text-plus-attachment behavior
- **AND** the original response field, content hash, revision identity, and historical submission associations SHALL remain unchanged.

#### Scenario: New response is submitted against a legacy revision
- **WHEN** a student submits text, supported attachments, or both against that revision
- **THEN** the server SHALL validate and persist the new unified answer contract
- **AND** it SHALL NOT reject the response solely because the historical rule was `TEXT` or `FILE`.

#### Scenario: Historical attachment order is explicitly student-arranged
- **WHEN** durable historical evidence proves the order selected by the student
- **THEN** the compatibility projection SHALL preserve that order with `student-arranged` provenance.

#### Scenario: Historical attachment order has no student provenance
- **WHEN** durable historical evidence cannot prove a student-selected order
- **THEN** migration SHALL persist a deterministic `legacy-fallback` order and provenance
- **AND** it SHALL NOT describe or expose that order as student-arranged
- **AND** it SHALL NOT rewrite the legacy publication snapshot, content hash, or attempt payload.

#### Scenario: Historical order migration is repeated
- **WHEN** dry-run or apply is repeated for the same immutable historical attachment set
- **THEN** it SHALL produce the same fallback order and provenance
- **AND** apply SHALL remain idempotent.
