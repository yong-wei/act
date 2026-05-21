## ADDED Requirements

### Requirement: Teacher class insights include evidence coverage
Teacher class insight APIs SHALL expose evidence state and feature cache coverage for enrolled students.

#### Scenario: Class coverage summary is returned
- **WHEN** a teacher opens a class insight page
- **THEN** the response includes ready, stale, missing, and low-confidence evidence counts

### Requirement: Teacher student insight includes traceable evidence drawer data
Teacher student insight APIs SHALL expose scoped recent evidence summaries for diagnosis drilldown.

#### Scenario: Recent evidence is scoped and summarized
- **WHEN** a teacher opens a student they teach
- **THEN** the response includes recent LearningFacts, durable submission summaries, session quality, and feature cache confidence without full raw logs
