## ADDED Requirements

### Requirement: Konling content citations respect answer relevance
Konling SHALL only present Source Pack content citations as high-confidence answer evidence when the selected Source Pack items satisfy the `konling-answer` answer-relevance contract.

#### Scenario: Knowledge graph answer has no relevant content citation
- **WHEN** Konling answers from `/knowledge` and Source Pack retrieval returns no item that satisfies the answer-relevance gate for the current question and server-owned knowledge workspace context
- **THEN** Konling SHALL omit unrelated content citations from answer generation, citation verification, and student-visible citation chips instead of presenting unrelated textbook chunks as high-confidence answer citations
- **AND** runtime citation metadata SHALL expose the missing or downgraded citation reason.

#### Scenario: Knowledge graph answer has relevant content citations
- **WHEN** Konling answers from `/knowledge` and Source Pack retrieval selects items that satisfy answer relevance and citation readiness
- **THEN** Konling SHALL pass those verified content citations into citation context, answer-generation, and citation-verification metadata
- **AND** student-visible citation chips SHALL retain server-owned title, href or unavailable state, source type, confidence, freshness, privacy visibility, and limitation state.

#### Scenario: Known leakage chunks are unrelated
- **WHEN** a knowledge graph Konling request is unrelated to `ADVANCED PROBLEMS` or `DESIGN PROBLEMS` textbook rows
- **THEN** Konling SHALL NOT include `ch01-advanced-problems-031__chunk-001` or sibling rows as high-confidence content citations merely because they are canonical, citation-ready, or broadly graph-bound.

### Requirement: Konling citation relevance diagnostics are privacy safe
Konling SHALL separate internal answer-relevance diagnostics from student-visible citation language.

#### Scenario: Answer citation is omitted for insufficient relevance
- **WHEN** Source Pack reports insufficient answer relevance for a Konling content citation
- **THEN** Konling SHALL retain raw limitation codes, query hashes, selected-node ids, SAR refs, and ranking signals only in service-side metadata, admin/debug diagnostics, or test evidence
- **AND** student-visible answer text and citation chips SHALL use product-safe language without exposing raw internal reason codes or privileged context identifiers.

#### Scenario: Answer citation is selected with relevance evidence
- **WHEN** Konling passes a selected Source Pack item into citation context
- **THEN** the runtime SHALL retain bounded relevance evidence for audit, including the relevance basis and non-private match summary
- **AND** it SHALL NOT require or expose raw private learner evidence, private Konling memory, hidden Arena internals, or audit-only SAR traces.
