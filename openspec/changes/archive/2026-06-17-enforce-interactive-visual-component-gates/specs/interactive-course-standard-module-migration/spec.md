## ADDED Requirements

### Requirement: Visual component acceptance artifacts are required
Interactive course implementations SHALL provide a standard acceptance artifact whenever they add or modify visual components or shared control workbench embedding.

#### Scenario: Course visual component is implemented
- **WHEN** a course implementation adds or modifies an interactive visual component
- **THEN** the implementation SHALL record the design contract path, visual source path, teaching mapping, screenshot matrix, viewport matrix, manifest audit path, test result, browser audit path, and backend evidence sample path
- **AND** course completion SHALL fail when the artifact is missing or incomplete.

#### Scenario: Teaching mapping is missing
- **WHEN** a visual component acceptance artifact omits lesson id, step id, learning goal id, handout anchor or evidence unit id, BOPPPS phase, or interactive contract step id
- **THEN** course completion SHALL fail
- **AND** the component SHALL NOT be accepted as serving the lesson design contract.

#### Scenario: Screenshot path is not traceable
- **WHEN** a screenshot artifact path or manifest entry does not identify component id, route, role, theme, viewport, and state
- **THEN** course completion SHALL fail
- **AND** the visual gate SHALL report the missing dimension.

#### Scenario: Component leaks engineering semantics
- **WHEN** visible text in a visual component includes internal module names, renderer names, payload keys, file paths, debug labels, unsupported-module notes, or implementation-only capability ids
- **THEN** the course visual gate SHALL fail
- **AND** the finding SHALL be treated as a blocking product QA issue.

### Requirement: Visual component browser audit has fixed role and route inputs
Interactive course visual component browser audit SHALL declare representative routes, classroom roles, session preconditions, release steps, answer reveal steps, and diagnostics entry points.

#### Scenario: Browser audit lacks route or state inputs
- **WHEN** a browser audit report omits route, role, session id or fixture, release state, answer reveal state, diagnostics entry point, theme, viewport, or component id
- **THEN** course completion SHALL fail
- **AND** the audit SHALL NOT be accepted as evidence for the missing matrix cell.
