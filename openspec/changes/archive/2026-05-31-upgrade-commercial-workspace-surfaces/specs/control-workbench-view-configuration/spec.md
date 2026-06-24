## ADDED Requirements

### Requirement: Direct and contextual workbench entry initialize equivalent default panels
The Control Workbench SHALL initialize a complete available default panel set for the current object, method, preset, and source context whether entered directly or from Arena.

#### Scenario: Student enters workbench directly with a selected object
- **WHEN** a student opens `/interactive-learning/control-workbench` and selects or receives a default object with available default panels
- **THEN** the workbench SHALL render the configured chart, diagram, or media panel instances
- **AND** it SHALL NOT silently omit the instrument panel area only because the entry source is direct rather than Arena.

#### Scenario: Default panel data is unavailable
- **WHEN** a default panel cannot render because the current object, method, or source data is unavailable
- **THEN** the panel area SHALL show an explicit branded unavailable state
- **AND** it SHALL preserve the layout region and explain the missing context in student-facing language.

### Requirement: Workbench panel chrome follows commercial instrument rules
Workbench panel instances SHALL use commercial instrument-panel chrome for title, selected source, local controls, status, and fallback states.

#### Scenario: Workbench analysis panel renders
- **WHEN** time-domain, Bode, Nyquist, root-locus, object diagram, black-box trace, or media panel renders
- **THEN** the panel SHALL expose title, selected source, available local controls, and evidence/status state through consistent commercial instrument chrome.
