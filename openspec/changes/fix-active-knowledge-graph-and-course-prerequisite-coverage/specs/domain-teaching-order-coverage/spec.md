## MODIFIED Requirements

### Requirement: Domain overview teaching order adopts engineering prerequisites
The domain Teaching Projection builder SHALL preserve valid published course-scope ACT_TEACHING PREREQUISITE edges with their strength and evidence. Applicable direct Engineering prerequisites SHALL be considered using their actual endpoint semantics and published provenance, without limiting consideration to previously bound resources. The implementing author SHALL determine missing teaching prerequisites from the approved full syllabus, unit knowledge lists and handouts. Scripts SHALL validate and materialize explicit author decisions; runtime loaders SHALL NOT infer teaching edges.

#### Scenario: Engineering post-requisite exists inside a domain overview
- **WHEN** two course-related overview members have a published engineering prerequisite applicable to the course
- **THEN** the composed projection SHALL retain its direction and engineering evidence
- **AND** the original Engineering record SHALL remain unchanged

#### Scenario: Runtime does not infer teaching order
- **WHEN** a domain-default shard is served
- **THEN** teaching edges SHALL come only from the published composed projection
- **AND** no runtime operation SHALL derive order from IDs, labels or layout

#### Scenario: Published course prerequisites are ingested
- **WHEN** a valid course prerequisite is included in the accepted source set
- **THEN** composition SHALL preserve its strength and evidence even when it is absent from the engineering snapshot

### Requirement: Domain overview concepts are teaching-connected
The coverage denominator SHALL be established independently from the complete approved module 1–5 syllabus, unit knowledge lists and existing handouts. Every course knowledge item SHALL have an explicit semantic Authority mapping or a user-accepted Authority-gap disposition, with unit evidence and prerequisite judgment. Missing resources SHALL remain visible as resource gaps and MUST NOT remove knowledge from the denominator. Mapped course-related concepts SHALL be connected through meaningful published prerequisite paths, including genuine cross-domain endpoints. Foundational concepts MAY have no predecessor but SHALL NOT be unjustifiably isolated. REQUIRED prerequisites MUST form a DAG. Non-course Authority overview objects SHALL NOT be force-included. Under the user's 2026-09-09 scope decision, accepted Authority gaps SHALL remain explicit and full-course coverage SHALL NOT be claimed.

#### Scenario: Overview has an isolated concept
- **WHEN** a course knowledge item has no justified prerequisite path to the course graph
- **THEN** candidate composition SHALL fail with the item and missing disposition identified
- **AND** it SHALL retain the previous published projection

#### Scenario: Extension edge closes a gap
- **WHEN** course content demonstrates a missing learning prerequisite
- **THEN** the implementing author SHALL record the actual source, direction, REQUIRED or RECOMMENDED strength and rationale
- **AND** the generator SHALL NOT fabricate an edge merely to satisfy connectivity

#### Scenario: Required cycle is proposed
- **WHEN** a REQUIRED prerequisite closes a directed cycle
- **THEN** candidate publication SHALL fail

#### Scenario: Unrelated overview members remain uncovered
- **WHEN** an Authority concept is absent from the approved course content and recorded denominator
- **THEN** omission from the teaching projection SHALL not fail coverage

#### Scenario: Course concept has no resource binding
- **WHEN** a unit knowledge list includes a concept without a resource binding
- **THEN** the concept SHALL remain in the coverage denominator with its explicit mapping and teaching prerequisites
- **AND** the resource gap SHALL be reported separately

#### Scenario: Same-unit concepts need an order
- **WHEN** two concepts appear in the same unit or have no encoded unit in a resource path
- **THEN** their order SHALL come from recorded teaching reasoning and source evidence
- **AND** ID order, collection order and unscheduled automatic extensions SHALL not qualify as evidence

#### Scenario: A frontier course subject is absent from the Authority
- **WHEN** the recorded course includes a subject without a matching current Authority object and the user has accepted its deferral
- **THEN** the subject SHALL remain in the course report as an Authority gap, without fabricated mapping or published prerequisite endpoints
- **AND** delivery MAY complete the existing-Authority scope while explicitly reporting that full-course coverage is incomplete
