# control-method-aware-companion-guidance Specification

## Purpose
Define task- and control-method-aware AI companion guidance for Arena practice while preserving the boundary between practice observations and official evaluation.
## Requirements
### Requirement: Arena companion context is derived from registered tasks
The system SHALL derive an Arena companion context from a registered challenge task, one of its allowed methods, and the task's registered metric profile. The context SHALL expose only method-relevant parameter labels, observable metric definitions, and aggregate instructional guidance.

#### Scenario: PID task retains time-domain guidance
- **WHEN** a companion request selects a registered task that allows `pid`
- **THEN** the context SHALL retain PID-relevant parameters and time-domain metric guidance
- **AND** it SHALL not require a caller to supply PID thresholds or labels.

#### Scenario: MPC task uses its registered metrics
- **WHEN** a companion request selects the registered MPC challenge and `mpc`
- **THEN** the context SHALL use the task metric profile's hidden-scenario aggregate, settling-time, control-energy, and overshoot metrics
- **AND** the generated learning guidance SHALL discuss constrained predictive-control exploration rather than PID-only tuning.

#### Scenario: Black-box task uses identification guidance
- **WHEN** a companion request selects the registered black-box challenge and `black-box-control`
- **THEN** the context SHALL use the task metric profile's tracking error, worst-case deviation, control energy, and constraint-violation metrics
- **AND** the generated learning guidance SHALL recommend experiment coverage and identification validation rather than PID gain adjustment.

### Requirement: Arena method context is validated before intervention generation
For a control-workbench governed intervention, the server SHALL resolve the registered task, allowed controller method and MetricProfile from a persisted official submission owned by the authenticated student. Client-supplied task or method hints MUST NOT override the submission artifact or create an intervention without official evidence. The authenticated intervention generation path SHALL reject an Arena task or method that arrives only with client-authored attempt state.

#### Scenario: Official submission uses an allowed method
- **WHEN** a persisted submission belongs to the current student and task and its controller artifact resolves to an allowed method
- **THEN** the server SHALL derive metric labels, bounds and method guidance from the registered task and MetricProfile
- **AND** the generated guidance SHALL retain the official submission reference.

#### Scenario: Client submits an unsupported or mismatched method
- **WHEN** a client method hint is unsupported or disagrees with the verified official submission artifact
- **THEN** the server SHALL reject or ignore the client hint before intervention generation
- **AND** it SHALL NOT create an intervention or memory record from client attempt values.

#### Scenario: Client submits an unsupported method
- **WHEN** a request names a registered task and a method outside that task's `allowedMethods` without a verified official submission
- **THEN** the route SHALL reject the request
- **AND** it SHALL not create an intervention or memory record.

#### Scenario: Registered Arena context is resolved on the server
- **WHEN** a request names a registered task and an allowed method without a verified official submission
- **THEN** the Arena generate path SHALL reject the request
- **AND** it SHALL not create an intervention from client-supplied metric thresholds or instructional labels.

### Requirement: Arena companion cooldowns are isolated by task and method
The system SHALL derive a governed control-workbench intervention identity from the authenticated student, registered task and scoped official submission reference. It SHALL use that identity for deduplication, persistence and traceable evidence. A task-method time cooldown MUST NOT replace the official-submission round identity.

#### Scenario: The same official submission is processed again
- **WHEN** a student or client repeats processing for the same scoped official submission
- **THEN** the system SHALL reuse or return the existing round result
- **AND** it SHALL not create another intervention for that submission.

#### Scenario: A follow-up official submission is available
- **WHEN** the same student makes a new official submission for the same task after a companion round
- **THEN** the new submission SHALL close the prior round and MAY start a new eligible round
- **AND** an older task-method time cooldown SHALL NOT suppress the verified follow-up.

#### Scenario: A repeated request uses the same Arena method
- **WHEN** a student submits another client-authored practice observation for the same task and selected method
- **THEN** the system SHALL NOT create a governed Arena intervention from that observation
- **AND** it SHALL NOT use a task-method cooldown as a substitute official round identity.

#### Scenario: A student switches to another allowed method
- **WHEN** a student switches client method hints without a new official submission
- **THEN** the system SHALL NOT persist a new governed Arena intervention from the client observation.

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

#### Scenario: Practice metric crosses an unacceptable boundary
- **WHEN** a supplied practice observation crosses a displayed instructional boundary without an official submission
- **THEN** the companion SHALL NOT persist that observation as a governed Arena intervention
- **AND** it SHALL not represent that observation as an official evaluation result or formal error attribution.

#### Scenario: Hidden-scenario task receives guidance
- **WHEN** the selected task has hidden scenario evaluation
- **THEN** official guidance SHALL discuss only aggregate registered metrics and learning actions
- **AND** it SHALL not disclose hidden scenario parameters, ordering, traces, or evaluation internals.

