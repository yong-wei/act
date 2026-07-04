## ADDED Requirements

### Requirement: Bottom-right assistant entry opens Konling directly
The platform shell SHALL treat the bottom-right assistant affordance as a direct Konling launcher when Konling is available.

#### Scenario: Konling is available
- **WHEN** a primary route registers Konling as the floating assistant control
- **THEN** the visible bottom-right button SHALL open Konling directly
- **AND** it SHALL NOT require the user to open a generic “工具” menu first.

#### Scenario: Theme switching is available
- **WHEN** a route supports theme switching
- **THEN** theme switching SHALL be exposed through the top-right shell action area or homepage account/action area
- **AND** theme switching SHALL NOT be injected as a bottom-right floating menu item.

#### Scenario: Other local controls exist
- **WHEN** management, support, settings, or route-local controls are needed
- **THEN** they SHALL use AppShell action slots, local toolbars, or an approved secondary control pattern
- **AND** they SHALL NOT make the primary Konling launcher ambiguous.

### Requirement: Direct Konling launcher preserves safe-area behavior
The direct Konling launcher SHALL preserve dock safe-area, focus, z-index, and route-context behavior.

#### Scenario: Konling opens over a dense workspace
- **WHEN** Konling opens on knowledge graph, adaptive learning, Arena, simulation, interactive learning, or Control Workbench routes
- **THEN** the launcher and opened panel SHALL not overlap primary local controls, graph inspectors, forms, charts, or mobile navigation
- **AND** route-level context registration SHALL remain available to the Konling runtime.
