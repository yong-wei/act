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
