## ADDED Requirements

### Requirement: Debrief is bound to one verified completed run
The system SHALL create a control-effect debrief only from a completed run whose scene, scenario, run identity, model/runtime identity, completion state, and telemetry summary pass the registered source contract. The first supported source SHALL be `sim/cruise` with scenario `cruise-comfort-course-turn` and model `fleet-cruise-adora`.

#### Scenario: Supported Cruise run completes
- **WHEN** the Cruise course-turn run reaches its configured completion boundary and its telemetry summary validates for the same run identity
- **THEN** the system SHALL display one debrief bound to that run
- **AND** resetting or starting a new run SHALL retire the previous debrief from the current-run surface.

#### Scenario: Run is incomplete or invalid
- **WHEN** the run is still active, paused before completion, failed, has non-finite required metrics, fails telemetry validation, or its run identity differs from the current run
- **THEN** the system SHALL show an unavailable or incomplete state
- **AND** it MUST NOT emit metric conclusions or task-threshold outcomes for that run.

### Requirement: Fact layer reports only computed metric semantics
The debrief SHALL present a fact layer using only finite metrics already produced by the bound run. Every displayed fact SHALL retain its registered label, value, unit, availability, and measurement semantics.

#### Scenario: Completed run has response metrics
- **WHEN** the bound run provides computed turn overshoot, settling time, and end-of-run heading error
- **THEN** the fact layer SHALL display those values with their units and source semantics
- **AND** it MUST distinguish end-of-run heading error from steady-state error unless the source contract explicitly identifies a steady-state-error metric.

#### Scenario: Control quantity is instantaneous
- **WHEN** the bound run provides only end-of-run rudder angle or end-of-run fin power
- **THEN** the debrief SHALL label each value as an end-of-run observation
- **AND** it MUST NOT describe either value as peak control effort, control energy, actuator demand over the run, or a constraint violation.

#### Scenario: Requested fact is unavailable
- **WHEN** a debrief metric is absent, non-finite, or lacks registered measurement semantics
- **THEN** the debrief SHALL identify that metric as unavailable or omit its value with an explicit limitation
- **AND** it MUST NOT substitute zero, estimate a replacement, or infer a qualitative result.

### Requirement: Task outcomes require authoritative threshold provenance
The debrief SHALL evaluate “满足” or “未满足” only for a metric whose bound task contract supplies a finite threshold, comparison operator, unit, and registered task identity. Each outcome SHALL remain per-metric and SHALL show both the observed value and threshold.

#### Scenario: Registered task threshold is satisfied
- **WHEN** the bound task requires turn overshoot to be at most 10 percent and the completed run reports 8 percent
- **THEN** the threshold layer SHALL state that the overshoot requirement is satisfied and show `8% ≤ 10%`
- **AND** it MUST NOT convert that result into an aggregate “表现良好”, “优秀”, “最佳”, score, or ranking conclusion.

#### Scenario: Registered task threshold is not satisfied
- **WHEN** the bound task requires settling time to be at most 45 seconds and the completed run reports 52 seconds
- **THEN** the threshold layer SHALL state that the settling-time requirement is not satisfied and show `52 s > 45 s`
- **AND** it MUST limit the conclusion to that registered requirement.

#### Scenario: Only some metrics have task thresholds
- **WHEN** the bound task provides authoritative thresholds for overshoot and settling time but not for heading error or control quantity
- **THEN** the system SHALL evaluate only overshoot and settling time
- **AND** it SHALL keep heading error and control quantity in the fact layer without pass/fail wording.

#### Scenario: Free exploration or self-entered target
- **WHEN** the run has no registered task threshold contract or the visible target was entered by the student for exploration
- **THEN** the debrief SHALL present computed facts and identify that no authoritative task judgment is available
- **AND** it MUST NOT state or imply “满足”, “未满足”, “表现良好”, “需要关注”, “优秀”, “最优”, or an official result.

### Requirement: Learning explanation preserves evidence boundaries
The debrief SHALL explain the observable meaning of available response and control-quantity facts in student-readable language and MAY suggest one next variable or trace to observe. It MUST NOT assert an uncomputed cause, prescribe an optimal controller, or represent advisory text as official evaluation.

#### Scenario: Overshoot exceeds a task threshold
- **WHEN** a completed run has an authoritative overshoot outcome of “未满足”
- **THEN** the debrief SHALL explain that the measured response exceeded the task's allowed peak deviation
- **AND** any next-step text SHALL be framed as an observation or experiment suggestion rather than a proven diagnosis.

#### Scenario: Control constraint cannot be evaluated
- **WHEN** end-of-run control observations exist but no peak, energy, or authoritative control threshold exists
- **THEN** the debrief SHALL visually separate response facts from control-quantity observations
- **AND** it SHALL state that the available data cannot determine whether control demand was excessive.

### Requirement: Debrief does not create a second evaluation authority
The debrief SHALL be a read-only projection of the current run and bound task contract. It MUST NOT recalculate plant dynamics or response metrics in the frontend, mutate the original run, write an official score or ranking, change Arena evaluation, or create learner evidence solely because the card was displayed.

#### Scenario: Debrief is rendered
- **WHEN** the system displays a completed-run debrief
- **THEN** the original telemetry summary, simulation result, Arena records, leaderboard data, and learner evidence SHALL remain unchanged
- **AND** all displayed outcomes SHALL be reproducible from the bound run facts and authoritative task thresholds.

### Requirement: First-scene acceptance covers the critical feedback states
The first Cruise integration SHALL provide deterministic acceptance coverage for a completed run satisfying available task thresholds, overshoot not satisfying its threshold, settling time not satisfying its threshold, control quantity without sufficient constraint semantics, and an incomplete or invalid run.

#### Scenario: Acceptance suite exercises all five states
- **WHEN** the focused unit/component tests and browser acceptance run for `cruise-comfort-course-turn`
- **THEN** each of the five states SHALL assert the displayed fact values, threshold provenance, permitted wording, and forbidden aggregate judgments
- **AND** the incomplete or invalid fixture SHALL assert that no deterministic debrief conclusion is rendered.
