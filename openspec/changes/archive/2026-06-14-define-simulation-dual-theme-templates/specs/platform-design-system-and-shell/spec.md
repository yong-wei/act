## ADDED Requirements

### Requirement: Simulation shell chrome uses governed theme roles
Simulation mission workspace chrome SHALL use platform semantic tokens for translucent top bars, side panels, bottom toolbars, hints, borders, text, and action states.

#### Scenario: Simulation shell theme changes
- **WHEN** the user switches between light and dark theme on a simulation route
- **THEN** shell chrome SHALL switch through governed theme roles
- **AND** it SHALL preserve readable text, visible focus, and clear panel boundaries without page-local raw color systems.

### Requirement: Simulation scene and shell colors are separated
Simulation shells SHALL allow feature-owned scene colors while governing UI chrome through platform tokens.

#### Scenario: Scene renders under shell chrome
- **WHEN** a 3D scene uses natural water, ship, terrain, or grid colors
- **THEN** the scene MAY keep feature-owned visual colors
- **AND** surrounding navigation, panels, toolbar, buttons, labels, and status UI SHALL use platform theme roles.
