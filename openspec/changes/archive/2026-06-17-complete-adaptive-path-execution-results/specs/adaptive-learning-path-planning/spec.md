## ADDED Requirements

### Requirement: Complex path nodes require typed outcome references
Adaptive path execution SHALL bind complex-node completion to typed outcome references before dependent path nodes advance.

#### Scenario: Adaptive assessment node completes
- **WHEN** an adaptive assessment node is marked completed for a path
- **THEN** the execution record SHALL include an adaptive assessment reference with item count, correctness, ability change, and weak-knowledge summary available to the path result card.

#### Scenario: Simulation or workbench node completes
- **WHEN** a simulation or control workbench node is marked completed for a path
- **THEN** the execution record SHALL include a simulation or control workbench reference with run id, trace or replay reference, key metrics, validation status, and evidence provenance.

#### Scenario: Arena node completes
- **WHEN** an Arena node is marked completed for a path
- **THEN** the execution record SHALL include an Arena submission reference with submission id, score, validity, and evaluation summary
- **AND** preview-only Arena evidence SHALL NOT be represented as official terminal validation unless policy explicitly permits it.

### Requirement: Missing complex-node results block dependent advancement
The path planner SHALL not advance to a node whose readiness depends on a complex-node result until the required result reference is bound.

#### Scenario: Required result is not bound
- **WHEN** a path node requires an assessment, simulation, workbench, or Arena result and the result reference is missing
- **THEN** dependent nodes SHALL remain blocked or locked
- **AND** the path activity SHALL record the missing binding for governance review.

#### Scenario: Result binding arrives later
- **WHEN** the missing result reference is later attached to the execution record
- **THEN** the planner SHALL re-evaluate dependent readiness without losing prior skip, return, review, or continued-interaction history.
