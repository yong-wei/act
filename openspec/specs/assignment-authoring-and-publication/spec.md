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
- **THEN** the editor SHALL show assignment title and instructions once before the question editing region
- **AND** the left outline SHALL show `从题库选择`, `新建题目`, and the ordered current question list
- **AND** the main region SHALL expose the selected question prompt, reference answer, points, scoring criteria, optional detailed rubric, draft state, preview, publication settings, and publish controls.

#### Scenario: Teacher views question-bank metadata
- **WHEN** the assignment workspace displays source, question type, review state, version, or grading-readiness metadata
- **THEN** every supported value SHALL use a centralized Chinese label
- **AND** the page SHALL NOT expose raw internal enum values or identifiers.

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
The system SHALL require each published subjective assignment question to contain one or more ordered scoring items with stable identifiers, names, maximum points, a natural-language scoring standard, and an optional detailed rubric composed of evaluation levels.
Scoring-item maximums, evaluation-level maximums, AI-suggested scores, teacher-revised scores, and final scores SHALL use one decimal place, and each scoring-item maximum SHALL be at least 1.0 point.

#### Scenario: Teacher defines a rubric
- **WHEN** a teacher edits a subjective question rubric
- **THEN** the editor SHALL allow ordered scoring items, maximum points, scoring standards, optional detailed levels, and feedback guidance to be defined and reordered.

#### Scenario: Teacher defines a scoring item without detailed rubric
- **WHEN** a teacher leaves the optional detailed rubric disabled
- **THEN** the scoring standard SHALL be required for publication
- **AND** automatic grading SHALL score directly against that standard from zero through the scoring-item maximum.

#### Scenario: Teacher creates a new scoring item
- **WHEN** a teacher adds a scoring item
- **THEN** its detailed rubric SHALL default to disabled
- **AND** no evaluation level SHALL be required unless the teacher explicitly enables it.

#### Scenario: Teacher enables detailed rubric
- **WHEN** a teacher enables the optional detailed rubric for a scoring item
- **THEN** the system SHALL maintain ordered evaluation levels containing a name, maximum score, and scoring guideline
- **AND** every level scoring guideline SHALL be required for publication while the general scoring standard MAY be empty.

#### Scenario: Rubric lacks gradable evidence
- **WHEN** a scoring item lacks a stable id, has a maximum below 1.0, lacks its required scoring standard, or contains an enabled level without a scoring guideline
- **THEN** the system SHALL block publication and identify the affected question, scoring item, and field.

#### Scenario: Default level values are created
- **WHEN** the system creates an evaluation-level name or maximum score
- **THEN** that value SHALL be a real publishable value
- **AND** the teacher's first typed or pasted replacement SHALL replace the default rather than append to it.

### Requirement: Publication validates all score scales without silent rescaling
The system MUST block assignment publication unless the assignment total, question totals, scoring-item totals, and enabled evaluation-level ranges are internally consistent on a one-decimal score grid.

#### Scenario: Totals agree
- **WHEN** assignment total equals the sum of question points and every question point value equals the sum of its scoring-item maximums
- **THEN** score consistency SHALL pass the publication gate if every enabled detailed rubric also forms valid ordered ranges.

#### Scenario: Totals disagree
- **WHEN** any assignment, question, scoring-item, or evaluation-level score scale conflicts
- **THEN** publication SHALL fail with a teacher-visible reconciliation result
- **AND** the system SHALL NOT silently normalize, rescale, or select one source as authoritative.

#### Scenario: Totals and level ranges agree
- **WHEN** the assignment total equals the sum of question points, each question point value equals the sum of its scoring-item maximums, and every enabled detailed rubric forms valid ordered ranges from the scoring-item maximum to zero
- **THEN** score consistency SHALL pass the publication gate.

#### Scenario: Totals or ranges disagree
- **WHEN** any assignment, question, scoring-item, or evaluation-level score scale conflicts
- **THEN** publication SHALL fail with a teacher-visible reconciliation result
- **AND** the system SHALL NOT silently normalize, rescale, or select one source as authoritative.

### Requirement: Publication binds authorized class audiences and policies
The system SHALL bind published assignment revisions to explicit class audiences, availability dates, due dates, late policy, unified response policy, and resubmission policy.
Every published question SHALL permit a response containing text, attachments, or both under the unified response contract; legacy response-type fields SHALL remain frozen only for historical audit and SHALL NOT restrict active authoring or student submission.

#### Scenario: Teacher publishes to managed classes
- **WHEN** a teacher selects classes they are authorized to manage and supplies a valid schedule
- **THEN** publication SHALL create audience records that preserve the assigned revision and policy snapshot
- **AND** the editor SHALL discover active managed classes from an authorized server projection rather than requiring internal class identifiers as free text.

#### Scenario: Teacher selects an unauthorized class
- **WHEN** a teacher attempts to publish to a class outside their authorized scope
- **THEN** the system SHALL reject publication before any audience receives the assignment.

#### Scenario: Legacy response type is present
- **WHEN** a frozen assignment revision contains `TEXT`, `FILE`, or another legacy response-type value
- **THEN** the server SHALL still accept text, supported attachments, or both under the unified response contract
- **AND** it SHALL preserve the original snapshot field, content hash, and historical submission associations for audit.

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

### Requirement: Evaluation levels use deterministic ranges and score correction
The system SHALL derive each enabled evaluation level's minimum from adjacent descending maximums, assign every shared boundary to the higher level, and constrain suggested scores to the selected level's legal one-decimal range.

#### Scenario: Adjacent levels share a boundary
- **WHEN** a 100-point scoring item has descending level maximums of 100.0, 90.0, and 80.0
- **THEN** the highest level SHALL include 90.0 through 100.0
- **AND** the next level SHALL include 80.0 through 89.9.

#### Scenario: Suggested score exceeds selected level
- **WHEN** automatic grading selects a level but suggests a score above its inclusive or exclusive upper bound or below its lower bound
- **THEN** the platform SHALL clamp the score to the nearest legal one-decimal value in that level
- **AND** the persisted final score SHALL use one decimal place.

#### Scenario: Teacher edits a level maximum
- **WHEN** a teacher changes a non-highest level maximum
- **THEN** the system SHALL reorder complete level records by maximum score descending
- **AND** each level name, scoring guideline, and score SHALL remain attached to the same record.

#### Scenario: Teacher attempts to edit the highest maximum
- **WHEN** a scoring item's maximum changes or a teacher targets the highest level maximum
- **THEN** the highest level maximum SHALL remain synchronized to the scoring-item maximum
- **AND** it SHALL NOT be independently editable.

### Requirement: Detailed rubric supports governed incremental levels
The system SHALL create and extend evaluation levels using deterministic names and maximum-score rules while preserving at least a 0.1-point legal interval.

#### Scenario: Teacher enables detailed rubric for the first time
- **WHEN** the detailed rubric changes from disabled to enabled
- **THEN** the system SHALL create only an `优秀` level whose range covers zero through the scoring-item maximum.

#### Scenario: Teacher adds levels sequentially
- **WHEN** the teacher adds levels after `优秀`
- **THEN** the next initial names SHALL be `良好`, `中等`, `及格`, and `不及格` in that order
- **AND** their default maximums SHALL be 90%, 80%, 70%, and 60% of the scoring-item maximum respectively, rounded upward to one decimal place
- **AND** the sixth and later level initial name SHALL be `自定义`.

#### Scenario: Custom level uses ratio extension
- **WHEN** the teacher adds a sixth or later custom level and at least two existing level maximums establish a ratio
- **THEN** the new default maximum SHALL extend the ratio between the last two maximums and round upward to one decimal place.

#### Scenario: Rounded extension repeats a maximum
- **WHEN** sixth-or-later ratio extension rounds to the same maximum as the preceding lower level
- **THEN** the new level maximum SHALL be 0.1 point below the preceding level
- **AND** the system SHALL reject the addition when no interval of at least 0.1 point remains.

### Requirement: Detailed rubric shortcuts preserve teacher content
The system SHALL provide five-level and two-level shortcuts and SHALL preserve all existing level records that fit in the target count unless the teacher confirms removal.

#### Scenario: Empty rubric uses five-level shortcut
- **WHEN** a teacher applies the five-level shortcut to an unedited blank detailed rubric
- **THEN** the levels SHALL be named `优秀`, `良好`, `中等`, `及格`, and `不及格`
- **AND** their maximums SHALL be 100%, 90%, 80%, 70%, and 60% of the scoring-item maximum, rounded upward to one decimal place, with the lowest range extending to zero.

#### Scenario: Empty rubric uses two-level shortcut
- **WHEN** a teacher applies the two-level shortcut to an unedited blank detailed rubric
- **THEN** the levels SHALL be `通过` and `不通过`
- **AND** 60% of the scoring-item maximum SHALL be the boundary assigned to `通过`, while `不通过` extends to zero.

#### Scenario: Shortcut removes levels
- **WHEN** the shortcut target has fewer levels than the current rubric
- **THEN** the system SHALL identify the trailing records and content that will be discarded and require teacher confirmation
- **AND** after confirmation it SHALL remove only those trailing records and extend the lowest retained range to zero.

#### Scenario: Shortcut adds levels to edited content
- **WHEN** the shortcut target has more levels than a rubric containing teacher-edited records
- **THEN** the system SHALL preserve existing names, scoring guidelines, and maximums
- **AND** it SHALL extend the missing levels using the last-two-maximum ratio, using standard names and percentages only where no teacher-edited content exists.

### Requirement: AI-assisted detailed rubric authoring remains teacher-directed
The system SHALL provide an emphasized AI-fill action for an enabled detailed rubric and SHALL generate scoring guidelines for the complete current set of evaluation levels without changing the rubric structure.

#### Scenario: Scoring standard is available
- **WHEN** the teacher requests AI fill and the scoring item has a non-empty scoring standard
- **THEN** the system SHALL use that standard as the primary generation basis
- **AND** it SHALL generate one scoring guideline for every current evaluation-level identity.

#### Scenario: Scoring standard is missing
- **WHEN** the teacher requests AI fill and the scoring standard is empty
- **THEN** the system SHALL open a dialog that allows the teacher to add the scoring standard before generation or explicitly ignore the omission
- **AND** choosing to add it SHALL save it through the normal draft contract before generation continues.

#### Scenario: Teacher ignores the missing scoring standard
- **WHEN** the teacher explicitly continues without a scoring standard
- **THEN** the system SHALL use the scoring-item name as the generation basis
- **AND** it SHALL make that reduced basis clear before sending the request.

#### Scenario: No generation basis exists
- **WHEN** both the scoring standard and scoring-item name are empty
- **THEN** the system SHALL reject generation and identify the fields that can provide a valid basis.

#### Scenario: Existing level content would be replaced
- **WHEN** any evaluation level already contains a teacher-entered scoring guideline
- **THEN** the system SHALL warn that the operation replaces all level scoring guidelines and require explicit confirmation
- **AND** cancellation SHALL preserve every existing guideline without sending a generation request.

#### Scenario: Generated level set is incomplete or stale
- **WHEN** generated output omits, duplicates, or invents a level identity, violates field bounds, or targets a changed draft revision
- **THEN** the system SHALL reject the complete generated set
- **AND** it SHALL NOT partially replace the current level guidelines.

#### Scenario: Generated guidelines are accepted
- **WHEN** the complete output matches the current evaluation-level identities and draft revision
- **THEN** the system SHALL apply all generated scoring guidelines as ordinary editable draft values
- **AND** it SHALL NOT add, remove, rename, reorder, or rescore levels, change the general scoring standard, publish the assignment, or initiate grading.

### Requirement: Assignment scoring items use concise accordion summaries
The assignment workspace SHALL present each scoring item as an accordion whose collapsed and expanded states preserve the complete scoring-item identity.

#### Scenario: Scoring item is collapsed
- **WHEN** a scoring item accordion is collapsed
- **THEN** it SHALL show the item name, point value, move-up, move-down, and delete controls
- **AND** it SHALL hide the scoring standard and optional detailed rubric fields without discarding their values.

#### Scenario: Scoring item is expanded
- **WHEN** a teacher expands a scoring item
- **THEN** the workspace SHALL expose the scoring standard and the optional detailed-rubric controls for that same stable item.

### Requirement: Assignment workspace separates draft and publication validation
The workspace SHALL allow incomplete drafts to be saved while keeping field feedback, save state, and publication blockers visible and recoverable.

#### Scenario: Draft contains incomplete fields
- **WHEN** automatic or explicit draft saving encounters incomplete authoring content that is still valid as a draft
- **THEN** the draft SHALL remain saveable
- **AND** each issue SHALL remain at its field without moving the page or keyboard focus.

#### Scenario: Teacher requests publication with invalid fields
- **WHEN** the teacher selects publish and one or more publication conditions fail
- **THEN** the workspace SHALL remain at the current route and scroll context
- **AND** it SHALL provide a problem list whose actions expand and focus the corresponding question, scoring item, or publication field.

### Requirement: Publication settings remain summarized and recoverable
Publication settings SHALL appear in the assignment main region as a default-collapsed section with a teacher-readable summary.

#### Scenario: Publication settings are complete
- **WHEN** the settings section is collapsed
- **THEN** its summary SHALL show target class names, publication time, and due time
- **AND** it SHALL NOT show internal class identifiers or sequence numbers.

#### Scenario: Publication setting blocks publication
- **WHEN** a required setting is missing or invalid
- **THEN** the settings section SHALL expand automatically during publication validation
- **AND** the affected field SHALL show its issue in place.

### Requirement: Assignment workspace exposes save state and derived total
The assignment editor SHALL continuously expose the current save state and SHALL derive the assignment total from question point values.

#### Scenario: Draft save state changes
- **WHEN** the current draft is saving, saved, save-failed, or conflicted
- **THEN** the workspace SHALL show `正在保存`, `已保存`, `保存失败`, or `存在冲突` respectively
- **AND** publication availability SHALL consume the publication-baseline contract rather than infer readiness from elapsed time.

#### Scenario: Question points change
- **WHEN** a teacher adds, removes, or changes a question point value
- **THEN** the displayed assignment total SHALL update from the sum of all question values
- **AND** the workspace SHALL NOT expose a separate editable total field.

#### Scenario: Teacher types into a field with example text
- **WHEN** the teacher enters or pastes content
- **THEN** any example text SHALL behave only as a placeholder and disappear
- **AND** it SHALL NOT become part of the saved content.

