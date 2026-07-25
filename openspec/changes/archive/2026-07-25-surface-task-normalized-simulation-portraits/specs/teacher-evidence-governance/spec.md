## ADDED Requirements

### Requirement: Teacher cumulative portraits expose task-attainment composition
Authorized teacher student-detail and class-attainment responses SHALL expose the task-normalized simulation completion count, current related-task count, and privacy-safe grouped task composition when the personal portrait has an eligible simulation dimension.

#### Scenario: Teacher reads a student's cumulative simulation attainment
- **WHEN** an authorized teacher opens a current class member with an eligible simulation task projection
- **THEN** the response includes the student's completed-task count, related-task count, and grouped task summary
- **AND** it does not expose raw run payloads, answers, hidden scoring details, or unrelated students' task details

#### Scenario: Teacher reads a class simulation aggregate
- **WHEN** an authorized teacher requests cumulative class attainment
- **THEN** the class simulation value is aggregated from current members' latest personal task projections
- **AND** the response uses the arithmetic mean of usable personal task-completion ratios and reports usable-member coverage against the current roster
- **AND** the response does not treat the class as the owner of learning facts or infer a class-time history

#### Scenario: Class comparison lacks a usable task aggregate
- **WHEN** a learner or current class aggregate has no usable task-normalized simulation value
- **THEN** the comparison remains unavailable
- **AND** the teacher response SHALL NOT emit zero values, ahead-or-behind conclusions, or a synthetic trend
