## ADDED Requirements

### Requirement: Path execution exposes candidate correction proposals
The system SHALL derive a student-visible candidate correction proposal when a path has a trusted failed checkpoint result or a recorded skip, replacement, or abandonment deviation for its current or unfinished nodes. The candidate proposal SHALL affect only unfinished nodes and SHALL NOT mutate the persisted path, current node, completion state, or deviation record.

#### Scenario: Failed checkpoint has a feasible correction
- **WHEN** a learner has a failed checkpoint and the current governed path and resource facts support a changed unfinished-node sequence
- **THEN** the path journey SHALL expose a candidate correction proposal with a student-visible action to inspect it
- **AND** the persisted path and current node SHALL remain unchanged.

#### Scenario: Deviation has a feasible correction
- **WHEN** a learner records a skip, replacement, or abandonment deviation and a changed unfinished-node sequence can be formed from governed facts
- **THEN** the path journey SHALL expose a candidate correction proposal that identifies the recorded deviation as its trigger
- **AND** it SHALL NOT automatically apply the proposal.

#### Scenario: Recorded deviation takes precedence over a residual failed checkpoint
- **WHEN** a valid recorded skip, replacement, or abandonment deviation exists for unfinished nodes after a checkpoint failure remains in execution metadata
- **THEN** the path journey SHALL derive the candidate from the recorded deviation and identify that deviation as its trigger
- **AND** it SHALL NOT present the residual failed checkpoint as the candidate trigger.

#### Scenario: Correction cannot be generated reliably
- **WHEN** trusted execution facts, eligible governed resources, prerequisite relationships, or a material path difference are insufficient
- **THEN** the path journey SHALL expose a student-safe unavailable reason
- **AND** it SHALL NOT fabricate a correction proposal or alter the existing path.

### Requirement: Candidate correction proposals are explainable and comparable
The system SHALL show a candidate correction proposal with its trigger, node additions, removals, replacements, or ordering changes, supporting learning evidence or prerequisite facts, and estimated effect on remaining work. The comparison SHALL use persisted path and governed resource identities rather than client-supplied ordering or generated content.

#### Scenario: Student inspects a candidate correction proposal
- **WHEN** a learner opens an available candidate correction proposal
- **THEN** the UI SHALL show the original unfinished path alongside the proposed changes, the trigger, supporting facts, and estimated remaining-work effect
- **AND** it SHALL state that the proposal is not applied until a later confirmation workflow exists.

#### Scenario: Candidate has no material difference
- **WHEN** a derived candidate has the same unfinished node identities and order as the persisted path
- **THEN** the system SHALL treat the candidate as unavailable
- **AND** it SHALL NOT present it as a correction.
