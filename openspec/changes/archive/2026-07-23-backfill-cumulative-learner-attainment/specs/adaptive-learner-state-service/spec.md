## ADDED Requirements

### Requirement: Historical native portraits remain visible after recent activity ends
The learner-state service SHALL treat a valid native portrait v2 as cumulative
attainment derived from all materialized historical facts, independent of
whether the learner has facts in a recent classroom window.

#### Scenario: Learner has older facts but no recent facts
- **WHEN** a learner has a valid native portrait v2 rebuilt from historical
  facts and has no fact in the recent class window
- **THEN** student-facing portrait consumers SHALL return the native portrait
- **AND** they SHALL expose its generation timestamp without reporting a
  no-evidence state.

#### Scenario: Learner has no facts
- **WHEN** a learner has no historical `LearningFact`
- **THEN** the learner-state service SHALL retain an explicit no-evidence state
- **AND** it SHALL NOT create or display a synthetic zero-valued portrait.

#### Scenario: Learner facts do not contribute portrait evidence
- **WHEN** the current native portrait is absent because historical facts are
  context-only or otherwise provide no governed portrait contribution
- **THEN** the growth page SHALL show an explicit no-evidence state and a real
  learning-activity entry
- **AND** it SHALL NOT show a zero score, learning stage, positive capability
  conclusion, or capability cards.
