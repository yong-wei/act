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
The authenticated intervention generation path SHALL resolve the submitted Arena task and method from the registered catalog before it creates guidance. It SHALL reject an unknown task or a method not allowed by that task.

#### Scenario: Client submits an unsupported method
- **WHEN** a request names a registered task and a method outside that task's `allowedMethods`
- **THEN** the route SHALL reject the request
- **AND** it SHALL not create an intervention or memory record.

#### Scenario: Registered Arena context is resolved on the server
- **WHEN** a request names a registered task and an allowed method
- **THEN** the server SHALL derive metric bounds and method guidance from the registry
- **AND** it SHALL not use client-supplied metric thresholds or instructional labels.

### Requirement: Arena companion cooldowns are isolated by task and method
The system SHALL derive a governed intervention identity from the server-resolved Arena task and method. It SHALL use that identity for cooldown lookup, intervention persistence, and traceable evidence context.

#### Scenario: A repeated request uses the same Arena method
- **WHEN** a student submits another practice observation for the same task and selected method while a prior intervention is in its cooldown period
- **THEN** the system SHALL return the cooldown result
- **AND** it SHALL not create another intervention for that task-method identity.

#### Scenario: A student switches to another allowed method
- **WHEN** a student has a cooling-down intervention for one allowed method and submits a practice observation using another allowed method for the same task
- **THEN** the system SHALL evaluate the newly selected method's guidance
- **AND** the persisted intervention and evidence SHALL identify the selected task-method context.

### Requirement: Companion guidance remains advisory and evidence-limited
The system SHALL distinguish an observed practice metric from an official Arena result and a governed wrong-answer attribution. Guidance SHALL not assert an unverified error cause or write an official score, LearningFact, portrait, ranking, or attribution record.

#### Scenario: Practice metric crosses an unacceptable boundary
- **WHEN** a supplied practice observation crosses the selected context's unacceptable metric boundary
- **THEN** the companion SHALL identify the observed metric as a practice constraint risk and recommend a learning action
- **AND** it SHALL not represent that observation as an official evaluation result or formal error attribution.

#### Scenario: Hidden-scenario task receives guidance
- **WHEN** the selected task has hidden scenario evaluation
- **THEN** guidance SHALL discuss only aggregate registered metrics and learning actions
- **AND** it SHALL not disclose hidden scenario parameters, ordering, traces, or evaluation internals.
