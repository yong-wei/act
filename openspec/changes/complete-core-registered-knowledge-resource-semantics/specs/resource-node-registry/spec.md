## ADDED Requirements

### Requirement: Core registered and knowledge resources have complete reviewed semantics
Registered resources, knowledge cards, and knowledge infographs SHALL be semantically reviewed before they affect path planning, Konling grounding, or governed citation coverage.

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
- **AND** any residual item SHALL name a concrete missing source artifact or schema blocker.
