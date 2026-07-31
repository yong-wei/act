## ADDED Requirements

### Requirement: Konling derives a server-owned learning continuity snapshot
The system SHALL derive the authenticated student's learning continuity snapshot from governed server-owned records and SHALL return exactly one of unfinished_task, recent_mistake, or cold_start.

#### Scenario: Unfinished task has priority
- **WHEN** the authenticated student opens Konling and has a resumable unfinished task
- **THEN** the snapshot state is unfinished_task
- **THEN** a recent mistake or weak area is not presented as a competing opening state

#### Scenario: Recent mistake is used when no task remains
- **WHEN** the authenticated student has no resumable unfinished task and has a recent governed incorrect result
- **THEN** the snapshot state is recent_mistake
- **THEN** the snapshot includes the governed knowledge target, evidence time, and any available structured cause identity

#### Scenario: Learner has no usable history
- **WHEN** the authenticated student has neither a resumable unfinished task nor a governed incorrect result
- **THEN** the snapshot state is cold_start
- **THEN** Konling asks for the student's current learning goal without manufacturing a diagnosis

#### Scenario: Client supplies another learner's context
- **WHEN** the client supplies task, mistake, or learner identifiers outside the authenticated student's scope
- **THEN** the server ignores or rejects those hints
- **THEN** no other learner's continuity data is returned

### Requirement: Konling presents one proactive continuity card per visit snapshot
The system SHALL present the selected continuity state as a structured card when Konling opens and SHALL present the same snapshot at most once during one application visit.

#### Scenario: Panel reopens without new evidence
- **WHEN** the student closes and reopens Konling during the same application visit and the continuity snapshotId is unchanged
- **THEN** the same proactive card is not presented again

#### Scenario: New governed evidence changes the snapshot
- **WHEN** a new eligible learning result changes the student's continuity snapshot
- **THEN** Konling may present the updated state or feedback once under the new snapshotId

#### Scenario: Card is rendered
- **WHEN** a continuity card is presented
- **THEN** its visible claims are derived from structured snapshot fields
- **THEN** opening the card alone does not create a learning fact or assessment attempt

### Requirement: Unfinished-task actions preserve student control
The system SHALL offer 继续学习, 重新讲解, and 暂时跳过 for an unfinished task and SHALL revalidate the task before executing an action.

#### Scenario: Student continues the task
- **WHEN** the student selects 继续学习
- **THEN** the system opens the existing authorized task entry
- **THEN** it does not create or regenerate a learning path

#### Scenario: Student requests another explanation
- **WHEN** the student selects 重新讲解
- **THEN** the authorized task context is passed into the existing Konling conversation flow

#### Scenario: Student temporarily skips
- **WHEN** the student selects 暂时跳过
- **THEN** the current card is dismissed
- **THEN** the task, mistake, learning path, and learner state remain unchanged

### Requirement: Recent-mistake continuity uses only governed structured causes
The system MUST NOT infer or invent a mistake cause when the latest governed incorrect result has no structured cause record.

#### Scenario: Structured cause exists
- **WHEN** the recent incorrect result references a structured cause available to the student
- **THEN** Konling may display that cause with its knowledge target and evidence time

#### Scenario: Structured cause is missing
- **WHEN** the recent incorrect result has no structured cause record
- **THEN** Konling states only that a recent mistake exists
- **THEN** no generated or free-text cause is presented as learning history

### Requirement: Recent-mistake continuity offers one governed check question
The system SHALL offer at most one check question for the current recent-mistake snapshot and SHALL obtain it through the existing adaptive assessment selection contract.

#### Scenario: Eligible check question is available
- **WHEN** the student starts review and an eligible assessment item matches the target knowledge context
- **THEN** exactly one assessment attempt is created through the existing assessment API
- **THEN** the question is not inserted into or represented as a learning-path node

#### Scenario: Eligible check question is unavailable
- **WHEN** no eligible assessment item can be selected
- **THEN** the system displays an explicit practice-unavailable state
- **THEN** Konling does not create an ungoverned chat-only substitute question

### Requirement: Learning continuity feedback is evidence-triggered
The system SHALL produce closed-loop learning feedback only after a new governed learning result changes the relevant continuity evidence.

#### Scenario: Check question is finalized
- **WHEN** the student's check-question result is finalized through the assessment contract
- **THEN** feedback identifies what the result directly demonstrates
- **THEN** feedback identifies any relevant instability still supported by cumulative learner state
- **THEN** feedback offers one next companion-practice action

#### Scenario: Student claims completion in chat
- **WHEN** the student states in chat that a task or practice is complete but no governed result exists
- **THEN** the system does not update learner state or generate evidence-based improvement claims

#### Scenario: One correct result does not prove stable mastery
- **WHEN** the new result is correct but cumulative learner state still marks the target as unstable
- **THEN** feedback distinguishes the correct result from stable mastery

### Requirement: Companion practice remains separate from learning paths
The system SHALL treat companion practice as an assessment activity independent of learning-path planning and execution.

#### Scenario: Companion practice is completed
- **WHEN** a companion-practice result enters governed learner state
- **THEN** no learning-path node is added, reordered, selected, advanced, or regenerated by this capability
- **THEN** any later path change remains the responsibility of the existing path-generation logic
