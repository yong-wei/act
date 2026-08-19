## Purpose

Define fixed, role-safe diagnosis report delivery artifacts and auditable teacher actions without changing diagnosis evidence, creating teaching objects, or sending reports automatically.

## ADDED Requirements

### Requirement: Delivery projections bind to an immutable diagnosis version
The system SHALL derive every teacher or student-safe delivery projection from one persisted diagnosis report, a projection version, a role version, and an audience identity when applicable. Repeating a projection with the same inputs SHALL preserve the same content identity and SHALL NOT generate another diagnosis.

#### Scenario: Teacher repeats an export
- **WHEN** an authorized teacher exports the same report with the same projection and role versions
- **THEN** the system SHALL return the same artifact identity and content hash
- **AND** it SHALL append an export audit event without creating another diagnosis report.

#### Scenario: Delivery inputs change
- **WHEN** the persisted report, projection version, role version, or student audience changes
- **THEN** the system SHALL use a different delivery identity.

### Requirement: Teacher delivery remains authorized and privacy-safe
The system SHALL authorize teacher detail, print, PDF, evidence, and action reads from the server-owned session and current class ownership. Teacher delivery SHALL omit raw answers, private dialogue, hidden assessment content, raw evidence payloads, and opaque evidence-reference identifiers.

#### Scenario: Non-owner requests a teacher report
- **WHEN** a teacher who does not own the report class requests a teacher delivery surface or PDF
- **THEN** the server SHALL reject the request without exposing report metadata or artifact existence.

#### Scenario: Teacher inspects a conclusion
- **WHEN** a teacher expands a report finding
- **THEN** the system SHALL show an allowlisted evidence-source summary or an explicit unavailable reason
- **AND** it SHALL NOT expose raw evidence identifiers or values.

### Requirement: Student delivery is an independent safe projection
The student-safe projection SHALL be available only for a student-scoped report. It SHALL contain the target student's personal conclusions, evidence summary, limitations, suggestions, cutoff, and version, and SHALL exclude peer data, class distributions, teacher-only explanation, force reasons, internal disposition, raw answers, private dialogue, hidden assessment content, and opaque evidence references.

#### Scenario: Student reads their own report
- **WHEN** the authenticated target student requests the student-safe page or PDF
- **THEN** the server SHALL return only that report's student-safe projection.

#### Scenario: Teacher previews a student-safe report
- **WHEN** the owning teacher requests a student-safe projection for a current class member
- **THEN** the server SHALL return the same role-versioned content used for that student audience.

#### Scenario: Class report has no personal projection
- **WHEN** a student-safe projection is requested from a class-scoped report
- **THEN** the server SHALL fail closed rather than infer personal conclusions from class findings.

### Requirement: PDF delivery is reproducible and auditable
The system SHALL generate teacher and student-safe PDFs on the server with A4 pagination, embedded Chinese-capable fonts, a report-version footer, and deterministic content. It SHALL persist artifact identity, content hash, artifact hash, projection and role versions, audience, creator, and creation time, and SHALL record each successful export actor and time.

#### Scenario: PDF generation succeeds
- **WHEN** an authorized actor exports a valid fixed projection
- **THEN** the response SHALL download the corresponding PDF
- **AND** the export ledger SHALL bind the actor to the stable artifact.

#### Scenario: PDF generation fails
- **WHEN** projection validation, font loading, rendering, storage, or authorization fails
- **THEN** the system SHALL return an explicit failure and recovery message
- **AND** it SHALL NOT record a successful export or send a report.

### Requirement: Teaching actions use existing authorized destinations only
The teacher delivery surface SHALL offer student detail, preparation, and remediation-resource links only when the destination is server-authorized and already exists. Opening a destination SHALL NOT create a preparation pack, remediation task, intervention, or assignment.

#### Scenario: Registered remediation resource exists
- **WHEN** a finding has a governed knowledge-node binding and an accessible registered teaching resource
- **THEN** the teacher MAY open that existing destination from the report.

#### Scenario: No registered resource exists
- **WHEN** no accessible registered resource is bound to the finding
- **THEN** the report SHALL state that no registered remediation resource is available
- **AND** it SHALL NOT manufacture a link.

### Requirement: Teacher disposition is append-only and separate from risk
The system SHALL allow the owning teacher to record viewed, pending, intervention-arranged, and completed disposition events against a report or stable finding target. Each event SHALL retain teacher, report, target, action, optional existing-action reference, idempotency identity, result, and time. Disposition SHALL NOT modify diagnosis content, evidence-derived risk, learner state, grade, or trend.

#### Scenario: Teacher records a disposition
- **WHEN** the owning teacher records an allowed action with a valid idempotency identity
- **THEN** the server SHALL append or return one matching audit event
- **AND** authorized report reads SHALL show the latest disposition independently from risk severity.

#### Scenario: Teacher completes handling
- **WHEN** the latest disposition becomes completed while supporting risk remains current
- **THEN** the interface SHALL continue to show the original risk judgment
- **AND** it SHALL identify only the human handling state as completed.

#### Scenario: Invalid action reference is supplied
- **WHEN** an intervention-arranged event references an unauthorized, missing, or automatically requested object
- **THEN** the server SHALL reject the event without creating that object or appending a success record.

### Requirement: Delivery surfaces support presentation and recovery
Teacher and student-safe report pages SHALL provide print-ready desktop layouts and usable 320px controls. Loading, empty, unauthorized, export-failed, and action-failed states SHALL explain the result and provide an allowed recovery action.

#### Scenario: Teacher presents a report
- **WHEN** the teacher opens the fixed report detail at desktop width or prints it
- **THEN** the report SHALL preserve readable hierarchy, evidence cutoff, version footer, and privacy labels.

#### Scenario: Mobile delivery action fails
- **WHEN** export or disposition fails at 320px width
- **THEN** the failure reason and retry or return action SHALL remain visible without horizontal loss of the report content.
