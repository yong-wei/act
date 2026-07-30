## ADDED Requirements

### Requirement: Teacher diagnosis tools preserve authorized class scope

The system SHALL provide a teacher-only `teacher-diagnosis` runtime mode with `get_student_risk_flags`, `get_class_competency_summary`, and `get_student_knowledge_progress`. Every invocation SHALL revalidate the authenticated teacher's active class ownership, and student-scoped invocations SHALL require current membership in that class.

#### Scenario: Teacher requests class diagnosis evidence

- **WHEN** an authenticated teacher invokes a diagnosis tool for an active class they own
- **THEN** the tool SHALL return only members of that class
- **AND** the result SHALL include evidence references, evidence cutoff, source coverage, confidence, and privacy class.

#### Scenario: Teacher requests an unauthorized student

- **WHEN** a diagnosis tool targets a student outside the authenticated teacher's active class
- **THEN** the tool SHALL reject the request
- **AND** it SHALL NOT return class or learner evidence.

#### Scenario: Risk evidence is returned

- **WHEN** the risk tool returns current risk flags
- **THEN** it SHALL include only `constraint`, `stagnation`, and `cross_domain`
- **AND** it SHALL return whitelisted summaries rather than raw evidence JSON, submissions, answers, or private dialogue.

### Requirement: Diagnosis reports are authorized and evidence-backed

The system SHALL persist and read structured class and student diagnosis reports through a teacher-authorized API. Scope SHALL be derived by the server and each report SHALL retain class, creator, optional target student, evidence references, evidence cutoff, source coverage, confidence, limitations, and generator version.

#### Scenario: Teacher writes a student diagnosis report

- **WHEN** an authenticated teacher writes a report for a current member of an active class they own
- **THEN** the system SHALL persist server-derived class and student scope
- **AND** findings with a knowledge-node identifier SHALL receive a preparation navigation link
- **AND** no teaching action SHALL be created automatically.

#### Scenario: Report includes raw private evidence

- **WHEN** a report contains raw answers, event payloads, private dialogue, parser output, or raw evidence JSON
- **THEN** the system SHALL reject the write.

#### Scenario: Teacher reads diagnosis history

- **WHEN** an authenticated teacher reads class or student diagnosis history
- **THEN** the system SHALL repeat class ownership and student-membership authorization
- **AND** it SHALL return only reports in the requested server-derived scope.
