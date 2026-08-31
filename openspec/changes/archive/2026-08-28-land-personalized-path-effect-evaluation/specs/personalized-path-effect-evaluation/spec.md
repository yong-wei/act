## ADDED Requirements

### Requirement: Path effect evaluation is snapshot-bound and read-only

The system SHALL build a class-scoped personalized path effect evaluation from frozen path-generation snapshots, path execution records, and governed evidence. Repeating the evaluation with the same frozen inputs SHALL return the same metrics. The evaluation SHALL NOT mutate saved paths, execution state, historical decision snapshots, mastery, or official Arena scores.

#### Scenario: Teacher requests a class evaluation

- **WHEN** an authorized teacher or admin requests personalized path effect evaluation for a class they may access
- **THEN** the system SHALL return metrics bound to goal identity, generation-time learner-state snapshot, path version or candidate batch, and an evidence window
- **AND** it SHALL omit raw answers, private chat, hidden Arena parameters, and high-frequency traces

#### Scenario: Current portrait changes after evaluation inputs are frozen

- **WHEN** a learner portrait is updated after the evaluation inputs were captured
- **THEN** repeating the evaluation on the original frozen snapshots SHALL NOT change historical metrics

### Requirement: Low-confidence samples cannot produce a personalized lift conclusion

The evaluation SHALL separate insufficient, personalized, and baseline cohorts. Cold-start, low-confidence, stale, conflicting, or incomplete evidence SHALL NOT enter the high-confidence personalized cohort. If either comparison cohort is below the minimum sample size, the evaluation SHALL report `insufficient-data` and SHALL NOT claim a personalized improvement.

#### Scenario: Mixed evidence quality

- **WHEN** a class contains trusted personalized paths, baseline paths, and low-confidence samples
- **THEN** the evaluation SHALL count the low-confidence samples separately
- **AND** it SHALL compute comparison metrics only from the trusted personalized and baseline cohorts

#### Scenario: Sample size is too small

- **WHEN** the trusted personalized or baseline cohort has fewer than five samples
- **THEN** the evaluation SHALL set conclusion to `insufficient-data`
- **AND** it SHALL still show sample counts and limitations

### Requirement: Teachers can read a privacy-safe evaluation view

Authorized teachers and admins SHALL see sample counts, denominators, evidence completeness, confidence, and limitations for adoption, completion, checkpoint, and competency-lift metrics. Unauthorized actors SHALL be rejected. Evaluation unavailability SHALL NOT hide existing path execution or learning records.

#### Scenario: Teacher opens class analytics

- **WHEN** an authorized teacher opens the class analytics view
- **THEN** the page SHALL show the personalized path effect evaluation or an explicit insufficient-data state
- **AND** existing path, mastery, and Arena records SHALL remain available
