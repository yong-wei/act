## MODIFIED Requirements

### Requirement: Interactive evidence participates in unified governance

Interactive classroom and standalone interactive evidence SHALL be classified through the unified learning evidence catalog before profile, report, or recommendation consumers rely on it. Every runtime producer SHALL preserve an explicit learning-context provenance from its launch contract; presentation properties such as `embedded` MUST NOT be the source of learning provenance.

#### Scenario: Interactive evidence is cataloged

- **WHEN** interactive classroom or standalone interactive events are inspected for governance
- **THEN** the system SHALL classify each event family by source table, canonical event type, evidence value level, profile eligibility, and traceability fields
- **AND** the classification SHALL preserve the existing durable submission and report requirements for `StudentStepResponse`, `InteractionLog`, and `LearningFact`.

#### Scenario: Direct resource launch preserves standalone provenance

- **WHEN** an authenticated learner opens an interactive resource from the independent resource surface without a classroom session
- **THEN** the runtime SHALL pass an explicit standalone launch context through the resource renderer to the shared interactive provider
- **AND** view, interaction, and completion events SHALL be eligible for the existing authenticated interactive-event ingestion path with `learningContext: 'standalone_resource'`
- **AND** the persisted event SHALL retain the source resource identity and canonical standalone surface/event classification.

#### Scenario: Classroom launch preserves classroom provenance

- **WHEN** an interactive resource is rendered inside an authorized classroom session
- **THEN** the runtime SHALL preserve the classroom session context and classify events as the applicable classroom live, review, pre-class, or post-class context
- **AND** changing standalone context propagation SHALL NOT turn classroom events into standalone events or bypass classroom access checks.

#### Scenario: Classroom knowledge-card tracking preserves classroom provenance

- **WHEN** a classroom resource renders a knowledge card through the shared resource renderer with an authorized classroom `sessionId`
- **THEN** the knowledge-card tracker SHALL receive that same classroom session context
- **AND** its open/interaction events SHALL retain the applicable classroom learning context
- **AND** the events SHALL NOT be classified as `standalone_resource` solely because the tracker was created without the caller's session identity.

#### Scenario: Interactive evidence uses canonical event type

- **WHEN** interactive event rows use legacy wrapper types such as `view`, `interact`, `submit`, or `complete`
- **THEN** governance consumers SHALL resolve the canonical type from the payload when present
- **AND** classroom and standalone evidence SHALL not be undercounted because only the wrapper type was inspected.

#### Scenario: Interactive profile contribution follows value policy

- **WHEN** interactive evidence is used for student profile or recommendation features
- **THEN** high-value submissions and completions SHALL be eligible for competency contribution
- **AND** low-value views or navigation SHALL remain activity context unless an explicit contribution rule exists.

#### Scenario: Non-learner runtime does not create learner evidence

- **WHEN** the same resource is opened anonymously or in demo mode without an authenticated learner
- **THEN** the runtime SHALL keep events local or otherwise follow the existing non-persistent behavior
- **AND** it SHALL NOT create a server-persisted learner event under an inferred or client-supplied user identity.
