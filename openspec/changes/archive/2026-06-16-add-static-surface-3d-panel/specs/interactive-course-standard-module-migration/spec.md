## ADDED Requirements

### Requirement: Static 3D surfaces use shared standard module rendering
Standard-module interactive lessons SHALL render static 3D surfaces through the shared `compute.panel` runtime path.

#### Scenario: Standard lesson uses a static 3D surface
- **WHEN** a migrated or newly authored standard-module lesson includes a static 3D surface
- **THEN** the manifest SHALL represent it as `kind: compute.panel` with a registered `static-surface-3d` capability
- **AND** it SHALL NOT introduce a lesson-private module kind or visual chrome to render the surface.

#### Scenario: Unit 1-2 pole magnitude surface is migrated
- **WHEN** Unit 1-2 renders the pole magnitude surface in the student or teacher runtime
- **THEN** the surface SHALL be served by the shared static 3D surface panel
- **AND** the existing static image evidence SHALL remain available as fallback or review evidence.
