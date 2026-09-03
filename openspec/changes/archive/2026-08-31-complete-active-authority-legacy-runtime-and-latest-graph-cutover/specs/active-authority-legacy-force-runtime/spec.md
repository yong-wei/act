## MODIFIED Requirements

### Requirement: Active Authority uses the established Force Graph runtime
The active Authority product canvas SHALL render both line-free root navigation and domain knowledge graphs through the complete established old-graph Force Graph runtime orchestration rather than an active-specific SVG, fixed-viewBox, static-coordinate, bounded-canvas, or reduced-wrapper renderer. The shared runtime SHALL own layout, force coordinates, responsive viewport, gestures, camera, hover, selection, filters, fitting, and presentation effects for both active and legacy adapters while keeping their data and session namespaces isolated. The active view SHALL occupy the workspace available below the shared shell, default to 2D, retain 3D, and support wheel and touch zoom, pan, node drag and pin, force reflow, dynamic relation effects, hover preview, selection, and camera fitting in both supported dimensions.

#### Scenario: User opens the active root
- **WHEN** a user opens the active Authority root with domain navigation entries
- **THEN** the shared Force Graph runtime SHALL fill the available workspace and render those entries as line-free navigation projections
- **AND** no active-specific SVG, fixed viewBox, bounded graph card, Canonical relation, or legacy data source SHALL own that root presentation

#### Scenario: User opens an active domain in 2D
- **WHEN** a user enters an active domain with presentable nodes
- **THEN** the shared Force Graph canvas SHALL fill the available workspace and accept the established wheel, pan, drag, pin, selection, hover, fitting, and force-reflow interactions
- **AND** button-only zoom, static coordinates, inert drag persistence, or an active-specific layout state machine SHALL NOT be the primary interaction contract

#### Scenario: User switches active mode to 3D
- **WHEN** the user changes the active graph from its default 2D view to 3D
- **THEN** the 3D view SHALL consume the same active semantic view model and preserve relation filters, node filters, selection, and drawer meaning
- **AND** it SHALL NOT switch to old graph data or a separate relation truth

#### Scenario: User switches between active and legacy modes
- **WHEN** the user uses the unified graph toolbar to change data mode
- **THEN** the same runtime orchestration SHALL restore the destination namespace's canvas, filters, selection, drawer, coordinates, and camera without title or control overlap
- **AND** it SHALL NOT merge or map active and legacy identities

#### Scenario: Active presentation needs an unsupported primitive
- **WHEN** an active-only visual requirement is not yet supported by the shared Force Graph runtime
- **THEN** the shared runtime SHALL receive a backward-compatible presentation extension
- **AND** the product SHALL NOT add or restore a second active canvas engine
