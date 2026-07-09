## ADDED Requirements

### Requirement: Source Pack distinguishes canonical and rendered textbook citation targets
Source Pack SHALL preserve canonical runtime citation addresses separately from human-readable rendered citation display targets.

#### Scenario: Textbook citation is hydrated for human presentation
- **WHEN** a reviewed textbook or reference runtime document is adapted into a Source Pack item and its canonical address points to a runtime Markdown chunk, section, image, or figure target
- **THEN** the item SHALL retain the canonical runtime href, citation target id, source id, anchor metadata, answer-relevance audit metadata when present, missing or downgraded citation reason, limitation state, confidence, freshness, and privacy scope for audit and verification
- **AND** it SHALL expose a platform-owned rendered display href for human citation navigation when the target is available to the caller.

#### Scenario: Citation metadata is serialized downstream
- **WHEN** a Source Pack item is passed to Konling, authoring tools, or another consumer citation UI
- **THEN** the serialized metadata SHALL make it possible to render the human display href without losing the canonical runtime href
- **AND** consumers SHALL NOT overwrite the canonical citation address, answer-relevance audit metadata, missing or downgraded citation reason, limitation state, confidence, freshness, or privacy scope with rendered-route-only metadata.

#### Scenario: Citation item is not answer-relevant
- **WHEN** the `konling-answer` profile reports that a Source Pack item is omitted, downgraded, or unavailable because it did not satisfy answer relevance
- **THEN** rendered display href generation SHALL NOT convert that item into a high-confidence student-visible content citation
- **AND** the relevance audit and limitation metadata SHALL remain available for downstream diagnostics.

#### Scenario: Raw runtime asset route remains the machine boundary
- **WHEN** a Source Pack citation references `/course-runtime/**`
- **THEN** Source Pack SHALL treat that href as the raw runtime asset address
- **AND** it SHALL NOT require `/course-runtime/**` itself to render learner-facing HTML.

### Requirement: Source Pack keeps machine retrieval text out of human citation pages
Source Pack citation presentation metadata SHALL allow machine-only retrieval aids to remain in runtime corpora without forcing them into learner-visible citation pages.

#### Scenario: Textbook chunk contains image description text
- **WHEN** a textbook chunk includes machine-oriented image descriptions for retrieval
- **THEN** the Source Pack item MAY retain those descriptions in search text, audit metadata, or accessibility metadata
- **AND** the human rendered citation target SHALL NOT display those descriptions as ordinary learner-facing prose.
