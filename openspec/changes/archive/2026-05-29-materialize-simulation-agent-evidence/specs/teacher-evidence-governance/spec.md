## ADDED Requirements

### Requirement: Teacher insights include simulation-agent evidence summaries
Teacher class and student insight APIs SHALL expose scoped summaries for materialized simulation, Arena preview, and Konling agent evidence where authorized.

#### Scenario: Teacher opens class summary
- **WHEN** a teacher opens a class insight view
- **THEN** the response SHALL include authorized simulation-agent coverage, run completion, replay confidence, weak metric distribution, intervention outcome, and low-confidence counts for students in that class.

#### Scenario: Teacher opens student drilldown
- **WHEN** a teacher opens an authorized student drilldown
- **THEN** the response SHALL include scoped LearningFacts, evidence draft status, SimulationRun references, AgentToolRun references, summary metrics, and provenance markers
- **AND** it SHALL NOT expose raw high-frequency traces, hidden official evaluation internals, or raw private Konling memory by default.

### Requirement: Teacher summaries do not cross class scope
Teacher insight services SHALL prevent simulation-agent evidence from other classes or unrelated students from entering class-level summaries.

#### Scenario: Same simulation task exists in another class
- **WHEN** another class has runs for the same simulation task or Arena challenge
- **THEN** the teacher's class summary SHALL exclude those runs unless the teacher is authorized for that class.
