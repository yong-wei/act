## ADDED Requirements

### Requirement: Teacher assignments lead directly into submission and review work
Teacher assignment management SHALL expose assignment-scoped submission and review actions with loading, empty, filtered-empty, blocked, stale/missing, and recoverable error states.

#### Scenario: Published assignment is collecting responses
- **WHEN** an assignment row has an active audience or submitted answers
- **THEN** it SHALL expose `查看提交` to `/teacher/assignments/[assignmentId]/submissions` with safe counts and state.

#### Scenario: Assignment has eligible pending reviews
- **WHEN** one or more submitted answers are ready for teacher review
- **THEN** the assignment row SHALL expose `进入批阅` to the first item under the current default queue policy.

#### Scenario: Queue has no rows or cannot load
- **WHEN** no submissions exist, filters exclude all rows, context is stale, or a recoverable service error occurs
- **THEN** the page SHALL distinguish the state and expose the correct wait, clear-filter, return, reload, or retry action.

### Requirement: Teachers can review by student or by question with deterministic navigation
The system SHALL provide authorized submission queues with `按学生` and `按题` modes, explicit sort/filter state, counts, batch AI controls, item status, and deterministic previous/next behavior.

#### Scenario: Teacher uses by-student navigation
- **WHEN** the queue is in `按学生`
- **THEN** previous/next SHALL move among student submissions in the current sort/filter while question navigation remains within the selected submission.

#### Scenario: Teacher uses by-question navigation
- **WHEN** the queue is in `按题`
- **THEN** the selected question SHALL remain fixed and previous/next SHALL move among student answers in the current sort/filter.

#### Scenario: Queue boundary or review action is reached
- **WHEN** the current item is first/last or approval/return changes eligibility
- **THEN** unavailable directions SHALL be disabled, the queue SHALL be recomputed, excluded statuses SHALL be skipped only according to active filters, and focus SHALL move to the next eligible item or a completed/empty state.

### Requirement: Text and document answers share a complete manual review path
Every submitted AnswerEvidence kind SHALL be reviewable manually and, when eligible, through AI assistance.

#### Scenario: Teacher opens a text answer
- **WHEN** text-native AnswerEvidence is ready
- **THEN** the workbench SHALL render canonical text with block/span anchors, rubric, comments, scores, return, approval, and navigation actions without requiring document conversion.

#### Scenario: Teacher opens a document answer
- **WHEN** converted document AnswerEvidence is ready
- **THEN** the workbench SHALL render original or authorized pages, canonical Markdown, declared anchor precision, rubric, comments, scores, return, approval, and navigation actions.

### Requirement: The grading workbench keeps evidence and rubric actions in context
At supported editing widths, the workbench SHALL present queue/question navigation, evidence, anchors, rubric criteria, scores, comments, derived totals, and review actions without long-page action loss.

#### Scenario: Teacher reviews at 768px or wider
- **WHEN** the grading workspace renders at a supported editing width
- **THEN** it SHALL provide coordinated queue, evidence, and sticky rubric/action regions with source/Markdown switching where applicable.

#### Scenario: Teacher uses a phone viewport
- **WHEN** the workspace renders at 320px or 375px
- **THEN** queue/status and safe navigation SHALL remain available
- **AND** full rubric editing or document annotation SHALL show a clear `请在平板或电脑端继续批阅` handoff instead of an unusable compressed editor.

#### Scenario: Teacher uses keyboard navigation
- **WHEN** the teacher switches panes, targets an annotation, handles a save conflict, or advances after approve/return without a pointer
- **THEN** focus order, accessible names, error association, and focus restoration SHALL preserve the same workflow.

### Requirement: Teacher edits preserve machine drafts and derive scores from criteria
The system SHALL allow teachers to accept, edit, add, or remove criterion decisions and annotations while preserving immutable machine values and deriving question/assignment totals from approved criteria.

#### Scenario: Teacher changes an AI criterion
- **WHEN** a teacher saves a different score, level, rationale, or anchor
- **THEN** the review SHALL retain machine and teacher values, actor, timestamp, reason when required, and the resulting criterion diff.

#### Scenario: Teacher changes an annotation
- **WHEN** a teacher edits, suppresses, or adds a location-aware comment
- **THEN** the review SHALL preserve annotation origin, anchor, previous value, teacher value, and status.

#### Scenario: Teacher attempts a direct total override
- **WHEN** a teacher supplies a question or assignment total that does not equal approved criterion aggregation
- **THEN** the system SHALL reject the override
- **AND** any exceptional adjustment SHALL be represented only by a bounded, named, auditable rubric criterion allowed by the published score scale.

#### Scenario: Concurrent review edit is stale
- **WHEN** a teacher saves against an outdated review version
- **THEN** the system SHALL return an explicit conflict and SHALL NOT silently overwrite newer work.

### Requirement: Final assignment totals require grading completeness
The system SHALL distinguish released question feedback from a final assignment grade.

#### Scenario: Some required questions are approved
- **WHEN** any required assignment question was never submitted, was returned and awaits resubmission, has a current attempt still processing or unapproved, and has no audited exemption
- **THEN** approved question feedback MAY be released according to policy, the assignment SHALL remain `批阅中`, and no final assignment total SHALL be published.

#### Scenario: Every required question is complete
- **WHEN** every required assignment question has a current approved submitted attempt or an explicit audited exemption with defined score effect
- **THEN** the final assignment total SHALL equal approved question totals and the assignment MAY enter `已批阅`.

### Requirement: Approval atomically creates a snapshot and durable outbox
Only an explicit teacher approval transaction SHALL create authoritative grading and downstream commands.

#### Scenario: Teacher approves a valid review
- **WHEN** an authorized teacher approves against the current review version
- **THEN** one transaction SHALL compare-and-swap review state, write the immutable approval snapshot and derived criterion/question state, and append durable outbox messages for derivative, student release, and governed evidence processing.

#### Scenario: Approval transaction fails before commit
- **WHEN** any snapshot, state, or outbox write fails before transaction commit
- **THEN** no approval or downstream command SHALL become visible.

#### Scenario: Outbox delivery is duplicated or partially fails
- **WHEN** derivative, student release, or evidence consumers receive duplicate messages or fail independently
- **THEN** each consumer SHALL use deterministic idempotency, correlation/causation ids, snapshot/version fencing, and retryable terminal state without duplicating feedback or evidence.

#### Scenario: Machine draft is unapproved
- **WHEN** conversion or AI grading completes without teacher approval
- **THEN** student APIs, final totals, remediation, and governed evidence SHALL exclude machine draft values.

### Requirement: Reviewed derivatives never mutate original submissions
The system SHALL generate reviewed derivative artifacts from approved annotation records while preserving the immutable source asset.

#### Scenario: Reliable DOCX range mapping exists
- **WHEN** an approved DOCX review has reliable range anchors
- **THEN** the system SHALL create a new DOCX with native Word comments and record source, snapshot, generator, output checksum, precision, lifecycle policy, and warnings.

#### Scenario: PDF geometry is supported
- **WHEN** an approved PDF review has reliable page and bounding-box anchors
- **THEN** the system SHALL create a new PDF with location-aware annotation objects without overwriting the original.

#### Scenario: Native placement is unreliable
- **WHEN** the source format or anchor precision cannot support reliable native comments
- **THEN** the system SHALL create a reviewed PDF or annotated Markdown fallback with honest page/block placement and SHALL NOT claim exact inline annotation.

#### Scenario: Derivative generation fails
- **WHEN** required reviewed-document generation fails after approval
- **THEN** feedback SHALL remain publishing-blocked until retry succeeds or the teacher explicitly approves a structured-only fallback with its limitation.

### Requirement: Students receive only authorized approved feedback
The student assignment detail SHALL expose approved question scores, rubric breakdown, anchored comments, overall evaluation, reviewed-document access, history, and valid next actions only for the owning student.

#### Scenario: Approved feedback is released
- **WHEN** approval exists, required derivative is ready, and student-release authorization is complete
- **THEN** the student's assignment page SHALL show teacher-approved values and deep-link comments to the supported question/page/block/span location.

#### Scenario: Release authorization is incomplete
- **WHEN** ownership, audience, privacy scope, derivative authorization, or release policy cannot be proven
- **THEN** feedback and reviewed assets SHALL remain blocked even if evidence mapping is otherwise available.

#### Scenario: Evidence mapping alone is incomplete
- **WHEN** student release is authorized but learner-evidence mapping is incomplete
- **THEN** approved feedback MAY be visible while governed evidence writeback remains blocked with an explicit limitation.

#### Scenario: Reference answer has no release policy
- **WHEN** approved feedback is visible but no active solution-release policy permits the reference answer
- **THEN** reference answers and teacher-only rubric guidance SHALL remain hidden.

#### Scenario: Student requests another submission's feedback
- **WHEN** a student requests feedback or reviewed assets they do not own
- **THEN** the system SHALL deny access without disclosing grading metadata.

### Requirement: Teacher return activates question-scoped resubmission
The teacher review workflow SHALL own return commands and SHALL activate only the selected question for a new submitted attempt.

#### Scenario: Teacher returns one question
- **WHEN** an authorized teacher returns a question answer
- **THEN** the system SHALL record teacher, source review/run, reason, permitted response type, new deadline, authorization snapshot, and resubmission grant
- **AND** other submitted question attempts SHALL remain sealed.

#### Scenario: Student resubmits a returned question
- **WHEN** the student uses a valid resubmission grant
- **THEN** the system SHALL create a new answer attempt and downstream evidence/grading lifecycle while preserving every prior attempt and review.

### Requirement: Historical review authorization is explicit
Historical feedback and grading access SHALL separate frozen student ownership from current or transferred teacher review grants.

#### Scenario: Student leaves a class
- **WHEN** the owning student no longer has current class membership
- **THEN** policy-permitted historical access to their own approved feedback SHALL use the frozen ownership record.

#### Scenario: Teacher assignment changes
- **WHEN** a new teacher joins or replaces the original class teacher
- **THEN** historical submissions SHALL remain inaccessible until an explicit audited assignment-review transfer or grant authorizes access.

### Requirement: Review mutations are protected and abuse-bounded
Save, batch, return, approve, retry, fallback, and release mutations SHALL require authenticated non-GET requests, strict Origin or CSRF validation, runtime schemas, bounded payloads, resource authorization, idempotency where applicable, and rate or quota limits.

#### Scenario: Forged approval or batch request is attempted
- **WHEN** a request lacks valid Origin/CSRF proof, contains another class's ids, exceeds batch/comment limits, or surpasses retry/provider quotas
- **THEN** the system SHALL reject or throttle it before changing review state or enqueuing outbox work.

### Requirement: Assignment-bound legacy grading routes converge on the assignment journey
The platform SHALL redirect or adapt assignment-bound legacy grading and feedback deep links to the new assignment-scoped routes and SHALL register them in central route inventory.

#### Scenario: Teacher opens a legacy assignment-bound grading run
- **WHEN** `/teacher/grading-workbench` resolves a grading run with assignment/submission identity
- **THEN** it SHALL route to the matching assignment review page with preserved context.

#### Scenario: Student opens legacy assignment-bound feedback
- **WHEN** `/assessment/document-feedback` resolves an approved assignment-bound run owned by the student
- **THEN** it SHALL route to the matching question feedback within the assignment detail.

#### Scenario: Legacy run is not assignment-bound
- **WHEN** a historical or demo run lacks assignment identity
- **THEN** it SHALL remain available only through a read-only compatibility adapter with an owner and retirement condition.

### Requirement: Approved grading writes evidence through governance
Teacher-approved criterion results SHALL create only governed, idempotent evidence candidates with assignment, question, rubric, anchor, reviewer, confidence, and AI-teacher diff lineage.

#### Scenario: Approved review is eligible for evidence
- **WHEN** an approved criterion maps to a governed capability or quality outcome
- **THEN** an outbox consumer SHALL create or update the authorized evidence candidate with a deterministic writeback key and complete grading lineage.

#### Scenario: Approval is not evidence-eligible
- **WHEN** rubric mapping, anchor integrity, or evidence policy is incomplete
- **THEN** student feedback MAY remain visible only when release authorization is independently complete
- **AND** high-confidence learner evidence SHALL remain blocked with an explicit limitation.
