## ADDED Requirements

### Requirement: Premium visual language has light and dark parity
The platform SHALL define premium visual rules for both light and dark themes rather than treating either theme as a derived fallback.

#### Scenario: Light theme renders a primary surface
- **WHEN** homepage, login, Interactive Learning, simulation hub, Control Workbench, learner profile, teacher, admin, or knowledge graph renders in light theme
- **THEN** the surface SHALL use the approved matte chart, engineering paper, instrument panel, and evidence-state roles
- **AND** it SHALL NOT degrade into unrelated white-card administration styling.

#### Scenario: Dark theme renders a primary surface
- **WHEN** the same representative surfaces render in dark theme
- **THEN** the surface SHALL use the approved night-navigation, low-light instrument, trace, and warning/success signal roles
- **AND** it SHALL preserve text contrast, chart readability, and control discoverability.

### Requirement: Page families share one visual world
The platform SHALL treat public entry, learning, simulation, learner profile, teacher operations, admin governance, and knowledge graph surfaces as one visual world.

#### Scenario: User moves between page families
- **WHEN** a user navigates from homepage or login to Interactive Learning, simulation, Control Workbench, profile, teacher, admin, or knowledge graph pages
- **THEN** the route transition SHALL preserve recognizable brand surfaces, token roles, typography, and navigation behavior
- **AND** it SHALL NOT feel like a transition between unrelated products.
