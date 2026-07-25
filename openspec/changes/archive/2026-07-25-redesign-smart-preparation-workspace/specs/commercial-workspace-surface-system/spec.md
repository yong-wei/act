## ADDED Requirements

### Requirement: Smart preparation uses an operations-console task layout
The commercial workspace SHALL present smart preparation as a repeatable teacher operations console with a task index and one active task rather than a grid of independent task cards.

#### Scenario: Desktop task workspace renders
- **WHEN** the smart-preparation task view renders at desktop width
- **THEN** the left region SHALL provide new task, title search, active or archived filtering, and task summaries containing topic, update time, current stage, and status
- **AND** the right region SHALL render exactly one active task accordion.

#### Scenario: Narrow task workspace renders
- **WHEN** the smart-preparation workspace renders at a narrow width
- **THEN** the task index SHALL remain reachable through a drawer, sheet, or equivalent compact navigation
- **AND** all five stages, their controls, and their status explanations SHALL remain usable without horizontal page scrolling.
