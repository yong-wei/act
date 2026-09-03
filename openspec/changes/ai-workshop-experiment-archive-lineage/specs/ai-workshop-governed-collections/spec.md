## MODIFIED Requirements

### Requirement: Experiment records preserve source and result authority

The experiment collection SHALL include only current-student simulation, control-workbench, Odyssey, or Arena records that meet the applicable source display or evidence eligibility contract. The projection SHALL prefer the canonical `SimulationRun` identity for evidence-bearing simulation activity, preserve source kind, occurrence time, result authority, a student-safe summary, and a verified navigation target. Legacy `SimulationLog` and Arena detail records MAY provide compatibility or source-specific fields, but SHALL NOT replace a canonical run or create a second item for the same bridged activity.

#### Scenario: Student has a qualifying canonical simulation run

- **WHEN** a completed `SimulationRun` owned by the authenticated student meets the display eligibility rule
- **THEN** the experiment collection SHALL expose one bounded student-safe summary using that run as the primary identity
- **AND** the item SHALL include a verified navigation target for the corresponding control-workbench or simulation learning context
- **AND** it SHALL NOT serialize raw trajectory, trace samples, or unrestricted task payloads.

#### Scenario: Student has an unbridged legacy simulation record

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
