## ADDED Requirements

### Requirement: Knowledge cards and infographs are reviewed in semantic shards
Knowledge-card and infograph resources SHALL be eligible for path planning or Konling grounding only after deterministic shard-based implementing-agent semantic review.

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
