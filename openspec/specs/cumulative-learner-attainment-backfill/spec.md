# cumulative-learner-attainment-backfill Specification

## Purpose
TBD - created by archiving change backfill-cumulative-learner-attainment. Update Purpose after archive.
## Requirements
### Requirement: Cumulative attainment backfill is explicit and recoverable
The system SHALL provide `db:backfill-cumulative-attainment`, which defaults
to dry run and requires `--apply --run-id=<stable-id> --wait` before it requests
or queues any write. The operation SHALL select only users with `role=STUDENT`
and at least one historical `LearningFact`, and SHALL not alter source facts.

#### Scenario: Dry run inventories historical attainment
- **WHEN** an operator runs the command without `--apply`
- **THEN** it SHALL report only aggregate candidate, current-class, and
  no-evidence counts with de-identified identifiers
- **AND** it SHALL NOT create a rebuild request, snapshot, or queue job.

#### Scenario: Apply rebuilds eligible learner portraits
- **WHEN** an operator runs the command with `--apply --run-id=<stable-id>`
- **THEN** it SHALL create or advance a fenced full-rebuild request for every
  selected eligible learner using all historical facts
- **AND** it SHALL enqueue the obtained generation directly to the existing
  learner snapshot worker with no class ids attached.
- **AND** an empty cumulative class-id input SHALL preserve any class ids
  already pending on that learner request.

#### Scenario: Historical facts have no portrait contribution
- **WHEN** a selected student has historical facts but the full rebuild yields
  valid native no-evidence, such as context-only facts
- **THEN** the learner rebuild SHALL complete with an explicit no-evidence outcome
- **AND** it SHALL NOT create a zero-valued portrait
- **AND** the student's current class id SHALL remain in the cumulative class target set.

#### Scenario: Rebuild attempt fails or is repeated
- **WHEN** a learner job fails, is stale, or the command is rerun
- **THEN** the durable rebuild request and generation fencing SHALL remain the
  recovery authority
- **AND** a successful rerun SHALL NOT duplicate source facts or produce an
  unfenced portrait write.

### Requirement: Cumulative class aggregation follows validated personal portraits
The system SHALL enqueue cumulative class aggregation only after every
selected learner has a valid native portrait v2. It SHALL derive target class
ids from the current non-null `StudentProfile.classId` values of selected
learners.

#### Scenario: All requested learner portraits complete
- **WHEN** `--wait` verifies every selected learner has completed its fenced
  rebuild and has either a valid native portrait v2 or an explicit native
  no-evidence outcome
- **THEN** the command SHALL enqueue one cumulative class task per distinct
  current class id.

#### Scenario: Apply waits for this run's class snapshots
- **WHEN** cumulative class tasks have been enqueued
- **THEN** the command SHALL wait for every task to complete
- **AND** it SHALL verify a `class-competency.cumulative.v1` snapshot carrying
  this run's opaque marker was created after that class task was requested
- **AND** completion SHALL remain verifiable after completed BullMQ jobs are trimmed
- **AND** an older snapshot SHALL NOT satisfy completion for the current run.

#### Scenario: A selected portrait remains incomplete
- **WHEN** a selected learner has no valid native portrait after its request
  is pending, failed, or stale
- **THEN** the command SHALL report the incomplete aggregate state
- **AND** it SHALL NOT enqueue cumulative class tasks for that run.

### Requirement: Cumulative class snapshots preserve recent semantics
The class snapshot worker SHALL support a `cumulative` scope that aggregates
the latest valid native portrait v2 for current class members without a recent
time filter. It SHALL store that result as
`class-competency.cumulative.v1` and SHALL not overwrite
`class-competency.v2`.

#### Scenario: Current roster has historical portraits only
- **WHEN** a current class member has a valid native portrait derived from
  facts older than the recent class window
- **THEN** the cumulative aggregate SHALL include that portrait
- **AND** its coverage SHALL be calculated against the current roster.

#### Scenario: Cumulative snapshot exposes no trend claim
- **WHEN** a cumulative class snapshot is materialized
- **THEN** it SHALL mark period-over-period trend comparison as not applicable
- **AND** it SHALL NOT represent recent risk or classroom-quality signals as
  cumulative capability conclusions.

