## ADDED Requirements

### Requirement: Visual stage preserves shared chrome boundaries
Interactive course pages SHALL use `visual.stage` for complex two-dimensional visuals while preserving shared module chrome and role state.

#### Scenario: Stage appears with teacher controls
- **WHEN** a teacher releases, hides, reveals, or jumps a stage layer
- **THEN** the control SHALL attach to the stage or the target layer
- **AND** it SHALL NOT appear as a detached global drawer that obscures the primary stage.

#### Scenario: Stage uses light and dark themes
- **WHEN** a stage is rendered in light or dark mode
- **THEN** text, formulas, connectors, annotations, activity anchors, and disabled states SHALL remain readable
- **AND** the implementation acceptance artifact SHALL include student and teacher screenshots for both themes.

#### Scenario: Stage exposes only teaching semantics
- **WHEN** stage titles, layer labels, fallback text, or diagnostics are visible to students or teachers
- **THEN** they SHALL use teaching language
- **AND** they SHALL NOT expose module kinds, payload keys, file paths, renderer names, or platform implementation notes.
