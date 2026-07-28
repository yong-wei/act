## ADDED Requirements

### Requirement: Learner portrait exposes task-normalized simulation attainment
The learner-state service SHALL expose the task-normalized `simulationValidationEvidence` dimension as the canonical seventh portrait dimension when eligible simulation task evidence exists. It SHALL include completed-task count, related-task count, grouped task summaries, calculation version, evidence lineage, and limitation metadata.

#### Scenario: Learner state returns a usable simulation dimension
- **WHEN** the learner has completed one or more current published simulation tasks
- **THEN** learner state returns the task-normalized seventh dimension with its count-based attainment summary
- **AND** it SHALL NOT substitute raw event counts, legacy `param_change`, or recent-window activity for the task-based value

#### Scenario: Simulation dimension has no eligible evidence
- **WHEN** the learner has no eligible task contribution for the simulation dimension
- **THEN** learner state preserves an explicit no-evidence limitation for that dimension
- **AND** it SHALL NOT present a synthetic zero-valued simulation capability
