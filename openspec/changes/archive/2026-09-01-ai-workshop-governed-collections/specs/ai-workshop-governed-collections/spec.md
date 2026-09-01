## ADDED Requirements

### Requirement: AI Workshop collections are server-owned and learner-scoped
The system SHALL project AI Workshop tasks, milestones, achievements, experiments, and journals from server-owned sources authorized for the authenticated student. Client parameters and client-provided collection items MUST NOT select the learner or establish personal learning facts.

#### Scenario: Authenticated student opens AI Workshop
- **WHEN** an authenticated student opens `/ai`
- **THEN** the server SHALL resolve every governed collection using that student's identity
- **AND** the serialized items SHALL contain no records owned by another learner.

#### Scenario: Client supplies collection-like parameters
- **WHEN** a client adds a user id, task item, achievement, experiment, milestone, or journal value to the request URL or browser state
- **THEN** the system SHALL ignore it as an authority source
- **AND** it SHALL NOT add the supplied value to a governed collection.

### Requirement: Each governed collection preserves its own source state
Every governed collection SHALL independently distinguish `available`, `empty`, and `unavailable`, and SHALL expose a student-facing limitation and adjacent action appropriate to that collection. The state of a portrait, evidence summary, or another collection MUST NOT authorize a zero value or personal record for the affected collection.

#### Scenario: One source fails while another succeeds
- **WHEN** the assignment source is unavailable and the experiment source returns eligible records
- **THEN** the task collection SHALL be `unavailable`
- **AND** the experiment collection SHALL remain `available` with its eligible records.

#### Scenario: Authoritative source confirms no eligible records
- **WHEN** a collection source read succeeds and finds no eligible records for the student
- **THEN** that collection SHALL be `empty`
- **AND** its total SHALL be zero rather than unknown.

#### Scenario: Source eligibility cannot be determined
- **WHEN** a collection source cannot be read or validated
- **THEN** that collection SHALL be `unavailable`
- **AND** the system SHALL NOT normalize the unknown total to zero.

### Requirement: Task and milestone collections require adopted persistent learning work
The task collection SHALL include only assignments published to the authenticated student and tasks from a student-adopted persisted learning path. The milestone collection SHALL include only ordered nodes from a persisted path with authoritative pending, current, or completed state.

#### Scenario: Published assignment is available to the student
- **WHEN** an assignment domain read confirms that an assignment revision is published to the authenticated student
- **THEN** the task collection SHALL expose its stable assignment identity, current permitted state, deadline context where applicable, and next action.

#### Scenario: Student has an adopted persisted path
- **WHEN** Learner State identifies an adopted persisted path with ordered nodes
- **THEN** eligible path tasks and milestones SHALL retain the path and node identities and authoritative state
- **AND** the current node SHALL remain distinguishable from completed and pending nodes.

#### Scenario: Candidate work has not been adopted
- **WHEN** a recommendation, report-feedback task candidate, Copilot suggestion, or browser-only task selection has not been persisted through its explicit adoption flow
- **THEN** it SHALL NOT appear as a governed task or milestone.

### Requirement: Experiment records preserve source and result authority
The experiment collection SHALL include only current-student simulation, control-workbench, Odyssey, or Arena records that meet the applicable source display or evidence eligibility contract. Each item SHALL preserve source kind, occurrence time, result authority, and a student-safe summary.

#### Scenario: Student has a qualifying simulation record
- **WHEN** a persisted `SimulationLog` owned by the authenticated student meets the display eligibility rule
- **THEN** the experiment collection SHALL expose a bounded student-safe summary and navigation target
- **AND** it SHALL NOT serialize raw trajectory or unrestricted parameter payloads.

#### Scenario: Student has an Arena submission
- **WHEN** an `ArenaSubmission` owned by the authenticated student is eligible for display
- **THEN** the item SHALL preserve whether the result is valid and official under the Arena contract
- **AND** a preview or invalid result SHALL NOT be represented as an official score.

### Requirement: Achievements and journals require explicit durable lifecycle records
The achievement collection SHALL use only independently persisted attainment records whose registered type authorizes achievement display. The journal collection SHALL use only student-confirmed reflection, ethics, or growth records that have entered a displayable durable lifecycle.

#### Scenario: Persisted attainment is registered for achievement display
- **WHEN** an authenticated student's durable record has an allowed achievement or certificate type
- **THEN** the achievement collection SHALL expose that record with its stable identity and occurrence time.

#### Scenario: Score or portrait implies a possible badge
- **WHEN** the student has a score, portrait level, task count, or locked badge definition but no qualifying durable attainment record
- **THEN** the system SHALL NOT infer or display an achievement.

#### Scenario: Reflection remains a candidate or editable draft
- **WHEN** Copilot output is unconfirmed or a portfolio reflection remains in candidate or editable draft state
- **THEN** it SHALL NOT appear in the journal collection.

#### Scenario: Student explicitly saves a qualifying learning record
- **WHEN** an existing governed promotion flow creates a durable displayable reflection, ethics, or growth record for the student
- **THEN** the journal collection SHALL expose the resulting record
- **AND** it SHALL retain the durable source identity rather than the original AI message text as authority.

### Requirement: Collection projections are bounded, deterministic, and student-safe
Every collection SHALL use stable item identity, deterministic ordering, bounded initial items, and student-safe fields. Raw audit payloads, unrestricted JSON, internal reason codes, reusable signed URLs, and source records outside the authenticated student's scope MUST NOT be serialized.

#### Scenario: Repeated reads use unchanged source data
- **WHEN** a governed collection is read repeatedly against the same eligible source records
- **THEN** item identity and ordering SHALL remain stable
- **AND** duplicate source records SHALL NOT produce duplicate collection items.

#### Scenario: Source contains private or unrestricted fields
- **WHEN** a qualifying source record contains raw responses, trajectories, audit metadata, or unrestricted parameters
- **THEN** the collection projector SHALL omit those fields
- **AND** it SHALL expose only the bounded student-safe summary required by the panel.

### Requirement: Governed collection reads do not create learning facts
Reading or rendering AI Workshop collections SHALL be side-effect free with respect to LearningFact, learner portraits, task completion, grades, rankings, achievements, and draft promotion.

#### Scenario: Student opens or refreshes AI Workshop
- **WHEN** the student opens or refreshes `/ai`
- **THEN** the system SHALL only read and project eligible records
- **AND** it SHALL NOT create, promote, complete, score, rank, or otherwise mutate learning state.
