## MODIFIED Requirements

### Requirement: Effect report metrics are source-backed
Assistant demo effect reports SHALL include document grading quality metrics when the competition baseline uses grading.

#### Scenario: Effect metric is generated
- **WHEN** the effect report includes document grading
- **THEN** it SHALL expose grading feedback coverage, teacher override rate, AI/teacher score delta or agreement, blocked-evaluator count, and sample size
- **AND** every metric SHALL include source references, source window, exclusions, confidence, and synthetic or real data marker.

### Requirement: Demo package covers the assistant closed loop
The demo package SHALL include professional grading artifacts when the grading workflow is part of the baseline story.

#### Scenario: Demo package is seeded
- **WHEN** the intelligent teaching assistant demo package is installed
- **THEN** it SHALL include at least one converted document, draft criterion assessments, teacher-approved feedback, writeback preview, and student feedback route target
- **AND** grading artifacts SHALL be privacy-reviewed and tied to the baseline class and student records.
