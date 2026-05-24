# course-evidence-specs Specification

## Purpose
Define the shared course evidence specification registry for runtime-first interactive lessons so governance, quality checks, and backfill jobs use the same lesson state kinds and evidence step mappings.
## Requirements
### Requirement: Interactive lessons expose evidence specifications
The system SHALL resolve a CourseEvidenceSpec for each supported runtime-first interactive lesson.

#### Scenario: Module 5 evidence mapping is available
- **WHEN** the registry is queried for 5-3, 5-4, 5-5, or 5-6
- **THEN** it returns the expected student state kind, pre assessment step, post assessment step, and summary step

### Requirement: Unsupported lessons are classified explicitly
The system SHALL return an explicit unsupported or legacy classification when a lesson cannot provide a complete evidence specification.

#### Scenario: Missing manifest does not silently pass
- **WHEN** a lesson lacks manifest metadata and no override exists
- **THEN** the registry reports unsupported or legacy status with a reason

### Requirement: Early unit lessons expose evidence specifications
The system SHALL resolve a supported `CourseEvidenceSpec` for 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, and 3-4 after their manifest migration.

#### Scenario: Migrated early unit spec resolves
- **WHEN** the evidence spec registry is queried with a migrated early unit manifest
- **THEN** it SHALL return `status: supported`
- **AND** the spec SHALL include student state kind, response-producing step ids, and available pre assessment, post assessment, or summary step ids.

#### Scenario: Objective early unit evidence is scoreable when contract permits
- **WHEN** a migrated early unit manifest includes objective reference answers
- **THEN** its evidence spec SHALL expose enough step and question metadata for scoreable manifest submissions
- **AND** unsupported objective scoring SHALL be marked explicitly rather than silently treated as a failed response.
