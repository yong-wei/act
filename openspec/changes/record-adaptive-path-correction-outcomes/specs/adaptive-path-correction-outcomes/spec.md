## ADDED Requirements

### Requirement: Only applied confirmed corrections have outcomes

The system SHALL derive a correction outcome only for a decision that is confirmed and whose application result is marked as applied.

#### Scenario: Rejected or deferred decision is excluded

- **WHEN** a correction decision is rejected, deferred, or marked unapplied
- **THEN** the journey SHALL NOT expose an outcome for that decision

#### Scenario: Applied confirmed decision is eligible

- **WHEN** a confirmed decision has `applicationResult.applied = true`
- **THEN** the system SHALL evaluate only evidence produced after the decision timestamp for its recorded node IDs

### Requirement: Outcomes are evidence-bounded

The system SHALL expose exactly one of `improved`, `needs-review`, `pending-verification`, or `indeterminate` and SHALL NOT claim that the correction caused the observed result.

#### Scenario: Follow-up checkpoint passes

- **WHEN** a post-confirmation checkpoint for an applied node is completed successfully, or an associated terminal validation is completed
- **THEN** the outcome SHALL be `improved`
- **AND** the explanation SHALL describe subsequent evidence without causal language

#### Scenario: Follow-up checkpoint fails

- **WHEN** a post-confirmation checkpoint for an applied node is explicitly failed
- **THEN** the outcome SHALL be `needs-review`

#### Scenario: Ordinary governed node is completed

- **WHEN** a post-confirmation governed learning node such as a knowledge card, lesson step, or simulation is completed
- **THEN** the execution SHALL count as associated follow-up evidence
- **AND** the outcome SHALL remain `pending-verification` with an insufficient-confidence limitation
- **AND** the system SHALL NOT describe the node completion as an improved capability result

#### Scenario: Ordinary governed node fails or is abandoned

- **WHEN** a post-confirmation governed learning node fails or is abandoned without an explicit checkpoint or terminal validation result
- **THEN** the execution SHALL count as associated follow-up evidence
- **AND** the outcome SHALL remain `pending-verification` with an insufficient-confidence limitation
- **AND** the system SHALL NOT convert ordinary resource failure into a checkpoint result

#### Scenario: No follow-up evidence

- **WHEN** no eligible post-confirmation evidence exists
- **THEN** the outcome SHALL be `pending-verification`
- **AND** missing evidence SHALL NOT be treated as failure

#### Scenario: Conflicting or low-confidence evidence

- **WHEN** eligible evidence contains an unresolved pass/fail conflict or lacks sufficient confidence to classify
- **THEN** the outcome SHALL be `indeterminate`
- **AND** the response SHALL expose only a controlled evidence-limitation code

#### Scenario: Terminal validation fails

- **WHEN** a post-confirmation terminal execution has an authoritative terminal validation state of `failed`
- **THEN** the outcome SHALL be `needs-review`

#### Scenario: Terminal validation is incomplete

- **WHEN** a terminal execution exists but its terminal validation is still pending, skipped, or otherwise not completed
- **THEN** the outcome SHALL remain `pending-verification`
- **AND** it SHALL NOT be projected as `improved`

### Requirement: Student projection preserves privacy and authorization

The student journey SHALL expose outcome state only to an authorized owner of the learning path.

#### Scenario: Unauthorized journey request

- **WHEN** a requester cannot read the learning path
- **THEN** the route SHALL reject the request using the existing access contract
- **AND** SHALL NOT reveal correction outcomes or evidence metadata

#### Scenario: Authorized journey request

- **WHEN** an authorized owner reads a journey containing an eligible correction
- **THEN** the response SHALL include its outcome state, decision timestamp, associated node count, and controlled limitation code when applicable
- **AND** SHALL NOT include raw evidence text, evidence payloads, or another learner's identifier

### Requirement: Teacher reporting is aggregate-only

The teacher correction report SHALL provide only redacted class-level outcome aggregates.

#### Scenario: Class has outcome records

- **WHEN** an authorized teacher requests a class correction report
- **THEN** the report SHALL include counts and rates for each controlled outcome state
- **AND** SHALL NOT add student-level outcome rows, `userId`, or raw evidence references

#### Scenario: Class has no eligible outcomes

- **WHEN** no applied confirmed correction has eligible outcome evidence in the class
- **THEN** every aggregate count and rate SHALL be zero
- **AND** the route SHALL complete without a division-by-zero error
