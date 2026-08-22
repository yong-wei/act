## MODIFIED Requirements

### Requirement: Resource segments bind to graph nodes and usage scenes
The system SHALL support graph-aware and scene-aware resource atom metadata for registered teaching resources. Formal binding atoms SHALL use one stable semantic paragraph for video, audio, podcast, textbook, Knowledge Card, handout, lecture, slide text, or another text-bearing resource, and one stable question/task item for an exercise. Every atom SHALL preserve parent resource, exact runtime subtype, source and content identity, stable atom ID, precise launch anchor, Canonical refs, teaching roles, scene availability, citation readiness, evidence capability, formal disposition, and governance limitations.

#### Scenario: Segment graph profile is generated
- **WHEN** a textbook paragraph, card paragraph, handout paragraph, media semantic paragraph, slide text paragraph, exercise item, simulation task, or Arena protocol is projected
- **THEN** the atom SHALL expose stable atom and parent-resource IDs, exact subtype, source/content hashes, precise anchor, Canonical refs, scene availability, citation readiness, evidence capability, formal disposition, and limitations
- **AND** container-level or retrieval-window identity SHALL not replace the formal atomic anchor

#### Scenario: Scene availability is evaluated
- **WHEN** a resource atom is considered for path planning, Konling, diagnosis, grading, prep-pack, reporting, or formal graph launch
- **THEN** the semantic projection SHALL expose whether the atom is allowed for that scene
- **AND** a disallowed scene SHALL be represented as a limitation rather than silently included

#### Scenario: Exercise item changes
- **WHEN** a stable question ID retains its name but the stem, options, answer, or explanation hash changes
- **THEN** its formal Canonical bindings SHALL become stale
- **AND** the stable ID alone SHALL not preserve formal eligibility

### Requirement: Runtime resource segments bind to graph nodes and usage scenes
The system SHALL support graph-aware and scene-aware atom metadata for registered runtime teaching resources while distinguishing development, candidate, excluded, and formal-included states. A qualified automatic pipeline result MAY become formally eligible without per-item human review only when the exact pipeline qualification and every atom-level gate pass. Model- or prompt-derived output without matching qualification, or any exceptional item, SHALL remain provisional or enter the repository review/disposition artifacts.

#### Scenario: Runtime card or infograph segment is generated
- **WHEN** a Knowledge Card, infograph, lesson figure, text paragraph, or media asset is projected for grounding
- **THEN** the atom SHALL expose source/content identity, stable anchor, Canonical refs, exact subtype, scene availability, citation readiness, AI-use permission, formal state, pipeline lineage, and bounded limitations
- **AND** an unqualified model or prompt output SHALL remain provisional
- **AND** a qualified item SHALL record pipeline version/configuration, qualification receipt, input/output hashes, confidence, and stale-invalidation rules before formal use

#### Scenario: Runtime lesson media is segmented
- **WHEN** video, audio, podcast, image, or slide media is projected from runtime content
- **THEN** its instructional atoms SHALL declare semantic-paragraph, time, page, image, or slide anchors as applicable and bind final media/content identity
- **AND** missing transcript, start time, stable anchor, graph binding, citation policy, source identity, qualification, or AI-use permission SHALL exclude the affected resource from formal admission

#### Scenario: Runtime text is resegmented
- **WHEN** a textbook, card, handout, lecture, or slide-text resource changes
- **THEN** only atoms with unchanged stable IDs and content hashes MAY receive deterministic revalidation
- **AND** changed, added, or removed atoms SHALL be re-dispositioned before formal inclusion

## ADDED Requirements

### Requirement: Formal binding does not imply path eligibility or learning evidence
A formal atomic Canonical binding, graph marker, drawer launch, playback, read, or exercise open SHALL NOT by itself make an atom a PathNode, authorize a planning scene, establish mastery, or emit a learning fact. Existing ResourceNode, PlanningUnit, event, assessment, authorization, privacy, and evidence contracts SHALL remain independently required.

#### Scenario: Bound media paragraph is launched
- **WHEN** a learner opens a formal video paragraph at its governed start time
- **THEN** the launch SHALL preserve the resource and atom context for existing feature-owned event contracts
- **AND** the binding or playback SHALL not automatically create mastery evidence or path eligibility

#### Scenario: Bound exercise item exists
- **WHEN** an exercise item has a formal `ASSESSES` binding
- **THEN** the item SHALL still require its existing assessment, authorization, scoring, and evidence contracts before producing a learning fact
- **AND** the graph binding SHALL not reveal answers or scoring payloads
