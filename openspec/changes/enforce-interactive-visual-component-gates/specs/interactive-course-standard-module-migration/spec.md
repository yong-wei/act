## ADDED Requirements

### Requirement: Visual component acceptance artifacts are required
Interactive course implementations SHALL provide a standard acceptance artifact whenever they add or modify visual components or shared control workbench embedding.

#### Scenario: Course visual component is implemented
- **WHEN** a course implementation adds or modifies an interactive visual component
- **THEN** the implementation SHALL record the design contract path, visual source path, student screenshot path, teacher screenshot path, non-default state screenshot path, manifest audit path, test result, and backend evidence sample path
- **AND** course completion SHALL fail when the artifact is missing or incomplete.

#### Scenario: Component leaks engineering semantics
- **WHEN** visible text in a visual component includes internal module names, renderer names, payload keys, file paths, debug labels, unsupported-module notes, or implementation-only capability ids
- **THEN** the course visual gate SHALL fail
- **AND** the finding SHALL be treated as a blocking product QA issue.
