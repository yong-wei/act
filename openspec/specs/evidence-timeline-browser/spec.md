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

### Requirement: Evidence timelines group repeated low-signal events
The evidence timeline browser SHALL group repeated events and highlight meaningful learner-state changes.

#### Scenario: Repeated superseded snapshots exist
- **WHEN** multiple low-signal or superseded evidence events appear in a learner timeline
- **THEN** the UI SHALL group, summarize, or de-emphasize them
- **AND** high-value events such as simulation breakthroughs, path deviations, mastery changes, and risk changes SHALL remain visually identifiable.

### Requirement: Evidence browser aligns with learner data shell
The evidence browser SHALL use the same ability dimensions, status vocabulary, filters, and route frame as profile and adaptive learning surfaces.

#### Scenario: Student filters evidence
- **WHEN** a student filters by ability dimension, course, event type, confidence, or result
- **THEN** the evidence browser SHALL preserve the learner data shell and current route context
- **AND** empty results SHALL remain navigable and actionable.
