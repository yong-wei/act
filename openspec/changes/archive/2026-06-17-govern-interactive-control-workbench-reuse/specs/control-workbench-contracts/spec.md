## ADDED Requirements

### Requirement: Control workbench supports course embedding contracts
The shared control workbench SHALL expose a course embedding contract that can be used by interactive lesson runtime without importing lesson-private components.

#### Scenario: Course runtime embeds the workbench
- **WHEN** an interactive course manifest requests a shared control workbench capability
- **THEN** the workbench contract SHALL accept lesson id, step id, role, release state, initial parameters, allowed panels, theme, and response contract metadata
- **AND** it SHALL return renderable state without requiring the course to reimplement panel internals.

#### Scenario: Course changes parameters
- **WHEN** a student changes workbench parameters inside an interactive lesson
- **THEN** the shared workbench SHALL expose a structured parameter snapshot suitable for interactive submission evidence
- **AND** the snapshot SHALL identify panel ids and teaching-relevant parameter names without exposing implementation-only field names in visible UI.

### Requirement: Course embedded workbench adapts to light and dark themes
The shared control workbench SHALL preserve readable chart, legend, handle, annotation, and fallback states in both light and dark interactive course themes.

#### Scenario: Theme changes during a lesson
- **WHEN** a course page renders a shared workbench capability in light or dark theme
- **THEN** axes, grid lines, curves, legends, handles, labels, warnings, and fallback content SHALL meet the same readability contract
- **AND** the implementation acceptance artifact SHALL include student and teacher screenshots for both themes.
