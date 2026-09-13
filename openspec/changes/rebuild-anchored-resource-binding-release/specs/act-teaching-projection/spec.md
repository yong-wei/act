## MODIFIED Requirements

### Requirement: Resource bindings use stable roles and identities
Every formal resource binding MUST use a deterministic resource ID, stable atom ID, exact registered runtime subtype, Canonical ID, one of `COVERS`, `EXPLAINS`, `PRACTICES`, or `ASSESSES`, an explicit teaching scope, a precise `anchor`, and teaching-order semantics (`appearance`, `teachingOrder`, `focus`). Binding identity MUST be derived from `resourceId + anchorKey + canonicalId + role + scopeId` and MUST bind the source/content identity and the anchored resource binding release. Resource subtype and teaching role SHALL remain orthogonal; adding video, audio, podcast, card, textbook, handout/slides, exercise, simulation, project, or another registered runtime subtype MUST NOT add or change a teaching role. Multi-knowledge subtypes MUST NOT bind with a `whole` anchor. Bindings MUST NOT mutate ActKG objects or predicates.

#### Scenario: Lesson step is projected
- **WHEN** a step's `sequence.json` group names course nodes with unique canonical crosswalk rows and the step declares `PRACTICES`
- **THEN** the runtime binding SHALL preserve the exact role, subtype, `step` anchor with `stepId`, scope, source/content identity, binding release identity, Canonical identity, and `appearance`

#### Scenario: Media paragraph is projected
- **WHEN** a qualified video, audio, or podcast semantic segment explains a valid Canonical Object
- **THEN** the binding SHALL use `EXPLAINS`, retain the exact media subtype and a `time` anchor with `mediaSha256`, and receive deterministic atomic identity
- **AND** it SHALL not introduce a media-action role such as `WATCHES` or `LISTENS`

#### Scenario: Unsupported role or missing anchor is supplied
- **WHEN** authoring uses an unknown role, unregistered resource subtype, malformed resource ID, or a multi-knowledge resource without a precise anchor
- **THEN** binding release build SHALL fail closed without replacing the prior release

### Requirement: Consumer activation records independent combinations
The activation manifest MUST map each consumer to an explicit Authority release and, when required, Projection ID, course active-domain scope hash, and anchored resource binding release identity (`bindingReleaseId`, `bindingHash`). Consumers MAY pin different valid combinations, and Engineering-only consumers MAY omit a Projection and a binding release. A relation-bearing teaching consumer MUST NOT select an empty or mismatched projection for a non-empty active-domain scope, and a resource-consuming teaching consumer MUST NOT select a binding release built on another Authority release.

#### Scenario: Engineering consumer activates first
- **WHEN** an Authority snapshot is valid and no Teaching Projection or binding release exists
- **THEN** the Engineering Graph/RAG combination MAY become ready
- **AND** teaching consumers SHALL remain `NOT_PROJECTED` or pinned to their prior exact matching combination

#### Scenario: Empty projection is built
- **WHEN** ACT has a sealed empty or Engineering-only scope with no selected teaching-relation members
- **THEN** an empty Projection SHALL be legal and receive a deterministic manifest/hash
- **AND** it SHALL NOT satisfy a non-empty course active-domain selection

#### Scenario: Binding release is on another Authority
- **WHEN** the staged binding release's Authority release differs from the combination's Authority release
- **THEN** course-runtime, Konling, learning-path, and teaching-resource RAG consumers SHALL be `BLOCKED_LOCAL_DEPENDENCY`

### Requirement: Teaching resource consumers share one live course projection
All teaching-semantic consumers that read course resources or bindings MUST resolve the same live course Teaching Projection identity for prerequisites, core nodes, and cards, and the same live anchored resource binding release identity for resources and bindings. The live set is `projection/current.json`, the overlay inspector sidecar course pointer, and `resource-bindings/current.json`. Konling, path planning, course pages, drawer resources, and teaching-resource RAG MUST read bindings from the binding release and MUST NOT read `bindings.jsonl` of the course projection. Engineering-only consumers MAY keep null projection and null binding release. The domain-fragments overlay pointer and sealed consumer-activation identity MUST remain the canvas/authority identity.

#### Scenario: Binding release is activated
- **WHEN** a new anchored resource binding release is staged and activated
- **THEN** `resource-bindings/current.json` SHALL name it
- **AND** Konling, path planning, course pages, drawer, and teaching-resource RAG SHALL resolve resources and bindings from it
- **AND** `projection/current.json`, the inspector sidecar, and the domain-fragments pointer SHALL stay unchanged

#### Scenario: Binding pointer lags activation
- **WHEN** the activation manifest names a binding release but `resource-bindings/current.json` names another
- **THEN** live teaching resource overlay SHALL NOT apply
- **AND** the staging MUST NOT be marked complete
