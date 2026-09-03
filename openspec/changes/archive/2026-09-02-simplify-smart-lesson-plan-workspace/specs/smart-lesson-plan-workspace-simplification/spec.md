## ADDED Requirements

### Requirement: Smart lesson-plan workspace has one durable task authority

The smart lesson-plan workspace SHALL use the existing `src/lib/smart-lesson-plan` domain/service projections as the authority for task, draft, stage, generation job, approval, source binding, class context, and revision facts.

#### Scenario: Workspace loads a task

- **WHEN** a teacher opens, filters, or refreshes the smart-preparation workspace
- **THEN** durable task and stage data SHALL come from the server-owned projection
- **AND** local selection or loading state SHALL not become a task revision or approval.

#### Scenario: A stale task response arrives

- **WHEN** a delayed query, event, poll, or retry response targets an older task/revision identity
- **THEN** the workspace SHALL ignore it or show an explicit stale state
- **AND** it SHALL not overwrite the current task, source, job, or stage projection.

### Requirement: Existing preparation editor owns lesson-document editing

Lesson and outline document edits SHALL use the existing preparation document editor, save coordinator, conflict handling, and return-state contracts without a second document store or workspace persistence path.

#### Scenario: Teacher edits an outline or lesson draft

- **WHEN** an authorized teacher selects edit from a paused or generated task
- **THEN** the existing preparation editor SHALL open the same draft identity
- **AND** saving SHALL use the server revision and source/approval contract.

#### Scenario: An edit conflicts with a newer revision

- **WHEN** the save request carries an outdated expected version
- **THEN** the workspace SHALL expose the existing conflict/recovery behavior
- **AND** it SHALL not silently merge or discard the newer server projection.

### Requirement: Workspace simplification preserves source and approval semantics

Deleting derived state or aliases SHALL preserve course-basis/textbook source bindings, stable anchors and hashes, goal/module source states, teacher confirmation, provider correction limits, generation retry/resume, and class-context authorization.

#### Scenario: Teacher confirms an AI suggestion

- **WHEN** a suggestion is authorized for the current teacher, task, revision, and scope
- **THEN** the existing confirm route SHALL apply the validated change and return the updated task projection
- **AND** the workspace SHALL not apply a client-only suggestion directly.

#### Scenario: Client forges a source or approval value

- **WHEN** a client submits an unverified source version, citation, stable anchor, goal gap, approval, class, or revision
- **THEN** the server SHALL reject or ignore it
- **AND** no workspace simplification path SHALL bypass owner validation.

### Requirement: Simplification preserves lifecycle, role, and AI boundaries

The workspace SHALL preserve task creation, query/archive, generation, failure, retry/resume, courseware handoff, teacher/student role projections, SSR/AppShell behavior, and AI advisory/privacy boundaries.

#### Scenario: Generation fails after earlier stages complete

- **WHEN** a current generation job enters a retryable failure
- **THEN** completed stages SHALL remain visible and immutable and retry SHALL resume from the first incomplete stage
- **AND** the workspace SHALL not regenerate completed stages or expose provider payloads.

#### Scenario: AI suggestion updates the workspace

- **WHEN** a bounded Konling suggestion is confirmed
- **THEN** the workspace MAY refresh and highlight the affected stage
- **AND** the suggestion SHALL not directly create a LearningFact, publication, score, or other business authority.

### Requirement: Simplification is proven by before/after behavior

The implementation SHALL record before/after state ownership and SHALL remove a derived field, effect, mapper, or alias only when observable output, errors, ordering, side effects, and privacy behavior remain equivalent.

#### Scenario: A candidate deletion changes an observable contract

- **WHEN** focused before/after tests detect a changed lifecycle or error result
- **THEN** the deletion SHALL be rejected or revised
- **AND** tests SHALL not be weakened to force acceptance.
