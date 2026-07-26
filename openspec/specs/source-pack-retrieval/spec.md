## Purpose

Define governed Source Pack retrieval evidence packages for authoring tools, Konling, and path planning.
## Requirements
### Requirement: Source Pack contract defines governed retrieval evidence packages
The system SHALL expose a Source Pack contract that represents a governed, auditable evidence package for authoring tools, Konling, and path planning.

#### Scenario: Source Pack is generated
- **WHEN** a caller asks for a Source Pack
- **THEN** the pack SHALL include a stable pack id, caller profile, query context, index or projection version refs, coverage summary, selected items, limitations, and audit metadata
- **AND** every item SHALL retain stable source identifiers such as `retrievalChunkId`, `citationTargetId`, `resourceNodeId`, or `planningUnitId` when those identifiers are available.

#### Scenario: Source Pack item is serialized
- **WHEN** a Source Pack item is rendered to JSON or Markdown
- **THEN** it SHALL preserve title, source kind, modality, excerpt, inclusion rationale, score fields, access metadata, and citation metadata
- **AND** it SHALL NOT rely on model-authored URLs or raw authoring-file line numbers as the verified citation target.

### Requirement: Source Pack CLI is a thin wrapper over shared core
The system SHALL provide a CLI shell for local authoring and agent workflows without making the CLI the retrieval source of record.

#### Scenario: CLI builds a pack
- **WHEN** an authoring workflow runs the Source Pack CLI with a query and profile
- **THEN** the CLI SHALL call the shared Source Pack builder
- **AND** it SHALL be able to write JSON, Markdown, and audit outputs with the same contract used by server consumers.

#### Scenario: CLI cannot satisfy retrieval
- **WHEN** a requested adapter, index, or retrieval mode is unavailable
- **THEN** the CLI SHALL return a valid Source Pack with explicit limitations or a structured failure
- **AND** it SHALL NOT silently fall back to unmanaged raw Markdown scanning.

### Requirement: Source Pack adapts governed corpus records
The system SHALL build Source Pack candidates from governed corpus records and runtime projections rather than unmanaged authoring files.

#### Scenario: Learning evidence chunk enters Source Pack candidate set
- **WHEN** a governed `LearningEvidenceCorpusChunk` is eligible for the caller scope
- **THEN** the Source Pack adapter SHALL preserve source type, family, span ref, citation address, authority, privacy scope, freshness, content hash, and limitation metadata
- **AND** invalid, inaccessible, or privacy-violating chunks SHALL be excluded or represented only as explicit limitations.

#### Scenario: Textbook or reference runtime document enters Source Pack candidate set
- **WHEN** a reviewed textbook or reference runtime search document is adapted
- **THEN** the candidate SHALL preserve book id, section id, title, page or anchor metadata, figure/equation refs where available, source version, graph refs, content hash, review state, and citation target metadata
- **AND** the adapter SHALL NOT read raw authoring Markdown as the source of record.

### Requirement: Source Pack hydrates citations from server-owned metadata
The system SHALL resolve Source Pack citation payloads from server-owned CitationAddress or CitationTarget metadata.

#### Scenario: Citation is hydrated
- **WHEN** a Source Pack item references a citation target or citation address
- **THEN** the hydrator SHALL produce display title, label, source kind, href or unavailable state, address kind, anchor metadata, freshness, and limitation state from server-owned metadata
- **AND** model-authored links SHALL NOT be accepted as verified citation targets.

#### Scenario: Citation metadata is unsafe or incomplete
- **WHEN** a citation address is missing, stale, unsafe, restricted, provisional, or incompatible with the caller scope
- **THEN** the Source Pack item SHALL expose an explicit limitation or be excluded according to profile policy
- **AND** the pack SHALL remain auditable.

### Requirement: Source Pack keeps retrieval readiness separate from path eligibility
The system SHALL distinguish retrievable or citable material from resources that can become adaptive path nodes.

#### Scenario: Retrieval chunk is citable but not path eligible
- **WHEN** a `RetrievalChunk` or `CitationTarget` is adapted into Source Pack evidence
- **THEN** it MAY support citation and authoring context
- **AND** it SHALL NOT become a path-plannable node unless an audited `PlanningUnit` and `ResourceNode` eligibility record exists.

### Requirement: Source Pack retrieval is profile-aware
The system SHALL apply retrieval behavior according to the consuming profile before ranking and serialization.

#### Scenario: Konling answer profile is used
- **WHEN** a Source Pack is built for `konling-answer`
- **THEN** the candidate set SHALL be filtered to permitted student-visible or role-authorized evidence before ranking
- **AND** citations SHALL be concise, citation-ready, and free of hidden learner data or teacher-only material unless the caller role permits it.

#### Scenario: Authoring or assessment profile is used
- **WHEN** a Source Pack is built for `handout-authoring`, `lesson-design`, or `assessment-item`
- **THEN** the profile SHALL apply appropriate authority, review-state, source-type, AI-use, answer-leakage, and excerpt-budget policies
- **AND** the resulting pack SHALL expose limitations for excluded or missing coverage.

#### Scenario: Path-planning profile is used
- **WHEN** a Source Pack is built for `path-planning`
- **THEN** retrieval SHALL use LearningGoal, knowledge node, capability target, resource readiness, and PlanningUnit context where available
- **AND** the pack SHALL distinguish path-eligible resources from supporting citation-only evidence.

### Requirement: Source Pack retrieval uses hybrid ranking signals
The system SHALL combine governed scope filtering with exact, lexical, graph/objective, authority, freshness, learner-context, eligibility, and optional semantic/vector ranking signals.

#### Scenario: Exact technical term is queried
- **WHEN** the query contains a formula, exercise id, section title, named concept, graph node, or citation target
- **THEN** exact or lexical matches SHALL remain eligible even when semantic/vector similarity is weak or unavailable.

#### Scenario: Graph or objective context is supplied
- **WHEN** the query includes knowledge nodes, capability targets, quality targets, LearningGoal ids, or resource constraints
- **THEN** the ranking SHALL use those refs to filter or rerank candidates
- **AND** inaccessible or disallowed candidates SHALL remain excluded.

### Requirement: Source Pack assembly enforces budgets and diversity
The system SHALL assemble packs with bounded excerpts, source diversity, modality diversity, citation readiness, and limitation reporting.

#### Scenario: Many similar chunks match
- **WHEN** many chunks from the same resource, citation target, or modality match a query
- **THEN** the builder SHALL diversify the selected pack according to profile budgets
- **AND** it SHALL report omitted coverage or source concentration as audit metadata when relevant.

#### Scenario: Coverage is incomplete
- **WHEN** no eligible material covers a requested knowledge node, capability target, resource type, or modality
- **THEN** the Source Pack SHALL include a limitation describing the missing coverage
- **AND** downstream consumers SHALL be able to display or store that limitation.

### Requirement: Authoring workflows consume Source Packs for large resources
Lesson and homework authoring workflows SHALL use Source Packs as the governed reference path for large textbooks, references, and multimedia transcripts.

#### Scenario: Lesson skill needs textbook context
- **WHEN** a lesson-authoring workflow needs evidence from large textbooks or references
- **THEN** it SHALL request a Source Pack through the shared builder or CLI
- **AND** it SHALL consume compact Markdown or JSON evidence instead of loading full books into agent context.

#### Scenario: Homework skill needs reviewed references
- **WHEN** an assessment or homework workflow needs references
- **THEN** it SHALL use an authoring or assessment Source Pack profile
- **AND** it SHALL preserve citation ids and audit output for later review.

### Requirement: Konling uses Source Packs for query-aware content citations
Konling SHALL expose Source Pack textbook retrieval as a shared read-only tool only through page contracts that permit course-knowledge retrieval.

#### Scenario: Concept explanation is requested from a graph context
- **WHEN** a learner asks Konling to explain a selected concept, resource, or page context
- **THEN** Konling SHALL expose the permitted textbook retrieval tool with the question and existing server-owned context
- **AND** any graph refs SHALL remain candidate-expansion signals rather than verified evidence.

#### Scenario: Scoped learning question needs textbook evidence
- **WHEN** the model calls the permitted textbook retrieval tool for a selected concept, resource, page context, or other content-grounded question
- **THEN** Konling SHALL build a `konling-answer` Source Pack using the question and existing server-owned page context
- **AND** it SHALL pass bounded textbook bodies and verified content citations into the answer-generation and citation-verification path.

#### Scenario: Scoped question does not need textbook evidence
- **WHEN** the model answers navigation, status, or another question without calling the textbook retrieval tool
- **THEN** the runtime SHALL NOT execute external textbook embedding or reranking merely because the page exposes that tool.

#### Scenario: Learner personalization evidence is missing
- **WHEN** learner state, path execution, or personalized evidence is unavailable
- **THEN** Konling SHALL still return content-grounded cited answers when eligible teaching-content citations are available
- **AND** missing personalization SHALL be represented as a limitation on style, scope, or confidence rather than a failure of teaching-content retrieval.

### Requirement: Path planning consumes Source Packs as evidence
Adaptive path planning SHALL consume Source Packs as goal-aligned resource evidence without bypassing ResourceNode and PlanningUnit governance.

#### Scenario: Planner evaluates a LearningGoal
- **WHEN** path planning receives a LearningGoal, knowledge target, capability target, learner state, or graph context
- **THEN** it MAY request a `path-planning` Source Pack to explain relevant resources, citations, and missing coverage
- **AND** actual path nodes SHALL still be selected only from audited ResourceNode or PlanningUnit candidates.

#### Scenario: Citation-only material matches a goal
- **WHEN** a Source Pack item is relevant but lacks path eligibility
- **THEN** the planner MAY use it as supporting evidence or explanation
- **AND** it SHALL NOT insert that item as a PathNode.

### Requirement: Source Pack consumers render citations through platform citation UI
Source Pack consumer integrations SHALL render verified citations through platform-owned citation payloads and click behavior.

#### Scenario: Konling consumes a Source Pack item
- **WHEN** a Source Pack item is used as evidence for a Konling answer
- **THEN** its CitationAddress, CitationTarget, display label, limitation state, and source metadata SHALL be passed to the citation presentation layer
- **AND** the frontend SHALL render the citation from that metadata rather than asking the model to author Markdown links.

#### Scenario: Source Pack item has no navigable target
- **WHEN** a Source Pack item is relevant but its citation address is restricted, missing, stale, or unavailable
- **THEN** the consumer SHALL expose the limitation state in the citation UI
- **AND** it SHALL not synthesize a fallback `/knowledge#user-content-*` link.

### Requirement: Konling answer retrieval enforces answer relevance
The Source Pack retrieval layer SHALL enforce an answer-relevance gate when the `konling-answer` profile is used.

#### Scenario: High-authority item lacks answer relevance
- **WHEN** a `konling-answer` Source Pack candidate is citation-ready, canonical, and high-authority but has no sufficient match to the current user question, selected graph node, capability target, requested resource, learner/SAR candidate ref, or provided semantic score
- **THEN** the candidate SHALL NOT be selected as a high-confidence answer citation
- **AND** authority, review state, stable id ordering, broad graph binding, or `scores.graphAlignment` alone SHALL NOT override the missing answer relevance.

#### Scenario: Exact or graph-context match is relevant
- **WHEN** a `konling-answer` Source Pack candidate has an exact technical-term match, sufficient lexical match, explicit selected graph-node match, capability-target match, requested resource match, learner/SAR candidate ref match, or accepted semantic score
- **THEN** the candidate MAY be selected after ordinary visibility, AI-use, review-state, answer-leakage, citation-readiness, budget, and diversity policies pass.
- **AND** the selected item or pack audit SHALL record an answer-relevance basis such as `query-exact`, `query-lexical`, `selected-node-ref`, `capability-target-ref`, `resource-ref`, `sar-candidate-ref`, `learner-context-ref`, or `semantic-score`.

#### Scenario: No selected item covers answer context
- **WHEN** no eligible `konling-answer` Source Pack item satisfies the answer-relevance gate
- **THEN** the Source Pack SHALL expose an auditable limitation such as `answer-citation-insufficient-relevance` or `coverage-missing-answer-context`
- **AND** it SHALL NOT return unrelated items as high-confidence answer evidence
- **AND** downstream consumers SHALL be able to distinguish this state from missing corpus data or authorization failure.

### Requirement: Konling answer retrieval records relevance evidence
The Source Pack retrieval layer SHALL preserve bounded answer-relevance evidence for items selected by the `konling-answer` profile.

#### Scenario: Item is selected as answer evidence
- **WHEN** a `konling-answer` Source Pack item is selected for answer grounding
- **THEN** the selected item, pack audit, or consumer metadata SHALL include an answer-relevance record with `passed: true`, the relevance basis, and bounded match evidence such as a matched ref, matched token class, semantic score bucket, query hash, selected-node summary, or SAR candidate ref summary
- **AND** this record SHALL be available to tests, service logs, or administrator/debug diagnostics without requiring raw private content.

#### Scenario: Item is rejected for insufficient answer relevance
- **WHEN** a `konling-answer` Source Pack item fails the answer-relevance gate
- **THEN** the rejection SHALL be represented in limitations, omitted-item audit, or test-observable metadata with a stable reason such as `answer-citation-insufficient-relevance`
- **AND** the rejected item SHALL NOT become high-confidence answer evidence through final score, authority, review state, or stable id ordering.

### Requirement: Konling answer retrieval is regression-guarded against default textbook chunks
The Source Pack retrieval layer SHALL include regression coverage for known default textbook chunks that previously leaked into unrelated Konling answers.

#### Scenario: Unrelated knowledge graph prompt is ranked
- **WHEN** a `konling-answer` retrieval request contains an unrelated user question and includes citation-ready textbook chunks such as `ch01-advanced-problems-031__chunk-001` or adjacent `ADVANCED PROBLEMS` rows in the candidate set
- **THEN** those chunks SHALL NOT be selected unless they independently satisfy the answer-relevance gate
- **AND** deterministic id ordering SHALL NOT cause them to appear in the final answer citation pack.

### Requirement: Source Pack distinguishes canonical and rendered textbook citation targets
Source Pack SHALL preserve canonical structural-unit and fragment addresses separately from human-readable reader display targets.

#### Scenario: Textbook citation is hydrated for human presentation
- **WHEN** a reviewed v2 textbook structural unit or fragment is adapted into a Source Pack item
- **THEN** the item SHALL retain its canonical unit id, fragment anchor, source id, answer-relevance audit metadata, limitation state, confidence, freshness, and privacy scope
- **AND** it SHALL expose a platform-owned `/textbooks/{bookId}/{edition}/{...unitPath}` display href when the target is available to the caller.

#### Scenario: Citation metadata is serialized downstream
- **WHEN** a Source Pack item is passed to Konling, authoring tools, or another consumer citation UI
- **THEN** the serialized metadata SHALL render the reader href without losing the canonical unit identity, answer-relevance audit, limitation state, confidence, freshness, or privacy scope.

#### Scenario: Citation item is not answer-relevant
- **WHEN** the `konling-answer` profile omits, downgrades, or marks an item unavailable because it failed answer relevance
- **THEN** reader href generation SHALL NOT convert that item into a high-confidence student-visible citation
- **AND** the relevance audit and limitation SHALL remain available for downstream diagnostics.

#### Scenario: Raw runtime asset route remains the machine boundary
- **WHEN** a Source Pack item reads v2 body or index assets from the textbook runtime
- **THEN** those physical assets SHALL remain server-side machine addresses
- **AND** clients SHALL receive only authorized reader routes and citation metadata.

### Requirement: Source Pack keeps machine retrieval text out of human citation pages
Source Pack citation presentation metadata SHALL allow machine-only retrieval aids to remain in runtime corpora without forcing them into learner-visible citation pages.

#### Scenario: Textbook chunk contains image description text
- **WHEN** a textbook chunk includes machine-oriented image descriptions for retrieval
- **THEN** the Source Pack item MAY retain those descriptions in search text, audit metadata, or accessibility metadata
- **AND** the human rendered citation target SHALL NOT display those descriptions as ordinary learner-facing prose.

### Requirement: Source Pack separates retrieval windows from citation units
The textbook adapter SHALL use overlapping windows for recall while treating non-overlapping structural units and registered fragments as the only citation identities.

#### Scenario: Overlapping window is selected
- **WHEN** a recalled window contains spans owned by several structural units
- **THEN** Source Pack SHALL retain every owning unit id, split support by unit, and deduplicate units before citation selection
- **AND** it SHALL NOT expose the window id as a user citation.

### Requirement: Textbook evidence passes direct-support and source-priority gates
The `konling-answer` profile SHALL require direct and complete claim support before applying source-language preferences.

#### Scenario: Direct English source competes with indirect Chinese source
- **WHEN** an English unit directly supports the question and a Chinese unit only mentions it indirectly
- **THEN** the direct English unit SHALL rank ahead of the indirect Chinese unit.

#### Scenario: Several sources directly support the question
- **WHEN** qualifying units exist in several textbooks
- **THEN** the preferred order SHALL be Hu Shousong eighth edition, Liu Sheng, then English textbooks
- **AND** Hu Shousong seventh edition, exercise analysis, and the control encyclopedia SHALL be used only for their declared supplemental roles.

### Requirement: Source Pack hands bounded textbook bodies to Konling
The textbook tool result SHALL include the bounded recalled text needed for answer grounding together with owning unit identities and server-assigned citation numbers.

#### Scenario: Textbook retrieval succeeds
- **WHEN** qualifying units are selected
- **THEN** Konling SHALL receive their relevant window text, exact unit metadata, citation number, source preference, and limitation state
- **AND** it SHALL NOT receive the full textbook corpus or index.

