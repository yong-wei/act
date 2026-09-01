## ADDED Requirements

### Requirement: Student-facing Konling context endpoints expose only bounded public projections

Every Konling endpoint reachable by a student browser SHALL either return no runtime context or return an explicit allowlisted student-safe projection. Complete learner-state, plan, knowledge-workspace, teaching-projection, dual-domain provenance, scoped-memory, permitted-tool and missing-context structures SHALL remain server-side.

#### Scenario: Student requests the internal context endpoint
- **WHEN** an authenticated student requests a Konling context endpoint that previously returned the complete runtime DTO
- **THEN** the endpoint SHALL be unavailable to that student or return only a separately defined bounded public projection
- **AND** the raw response SHALL contain no private memory, internal provenance, permitted-tool list, missing-context code or raw domain context.

#### Scenario: A product surface needs context availability
- **WHEN** a student-facing product surface has a verified need to explain Konling availability or limitations
- **THEN** the server SHALL map only the required state into product-safe language and approved public fields
- **AND** it SHALL NOT serialize the internal DTO and rely on browser filtering or field omission after receipt.

#### Scenario: Server invokes the model with governed context
- **WHEN** a supported Konling mode builds server-owned model grounding
- **THEN** private learner context and permitted tools MAY remain available inside the authorized service boundary
- **AND** removing the public endpoint SHALL NOT remove that server-side grounding.

#### Scenario: Tests inspect runtime context
- **WHEN** automated tests need to verify internal context construction
- **THEN** they SHALL inspect server-owned builders or restricted diagnostics
- **AND** a production student-readable endpoint SHALL NOT be retained solely for test introspection.

