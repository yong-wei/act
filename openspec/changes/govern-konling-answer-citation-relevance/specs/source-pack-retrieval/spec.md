## ADDED Requirements

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
