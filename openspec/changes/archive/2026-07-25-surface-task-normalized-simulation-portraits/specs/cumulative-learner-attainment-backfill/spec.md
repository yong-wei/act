## ADDED Requirements

### Requirement: Task-attainment application uses the cumulative single-learner lane
The cumulative attainment backfill SHALL apply accepted simulation task candidates and directory-change refreshes through the existing fenced per-learner portrait materialization lane. A batch MAY schedule different learners concurrently but MUST NOT use a distinct multi-fact scoring semantic for one learner.

#### Scenario: Batch applies candidates for multiple learners
- **WHEN** an operator applies accepted simulation task candidates for multiple students
- **THEN** each affected learner receives an independently fenced portrait update
- **AND** class aggregation runs only from the resulting current personal portraits

#### Scenario: Candidate application yields no completed task
- **WHEN** an affected learner receives task progress evidence but no current task reaches its completion rule
- **THEN** the learner update records the governed task context
- **AND** it does not create a zero-valued simulation dimension or a completed-task contribution
