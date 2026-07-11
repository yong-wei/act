## ADDED Requirements

### Requirement: Personal Center exposes Task Center as the primary task action
The student Personal Center SHALL expose `任务中心` directly beneath the student name card and SHALL preserve class-join access in the class information area.

#### Scenario: Student opens the profile name card
- **WHEN** an authenticated student views `/profile`
- **THEN** the name-card action that previously opened class join SHALL be labeled `任务中心` and route to `/missions`
- **AND** joining a classroom or class SHALL remain available from the class card.

#### Scenario: Student has pending mainline work
- **WHEN** the student has active required assignments
- **THEN** the Task Center action SHALL expose a pending count or equivalent accessible status without disclosing teacher-only grading state.

### Requirement: Missions separates mainline assignments from progression tasks
`/missions` SHALL present teacher-published coursework as the default `主线作业` view and SHALL preserve existing missions and feedback tasks under `任务进阶`.

#### Scenario: Student opens Task Center
- **WHEN** an authenticated student opens `/missions` without a selected tab
- **THEN** the page SHALL default to `主线作业`
- **AND** it SHALL show compact assignment status, deadline, question progress, and next action.

#### Scenario: Student opens progression tasks
- **WHEN** the student selects `任务进阶`
- **THEN** existing Mission/UserProgress and feedback-task behavior SHALL remain available without being migrated into assignment records.

### Requirement: Students see only assignments for authorized audiences
The system SHALL deliver an assignment revision only to students who belong to an active audience class and SHALL enforce schedule and visibility policy server-side.

#### Scenario: Authorized student opens an active assignment
- **WHEN** a student belongs to the assignment audience and the assignment is available
- **THEN** the student SHALL see the assigned immutable revision, instructions, questions, points, response rules, deadline, and current submission state.

#### Scenario: Student is outside the audience
- **WHEN** a student requests an assignment not addressed to their active classes
- **THEN** the system SHALL reject access without returning question content, answers, assets, or grading metadata.

#### Scenario: Student leaves the class after submitting
- **WHEN** a student no longer has current class membership but owns a historical submitted question attempt
- **THEN** policy-permitted historical access SHALL use the frozen student, assignment, and submission ownership record
- **AND** the student SHALL NOT gain access to assignments or submissions owned by other audiences.

### Requirement: Every question has an independent answer and asset lifecycle
The system SHALL persist text, attachments, draft state, upload state, submitted state, and attempt history separately for each assignment question.

#### Scenario: Student saves one question
- **WHEN** a student saves or uploads an answer for one question
- **THEN** only that question answer version SHALL change
- **AND** other question drafts or submitted answers SHALL remain unchanged.

#### Scenario: Student uploads a document answer
- **WHEN** a question permits a supported document response
- **THEN** the upload SHALL be bound to that question answer with ownership, object reference, MIME, size, checksum, scan state, and timestamps
- **AND** raw document bytes SHALL NOT be embedded in generic JSON workflow records or application logs.

#### Scenario: Student replaces a draft attachment
- **WHEN** a student selects another file before formally submitting the question
- **THEN** the system SHALL create a new object and asset version
- **AND** it SHALL NOT overwrite a finalized or previously submitted object.

#### Scenario: Student attempts a whole-assignment upload
- **WHEN** a client attempts to attach one document without a target assignment question
- **THEN** the system SHALL reject the upload contract
- **AND** it SHALL NOT segment or infer question ownership from the document.

### Requirement: Each question is submitted and sealed independently
The system SHALL provide a question-level submit action that validates and atomically seals one explicit answer version into a numbered question attempt.

#### Scenario: One question answer is ready
- **WHEN** the student submits a ready answer before or according to deadline policy
- **THEN** the system SHALL seal only that question answer version, record its attempt and submitted timestamp, and leave other question drafts unchanged.

#### Scenario: Question answer or asset is incomplete
- **WHEN** the selected question is empty, an upload is unfinished, or its asset failed validation
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

#### Scenario: Server signs an upload
- **WHEN** assignment, audience, question, response type, ownership, length, MIME, and checksum intent pass validation
- **THEN** the server SHALL generate an opaque quarantine object key and a method/object/purpose-bound upload URL with a maximum ten-minute TTL
- **AND** it SHALL NOT persist or log the complete bearer URL.

#### Scenario: Client finalizes an upload
- **WHEN** the client requests asset finalization
- **THEN** the server SHALL reauthorize the request and verify object key, expected owner intent, size, MIME, checksum, and scan state through object metadata before recording an immutable finalized asset.

#### Scenario: Authorized actor reads an object
- **WHEN** an authorized student, teacher, or worker requests a source object for an allowed purpose
- **THEN** the server SHALL perform a fresh assignment/answer/purpose authorization check and issue access with a maximum ten-minute TTL
- **AND** original documents SHALL use attachment download or isolated preview with trusted content headers, `nosniff`, and private no-store caching.

#### Scenario: Quarantine object is unsafe or abandoned
- **WHEN** an upload fails validation, scanning, finalization, or the configured quarantine window
- **THEN** it SHALL NOT become a submission asset and SHALL be revoked and garbage-collected with an auditable tombstone.

### Requirement: Student assignment states expose a valid next action
Task Center and assignment detail SHALL present authoritative assignment and question states with a clear next action and recoverable error state.

#### Scenario: Mainline assignments are loading
- **WHEN** Task Center is resolving the student's mainline assignment scope
- **THEN** the page SHALL show a non-deceptive loading state that preserves the current tab and does not present stale counts as final.

#### Scenario: Student has no mainline assignments
- **WHEN** the authorized assignment query returns no current or historical mainline work
- **THEN** the page SHALL show a true empty state with a clear explanation and retain access to `任务进阶`.

#### Scenario: Assignment filters have no matches
- **WHEN** mainline assignments exist but the current status or course filters return no rows
- **THEN** the page SHALL show a filtered-empty state with a clear-filter action rather than the no-assignment message.

#### Scenario: Assignment state changes downstream
- **WHEN** conversion, AI grading, teacher review, approval, return, or deadline processing changes assignment state
- **THEN** the student view SHALL display the current permitted state and next action without exposing unapproved draft scores or comments.

#### Scenario: Assignment context is missing or stale
- **WHEN** a saved route references a removed audience, unavailable revision, or stale attempt
- **THEN** the page SHALL show a recoverable missing-context state and a return action to `/missions` rather than a generic failure page.

### Requirement: Task Center remains usable across student viewport and input modes
The student assignment journey SHALL remain operable at 320px, 375px, 1024px, and desktop widths with keyboard, screen-reader, and non-color state cues.

#### Scenario: Student uses a mobile viewport
- **WHEN** the assignment list or detail renders at a supported mobile width
- **THEN** question navigation, upload state, deadline, validation messages, and each `提交本题` action SHALL remain reachable without horizontal page scrolling.

#### Scenario: Student uses keyboard or assistive technology
- **WHEN** the student navigates tabs, question status, upload controls, or submission errors without a pointer
- **THEN** focus order, accessible names, error associations, and state text SHALL expose the same operation and status information.

#### Scenario: Student changes the active question
- **WHEN** the student selects another question through question navigation
- **THEN** focus SHALL move to that question heading or answer region and its submitted/draft state SHALL be announced.

#### Scenario: Question submission succeeds
- **WHEN** `提交本题` completes successfully
- **THEN** focus SHALL move to the submitted-state confirmation for that question and provide a direct next-unsubmitted-question action when one exists.

#### Scenario: Question submission fails or retry completes
- **WHEN** validation, upload, deadline, network, or service failure prevents submission
- **THEN** focus SHALL move to the error summary and then the first affected control through an explicit link
- **AND** retry or history return SHALL restore focus to the originating question and operation result.

### Requirement: Student submission mutations are protected and abuse-bounded
Every autosave, upload-signing, finalization, and question-submission mutation SHALL require authenticated non-GET requests, strict Origin or CSRF validation, runtime schemas, payload bounds, resource authorization, idempotency where applicable, and rate or quota controls.

#### Scenario: Cross-site or forged submission is attempted
- **WHEN** a request lacks valid Origin or CSRF proof, references another student's answer, or uses an unauthorized assignment/question id
- **THEN** the system SHALL reject it before issuing storage access or changing answer state.

#### Scenario: Upload or mutation exceeds policy
- **WHEN** a client exceeds signing frequency, file size/count, body size, field length, autosave rate, or submission retry limits
- **THEN** the system SHALL reject or throttle the request without exposing a reusable signed URL or partially mutating the answer.
