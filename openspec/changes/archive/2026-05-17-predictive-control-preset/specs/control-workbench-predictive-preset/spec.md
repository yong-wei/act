## ADDED Requirements

### Requirement: Predictive preset supports bounded MPC template
The unified workbench SHALL provide a predictive-control preset that supports bounded linear MPC template parameters.

#### Scenario: MPC challenge opens
- **WHEN** a student opens a task whose allowed method is `mpc`
- **THEN** the workbench SHALL render prediction horizon, control horizon, output weight, control weight, terminal weight, input limit, and sample time controls.

### Requirement: Predictive preset supports optimized PID template
The predictive-control preset SHALL support optimization-assisted PID template parameters for robust PID tasks.

#### Scenario: Optimized PID challenge opens
- **WHEN** a student opens a task whose allowed method is `optimized-pid`
- **THEN** the workbench SHALL render speed, energy, robustness, overshoot, and search-budget controls.

### Requirement: Predictive preset generates official template artifacts
The predictive-control preset SHALL generate official `mpc` or `optimized-pid` artifacts from the current template draft.

#### Scenario: Student submits MPC draft
- **WHEN** a student submits a valid MPC draft
- **THEN** the workbench SHALL call `/api/arena/evaluate`
- **AND** the artifact method SHALL be `mpc`.

#### Scenario: Student submits optimized PID draft
- **WHEN** a student submits a valid optimized PID draft
- **THEN** the workbench SHALL call `/api/arena/evaluate`
- **AND** the artifact method SHALL be `optimized-pid`.

### Requirement: Predictive preset distinguishes preview from hidden official scoring
The predictive-control preset SHALL distinguish local preview information from official hidden-scenario scoring.

#### Scenario: Hidden metric unavailable locally
- **WHEN** a ranking metric is official-only, such as hidden scenario worst performance
- **THEN** the preview view SHALL label it as official evaluation only
- **AND** it SHALL NOT show fabricated local values.
