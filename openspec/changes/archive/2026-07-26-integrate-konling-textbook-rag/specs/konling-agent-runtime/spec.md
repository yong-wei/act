## ADDED Requirements

### Requirement: Konling exposes textbook retrieval through page tool contracts
Konling SHALL register textbook RAG as a shared read-only tool and SHALL expose it only when the server-owned page, mode, and role contract permits course-knowledge retrieval.

#### Scenario: Page contract permits textbook retrieval
- **WHEN** a learning surface exposes the textbook tool and the model determines that the current question needs textbook support
- **THEN** the model MAY call the tool with the current question
- **AND** the runtime SHALL apply the page's existing server-owned context without introducing a knowledge-graph-only context path.

#### Scenario: Tool is exposed but unused
- **WHEN** the model answers without calling the available textbook tool
- **THEN** the runtime SHALL treat that as a normal model decision
- **AND** it SHALL NOT mark the answer degraded solely because the tool was unused.

### Requirement: Konling uses server-assigned visible citation numbers
Konling SHALL use one server-assigned citation sequence for textbook content and authorized learning evidence and SHALL reject model-authored URLs or new identifiers.

#### Scenario: Citation table is prepared
- **WHEN** eligible content and evidence sources are ready before answer generation
- **THEN** the server SHALL deduplicate them and assign `[1]`, `[2]` display numbers
- **AND** the prompt SHALL allow only those assigned numbers.

#### Scenario: Model emits internal citation syntax
- **WHEN** model prose contains a raw citation id, `[content: ...]`, an unknown number, or a model-authored citation URL
- **THEN** that syntax SHALL NOT become a verified visible citation or link.

### Requirement: Konling repairs unknown citation markers once
Konling SHALL deterministically normalize known citation forms and SHALL permit at most one model repair call for remaining unknown or ambiguous markers.

#### Scenario: Deterministic normalization succeeds
- **WHEN** a marker contains an assigned number, a complete known citation id, or a uniquely matching source title
- **THEN** the server SHALL map it without an additional model call.

#### Scenario: Unknown markers remain
- **WHEN** deterministic normalization leaves unresolved markers
- **THEN** one repair call SHALL receive the original question, frozen server context, assigned citation table, original answer, and all unresolved markers
- **AND** it SHALL return mappings only without rewriting prose or adding sources.

#### Scenario: Repair still fails
- **WHEN** markers remain unresolved after the repair call
- **THEN** production output SHALL remove their raw syntax and invalid links, preserve the answer prose, and show the applicable safe verification notice
- **AND** detailed reasons SHALL remain available only in development diagnostics.

### Requirement: Konling supports soft-timeout textbook optimization
Konling SHALL start a fallback-grounded answer after the configured foreground retrieval wait while allowing bounded external retrieval to continue.

#### Scenario: External retrieval exceeds foreground wait
- **WHEN** embedding and reranking have not completed after approximately two seconds
- **THEN** Konling SHALL answer from lexical or local fused candidates
- **AND** production UI SHALL show `正在后台优化响应` without provider, timeout, or error details.

#### Scenario: Background evidence is equivalent
- **WHEN** external retrieval completes before the experiment-derived P95 cap and the preferred source and used citation-unit set are unchanged
- **THEN** the UI SHALL end the optimization status without regenerating the answer.

#### Scenario: Background evidence materially changes
- **WHEN** external retrieval completes before the cap and changes the preferred source or used citation-unit set
- **THEN** Konling SHALL regenerate from the frozen question and final evidence and replace the same message revision
- **AND** it SHALL NOT append a second assistant response.

#### Scenario: Background retrieval reaches its cap
- **WHEN** the external work has not completed by the experiment-derived P95 limit
- **THEN** the fallback-grounded answer SHALL remain final
- **AND** the optimization status SHALL end with operational diagnostics kept outside production prose.

### Requirement: Konling final messages replace provisional revisions
The shared chat experience SHALL support one visible message identity whose body, citations, and final state can be replaced after citation repair or material background optimization.

#### Scenario: Citation mapping is corrected
- **WHEN** the single citation repair call resolves provisional markers
- **THEN** the corrected body and citation presentation SHALL replace the current message revision
- **AND** the provisional and corrected variants SHALL NOT remain as separate visible messages.
