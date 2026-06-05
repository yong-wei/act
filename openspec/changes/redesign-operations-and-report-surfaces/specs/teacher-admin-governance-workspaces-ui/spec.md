## ADDED Requirements

### Requirement: Teacher and admin homes prioritize operational decisions
Teacher and admin home surfaces SHALL prioritize current work, pending actions, risks, and unavailable states over directory cards.

#### Scenario: Teacher or admin home renders
- **WHEN** `/teacher` or `/admin` opens
- **THEN** the first viewport SHALL show active work, pending decisions, risks, or next actions relevant to the role
- **AND** route directory cards SHALL NOT be the only primary hierarchy.

### Requirement: Operations navigation persists across role subpages
Teacher and admin operations navigation SHALL remain continuous across subpages.

#### Scenario: Role subpage renders
- **WHEN** teacher classes, lesson plans, resources, history, analytics, admin users, states, config, or governance pages render
- **THEN** the route SHALL preserve the role operations navigation, current location, and account/cockpit semantics
- **AND** mobile layouts SHALL expose the same work domains without relying on desktop sidebars.

### Requirement: Teacher operations connect preparation, classroom, evidence, and reporting
Teacher operations surfaces SHALL support a complete teaching workflow rather than isolated console entries.

#### Scenario: Teacher follows a teaching workflow
- **WHEN** a teacher moves from class to lesson plan, resource or ResourceNode, classroom launch, student activity evidence, classroom history, analytics, or report entry
- **THEN** each surface SHALL preserve role navigation, current object context, next action, and evidence availability
- **AND** teacher controls, telemetry summaries, and teacher insight states SHALL remain visible where the underlying runtime provides them.
