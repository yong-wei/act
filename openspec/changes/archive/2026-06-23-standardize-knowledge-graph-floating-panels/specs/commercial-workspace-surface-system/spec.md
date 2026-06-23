## ADDED Requirements

### Requirement: Knowledge graph workspace uses edge-anchored overlay panels
The knowledge graph workspace SHALL render local graph tools as edge-anchored overlays whose spacing is independent of graph canvas width.

#### Scenario: Local graph tools open on desktop
- **WHEN** `/knowledge` renders at a desktop viewport and the user opens directory, filter, legend, or view controls
- **THEN** each opened panel SHALL use the same local graph tool shell, placement rule, visual treatment, close behavior, scroll behavior, focus handling, and accessible panel relationship
- **AND** the panel SHALL anchor to the AppShell content or workspace edge with a fixed safe-area inset
- **AND** the gap between the panel and the workspace edge SHALL NOT increase merely because the graph canvas is wider
- **AND** filter controls SHALL NOT render through a separate panel model from directory, legend, or view controls.

#### Scenario: Graph workspace suppresses route scrolling
- **WHEN** `/knowledge` is used as an interactive graph workspace
- **THEN** graph pan, graph zoom, local tool scrolling, and inspector scrolling SHALL be scoped to the graph canvas or the active overlay
- **AND** the page itself SHALL NOT introduce vertical or horizontal scrolling caused by the graph canvas workspace
- **AND** browser zoom and canvas wheel zoom SHALL NOT compete with a route-level scroll container.

### Requirement: Knowledge graph inspector is a floating right-edge panel
The selected-node knowledge inspector SHALL be a floating workspace overlay on desktop rather than a layout rail that resizes the graph.

#### Scenario: Selected-node inspector opens
- **WHEN** a user selects a knowledge graph node on `/knowledge`
- **THEN** the selected-node inspector SHALL open as a floating panel tight to the right workspace edge
- **AND** opening or closing the inspector SHALL NOT change graph canvas width, graph canvas height, graph zoom, graph center, node layout, or selected-node state
- **AND** the inspector SHALL preserve keyboard focus management, close behavior, scroll containment, and mobile sheet behavior.

#### Scenario: Local tools and shared dock coexist
- **WHEN** a local graph tool panel, selected-node inspector, right-bottom workspace tools launcher, and Konling dock are present
- **THEN** local graph tools and the inspector SHALL remain visually distinct and non-overlapping
- **AND** opening local graph tools or the inspector SHALL NOT move the collapsed Konling floating button
- **AND** any collision rule for expanded Konling SHALL avoid obscuring the inspector or local tool panels without resizing the graph canvas.
