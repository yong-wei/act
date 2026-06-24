## ADDED Requirements

### Requirement: Workspaces use the compact edge model
Commercial workspaces SHALL use the sitewide compact edge-spacing model for their outer content frame, including workspaces that contain text, forms, tables, charts, canvases, or reports.

#### Scenario: Dense workspace renders on a wide screen
- **WHEN** a Control Workbench, Arena, simulation, data center, teacher analytics, admin governance, knowledge graph, adaptive practice, or report workspace renders at 1440px, 1920px, or 2560px width
- **THEN** the primary workspace or instrument area SHALL use the available width inside compact fixed edges
- **AND** large empty side gutters caused by centered page-level max-width wrappers SHALL NOT be accepted.

#### Scenario: Dense workspace renders at mixed desktop breakpoints
- **WHEN** a workspace route exposes local tools, inspectors, floating docks, runtime controls, or support drawers at 1024px, 1100px, or 1279px width
- **THEN** compact spacing SHALL preserve primary workspace access while auxiliary surfaces are open
- **AND** the page SHALL NOT introduce overlap, horizontal page scroll, trapped viewport content, or unreachable controls.

#### Scenario: Workspace contains prose or form controls
- **WHEN** a workspace contains prose, instructions, filters, forms, rubrics, tables, or evidence details
- **THEN** those elements SHALL be arranged within the compact workspace grid or internal component measures
- **AND** the entire workspace SHALL NOT be narrowed to the center merely because it includes text or forms.

### Requirement: Interactive course runtime uses compact spacing
Interactive course runtime pages SHALL render course headers, student runtime pages, teacher runtime pages, and standard module chrome inside the sitewide compact edge system.

#### Scenario: Interactive course runtime opens on desktop
- **WHEN** a student or teacher opens an interactive course runtime at desktop width
- **THEN** the runtime header and `premium-lesson-main` content SHALL use compact page edges and the available workspace width
- **AND** shared course wrappers SHALL NOT use narrow centered caps such as `max-w-[1180px]` or `max-w-[1280px]` as the page-level layout.

#### Scenario: Standard modules render inside a wide runtime
- **WHEN** standard interactive modules, visual stages, compute panels, quizzes, explanations, figures, or forms render inside a runtime page
- **THEN** the module chrome SHALL occupy the available compact workspace width according to its role and content type
- **AND** lesson-private wrappers SHALL NOT reintroduce wide-screen side gutters around the whole lesson body.

#### Scenario: Course runtime renders on mobile
- **WHEN** an interactive course runtime renders at 320px width
- **THEN** compact spacing SHALL collapse to mobile-safe edges
- **AND** secondary controls SHALL remain reachable without horizontal overflow or squeezed desktop-only gutters.
