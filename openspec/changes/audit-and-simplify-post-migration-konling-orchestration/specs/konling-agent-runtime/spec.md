## ADDED Requirements

### Requirement: Post-migration Konling orchestration is simplified without changing authority
Konling SHALL retain one application coordinator while delegating domain decisions through existing public APIs. The simplification MUST preserve tool availability, permissions, approval, idempotency, context projection, citations, session persistence, privacy, structured actions, and student-safe failure behavior. Completion MUST reduce repeated orchestration logic, direct cross-domain implementation imports, or obsolete compatibility code without introducing a second runtime framework.

#### Scenario: Existing Konling behavior is replayed
- **WHEN** the current tool, context, citation, session, and failure characterization cases run after the simplification
- **THEN** their observable responses, persisted effects, permissions, and error behavior remain equivalent

#### Scenario: Domain logic would move into a generic dispatcher
- **WHEN** a proposed simplification would copy domain policy into a new generic Konling layer
- **THEN** the proposal is rejected and the existing domain public API remains authoritative
