# assignment-authoring-and-publication Specification

## Purpose
TBD - created by archiving change establish-assignment-authoring-domain. Update Purpose after archive.
## Requirements
### Requirement: Assignments have durable identity and immutable publication revisions
The system SHALL persist assignments as first-class records with stable identity, teacher ownership, one mutable pre-publication draft, immutable published revisions, timestamps, and lifecycle state.

#### Scenario: Teacher saves and publishes one assignment
- **WHEN** an authorized teacher saves and publishes content within the same assignment editing task
- **THEN** every save, publication operation, and resulting revision SHALL remain bound to the same stable assignment identity
- **AND** repeated publication SHALL NOT create a second student-visible assignment identity.

#### Scenario: Teacher publishes a draft revision
- **WHEN** an authorized teacher publishes a valid draft whose current content is successfully saved, matches the teacher's current editor content, and has no version conflict
- **THEN** the system SHALL atomically create or return the immutable numbered published revision for that saved baseline
- **AND** the publication operation SHALL NOT perform an additional draft save.

#### Scenario: Teacher publishes while a local save is pending
- **WHEN** the current content is saving, save-failed, conflicted, or differs from the last successfully saved draft revision
- **THEN** publication SHALL remain unavailable and no published revision or audience SHALL be created
- **AND** the editor SHALL identify the save or conflict recovery action.

#### Scenario: Existing submission references an older revision
- **WHEN** a newer assignment revision is published after a student received or submitted an older revision
- **THEN** the student's assignment and grading records SHALL continue to reference the originally assigned immutable revision.

### Requirement: Teachers can manage assignments through an assignment workspace
The system SHALL provide authorized teachers with assignment list, create, edit, preview, save-draft, publish, and lifecycle management surfaces.

#### Scenario: Teacher opens assignment management
- **WHEN** a teacher opens `/teacher/assignments`
- **THEN** the page SHALL show assignments with draft, published, review, returned, completed, or closed state as applicable
- **AND** it SHALL expose class audience, schedule, submission totals when available, and the next valid action.

#### Scenario: Teacher edits an assignment
- **WHEN** a teacher opens a new or existing draft
- **THEN** the editor SHALL expose a question outline, assignment settings, preview, draft save, and publish controls
- **AND** each question SHALL expose `题面`, `参考答案`, `评分标准`, response type, and points as primary fields.

### Requirement: Assignment questions preserve source and content snapshots
Every assignment question SHALL persist an immutable prompt, reference answer, rubric, point value, response type, source lineage, and content hash within the assignment revision.

#### Scenario: Teacher selects a governed question-bank item
- **WHEN** a teacher adds an eligible catalog item to an assignment draft
- **THEN** the system SHALL snapshot the item content, answer, rubric, source family, source identity, source hash, review state, and version references.

#### Scenario: Catalog item is not eligible for assignment authoring
- **WHEN** an item is not path-eligible, does not allow low-stakes practice, or carries unresolved limitations
- **THEN** the server SHALL omit or disable it in the assignment catalog projection
- **AND** SHALL reject direct materialization attempts regardless of client-supplied metadata.

#### Scenario: Source question changes later
- **WHEN** the original question-bank content or metadata changes after publication
- **THEN** the published assignment question SHALL remain unchanged
- **AND** audit views SHALL retain the original source hash and snapshot version.

#### Scenario: Teacher creates a question manually
- **WHEN** a teacher creates a new subjective question in the assignment editor
- **THEN** the system SHALL store it through the same question snapshot contract with an assignment-authoring source marker.

### Requirement: Every published subjective question has an analytic rubric
The system SHALL require each published subjective assignment question to include a versioned analytic rubric with stable criterion identifiers, criterion maximums, observable evidence, performance levels, and feedback guidance.
All assignment, question, criterion, and performance-level scores SHALL use at most two decimal places. Performance levels SHALL cover each criterion from its maximum to zero on a descending, non-overlapping, gap-free `0.01` score grid.

#### Scenario: Teacher defines a rubric
- **WHEN** a teacher edits a subjective question rubric
- **THEN** the editor SHALL allow criteria, maximum points, observable evidence, level descriptions or score bands, and feedback guidance to be defined and reordered.

#### Scenario: Rubric lacks gradable evidence
- **WHEN** a rubric criterion lacks a stable id, positive maximum, or observable evidence description
- **THEN** the system SHALL block publication and identify the affected question and criterion.

### Requirement: Publication validates all score scales without silent rescaling
The system MUST block assignment publication unless the assignment total, question totals, and rubric criterion totals are internally consistent.

#### Scenario: Totals agree
- **WHEN** assignment total equals the sum of question points and every question point value equals the sum of its rubric criterion maximums
- **THEN** score consistency SHALL pass the publication gate.

#### Scenario: Totals disagree
- **WHEN** any assignment, question, criterion, or rubric-level score scale conflicts
- **THEN** publication SHALL fail with a teacher-visible reconciliation result
- **AND** the system SHALL NOT silently normalize, rescale, or select one source as authoritative.

### Requirement: Publication binds authorized class audiences and policies
The system SHALL bind published assignment revisions to explicit class audiences, availability dates, due dates, late policy, response policy, and resubmission policy.
Every question response type SHALL be included in the assignment revision's allowed response types; inconsistent drafts SHALL be blocked with a field-specific recovery target.

#### Scenario: Teacher publishes to managed classes
- **WHEN** a teacher selects classes they are authorized to manage and supplies a valid schedule
- **THEN** publication SHALL create audience records that preserve the assigned revision and policy snapshot.
- **AND** the editor SHALL discover active managed classes from an authorized server projection rather than requiring internal class identifiers as free text.

#### Scenario: Teacher selects an unauthorized class
- **WHEN** a teacher attempts to publish to a class outside their authorized scope
- **THEN** the system SHALL reject publication before any audience receives the assignment.

### Requirement: Student payloads do not disclose protected grading material
Assignment delivery contracts SHALL separate student-visible question content from teacher-only reference answers, rubric internals, and publication controls.

#### Scenario: Student reads an active assignment
- **WHEN** an authorized student requests an assigned revision before grading feedback is approved
- **THEN** the response SHALL include only student-visible instructions, questions, points, response rules, schedule, and submission state
- **AND** it SHALL NOT disclose reference answers or teacher-only rubric guidance.

#### Scenario: Grading finishes without a solution release policy
- **WHEN** feedback is approved but no active versioned solution-release policy permits publication
- **THEN** reference answers and teacher-only rubric guidance SHALL remain private.

#### Scenario: Teacher releases a solution
- **WHEN** an authorized teacher activates a solution-release policy for a specific assignment revision, audience, and release time
- **THEN** only the policy-approved student solution material SHALL become visible
- **AND** teacher-only rubric guidance SHALL remain protected unless separately declared student-visible.

### Requirement: Assignment history uses explicit current and frozen authorization
The system SHALL distinguish current class membership used for new delivery from frozen ownership and explicit review grants used for historical assignment access.

#### Scenario: Student leaves a class after submitting
- **WHEN** a student is removed from the current class after owning a submission
- **THEN** the student SHALL retain policy-permitted access to their own historical assignment, submission, and approved feedback through the frozen ownership record.

#### Scenario: Class teacher changes
- **WHEN** a new teacher is assigned to a class with historical submissions
- **THEN** the teacher SHALL NOT automatically gain document-review access unless an explicit audited assignment-review grant or transfer authorizes it.

#### Scenario: Audience or class is archived
- **WHEN** an assignment audience is removed or a class is closed
- **THEN** historical revisions and submissions SHALL remain read-only and SHALL NOT be cascade-deleted.

### Requirement: Assignment mutations are protected and bounded
Every assignment-authoring mutation SHALL require an authenticated non-GET request, strict Origin or CSRF validation, runtime input schemas, bounded payloads, resource authorization, and applicable idempotency and rate limits.

#### Scenario: Cross-site publication request is attempted
- **WHEN** an authenticated browser session sends a publication mutation without valid Origin or CSRF proof
- **THEN** the system SHALL reject the request before changing assignment or audience state.

#### Scenario: Mutation payload is malformed or excessive
- **WHEN** a request contains unknown fields, invalid enums, over-limit text, excessive questions, or an unauthorized resource id
- **THEN** the system SHALL reject the request with no partial assignment mutation.

### Requirement: Teacher authoring exposes complete operational states
The assignment list and editor SHALL provide loading, empty, filtered-empty, recoverable error, stale-context, conflict, and publication-blocked states with keyboard-operable recovery actions.

#### Scenario: Teacher has no assignments or a filter has no matches
- **WHEN** the list has no assignments or the current filters produce no rows
- **THEN** the page SHALL distinguish the two states and expose the appropriate create or clear-filter action.

#### Scenario: Draft becomes stale or fails to load
- **WHEN** the editor detects a stale version, missing draft, authorization change, or recoverable service failure
- **THEN** it SHALL preserve safe local input where possible, explain the conflict, and expose reload, return, or retry without silent overwrite.

#### Scenario: Teacher uses a narrow viewport
- **WHEN** assignment management renders below 768px
- **THEN** assignment status and navigation SHALL remain available with a clear continue-on-tablet-or-desktop message
- **AND** the system SHALL NOT present an apparently complete but unusable rubric editor.

#### Scenario: Teacher uses keyboard navigation
- **WHEN** the teacher moves through the question outline, editor regions, validation errors, or publication controls without a pointer
- **THEN** focus order, error association, focus restoration, and accessible names SHALL preserve the complete authoring workflow at supported editing widths.

### Requirement: Inactive classes are excluded from assignment publication

Assignment publication SHALL reject inactive class audiences before any
revision or audience mutation.

#### Scenario: Administrator selects an inactive class

- **WHEN** an administrator requests publication for a class whose `isActive`
  state is false
- **THEN** the server SHALL reject publication before freezing the revision or
  creating audience rows
- **AND** the inactive class SHALL NOT receive the assignment.

### Requirement: Assignment publication is idempotent and has one completion flow
Publication SHALL deduplicate equivalent requests for the same stable assignment identity and saved publication baseline and SHALL leave the editor through one successful completion flow.

#### Scenario: Equivalent publication request is repeated
- **WHEN** the same saved publication baseline is submitted more than once because of a double-click, network retry, or concurrent request
- **THEN** every request SHALL return the first successful publication result
- **AND** the system SHALL NOT create an additional published revision or audience set.

#### Scenario: Publication succeeds
- **WHEN** publication commits successfully
- **THEN** the client SHALL immediately return to the teacher assignment list
- **AND** the list SHALL show and locate the published assignment using its stable identity and teacher-visible class names rather than internal class identifiers.

### Requirement: Historical duplicate publications are repaired without losing lineage
The system SHALL provide an auditable and idempotent repair for historical duplicate published versions that preserves all student submission and grading lineage.

#### Scenario: Duplicate version has no dependent submission
- **WHEN** a historical duplicate published version has no student submission, grading review, or other retained dependent record
- **THEN** the repair MAY delete that duplicate version
- **AND** it SHALL record the affected stable assignment and version in the repair result.

#### Scenario: Duplicate version has dependent submissions
- **WHEN** a historical duplicate published version has any student submission or grading dependency
- **THEN** the repair SHALL preserve it as a read-only historical version
- **AND** it SHALL NOT break its submission, review, feedback, or audit associations.

#### Scenario: Repair selects current publication
- **WHEN** duplicate versions for one provable stable assignment have been classified
- **THEN** exactly one current published version SHALL enter the student assignment list
- **AND** ambiguous identity groups SHALL remain unchanged and be reported for manual resolution.

