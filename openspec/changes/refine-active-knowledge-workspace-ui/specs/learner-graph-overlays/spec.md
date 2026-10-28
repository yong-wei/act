## ADDED Requirements

### Requirement: Active Authority graph exposes a self-scoped mastery overlay

The system SHALL provide a server-owned mastery overlay for the new (active Authority) knowledge graph, returned only to the signed-in student about their own learning facts. The overlay SHALL be a separate payload from graph shards and SHALL NOT change graph coordinates, membership or relations.

Overlay identity SHALL come only from (a) learning facts stored with the Canonical identity namespace whose Canonical object belongs to the current active graph, and (b) historical facts resolved at read time through the reviewed Legacy→Canonical crosswalk published with the runtime Teaching Projection. Same-name matching SHALL NOT be used, historical facts SHALL NOT be rewritten or backfilled, and crosswalk rows marked stale SHALL NOT contribute.

#### Scenario: Student requests the overlay

- **WHEN** a signed-in student requests the active graph mastery overlay
- **THEN** the response SHALL contain per-domain summaries and per-object items with mastery state (mastered, developing, weak, evidence-needed), score or null, confidence and evidence count
- **AND** it SHALL NOT include raw answers, event payloads, other learners' data or internal identifiers beyond the graph object references the client already holds.

#### Scenario: No mappable evidence exists

- **WHEN** the student has no Canonical facts and no crosswalk-resolvable historical facts for the active graph
- **THEN** the overlay SHALL report an empty status with coverage counts
- **AND** the workspace SHALL show a neutral "暂无掌握度数据" note instead of colouring nodes as weak or not started.

#### Scenario: Teacher or administrator opens the graph

- **WHEN** a teacher or administrator requests the overlay
- **THEN** the system SHALL return a not-applicable status without any learner data.

#### Scenario: Unauthenticated request

- **WHEN** the overlay is requested without a session
- **THEN** the system SHALL reject it with 401 and expose no learner state.
