## ADDED Requirements

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
Long-form resources that should not enter path planning SHALL have reviewed exclusion rationale.

#### Scenario: Section is unsuitable for path planning
- **WHEN** a textbook or reference section is obsolete, too advanced, copyright-restricted, duplicate, off-topic, or unsuitable for the course path
- **THEN** it SHALL be classified as excluded with rationale
- **AND** the helper SHALL not count it as an unexplained missing planning resource.
