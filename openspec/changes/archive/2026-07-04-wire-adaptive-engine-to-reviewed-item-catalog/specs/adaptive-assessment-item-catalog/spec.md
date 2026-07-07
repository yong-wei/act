## ADDED Requirements

### Requirement: Adaptive selection uses reviewed catalog items for path-owned assessment
The adaptive assessment engine SHALL select reviewed, path-eligible catalog items for path-owned readiness, checkpoint, remediation, and terminal-validation-support assessment nodes.

#### Scenario: Path-owned next question is requested
- **WHEN** a student requests the next question for a path-scoped assessment node
- **THEN** selection SHALL use server-owned LearningGoal, path, node, stage, learner-state, catalog version, coverage matrix version, and asked/answered history
- **AND** candidates SHALL be current, semantically reviewed, path-eligible, and compatible with the requested LearningGoal and assessment stage.

#### Scenario: Catalog coverage is insufficient
- **WHEN** no reviewed path-eligible candidate exists for the requested context
- **THEN** the engine SHALL return a governed low-resource or limited-confidence state according to policy
- **AND** it SHALL NOT silently substitute generated, template, unreviewed, stale, deprecated, or retrieval-only items for readiness or checkpoint coverage.

#### Scenario: Generic practice is requested
- **WHEN** a learner requests low-stakes practice without a path-owned readiness or checkpoint context
- **THEN** generated or provisional items MAY be used if policy allows
- **AND** the response and resulting evidence SHALL carry limited authority.

### Requirement: Selected catalog items snapshot into assessment persistence
Runtime item selection SHALL preserve the selected catalog metadata in immutable assessment item references.

#### Scenario: Catalog item is selected
- **WHEN** the engine returns a catalog-backed question
- **THEN** the persisted `AdaptiveAssessmentItemRef` SHALL snapshot catalog item id, source lineage, content hash, semantic metadata, review state, eligibility state, and version refs used at selection time
- **AND** later catalog changes SHALL NOT mutate the historical answer snapshot.

#### Scenario: Historical pre-catalog answer is restored
- **WHEN** an existing answer references an item snapshot created before catalog selection
- **THEN** restore logic SHALL continue to read the historical snapshot
- **AND** it SHALL expose any missing catalog link as compatibility metadata rather than failing the report.
