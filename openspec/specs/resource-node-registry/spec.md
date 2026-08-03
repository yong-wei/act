# resource-node-registry Specification

## Purpose
Defines the ResourceNode planning contract and audit builder used to map verified platform resource records into adaptive-learning path candidates without copying renderable content or teacher-owned catalog metadata.
## Requirements
### Requirement: ResourceNode registry builder covers supplied path-plannable resource records
The system SHALL provide ResourceNode contracts and a registry builder that represent supplied path-plannable resource records independently from their rendering implementation.

#### Scenario: ResourceNode types are registered
- **WHEN** supplied resource records are mapped and audited
- **THEN** it SHALL support existing resource node types and the adaptive path semantics required by the path center
- **AND** each node SHALL include stable id, title, resource type, path display semantics, `sourceKind`, `sourceRef`, render target field, launch target field, and eligibility status.
- **AND** the builder SHALL NOT invent a render or launch target when the source record does not provide a verified target.

### Requirement: ResourceNode metadata follows source-of-record ownership
The system SHALL keep planning metadata, semantic resource mappings, and projection status separate from records that own renderable content and teacher-editable resource metadata.

#### Scenario: Unified resource semantics are mapped
- **WHEN** a runtime lesson, TeachingResource, knowledge card, media asset, simulation, Arena task, grading artifact, or external resource is mapped into unified resource semantics
- **THEN** the semantic layer SHALL store stable identity, source references, content hash where available, knowledge mapping, ability mapping, citation target references, projection status, and governance metadata
- **AND** the original source record SHALL remain the source of record for raw content, renderable payload, teacher-editable catalog fields, hidden evaluation internals, and raw learner submissions.

#### Scenario: Planning unit is path eligible
- **WHEN** a PlanningUnit is considered for adaptive path generation
- **THEN** it SHALL be represented through an audited ResourceNode or generated checkpoint contract before it can become a PathNode
- **AND** ResourceNode audit, eligibility, launch target, privacy policy, evidence instrumentation, readiness metadata, and path semantics SHALL remain authoritative.

#### Scenario: Retrieval chunk is indexed
- **WHEN** a ResourceSegment produces a RetrievalChunk
- **THEN** the chunk SHALL reference the ResourceSegment and CitationTarget
- **AND** the chunk SHALL NOT become a path-plannable node unless a separate PlanningUnit and ResourceNode audit exist.

### Requirement: ResourceNode graph supports planning constraints
The system SHALL expose graph edges and metadata needed by downstream adaptive path planning.

#### Scenario: Planner consumes ResourceNode graph profile
- **WHEN** graph-driven path planning reads ResourceNodes
- **THEN** the planner SHALL receive only audited graph profile, planning, readiness, evidence, citation, privacy, and governance metadata
- **AND** it SHALL NOT inspect raw resource content, raw chunks, media bytes, hidden Arena internals, or private learner evidence to decide path eligibility.

### Requirement: Registry audits protect path quality
The system SHALL audit path-eligible resources.

#### Scenario: Segment is retrievable but not path eligible
- **WHEN** a resource segment or retrieval chunk has graph binding or citation readiness but lacks ResourceNode path audit approval
- **THEN** the audit SHALL keep it out of path generation
- **AND** diagnostics SHALL distinguish retrieval readiness from path eligibility.

#### Scenario: ResourceNode is incomplete
- **WHEN** a ResourceNode lacks a verified render or launch target, knowledge mapping, valid prerequisite references, availability, privacy policy, or evidence instrumentation required for path execution
- **THEN** the audit SHALL mark the node as not path-eligible
- **AND** diagnostics SHALL identify the missing governance field rather than treating segment or chunk readiness as a substitute for ResourceNode path audit approval.

### Requirement: Registry provides an audited control-correction seed graph
The system SHALL provide a versioned ResourceNode seed graph for the `control-correction` goal.

#### Scenario: Seed graph is loaded
- **WHEN** the ResourceNode registry loads the control-correction seed graph
- **THEN** it SHALL expose path-eligible nodes for knowledge card, handout or lecture, video, quiz, simulation, Arena task, reflection, and AI intervention resources
- **AND** each node SHALL include stable id, source reference, launch target, knowledge coverage, estimated time, prerequisite edges, evidence instrumentation, privacy policy, and eligibility status.

#### Scenario: Seed node is incomplete
- **WHEN** a control-correction seed node lacks a verified launch target, knowledge mapping, evidence instrumentation, prerequisite validity, or privacy policy
- **THEN** the registry audit SHALL mark the node as not path-eligible
- **AND** it SHALL expose an audit reason suitable for teacher or admin review.

#### Scenario: Terminal validation node is registered
- **WHEN** a simulation or Arena seed node is intended to validate transfer
- **THEN** the registry SHALL mark its terminal or validation role explicitly
- **AND** downstream planners SHALL be able to require that role without hard-coding node ids.

### Requirement: ResourceNode registry supports adaptive path node semantics
The ResourceNode registry SHALL expose stable path node semantics for the adaptive learning path center.

#### Scenario: Path node types are registered
- **WHEN** supplied resource records are mapped for adaptive paths
- **THEN** the registry SHALL support `interactive_lesson`, `knowledge_card`, `adaptive_quiz`, `control_workbench`, `simulation`, `arena_task`, `external_resource`, `reflection`, `checkpoint`, and `konling` path node semantics
- **AND** each node SHALL include stable id, title, display name, icon key, launch target when applicable, evidence behavior, and eligibility status.

#### Scenario: Checkpoint node is mapped
- **WHEN** a checkpoint is added to a path
- **THEN** it SHALL include assessment purpose, criteria, required evidence, pass/fail or review state, and remediation behavior
- **AND** it SHALL be distinguishable from ordinary learning resources in downstream payloads.

### Requirement: External resources are governed before path eligibility
External resources SHALL be audited before they can appear as path-eligible nodes.

#### Scenario: External resource is complete
- **WHEN** an external resource is registered for path use
- **THEN** it SHALL include title, source, URL, estimated time, knowledge coverage, applicable goal, evidence-use status, and privacy policy
- **AND** it MAY become path-eligible after audit.

#### Scenario: External resource is incomplete
- **WHEN** an external resource lacks required metadata, safe URL policy, knowledge coverage, or evidence-use status
- **THEN** the audit SHALL mark it as not path-eligible
- **AND** teacher/admin diagnostics SHALL explain the missing governance field.

### Requirement: Path icon semantics are centralized
Path resource icons and visual shape hints SHALL be generated from a central contract rather than page-local mapping.

#### Scenario: Path payload is consumed by UI
- **WHEN** path comparison, execution, or history UI renders a path node
- **THEN** the node SHALL provide stable type, display name, icon key, shape hint, and evidence status
- **AND** each surface SHALL render the same type with the same core visual semantics.

### Requirement: Resource nodes expose adaptive path readiness metadata
ResourceNodes that can appear in adaptive learning paths SHALL expose readiness metadata when their execution depends on prior competency, evidence, completed nodes, or external outcomes.

#### Scenario: Heavy node is registered for path planning
- **WHEN** a ResourceNode represents Arena, advanced simulation, control workbench validation, terminal validation, or another high-complexity path node
- **THEN** its path metadata SHALL declare minimum competency, minimum evidence count, required completed node ids, required outcome references, unlock message, and fallback node ids where applicable
- **AND** the metadata SHALL be available to the adaptive path planner without requiring the student UI to infer readiness from display text.

#### Scenario: Readiness metadata is missing
- **WHEN** a high-complexity ResourceNode lacks audited readiness metadata
- **THEN** the planner SHALL treat the node as not immediately executable
- **AND** the node MAY appear only as a locked future milestone with a student-facing preparation message.

### Requirement: Resource field completion audit protects path quality
The system SHALL audit path-eligible resources and expose a worklist suitable for staged implementing-agent completion of existing project resources.

#### Scenario: Resource field completion is audited
- **WHEN** a resource candidate is inventoried for future path planning
- **THEN** the audit SHALL record missing identity, source, graph binding, path profile, evidence, readiness, grounding, version, and review-state fields
- **AND** it SHALL classify each missing field by completion method: agent-reviewed, local-model-assisted, external-tool-assisted, generated-provisional, already-governed, or blocked.
- **AND** it SHALL record evidence-contract completeness, including event source, event type, client event id policy, attempt key, source log id, dedupe key, timestamps, LearningFact materialization policy, confidence policy, and privacy scope.
- **AND** it SHALL preserve stable candidate ids that can be used by the data completeness helper and subsequent implementing-agent review batches.

#### Scenario: Review confirmation is audited
- **WHEN** a provisional or agent-reviewed field set is promoted to review-confirmed
- **THEN** the audit SHALL record reviewer id, reviewer role, reviewed time, review batch id, reviewed source hash, reviewed version ref, generation tool or model where applicable, prompt or manifest hash where applicable, confidence, and stale invalidation rules
- **AND** a source hash, version, prompt hash, or generation-tool version change SHALL make the confirmed field set stale until it is reviewed again.
- **AND** only review-confirmed semantic fields MAY make a ResourceNode path-eligible, mastery-affecting, or terminal-validation-capable.

### Requirement: Runtime ResourceNode projections preserve source-of-record ownership
The system SHALL keep planning metadata, semantic resource mappings, and projection status separate from records that own renderable content and teacher-editable resource metadata.

#### Scenario: Runtime step becomes a PlanningUnit
- **WHEN** a runtime lesson step is projected as a path resource
- **THEN** it SHALL have a verified route target, LearningGoal or graph bindings, knowledge coverage, ability impact, evidence instrumentation, evidence contract, estimated time, privacy, teacher policy, and review-confirmed audit state
- **AND** verified route targets SHALL match an actual interactive course App Router base, student session, or teacher session page pattern
- **AND** missing or provisional fields SHALL prevent PlanningUnit creation.
- **AND** runtime projection blockers SHALL also make the base ResourceNode eligibility path-ineligible.
- **AND** long-form sections, transcript chunks, figures, and other citation-only records SHALL NOT become PlanningUnits unless they are separately reviewed with path profile and evidence policy.

#### Scenario: Arena resource preserves official scoring boundary
- **WHEN** an Arena resource is mapped as path-plannable or evidence-producing context
- **THEN** ResourceNode and LearningFact metadata MAY represent auxiliary learning evidence, preview behavior, preparation progress, or terminal validation context
- **AND** official Arena score, validity, ranking, leaderboard position, and official submission result semantics SHALL remain sourced only from `ArenaSubmission` and governed official Arena evaluation records.

### Requirement: Every resource declares a path-planning disposition
The ResourceNode governance layer SHALL require every existing platform resource discovered by registry, runtime, authoring export, RAG projection, or teaching-resource data to declare a reviewed path-planning disposition.

#### Scenario: Resource is inventoried for path planning
- **WHEN** a resource is discovered by the completeness helper or ResourceNode registry builder
- **THEN** it SHALL be classified as `path-plannable`, `supporting-citation`, `embedded-asset`, `evidence-producing`, or `excluded-with-rationale`
- **AND** the classification SHALL include source family, stable source ref, review state, version or source hash where available, and reviewer-visible rationale.

#### Scenario: Resource is not an independent path node
- **WHEN** a resource is a textbook chunk, citation target, transcript segment, image description, slide fragment, lesson module, or other sub-resource without its own launch target and evidence contract
- **THEN** it SHALL NOT become a PathNode directly
- **AND** it SHALL be linked to a parent PlanningUnit, supporting citation, embedded asset record, or exclusion rationale.

#### Scenario: Resource is promoted to path-plannable
- **WHEN** a resource disposition is promoted to `path-plannable`
- **THEN** it SHALL have implementing-agent-reviewed knowledge mapping, capability or quality mapping where applicable, LearningGoal fit, route target, path profile, evidence behavior, privacy policy, readiness metadata, and citation or source authority metadata
- **AND** provisional automated suggestions SHALL NOT satisfy this promotion.

### Requirement: Resource disposition gaps are auditable
The data-completeness helper SHALL report resource path-planning disposition gaps without mutating source records.

#### Scenario: Disposition is missing
- **WHEN** an inventoried resource has no reviewed path-planning disposition
- **THEN** the helper SHALL report a stable finding with source family, resource ref, missing disposition code, and follow-up bucket.

#### Scenario: Resource is intentionally excluded
- **WHEN** a resource is marked `excluded-with-rationale`
- **THEN** the helper SHALL require a reviewer-visible rationale and source/version reference
- **AND** the planner SHALL not treat that resource as an unexplained coverage gap.

### Requirement: Residual resource disposition backlog is closed before final readiness
The ResourceNode governance layer SHALL close residual semantic-review and disposition findings after resource-family batches complete.

#### Scenario: Residual backlog is reviewed
- **WHEN** primary TeachingResource, graph, runtime, media, long-form, assessment, and citation batches are complete
- **THEN** every remaining resource SHALL be classified as path-plannable, supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale
- **AND** the classification SHALL include reviewer-visible rationale, review metadata, source family, stable source ref, and version or source hash where available.

#### Scenario: Final gate consumes backlog summary
- **WHEN** the full-resource readiness gate runs
- **THEN** residual disposition blockers SHALL be zero or explicitly represented as reviewed limitations
- **AND** downstream blockers SHALL identify evidence-lineage, runtime, or learner-fixture issues rather than unreviewed resource semantics.

### Requirement: Core teaching resources are path-ready after implementing-agent semantic review
The ResourceNode registry SHALL support path-planning readiness for existing core teaching resources after implementing-agent-reviewed semantic completion.

#### Scenario: Core teaching resource is completed
- **WHEN** an existing TeachingResource, runtime lesson planning unit, knowledge card, infograph, simulation, control workbench entry, Arena preview or terminal-validation resource, quiz, exercise, or platform-managed practice resource is marked path-plannable
- **THEN** it SHALL include reviewed knowledge mapping, LearningGoal fit, capability or quality contribution where applicable, route target, path stage, prerequisite relation, evidence contract, privacy policy, review metadata, and source/version reference
- **AND** the registry audit SHALL keep the resource blocked if any required field remains missing or provisional.

#### Scenario: Core resource is teacher-policy blocked or unavailable
- **WHEN** a core resource cannot be used by student path planning because of teacher policy, broken target, unavailable route, obsolete content, or restricted visibility
- **THEN** it SHALL be classified with a reviewed disposition and rationale
- **AND** the helper SHALL not count it as an unexplained missing path resource.

### Requirement: Core resources preserve evidence authority boundaries
The ResourceNode registry SHALL preserve official evidence authority when core resources include assessment, simulation, or Arena behavior.

#### Scenario: Arena, simulation, or control workbench resource is path-plannable
- **WHEN** an Arena, simulation, or control workbench resource is marked path-plannable or terminal-validation-capable
- **THEN** its ResourceNode metadata SHALL reference the allowed evidence behavior and limitation state
- **AND** it SHALL NOT fabricate or override official Arena score, validity, ranking, or leaderboard authority.

### Requirement: Long-form resources enter planning at reviewed section grain
The ResourceNode registry SHALL represent textbook and reference resources in path planning at reviewed section or exercise grain rather than raw chunk grain.

#### Scenario: Textbook section is reviewed for planning
- **WHEN** a textbook or reference section is promoted to path-plannable
- **THEN** it SHALL include source book ref, section ref, citation target, graph mapping, LearningGoal fit, prerequisite position, estimated time, path role, authority, privacy, source hash, and review metadata
- **AND** it SHALL be eligible for planner selection according to LearningGoal policy.

#### Scenario: Long-form chunk is only citation support
- **WHEN** a paragraph chunk, figure description, transcript segment, equation anchor, or table anchor lacks independent route and evidence contract
- **THEN** it SHALL remain a supporting citation or embedded asset linked to a reviewed parent section
- **AND** it SHALL NOT be promoted directly to a PathNode.

### Requirement: Long-form resource exclusions are explicit
Long-form resources that should not enter path planning SHALL have reviewed exclusion rationale. The textbook projection MUST record explicit access and exclusion reasons. Missing locator sidecar data SHALL block only the affected textbook slice and MUST NOT be interpreted as an upstream Authority failure.

#### Scenario: Section is unsuitable for path planning
- **WHEN** a textbook or reference section is obsolete, too advanced, copyright-restricted, duplicate, off-topic, or unsuitable for the course path
- **THEN** it SHALL be classified as excluded with rationale
- **AND** the helper SHALL not count it as an unexplained missing planning resource.

#### Scenario: Sidecar row is missing
- **WHEN** a selected textbook section lacks a valid public locator or crosswalk row
- **THEN** that textbook slice SHALL be `REVIEW_REQUIRED`
- **AND** unrelated resources and Authority SHALL remain usable

### Requirement: Resource identities are repaired before semantic promotion
TeachingResource and runtime lesson records SHALL have stable registry identity before they can be reviewed for graph binding or path eligibility.

#### Scenario: TeachingResource identity is repaired
- **WHEN** a TeachingResource is inventoried for resource governance
- **THEN** it SHALL reference a registered registry id or declare a reviewed identity limitation
- **AND** unregistered registry ids SHALL block semantic promotion and path eligibility.

#### Scenario: Runtime artifact is missing
- **WHEN** a mapped runtime lesson artifact such as a lesson JSON is missing
- **THEN** downstream semantic review SHALL remain blocked for the affected resource family
- **AND** the helper SHALL report the exact missing artifact until it is restored or given a reviewed limitation.

### Requirement: Runtime media and handouts declare reviewed dispositions
Runtime media, slides, audio, video, PDF, and handout resources SHALL declare reviewed path-planning dispositions before they can affect path generation.

#### Scenario: Media is citation support
- **WHEN** a media or handout resource is used only to support explanation or citation
- **THEN** it SHALL declare supporting-citation or embedded-asset disposition, parent PlanningUnit where available, anchor or transcript requirements, source version, and limitation state.

#### Scenario: Media is path-plannable
- **WHEN** a media or handout resource is promoted to path-plannable
- **THEN** it SHALL include verified launch target, graph binding, LearningGoal fit, estimated time, evidence behavior, privacy policy, route/access semantics, and review metadata.

### Requirement: Core textbook sections are reviewed at section grain
Core textbook resources SHALL enter path planning only through reviewed section-level planning units or explicit non-planning dispositions. Textbook resources projected from ActKG MUST be represented at `TEXTBOOK`/`CHAPTER`/`SECTION` grain using stable SourceDocument/SourceAnchor locator identities. A locator-only section MUST remain reference-governed and MUST NOT become path-eligible without the existing resource review contract.

#### Scenario: Core textbook section is promoted
- **WHEN** a core automatic-control textbook section is promoted to path-plannable or remediation-capable
- **THEN** it SHALL include book ref, section ref, citation address, graph mapping, LearningGoal fit, prerequisite position, estimated time, path role, authority level, privacy policy, source hash, and review metadata.

#### Scenario: Textbook chunk remains citation support
- **WHEN** a paragraph chunk, figure description, caption, equation anchor, or table anchor lacks independent route and evidence contract
- **THEN** it SHALL remain supporting citation or embedded asset linked to a reviewed parent section.

#### Scenario: Public textbook sidecar resolves
- **WHEN** a SourceDocument, SourceAnchor, section/page locator, and Canonical ID match the same Authority capture
- **THEN** the registry SHALL emit a stable textbook section resource and preserve its locator provenance

#### Scenario: Unauthorized body text is absent
- **WHEN** the public Bundle contains locator metadata but no authorized textbook body
- **THEN** the registry SHALL retain a reference-only resource
- **AND** it SHALL not copy or expose raw textbook text

### Requirement: Runtime lesson steps are reviewed before PlanningUnit promotion
Runtime lesson steps SHALL become path-planning units only after step-level implementing-agent semantic review.

#### Scenario: Runtime step is promoted
- **WHEN** a runtime lesson step is promoted to a PlanningUnit
- **THEN** it SHALL have a verified route target, graph bindings, capability or quality contribution where applicable, estimated time, path role, prerequisite relation, evidence contract, privacy policy, source version, and review metadata
- **AND** provisional or generated metadata SHALL NOT satisfy promotion.

#### Scenario: Runtime step is not a PlanningUnit
- **WHEN** a runtime lesson step is display-only, transitional, embedded, duplicate, teacher-only, obsolete, or otherwise unsuitable for independent path planning
- **THEN** it SHALL be linked to a parent PlanningUnit, supporting citation, embedded asset record, evidence role, or reviewed exclusion rationale.

### Requirement: Reference sections are reviewed separately from core textbook sections
Reference books, encyclopedic entries, and external long-form resources SHALL be classified independently from core textbook path units.

#### Scenario: Reference section is reviewed
- **WHEN** a reference section is reviewed for resource governance
- **THEN** it SHALL be classified as path-plannable, remediation, extension, enrichment, supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale
- **AND** path promotion SHALL require graph mapping, LearningGoal fit, source authority, estimated time, citation address, privacy policy, source hash, and review metadata.

#### Scenario: Reference is unsuitable
- **WHEN** a reference section is too advanced, duplicate, off-topic, copyright-restricted, stale, or unsuitable for a student path
- **THEN** it SHALL be excluded with reviewer-visible rationale rather than remaining an unexplained resource gap.

### Requirement: Path-plannable resources declare evidence-lineage behavior
ResourceNodes that produce or consume learner evidence SHALL declare evidence-lineage behavior before they can affect path state.

#### Scenario: Evidence-producing ResourceNode is audited
- **WHEN** a ResourceNode can mark completion, checkpoint success, mastery lift, readiness unlock, remediation need, or terminal validation
- **THEN** it SHALL declare event type, event source, clientEventId policy, attemptKey policy, dedupe key, timestamp policy, source-log or source-event linkage, LearningFact materialization policy, confidence policy, and privacy scope
- **AND** the planner SHALL treat missing required lineage as a readiness blocker.

### Requirement: Textbook search documents do not bypass section-level planning
Textbook search-document rows SHALL remain citation-support records unless a reviewed parent section owns the PlanningUnit role.

#### Scenario: Search-document row is reviewed
- **WHEN** a textbook search-document row is classified during resource governance
- **THEN** it SHALL be linked to a reviewed parent section, supporting citation target, embedded asset, or exclusion rationale
- **AND** it SHALL NOT become an independent PathNode solely because it is citation-ready.

#### Scenario: Parent section is not reviewed
- **WHEN** a search-document row belongs to an unreviewed or unsuitable parent section
- **THEN** the row SHALL remain limited supporting material or excluded with rationale
- **AND** the helper SHALL report the parent-section dependency separately from citation-anchor gaps.

### Requirement: Knowledge cards and infographs are reviewed in semantic shards
Canonical-keyed knowledge cards MUST remain governed teaching resources and MUST carry one Canonical ID, reviewed source/version evidence, citation metadata, and explicit path/grounding disposition. Card migration MUST NOT make a card an engineering graph entity or require one for every Canonical node. Knowledge-card and infograph resources SHALL be eligible for path planning or Konling grounding only after deterministic shard-based implementing-agent semantic review.

#### Scenario: Core card is active
- **WHEN** a card is selected for a core node with `cardPolicy: REQUIRED`
- **THEN** the card SHALL pass existing semantic/citation review and appear once in the Canonical card index

#### Scenario: Non-core node has no card
- **WHEN** a non-core Canonical node has no active card
- **THEN** the ResourceNode projection SHALL remain valid if other resource evidence is present
- **AND** no card-readiness gate SHALL be synthesized

#### Scenario: Knowledge visual shard is selected
- **WHEN** the helper reports knowledge-card or infograph resources with missing semantic review, path disposition, graph binding, citation, or evidence fields
- **THEN** the implementation SHALL select a deterministic shard prioritized by active LearningGoals and graph nodes used by planner or Konling tests
- **AND** it SHALL record selected ids, blocker codes, source hashes, and residual unselected counts.

#### Scenario: Knowledge visual is promoted
- **WHEN** a selected knowledge card or infograph is promoted to path-plannable or evidence-producing
- **THEN** it SHALL include reviewed graph mapping, LearningGoal fit, K/A/Q contribution, path stage or support role, route or citation address, authority level, evidence behavior, privacy policy, source hash, and reviewer-visible rationale
- **AND** provisional suggestions SHALL NOT satisfy promotion.

#### Scenario: Knowledge visual is supporting only
- **WHEN** a selected card, image, or infograph is display-only, duplicate, too broad, teacher-only, or unsuitable as an independent path node
- **THEN** it SHALL be classified as supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale
- **AND** it SHALL not become an independent PathNode without a reviewed launch target and evidence contract.

### Requirement: ResourceNode registry exposes a planner-consumable projection
The ResourceNode governance layer SHALL provide a planner-consumable projection that matches the resource center inventory boundary. The ResourceNode projection MUST identify Canonical-keyed card resources, optional-card absence, legacy fallback status, projection identity, source hash, review state, and launch/evidence policy without exposing raw hidden card content.

#### Scenario: Step resolves an optional card
- **WHEN** a step references a Canonical ID whose active card is absent
- **THEN** the projection SHALL return the Canonical/resource identity and an explicit optional-card-missing state
- **AND** path consumers SHALL be able to use other eligible resources

#### Scenario: Planner projection is built
- **WHEN** the planner requests governed resource candidates
- **THEN** the projection SHALL include all audited path-eligible ResourceNodes and reviewed non-path dispositions from the resource center inventory
- **AND** the projection SHALL identify source family, source ref, registry version, projection version, review state, path disposition, and eligibility blockers.

#### Scenario: Projection excludes raw content
- **WHEN** the planner consumes the ResourceNode projection
- **THEN** it SHALL receive metadata, graph bindings, path profile, evidence policy, citation refs, privacy policy, and readiness data
- **AND** it SHALL NOT receive raw textbook content, raw media bytes, hidden assessment internals, or private learner evidence.

### Requirement: Core registered and knowledge resources have complete reviewed semantics
Registered resources, knowledge cards, and knowledge infographs SHALL be semantically reviewed before they affect path planning, Konling grounding, or governed citation coverage. Only cards required by selected core-node/card-policy records MUST block the corresponding projection. A duplicate, split, or unmapped card MUST retain a machine-readable classification and cannot silently become active.

#### Scenario: Duplicate active cards exist
- **WHEN** two cards claim ACTIVE status for one Canonical ID
- **THEN** card-index publication SHALL fail closed
- **AND** the affected card consumer SHALL remain on its prior valid state

#### Scenario: Core resource is reviewed
- **WHEN** a registered resource, knowledge card, or knowledge infograph is processed in the core completion batch
- **THEN** it SHALL receive a reviewed disposition, graph binding or rationale, LearningGoal fit, K/A/Q objective mapping where applicable, path profile where applicable, citation target, evidence behavior, privacy policy, source/version evidence, and review metadata
- **AND** generated suggestions or unreviewed placeholders SHALL NOT satisfy completion.

#### Scenario: Core resource is not an independent path node
- **WHEN** the resource is display-only, derived, embedded, duplicate, inaccessible, or unsuitable for path execution
- **THEN** it SHALL be classified as supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale
- **AND** the helper SHALL stop reporting it as an unexplained path-readiness gap.

#### Scenario: Core batch is complete
- **WHEN** the scoped helper queue for registered resources, knowledge cards, and infographs is rerun
- **THEN** it SHALL report zero unreviewed or unexplained in-scope items
- **AND** the tracked review source SHALL be applied to formal audit rows before summaries, workqueues, projections, baselines, and path-readiness gates are derived
- **AND** materialization SHALL use the tracked audit snapshot and summary metadata without replacing the frozen denominator from live candidate enumeration
- **AND** any residual item SHALL name a concrete missing source artifact or schema blocker.

### Requirement: Arena path nodes bind concrete challenge tasks
Every path-plannable `arena_task` ResourceNode SHALL bind a stable Arena task identity and a verified concrete challenge route.

#### Scenario: Arena task enters the path registry
- **WHEN** an Arena task is promoted to a path-plannable or terminal-validation node
- **THEN** its stable node id SHALL be based on `arena-task:<taskId>`, its source kind and source reference SHALL identify the Arena task, and its launch target SHALL resolve to `/arena/challenges/<taskId>`
- **AND** the referenced task SHALL exist in the governed Arena task catalog.

#### Scenario: Arena task uses a generic or placeholder target
- **WHEN** an `arena_task` node points to `/arena`, uses a knowledge node as its source identity, lacks a task id, or resolves to an unknown challenge
- **THEN** registry or fixture validation SHALL mark it path-ineligible
- **AND** path execution SHALL block or repair the target from a verified stable task mapping rather than launch the Arena hall.

#### Scenario: Persisted path contains a legacy Arena target
- **WHEN** a restored path contains an Arena node with a generic or invalid target
- **THEN** the system SHALL repair it only when a unique verified task mapping exists
- **AND** otherwise SHALL require path regeneration or an explicit recovery action without treating the node as executable.

### Requirement: New ResourceNode records cannot be provisionally complete
New or modified resource records SHALL not be treated as complete when semantic fields are generated, provisional, or missing review evidence.

#### Scenario: Generated metadata is present
- **WHEN** a new resource contains generated suggestions for K/A/Q, graph, path profile, evidence, citation, or disposition fields
- **THEN** the ResourceNode audit SHALL keep the resource incomplete until an implementing-agent review records reviewer identity, source/version evidence, rationale, and fresh review metadata.

#### Scenario: Resource is intentionally not path-plannable
- **WHEN** a new resource should not become a PathNode
- **THEN** it SHALL still declare reviewed supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale disposition
- **AND** the rationale SHALL be sufficient for the helper to stop reporting it as unexplained missing path readiness.

### Requirement: Runtime lesson and media resources have complete reviewed dispositions
Runtime lesson steps, modules, media, slides, audio/video, PDFs, and handouts SHALL have reviewed dispositions before they affect path planning or governed citations.

#### Scenario: Runtime PlanningUnit is path-plannable
- **WHEN** a runtime lesson step, handout, or media-backed resource is promoted to path-plannable
- **THEN** it SHALL have a verified launch target, parent lesson ref, graph binding, LearningGoal fit, K/A/Q mapping where applicable, path stage, time cost, evidence contract, privacy policy, readiness metadata, citation/source refs, and review metadata
- **AND** the ResourceNode audit SHALL block promotion if any required field is missing or provisional.

#### Scenario: Runtime fragment is supporting material
- **WHEN** a lesson module, slide fragment, media asset, transcript segment, or embedded PDF section lacks independent launch and evidence contracts
- **THEN** it SHALL be linked to a reviewed parent PlanningUnit or classified as supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale
- **AND** it SHALL NOT become an independent PathNode.

#### Scenario: Runtime family batch is complete
- **WHEN** scoped runtime workqueues are rerun
- **THEN** unreviewed runtime lesson and media disposition blockers SHALL be zero
- **AND** residual blockers SHALL identify concrete missing runtime artifacts, route gaps, or schema conflicts.

### Requirement: Textbook and reference resources have reviewed long-form semantics
Textbook and reference resources SHALL be reviewed at section/supporting-resource grain before they affect path planning, RAG grounding, or citation presentation.

#### Scenario: Long-form section is path-plannable
- **WHEN** a textbook or reference section is promoted to path-plannable
- **THEN** it SHALL include source book/reference ref, section ref, citation target, graph binding, K/A/Q mapping where applicable, LearningGoal fit, prerequisite position, estimated time, path role, authority, privacy, source hash, and review metadata
- **AND** it SHALL be selectable by the planner only through the reviewed section PlanningUnit.

#### Scenario: Long-form child item is support only
- **WHEN** a search document, chunk, figure, caption, image description, equation, table, or citation target lacks an independent reviewed PlanningUnit
- **THEN** it SHALL be classified as supporting-citation, embedded-asset, parent-section evidence, or excluded-with-rationale
- **AND** it SHALL link to a reviewed parent section where available.

#### Scenario: Long-form batch is complete
- **WHEN** scoped long-form workqueues are rerun
- **THEN** unreviewed long-form disposition and citation-anchor blockers SHALL be zero
- **AND** residual blockers SHALL identify concrete missing source artifacts, anchor gaps, or schema conflicts.

### Requirement: Effective resources use reviewed Canonical bindings
After the final production cutover, an effective teaching resource that is published, recommendable, path-eligible, or evidence-producing MUST resolve its knowledge scope through active Canonical binding entities rather than Legacy knowledge-node ID arrays.

#### Scenario: Effective resource is consumed
- **WHEN** a formal consumer loads an effective resource after the final selector activation
- **THEN** the registry SHALL expose its reviewed Canonical Object, Release, teaching role, and binding version

#### Scenario: Only Legacy IDs are present
- **WHEN** an effective resource has no active Canonical binding
- **THEN** the registry SHALL mark it not ready for Canonical cutover rather than inheriting a binding

#### Scenario: Effective resource is consumed before cutover
- **WHEN** a reviewed Canonical binding exists but Legacy remains the active authority
- **THEN** the formal registry response SHALL retain Legacy production identity and expose the Canonical binding only through migration review

