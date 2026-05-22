# evidence-timeline-browser Specification

## Purpose
Define the governed evidence timeline browser used by student and teacher evidence drilldown views so recent facts are visible first and full evidence history remains filterable and paginated.
## Requirements
### Requirement: Evidence summaries are newest-first
The system SHALL order competency evidence summaries by recency rather than score.

#### Scenario: Newer lower score remains visible
- **WHEN** a dimension has an older high-score fact and a newer lower-score fact
- **THEN** the latest evidence summary places the newer fact before the older fact

### Requirement: Full evidence browsing is paginated
The system SHALL expose paginated student and teacher evidence APIs backed by LearningFact and governed source summaries.

#### Scenario: Teacher evidence access is scoped
- **WHEN** a teacher requests evidence for a student in one of their classes
- **THEN** the API returns newest-first evidence with filters and denies unrelated students
