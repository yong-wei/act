## ADDED Requirements

### Requirement: Workbench instrument area is theme-neutral
The control workbench instrument area SHALL render embedded analysis content on platform-neutral surfaces in both themes, scoped to the workbench so that premium lesson themes elsewhere are unchanged.

#### Scenario: Classic preset renders in light theme
- **WHEN** the classic four-view preset renders inside the control workbench in the light theme
- **THEN** the preset container, parameter summary, snapshot manager, and metric comparison SHALL use platform surface and border tokens rather than a dark translucent container or premium lesson cyan gradients.

#### Scenario: Premium lesson renders elsewhere
- **WHEN** a premium lesson or the standalone multi-representation linkage page renders
- **THEN** its premium lesson theme SHALL be unchanged by the workbench scoping.

### Requirement: Workbench learner-visible copy avoids internal terms
Control workbench learner-visible text SHALL NOT expose internal product or system terms such as Arena, DB BOPPPS, or 商业工作区, and SHALL NOT repeat the same mode label or evidence boundary twice in the context area.

#### Scenario: Student opens free exploration
- **WHEN** a student opens the workbench in free exploration mode
- **THEN** the context strip SHALL show the mode label once
- **AND** the launch summary, submission status, and support text SHALL use learner-facing Chinese terms such as 竞技场.
