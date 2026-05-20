## ADDED Requirements

### Requirement: Response-producing pages are covered by a submission gate
The system SHALL provide a repository gate that detects manifest response-producing pages that bypass the shared submission evidence path.

#### Scenario: Missing shared submission integration
- **WHEN** a manifest page can collect a student response but does not use the shared submission path
- **THEN** the gate MUST fail with the lesson and step or page identifier
- **AND** the failure MUST identify the missing evidence integration.

#### Scenario: Module 5 coverage is included
- **WHEN** the gate runs
- **THEN** 5-2 and later module 5 lessons MUST be included in the response-producing page inventory
- **AND** the gate MUST fail if any inventoried page lacks coverage.

### Requirement: Session data-quality report is available
The system SHALL provide a report that summarizes post-class evidence usability for a session.

#### Scenario: Report includes evidence richness
- **WHEN** the data-quality report runs for a session
- **THEN** it MUST include answer availability, score availability, question summary availability, evidence quality level, report availability, and snapshot freshness
- **AND** it MUST distinguish rich, partial, legacy, and missing evidence.

#### Scenario: Report includes sync quality
- **WHEN** sync errors occurred in the session
- **THEN** the report MUST include raw sync errors, incident count, affected users, dominant source, and severity classification.

### Requirement: Course implementation guidance includes evidence gates
The system SHALL document evidence-gate requirements in the repo-local interactive lesson implementation workflow.

#### Scenario: New lesson implementation
- **WHEN** a new interactive lesson is implemented from manifest activities
- **THEN** the implementation guidance MUST require the shared submission path and post-class evidence verification
- **AND** it MUST name the commands or tests that enforce those requirements.
