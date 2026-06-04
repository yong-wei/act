## ADDED Requirements

### Requirement: Evidence timelines group repeated low-signal events
The evidence timeline browser SHALL group repeated events and highlight meaningful learner-state changes.

#### Scenario: Repeated superseded snapshots exist
- **WHEN** multiple low-signal or superseded evidence events appear in a learner timeline
- **THEN** the UI SHALL group, summarize, or de-emphasize them
- **AND** high-value events such as simulation breakthroughs, path deviations, mastery changes, and risk changes SHALL remain visually identifiable.

### Requirement: Evidence browser aligns with learner data shell
The evidence browser SHALL use the same ability dimensions, status vocabulary, filters, and route frame as profile and adaptive learning surfaces.

#### Scenario: Student filters evidence
- **WHEN** a student filters by ability dimension, course or lesson context, event type, or result
- **THEN** the evidence browser SHALL preserve the learner data shell and current route context
- **AND** empty results SHALL remain navigable and actionable.
