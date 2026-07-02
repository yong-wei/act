## ADDED Requirements

### Requirement: Teachers inspect K/A/Q evidence traces for authorized classes
The system SHALL provide a teacher-facing K/A/Q evidence trace surface for authorized class contexts.

#### Scenario: Teacher opens class K/A/Q evidence trace
- **WHEN** an authorized teacher opens `/teacher/classes/[classId]/kaq-evidence-trace`
- **THEN** the surface SHALL allow selecting or receiving a K/A/Q graph node or objective context
- **AND** it SHALL show node identity, objective or portrait mapping, SAR associated evidence summary, safe top events, class or student evidence counts, resource coverage gaps, candidate resources, trace limitations, and relevant return links.

#### Scenario: Teacher requests a student-scoped trace
- **WHEN** an authorized teacher filters the trace to a student in the class
- **THEN** the surface SHALL show only evidence permitted for that teacher and student context
- **AND** it SHALL preserve redacted summaries instead of raw learner answers.

### Requirement: Teacher K/A/Q evidence trace enforces privacy scope
The teacher K/A/Q evidence trace surface SHALL enforce class authorization and SAR privacy scope before exposing evidence.

#### Scenario: Unauthorized or restricted evidence is reached
- **WHEN** a teacher requests another class, another teacher's student, audit-only evidence, hidden Arena internals, private Konling memory, or raw learner submissions
- **THEN** the system SHALL reject, omit, or redact that evidence
- **AND** the trace SHALL expose safe limitation codes without leaking restricted content.
