## ADDED Requirements

### Requirement: Assignment review binds grading artifacts to one governed review snapshot
The document grading workbench SHALL bind text-native or document AnswerEvidence, conversion where applicable, AI grading run, teacher working review, approved snapshot, derivative where applicable, feedback release, and evidence writeback through stable assignment revision, question, answer attempt, rubric, and version identifiers.

#### Scenario: Teacher opens a grading draft
- **WHEN** a production grading run is selected from an assignment submission queue
- **THEN** the workbench SHALL verify that every displayed artifact belongs to the same assignment question answer and SHALL expose any version or anchor mismatch as a blocking state.

#### Scenario: New AI run supersedes an older draft
- **WHEN** a teacher requests or selects a newer evaluator run
- **THEN** the system SHALL preserve prior runs and require the working review to explicitly adopt or reject the newer run rather than silently replacing teacher edits.

### Requirement: Approved annotations drive reviewed document derivatives
The document grading workbench SHALL treat approved structured annotations as the authoritative source for DOCX comments, PDF annotations, reviewed-PDF fallbacks, and student deep links.

#### Scenario: Approved annotation is regenerated
- **WHEN** a reviewed derivative is regenerated with the same source, review snapshot, generator, and anchor-map versions
- **THEN** the output SHALL preserve equivalent annotation identity and placement within the declared precision
- **AND** regeneration SHALL NOT create duplicate student feedback records.

### Requirement: Approval and downstream effects use a durable outbox
The system SHALL atomically create the approved review snapshot and durable outbox commands, then expose derivative generation, student release, and governed evidence writeback as distinct idempotent consumer states.

#### Scenario: Approval transaction commits
- **WHEN** an authorized teacher approves the current review version
- **THEN** the snapshot, compare-and-swap state, and outbox commands SHALL commit in one transaction before any downstream consumer executes.

#### Scenario: Consumer processing is interrupted
- **WHEN** a derivative, student-release, or evidence consumer crashes or receives duplicate delivery
- **THEN** deterministic keys, correlation/causation ids, and snapshot/version fencing SHALL prevent duplication or stale publication.

#### Scenario: Student feedback succeeds but evidence is blocked
- **WHEN** a review is valid for student feedback but lacks an eligible learner-evidence mapping
- **THEN** the system SHALL release approved feedback only when student-release authorization is independently complete and show evidence writeback as limited or blocked.

#### Scenario: Evidence writeback is retried
- **WHEN** an approved review's evidence materialization is retried
- **THEN** the writeback SHALL use its deterministic key and SHALL NOT duplicate LearningFacts or profile contributions.
