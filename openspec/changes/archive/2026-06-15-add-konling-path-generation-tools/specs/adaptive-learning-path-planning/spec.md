## ADDED Requirements

### Requirement: Planner accepts Konling path-generation requests
The adaptive path planner SHALL accept governed Konling tool requests as one path generation input channel.

#### Scenario: Konling invokes planner
- **WHEN** a governed Konling path tool calls the planner
- **THEN** the planner SHALL consume registered goal, learner state, user parameters, natural-language intent summary, and resource preferences
- **AND** it SHALL return structured path options, comparison metadata, and student-safe explanation fields.

#### Scenario: Konling revises existing options
- **WHEN** Konling requests path option revision
- **THEN** the planner SHALL preserve the original path request and selection history
- **AND** it SHALL return revised options without discarding prior rejected or selected alternatives.
