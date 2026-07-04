# adaptive-assessment-item-catalog Specification

## Purpose
Provide one governed catalog for all adaptive-assessment question sources so path planning, review workflows, and answer snapshots share stable item identity, lineage, content hashes, review state, and eligibility semantics.

The catalog separates low-stakes imported or generated practice from explicitly path-eligible items used for readiness, checkpoint, remediation, and terminal-validation gates.
## Requirements
### Requirement: Assessment item catalog registers all adaptive question sources
The system SHALL maintain a governed assessment item catalog that registers all current and future sources that may supply adaptive-assessment questions.

#### Scenario: Catalog registers current source families
- **WHEN** the catalog is built
- **THEN** it SHALL include the existing 50 preset adaptive questions, Prisma `Question` records, parsed static `course-content/questions/questions/AC-Q-*.json` items, iCourse `course-content/questions/objective-bank/icourse-bank-bankType4.*` items, generated adaptive questions, reviewed K/A/Q foundation-bank items, and future manually authored checkpoint items
- **AND** each source family SHALL report source totals, imported totals, blocked totals, and limitation reasons.

#### Scenario: Repository question-bank counts are derived
- **WHEN** parsed static or objective-bank question sources are registered
- **THEN** the AC-Q static bank count SHALL be derived from `course-content/questions/questions/AC-Q-*.json`
- **AND** the iCourse objective-bank count SHALL be derived from `course-content/questions/objective-bank/icourse-bank-bankType4.index.json`
- **AND** any legacy or external 188-question source SHALL be registered only when a concrete source path or manifest exists.

#### Scenario: Source item is incomplete
- **WHEN** a source item lacks required content, answer, rubric, lineage, or semantic fields
- **THEN** the catalog SHALL still report the source item as registered or import-blocked
- **AND** it SHALL NOT mark the item as path-eligible.

### Requirement: Catalog items preserve lineage and immutable identity
Catalog entries SHALL expose stable identity, source lineage, immutable content hash, review state, eligibility state, and version metadata.

#### Scenario: Catalog item is emitted
- **WHEN** a catalog item is exported or selected
- **THEN** it SHALL expose catalog item id, source family, source id or file anchor, content hash and algorithm, metadata version refs, review state, eligibility state, and available question/rubric references
- **AND** it SHALL include LearningGoal, K/A/Q objective, graph-node, misconception, remediation, difficulty, cognitive-level, and assessment-stage fields when those fields are known.

#### Scenario: Historical answer snapshot exists
- **WHEN** catalog metadata changes after an answer has been recorded
- **THEN** existing `AdaptiveAssessmentItemRef` snapshots SHALL remain immutable
- **AND** historical answers SHALL continue to cite the content hash and metadata snapshot used when the item was selected.

### Requirement: Path eligibility is explicit
The catalog SHALL distinguish registered, imported-unreviewed, generated-provisional, semantically-reviewed, path-eligible, and deprecated item states.

#### Scenario: Readiness or checkpoint item is selected
- **WHEN** an item is used for readiness, checkpoint, remediation gate, or terminal-validation evidence
- **THEN** it SHALL be in the `path-eligible` state
- **AND** generated-provisional or imported-unreviewed items SHALL NOT satisfy the gate.

#### Scenario: Provisional item is used for practice
- **WHEN** a generated or imported-unreviewed item is used for low-stakes practice
- **THEN** the response evidence SHALL be marked provisional or limited-confidence
- **AND** it SHALL NOT update high-confidence mastery or unlock heavy path nodes.

### Requirement: Assessment items require human semantic review before path eligibility
The system SHALL require manual semantic review before an assessment item can become `semantically-reviewed` or `path-eligible`.

#### Scenario: Review packet is generated
- **WHEN** catalog items need semantic review
- **THEN** the workflow SHALL generate review packets containing source reference, question content summary, answer/rubric context, candidate LearningGoal ids, K/A/Q objective ids, graph-node refs, difficulty, cognitive level, misconception refs, remediation refs, assessment stage, source hash, and missing-field blockers
- **AND** machine suggestions SHALL be clearly distinguished from reviewer decisions.

#### Scenario: Reviewer approves semantics
- **WHEN** a reviewer marks an item semantically reviewed
- **THEN** the review decision SHALL record reviewer id or role, reviewed timestamp, review batch id, source content hash, selected LearningGoal ids, selected K/A/Q objective ids, graph-node refs, stage purpose, difficulty, cognitive level, misconception refs, remediation refs, and metadata version refs
- **AND** the item SHALL NOT become path-eligible until required stage policy checks pass.

#### Scenario: Script infers candidate tags
- **WHEN** a script or model proposes LearningGoal, K/A/Q, graph, stage, difficulty, or remediation fields
- **THEN** the fields MAY be stored as suggestions
- **AND** they SHALL NOT set `semantically-reviewed` or `path-eligible` without a human review decision.

### Requirement: Semantic review covers all catalog source families
The semantic review workflow SHALL report coverage for every registered source family in the assessment item catalog.

#### Scenario: Review coverage is reported
- **WHEN** the semantic review validator runs
- **THEN** it SHALL report reviewed, path-eligible, unreviewed, stale, rejected, deprecated, and blocked item totals by source family, LearningGoal, K/A/Q objective, and assessment stage
- **AND** it SHALL include the 50 preset questions, Prisma `Question` records, parsed static AC-Q files, iCourse objective-bank items, generated questions, K/A/Q foundation-bank items, and manually authored checkpoint items when those sources exist.

#### Scenario: Review coverage reports repository question banks
- **WHEN** AC-Q static files or iCourse objective-bank items are present
- **THEN** semantic review coverage SHALL report AC-Q counts from `course-content/questions/questions/AC-Q-*.json`
- **AND** it SHALL report iCourse objective-bank counts from `course-content/questions/objective-bank/icourse-bank-bankType4.index.json`.

#### Scenario: Reviewed item becomes stale
- **WHEN** the source content hash, answer key, rubric, objective catalog version, graph catalog version, or remediation resource version changes
- **THEN** the item SHALL be reported as review-stale
- **AND** it SHALL NOT remain path-eligible until the stale review is resolved or explicitly reapproved.

### Requirement: Path-ready LearningGoals have minimum reviewed assessment item sets
The assessment item catalog SHALL provide minimum reviewed, path-eligible assessment item coverage for each current path-ready LearningGoal before the goal is treated as fully testable.

#### Scenario: LearningGoal coverage is evaluated
- **WHEN** the coverage matrix is generated for a path-ready LearningGoal
- **THEN** it SHALL report required and available path-eligible item counts for precheck or readiness, practice, checkpoint, and remediation stages
- **AND** it SHALL report K/A/Q objective coverage, graph-node coverage, difficulty distribution, cognitive-level distribution, source mix, remediation coverage, blockers, and limitation reasons.

#### Scenario: Minimum coverage is satisfied
- **WHEN** a LearningGoal has at least the configured reviewed path-eligible item counts for every required stage
- **THEN** the coverage matrix SHALL mark the LearningGoal assessment coverage as complete for those stages
- **AND** the items counted SHALL have current human semantic review decisions and valid source hashes.

#### Scenario: Minimum coverage is incomplete
- **WHEN** a LearningGoal lacks required reviewed items for a stage
- **THEN** the coverage matrix SHALL mark the stage incomplete
- **AND** path planning SHALL receive a limitation rather than treating generated, template, unreviewed, or deprecated items as coverage.

### Requirement: Existing question sources are reused or explicitly rejected
The platform SHALL review existing question sources before authoring new adaptive checkpoint items.

#### Scenario: Existing item is suitable
- **WHEN** a preset, Prisma `Question`, AC-Q static, iCourse objective-bank, or K/A/Q foundation-bank item satisfies the LearningGoal and stage policy after human review
- **THEN** it MAY count toward the minimum item set
- **AND** its source lineage and review audit SHALL remain visible.

#### Scenario: Existing item is unsuitable
- **WHEN** an existing item is too broad, ambiguous, duplicated, open-ended without rubric, or disconnected from the LearningGoal policy
- **THEN** it SHALL remain registered as rejected, deprecated, or blocked
- **AND** it SHALL NOT count toward minimum reviewed coverage until rewritten and re-reviewed.
