## ADDED Requirements

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
