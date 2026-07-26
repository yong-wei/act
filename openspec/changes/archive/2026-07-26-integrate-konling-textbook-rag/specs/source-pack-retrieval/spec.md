## MODIFIED Requirements

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

## ADDED Requirements

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
