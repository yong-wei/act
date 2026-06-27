## ADDED Requirements

### Requirement: Teacher report delivery shall be represented by a delivery ledger
Teacher report surfaces SHALL expose report delivery status across class review, class analytics, teacher home, history, and report-book entries.

#### Scenario: Report ready for delivery
- **WHEN** a class/session report is ready
- **THEN** every supported teacher surface SHALL show the same report identity, class/session context, and delivery state
- **AND** actions SHALL include supported export, send/publish, copy-summary, or grading entry points.

#### Scenario: Missing delivery context
- **WHEN** a report action lacks class, session, or report context
- **THEN** the UI SHALL show a blocked or degraded state with recovery actions
- **AND** it SHALL NOT route the teacher to an internal review aggregation page as the delivery endpoint.

### Requirement: Report delivery actions shall produce visible and auditable status
Export, send, publish, copy-summary, and grading handoff actions SHALL show loading, ready, success, failure, and retry states.

#### Scenario: Export report
- **WHEN** a teacher exports a report
- **THEN** the UI SHALL show file readiness or failure
- **AND** the delivery ledger SHALL record actor id or role, report id, class id, session id, lesson id, action id, idempotency key, action timestamp, recipient or delivery scope, artifact ref, and action outcome.
- **AND** artifact refs and copied summaries SHALL be redacted for student-safe delivery and SHALL NOT expose private raw evidence, internal report JSON, or hidden AI context.

#### Scenario: Assistant-effect report unavailable
- **WHEN** a teacher report slot references an assistant-effect report that is missing or demo-only
- **THEN** the ledger SHALL show an unavailable or degraded report state with a recovery action
- **AND** it SHALL NOT present the slot as a deliverable real class report.
