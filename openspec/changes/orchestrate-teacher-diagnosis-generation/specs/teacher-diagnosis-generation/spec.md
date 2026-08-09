## ADDED Requirements

### Requirement: Teachers can request server-owned diagnosis generation

The system SHALL allow an authenticated teacher to request a class- or student-scoped diagnosis generation job from the existing teacher workspace. The server SHALL derive and authorize the scope, SHALL NOT accept a factual report body from the browser, and SHALL return a durable job projection.

#### Scenario: Teacher requests a class diagnosis

- **WHEN** a teacher requests generation for an active class they own with a valid idempotency key
- **THEN** the server SHALL create or reuse an authorized class-scoped generation job
- **AND** the evidence cutoff and generator version SHALL be fixed at job creation.

#### Scenario: Teacher requests a student diagnosis

- **WHEN** a teacher requests generation for a current member of an active class they own
- **THEN** the server SHALL create or reuse a student-scoped generation job
- **AND** it SHALL reject students outside that class.

#### Scenario: Browser submits report facts

- **WHEN** a browser includes report findings, evidence, or other factual report content in a generation request
- **THEN** the server SHALL reject the request
- **AND** it SHALL NOT persist a diagnosis report.

### Requirement: Generation is durable and idempotent

The system SHALL persist generation lifecycle state independently of queue delivery. The same idempotency key SHALL identify one logical job, and a diagnosis scope SHALL have at most one queued or running job at a time.

#### Scenario: A request is repeated

- **WHEN** the same idempotency key is submitted more than once
- **THEN** every response SHALL identify the same job
- **AND** no duplicate report SHALL be created.

#### Scenario: Different clicks overlap for one scope

- **WHEN** a second request key targets a scope with an active job
- **THEN** the server SHALL return the active job rather than start concurrent generation.

#### Scenario: A completed scope is generated again

- **WHEN** a teacher submits a new request key after the prior job completed
- **THEN** the server SHALL create a new job with a new evidence cutoff
- **AND** the resulting report SHALL remain a distinct historical snapshot.

### Requirement: Governed evidence bounds every execution attempt

Every attempt SHALL invoke the Konling `teacher-diagnosis` mode with only its allowlisted tools and the job's fixed evidence cutoff. Automatic and explicit retries SHALL retain that cutoff.

#### Scenario: A retry executes after new evidence arrives

- **WHEN** an existing job is retried after later learning evidence was recorded
- **THEN** the retry SHALL exclude evidence later than the original cutoff
- **AND** its audit record SHALL remain attached to the original job.

### Requirement: Only validated structured output becomes a report

The system SHALL validate the model's structured output against the report schema and SHALL revalidate evidence references, cutoff, scope, finding allowlists, and tool provenance on the server. Report creation, job association, and successful completion SHALL be atomic.

#### Scenario: Generated output passes governance

- **WHEN** structured output and all referenced evidence pass server validation
- **THEN** the system SHALL create exactly one report for the job
- **AND** mark the job completed with an auditable report reference.

#### Scenario: Generated output fails governance

- **WHEN** output is malformed, cites unobserved evidence, crosses scope, or exceeds the cutoff
- **THEN** the system SHALL record a non-retryable validation failure
- **AND** SHALL NOT persist any partial report.

### Requirement: Failure and retry states remain observable

The system SHALL distinguish queued, running, completed, failed, and timed-out generation states. Recoverable execution failures MAY be retried automatically up to three attempts; deterministic validation or authorization failures SHALL NOT be automatically retried. Teachers SHALL be able to explicitly retry an eligible terminal job.

#### Scenario: Queue delivery fails

- **WHEN** the durable job is created but queue delivery fails
- **THEN** the job SHALL remain queryable with a failure state
- **AND** the teacher SHALL be able to retry delivery.

#### Scenario: Generation times out

- **WHEN** an execution exceeds the configured deadline and automatic attempts are exhausted
- **THEN** the job SHALL enter a timed-out state
- **AND** retain its attempts for audit and explicit retry.

