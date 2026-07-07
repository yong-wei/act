## ADDED Requirements

### Requirement: Reviewed knowledge visuals expose citation-safe grounding
Reviewed knowledge cards and infographs SHALL provide citation-safe grounding metadata when used by Konling or path rationale.

#### Scenario: Knowledge visual grounds an answer
- **WHEN** a reviewed knowledge card or infograph is retrieved for a Konling explanation or path rationale
- **THEN** the retrieval record SHALL include graph-node refs, LearningGoal refs where applicable, source hash, authority, review state, citation target, privacy scope, and limitation state
- **AND** citation display links SHALL resolve through server-owned citation metadata.

#### Scenario: Knowledge visual anchor is incomplete
- **WHEN** an image, description, card route, or infograph anchor is missing or stale
- **THEN** the citation SHALL be downgraded or limited
- **AND** the helper SHALL report the missing anchor separately from path-planning disposition.
