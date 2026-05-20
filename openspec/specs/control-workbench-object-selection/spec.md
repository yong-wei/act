# control-workbench-object-selection Specification

## Purpose
TBD - created by archiving change comprehensive-simulation-object-selector. Update Purpose after archive.
## Requirements
### Requirement: Object selector is collapsible
The comprehensive simulation workbench SHALL provide a collapsible object selector so object choice does not dominate the analysis surface.

#### Scenario: Selected object remains visible when collapsed
- **WHEN** the object selector is collapsed after a compatible object has been selected
- **THEN** the collapsed header SHALL show the selected object name
- **AND** it SHALL show enough labels to identify the selected object's source and model type.

#### Scenario: Expanded selector shows object groups
- **WHEN** the selector is expanded
- **THEN** typical objects and white-box objects SHALL be grouped by their configured object category
- **AND** each group SHALL support scanning without changing the current working model until an object is selected.

### Requirement: Selected object state is visually explicit
The object selector SHALL make the current selected object visually distinct in both light and dark themes.

#### Scenario: Light theme selected state
- **WHEN** the workbench is rendered in light theme
- **THEN** the selected object SHALL have a distinct background, border, or text treatment
- **AND** the selected state SHALL not rely on color alone when labels are present.

#### Scenario: Dark theme selected state
- **WHEN** the workbench is rendered in dark theme
- **THEN** the selected object SHALL remain visually distinct from hover, focus, and unselected states.

### Requirement: Object models use formula rendering and labels
Typical and white-box object entries SHALL render model expressions as LaTeX/KaTeX formulas and metadata as labels or badges.

#### Scenario: White-box object model is shown as a formula
- **WHEN** a white-box object exposes a transfer-function model
- **THEN** the selector SHALL render the model expression with LaTeX/KaTeX
- **AND** it SHALL NOT present the model as a plain text-only sentence.

#### Scenario: Object metadata uses labels
- **WHEN** an object entry includes source, visibility, model type, or compatibility metadata
- **THEN** those fields SHALL be shown as labels or badges
- **AND** they SHALL not be rendered as unstructured inline prose.

### Requirement: Incompatible object selection is safe
The object selector SHALL reject incompatible object selections without corrupting the active workbench model.

#### Scenario: Incompatible object is selected
- **WHEN** the student selects an object that the active preset cannot render
- **THEN** the workbench SHALL show a Chinese compatibility reason
- **AND** the previously selected compatible object and working model SHALL remain active.

