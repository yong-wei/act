# ai-workshop-governed-collections Specification

## Purpose
TBD - created by archiving change ai-workshop-governed-collections. Update Purpose after archive.
## Requirements
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
The task collection SHALL include only assignments published to the authenticated student and tasks from a student-adopted persisted learning path. The milestone collection SHALL include only ordered nodes from a persisted path with authoritative pending, current, or completed state. Every path task SHALL expose a server-generated navigation target that preserves the learning goal, path identity, node identity, and `path-execution` intent required to continue or inspect that task.

#### Scenario: Published assignment is available to the student
- **WHEN** an assignment domain read confirms that an assignment revision is published to the authenticated student
- **THEN** the task collection SHALL expose its stable assignment identity, current permitted state, deadline context where applicable, and next action.

#### Scenario: Student has an adopted persisted path
- **WHEN** Learner State identifies an adopted persisted path with ordered nodes
- **THEN** eligible path tasks and milestones SHALL retain the path and node identities and authoritative state
- **AND** the current node SHALL remain distinguishable from completed and pending nodes.

#### Scenario: A path task is rendered as an actionable item
- **WHEN** the server projects an uncompleted node from an adopted path into the task collection
- **THEN** its navigation target SHALL include the server-confirmed goal, path ID, node ID, and `intent=path-execution`
- **AND** all navigation values SHALL be URL encoded
- **AND** the target SHALL not be constructed from client-provided collection data.

#### Scenario: A path lacks executable navigation context
- **WHEN** the adopted path has no valid goal, no valid node, or an invalid persisted path context
- **THEN** the task collection SHALL not expose a generic practice URL as if it continued that task
- **AND** it SHALL expose an honest unavailable or recovery action according to the collection contract.

#### Scenario: Candidate work has not been adopted
- **WHEN** a recommendation, report-feedback task candidate, Copilot suggestion, or browser-only task selection has not been persisted through its explicit adoption flow
- **THEN** it SHALL NOT appear as a governed task or milestone.

### Requirement: Experiment records preserve source and result authority

The experiment collection SHALL include only current-student simulation, control-workbench, Odyssey, or Arena records that meet the applicable source display or evidence eligibility contract. The projection SHALL prefer the canonical `SimulationRun` identity for evidence-bearing simulation activity, preserve source kind, occurrence time, result authority, a student-safe summary, and a verified navigation target. Legacy `SimulationLog` and Arena detail records MAY provide compatibility or source-specific fields, but SHALL NOT replace a canonical run or create a second item for the same bridged activity.

#### Scenario: Student has a qualifying canonical simulation run

- **WHEN** a completed `SimulationRun` owned by the authenticated student meets the display eligibility rule
- **THEN** the experiment collection SHALL expose one bounded student-safe summary using that run as the primary identity
- **AND** the item SHALL include a verified navigation target for the corresponding control-workbench or simulation learning context
- **AND** it SHALL NOT serialize raw trajectory, trace samples, or unrestricted task payloads.

#### Scenario: Student has a qualifying simulation record

- **WHEN** a persisted `SimulationLog` owned by the authenticated student has no corresponding canonical run but meets the legacy display eligibility rule
- **THEN** the experiment collection MAY expose it as a compatibility item with its original stable identity and source type
- **AND** it SHALL use a verified safe fallback entry or an explicit unavailable navigation state rather than a dead link.

#### Scenario: Student has an Arena submission

- **WHEN** an `ArenaSubmission` owned by the authenticated student is eligible for display
- **THEN** the item SHALL preserve its task source, valid/official semantics, and authorized challenge navigation target
- **AND** a preview or invalid result SHALL NOT be represented as an official score.

#### Scenario: One Odyssey activity is present in multiple source records

- **WHEN** a simulation log, canonical run or Arena submission carries the same verified Odyssey activity identity
- **THEN** the experiment collection SHALL expose one item for that activity
- **AND** the item SHALL retain the highest applicable result authority and the complete verified source lineage
- **AND** the collection total SHALL count the activity once.

#### Scenario: Source type is not PID

- **WHEN** an eligible experiment comes from an Odyssey, Arena, scene, MPC, black-box, or other explicitly identified source
- **THEN** the item type and title SHALL reflect that source contract
- **AND** the projector SHALL NOT default every non-ethical simulation record to PID tuning.

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

Every collection SHALL use stable item identity, deterministic ordering, bounded initial items, and student-safe fields. The experiment collection SHALL resolve cross-source identity before applying its limit and total, so one learning activity cannot appear twice merely because it exists in multiple source tables. Raw audit payloads, unrestricted JSON, internal reason codes, reusable signed URLs, and source records outside the authenticated student's scope MUST NOT be serialized.

#### Scenario: Repeated reads use unchanged source data

- **WHEN** a governed collection is read repeatedly against the same eligible source records
- **THEN** item identity, deduplicated membership, and ordering SHALL remain stable
- **AND** duplicate source records SHALL NOT produce duplicate collection items.

#### Scenario: Source contains private or unrestricted fields

- **WHEN** a qualifying source record contains raw responses, trajectories, audit metadata, or unrestricted parameters
- **THEN** the collection projector SHALL omit those fields
- **AND** it SHALL expose only the bounded student-safe summary required by the panel.

#### Scenario: A navigation target cannot be verified

- **WHEN** a source record lacks an authorized task, resource, publication, or replay target
- **THEN** the item SHALL not emit a fabricated deep link
- **AND** the collection SHALL expose an honest restricted-navigation state or its collection-level recovery action.

### Requirement: Governed collection reads do not create learning facts
Reading or rendering AI Workshop collections SHALL be side-effect free with respect to LearningFact, learner portraits, task completion, grades, rankings, achievements, and draft promotion.

#### Scenario: Student opens or refreshes AI Workshop
- **WHEN** the student opens or refreshes `/ai`
- **THEN** the system SHALL only read and project eligible records
- **AND** it SHALL NOT create, promote, complete, score, rank, or otherwise mutate learning state.

