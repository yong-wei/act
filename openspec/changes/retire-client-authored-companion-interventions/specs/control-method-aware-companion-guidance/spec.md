## MODIFIED Requirements

### Requirement: Arena method context is validated from official evidence before intervention generation
For a control-workbench governed intervention, the server SHALL resolve the registered task, allowed controller method and MetricProfile from a persisted official submission owned by the authenticated student. Client-supplied task or method hints MUST NOT override the submission artifact or create an intervention without official evidence.

#### Scenario: Official submission uses an allowed method
- **WHEN** a persisted submission belongs to the current student and task and its controller artifact resolves to an allowed method
- **THEN** the server SHALL derive metric labels, bounds and method guidance from the registered task and MetricProfile
- **AND** the generated guidance SHALL retain the official submission reference.

#### Scenario: Client submits an unsupported or mismatched method
- **WHEN** a client method hint is unsupported or disagrees with the verified official submission artifact
- **THEN** the server SHALL reject or ignore the client hint before intervention generation
- **AND** it SHALL NOT create an intervention or memory record from client attempt values.

### Requirement: Arena companion rounds are isolated by official submission and task
The system SHALL derive a governed control-workbench intervention identity from the authenticated student, registered task and scoped official submission reference. It SHALL use that identity for deduplication, persistence and traceable evidence. A task-method time cooldown MUST NOT replace the official-submission round identity.

#### Scenario: The same official submission is processed again
- **WHEN** a student or client repeats processing for the same scoped official submission
- **THEN** the system SHALL reuse or return the existing round result
- **AND** it SHALL not create another intervention for that submission.

#### Scenario: A follow-up official submission is available
- **WHEN** the same student makes a new official submission for the same task after a companion round
- **THEN** the new submission SHALL close the prior round and MAY start a new eligible round
- **AND** an older task-method time cooldown SHALL NOT suppress the verified follow-up.

### Requirement: Companion guidance remains advisory and evidence-limited
Control-workbench governed guidance SHALL distinguish official Arena evidence from previews and client observations. It SHALL not assert an unverified error cause or write an official score, LearningFact, portrait, ranking or attribution record. Client-authored practice observations MAY support non-persistent local explanation only when clearly identified as non-official, and MUST NOT create governed interventions, cooldowns, Memory or verification rounds.

#### Scenario: Client observation crosses a displayed boundary
- **WHEN** a preview or hand-entered observation crosses a displayed instructional boundary without an official submission
- **THEN** the interface MAY explain the observation as non-official local guidance
- **AND** it SHALL NOT persist it as an Arena companion intervention or represent it as an official constraint result.

#### Scenario: Official hidden-scenario task receives guidance
- **WHEN** a verified official submission belongs to a hidden-scenario task
- **THEN** guidance SHALL discuss only aggregate registered metrics and learning actions available in the official result
- **AND** it SHALL not disclose hidden scenario parameters, ordering, traces or evaluation internals.
