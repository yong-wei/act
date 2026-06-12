## ADDED Requirements

### Requirement: Code examples use the standard code module
Interactive course manifests SHALL represent visible code examples as `content.code` modules instead of plain rich text or lesson-private renderers.

#### Scenario: MATLAB code example is authored
- **WHEN** an interactive lesson includes a MATLAB-style code example
- **THEN** the manifest SHALL use a `content.code` module with `language` set to `matlab`
- **AND** the payload SHALL include the source code, a teaching title, and a teaching explanation when explanation is needed.

#### Scenario: Code is not a generic prose block
- **WHEN** the module registry gate scans a migrated or new course manifest
- **AND** a visible module carries source-code-like content through an ordinary prose module
- **THEN** the gate SHALL fail or require migration to `content.code`.

### Requirement: Figure-bearing pages use teaching-only visible text
Interactive course pages that display figures, graphics, generated images, or media SHALL expose only teaching-relevant visible text across the entire student-visible and teacher-visible page.

#### Scenario: Figure caption is rendered
- **WHEN** a figure, SVG, generated graphic, or media panel is visible to students or teachers
- **THEN** its visible title, caption, and explanation SHALL describe the teaching object, observable evidence, reading order, or control-system judgment
- **AND** it SHALL NOT display development paths, file paths, module kind names, renderer names, platform implementation notes, or generic labels that only describe the UI carrier.

#### Scenario: Unit 1-1 graphics are reviewed
- **WHEN** Unit 1-1 figure-bearing pages are validated
- **THEN** every visible text string on those pages SHALL be teaching-semantic
- **AND** path-like strings or development labels SHALL fail validation.
