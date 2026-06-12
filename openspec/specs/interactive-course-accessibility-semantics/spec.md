## Purpose

Define accessibility semantics for interactive course student and teacher surfaces so business identities do not conflict with ARIA role semantics.

## Requirements
### Requirement: Interactive course surfaces use valid ARIA roles
The system SHALL use only valid non-abstract ARIA roles or semantic HTML elements for interactive course student and teacher surfaces.

#### Scenario: Course page marks business role
- **WHEN** an interactive course page or course subcomponent needs to identify a student or teacher surface for branching, styling, analytics, or tests
- **THEN** it SHALL use domain-specific props such as `viewerRole` or non-ARIA metadata such as `data-role` rather than `role="student"` or `role="teacher"`

#### Scenario: Business role reaches the DOM
- **WHEN** a course component receives a student or teacher business role prop
- **THEN** it SHALL NOT forward that value to the DOM `role` attribute

#### Scenario: Course page marks a semantic region
- **WHEN** an interactive course page marks a content region for assistive technology
- **THEN** it SHALL use semantic HTML or a valid ARIA role with an accessible name

### Requirement: Invalid business roles are rejected by local validation
The system SHALL provide a local validation guard that rejects interactive course source files containing business identities in the DOM `role` attribute.

#### Scenario: Developer validates interactive course accessibility semantics
- **WHEN** a developer runs the relevant local validation or React Doctor 0.5.1 error-only scan
- **THEN** the report SHALL contain no `aria-role` diagnostics for `student` or `teacher` role values
