## ADDED Requirements

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
