## ADDED Requirements

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
