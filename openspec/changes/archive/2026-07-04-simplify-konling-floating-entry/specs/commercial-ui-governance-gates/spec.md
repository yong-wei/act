## ADDED Requirements

### Requirement: Visual QA rejects generic bottom-right tool menus for Konling routes
Commercial UI governance SHALL verify that primary Konling routes expose a direct assistant launcher rather than a generic bottom-right tools menu.

#### Scenario: Floating controls are reviewed
- **WHEN** visual evidence is captured for a route with Konling enabled
- **THEN** the bottom-right primary control SHALL be identifiable as Konling and SHALL open the assistant directly
- **AND** theme switching SHALL be visible in the top-right shell action area where the route supports themes.

#### Scenario: Dock collision is reviewed
- **WHEN** visual QA checks desktop and 320px mobile states
- **THEN** the Konling launcher and opened assistant panel SHALL not overlap primary content, local toolbars, graph panels, forms, or report labels.
