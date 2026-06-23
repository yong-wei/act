## Purpose
Define commercial workspace layout, panel, command, evidence, and chart-surface rules for dense learning, simulation, challenge, course-runtime, teacher, and admin tools.
## Requirements
### Requirement: Commercial workspaces use instrument-oriented zones
The system SHALL structure dense workspaces with context strip, command bar, instrument area, evidence rail, and support drawer zones when those zones apply to the workspace.

#### Scenario: A dense workspace renders
- **WHEN** Control Workbench, Arena challenge detail, interactive course runtime, simulation workspace, teacher analytics, or admin governance renders a dense task surface
- **THEN** the surface SHALL expose task context, primary commands, instrument panels, evidence/status context, and support actions through a coherent commercial hierarchy
- **AND** it SHALL NOT rely on unrelated nested cards as the primary layout model.

### Requirement: Workspace panels preserve stable visual geometry
The system SHALL keep chart, diagram, media, and module panel wrappers dimensionally stable while controls, loading state, availability, and selected series change.

#### Scenario: A student changes a panel option
- **WHEN** the student switches curves, object, method, lesson step, answer state, or evidence overlay
- **THEN** the panel wrapper SHALL preserve stable width and height constraints
- **AND** surrounding panels SHALL NOT jump because option controls or fallback text changed.

### Requirement: Workspaces may replace legacy local shells
The system SHALL allow workspace-specific commercial shells to replace local page shells when the replacement preserves route behavior, role actions, and contextual navigation.

#### Scenario: A legacy workspace shell conflicts with commercial hierarchy
- **WHEN** a workspace shell duplicates global navigation, hides contextual route state, or forces a generic card layout
- **THEN** the migration MAY replace it with a commercial workspace shell derived from shared brand and navigation tokens.

### Requirement: Workspace presentation preserves domain ownership
The system SHALL keep commercial workspace primitives display-focused and SHALL NOT compute domain truth for simulations, official evaluation, learner evidence, module correctness, or route authorization.

#### Scenario: Workspace renders evidence or panel availability
- **WHEN** a workspace panel displays readiness, official status, confidence, correct/incorrect state, or availability
- **THEN** the feature domain SHALL supply that state
- **AND** the commercial surface primitive SHALL only map it to layout, tone, label, and allowed details.

### Requirement: Operations workspaces share the commercial system
The system SHALL treat teacher analytics, admin governance, data center, data-quality, and report surfaces as first-class commercial operations workspaces.

#### Scenario: Teacher or admin opens an operations workspace
- **WHEN** a teacher analytics, admin governance, data center, data-quality, or report surface renders
- **THEN** it SHALL use the shared commercial workspace concepts for context, commands, instruments, evidence/status, and support actions
- **AND** it SHALL preserve dense repeated-use ergonomics rather than copying spacious student-entry layouts.

### Requirement: Operations metrics use stable commercial hierarchy
Operations workspaces SHALL align metrics, tables, status summaries, filters, and report actions through stable visual hierarchy and tabular numeric treatment.

#### Scenario: A teacher or admin page displays operational metrics
- **WHEN** the page renders class, learner, evidence, queue, report, or governance metrics
- **THEN** numeric values SHALL align consistently
- **AND** status and confidence labels SHALL use shared evidence semantics rather than page-local badge vocabularies.

### Requirement: Task workspaces use registered archetypes
Commercial workspaces SHALL support registered archetypes for immersive scene, engineering analysis, challenge task, lesson runtime, learner data, operations analytics, and governance console surfaces.

#### Scenario: A task route is migrated
- **WHEN** a simulation, Control Workbench, Arena, or interactive runtime route adopts a commercial workspace
- **THEN** it SHALL declare its workspace archetype and expected zones
- **AND** it SHALL inherit platform tokens, navigation conventions, account actions, and floating dock rules.

### Requirement: Dense workspace controls do not compete with shell controls

Commercial workspace local controls SHALL be visually distinct from role cockpit, global navigation, and floating dock controls.

#### Scenario: Simulation pages expose local tools as workspace controls
- **WHEN** a simulation detail route renders local telemetry, controls, hints, or scene commands
- **THEN** the controls SHALL be organized as simulation-local workspace panels and bottom tools
- **AND** mobile secondary controls SHALL NOT appear as persistent sidebars that compete with the primary scene
- **AND** the local tool layer SHALL use governed platform tokens rather than page-local palettes.

### Requirement: Mission workspaces prioritize instrument area
Commercial mission workspaces SHALL prioritize active object, current step, primary command, and instrument area before explanatory or configuration content.

#### Scenario: Mission workspace first viewport renders
- **WHEN** Control Workbench, Arena task, simulation, or lesson runtime workspace opens
- **THEN** the first viewport SHALL expose current context, primary task state, and the main visualization or instrument entry
- **AND** long process explanations, secondary panel setup, and support text SHALL NOT obscure the primary instrument area.

### Requirement: Lesson runtime workspaces preserve runtime manifest truth
Commercial lesson runtime workspaces SHALL preserve the runtime lesson manifest and teacher/student activity contract.

#### Scenario: Runtime lesson shell is redesigned
- **WHEN** a lesson has `interactive-manifest.json` or equivalent runtime bundle
- **THEN** the UI SHALL consume runtime truth for steps, activities, telemetry summary, teacher insight, and teacher controls
- **AND** redesign SHALL NOT replace runtime state with static decorative panels or authoring-only assumptions.

### Requirement: Mobile mission workspaces use sheets for secondary controls
Commercial mission workspaces SHALL use mobile sheets or drawers for secondary configuration.

#### Scenario: Workspace renders at 320px width
- **WHEN** object selection, method boundaries, filters, panel setup, evidence, or support content is available
- **THEN** secondary content SHALL move into explicit sheet/drawer controls
- **AND** the primary visualization or task entry SHALL remain reachable without reading through all secondary panels.

### Requirement: Workspace shell supports collapsible navigation
The system SHALL provide a unified workspace shell pattern for dense student workspaces with desktop expanded navigation, desktop collapsed navigation, sticky breadcrumb header, personal-center account action, and mobile drawer navigation.

#### Scenario: Desktop workspace shell expands and collapses
- **WHEN** a student opens a migrated workspace on a desktop-width viewport
- **THEN** the left navigation SHALL be available in expanded and collapsed states
- **AND** the collapsed state SHALL preserve route navigation through icons, accessible names, focus order, and active route indication
- **AND** the collapsed state SHALL reserve only the approved narrow navigation rail width rather than the expanded sidebar width
- **AND** collapsed navigation items SHALL NOT display duplicated or ambiguous abbreviated text
- **AND** the main workspace area SHALL expand without horizontal overflow.

#### Scenario: Mobile workspace shell uses a drawer
- **WHEN** a student opens a migrated workspace at 320px width
- **THEN** global workspace navigation SHALL move into an explicit drawer or sheet control
- **AND** the primary task content SHALL remain reachable without reading through all navigation entries.

### Requirement: Workspace visual assets are centralized
The system SHALL keep generated or hand-authored visual-world assets for workspace identity in a centralized platform asset directory rather than page-local route folders.

#### Scenario: Arena visual assets are added
- **WHEN** Arena shell, entry, empty-state, or challenge-card visuals require images or domain illustrations
- **THEN** those assets SHALL be stored under a single platform visual-world directory for Arena
- **AND** page components SHALL reference those assets through a consistent path or manifest
- **AND** the assets SHALL NOT be scattered inside Arena route, component, or test fixture directories.

#### Scenario: Visual assets render with UI text
- **WHEN** a generated image or illustration is used in the workspace shell or Arena cards
- **THEN** the asset SHALL NOT contain rendered instructional text, labels, or numbers that are needed for comprehension
- **AND** readable text SHALL be rendered by the application UI.

### Requirement: Workspace identity avoids emoji symbols
The system SHALL use the platform icon system, shared status semantics, and centralized visual assets for premium workspace identity instead of emoji-style symbols.

#### Scenario: Workspace navigation and cards render
- **WHEN** a migrated workspace displays navigation, route identity, task status, empty states, or primary actions
- **THEN** the UI SHALL use consistent icons, text, status markers, or centralized visual assets
- **AND** it SHALL NOT use emoji as functional module symbols, status symbols, or premium visual identity.

### Requirement: Workspace zones are available through AppShell
Commercial workspace zones SHALL be expressible through the shared AppShell contract when a route declares a dense workspace archetype.

#### Scenario: Mission workspace renders
- **WHEN** a Control Workbench, Arena task, simulation, or interactive runtime route uses the `mission-workspace` archetype
- **THEN** AppShell SHALL support context header, command bar, instrument area, evidence rail, support drawer, status rail, and local tool slots
- **AND** feature content SHALL not need a separate page shell to express those zones.

#### Scenario: Simulation detail route renders
- **WHEN** a `/simulations/*` detail route renders through the shared simulation shell
- **THEN** it SHALL expose route-level breadcrumbs, theme switching, personal-center access, return target metadata, and the primary simulation scene as the main instrument area
- **AND** the shell SHALL NOT compute physics state, controller state, telemetry truth, or Arena official evaluation truth.

### Requirement: Mission workspaces migrate through the unified shell
Primary mission workspaces SHALL migrate to the shared AppShell mission-workspace archetype before local shell styling is considered complete.

#### Scenario: Arena-to-workbench journey is accepted
- **WHEN** a user moves from Arena hall to challenge detail to Control Workbench
- **THEN** the route sequence SHALL preserve context, return target, task state, primary commands, instrument area, evidence/support access, and shell-level dock behavior
- **AND** the pages SHALL not present unrelated local shell systems as competing navigation.

#### Scenario: Mission workspace renders on mobile
- **WHEN** a migrated mission workspace renders at 320px width
- **THEN** secondary controls SHALL move into drawer, sheet, tab, or command surfaces
- **AND** the primary visualization or task entry SHALL remain reachable in the first usable viewport.

### Requirement: Mission migrations preserve domain truth
Mission shell migration SHALL preserve feature-owned truth for Arena, simulation, Control Workbench, and interactive runtime behavior.

#### Scenario: Workspace state is displayed
- **WHEN** official evaluation state, object selection, method availability, lesson runtime step, or evidence status appears in the mission shell
- **THEN** the owning feature domain SHALL supply that state
- **AND** shell primitives SHALL map it only to layout, accessibility, visual tone, and allowed details.

### Requirement: Report-ledger surfaces preserve evidence and export readability
Commercial report-ledger surfaces SHALL prioritize evidence review, source labels, privacy boundaries, status filtering, and export readiness.

#### Scenario: Report-ledger route or component is migrated
- **WHEN** grading, teacher report, governance snapshot, prep-pack review, assistant effect report, or export UI is migrated
- **THEN** the surface SHALL show source labels, privacy labels, review status, export actions, and key metrics in a readable hierarchy
- **AND** unavailable data SHALL be represented as honest status rather than generated-looking placeholder output.

### Requirement: Runtime overlay and effect reports fit operations/report shells
Future runtime overlay and assistant effect report capabilities SHALL use operations-console or report-ledger slots instead of standalone local shells.

#### Scenario: Overlay or effect report capability becomes available
- **WHEN** overlay preview/review/activate/archive/rollback or deterministic demo/effect report data is displayed
- **THEN** it SHALL use unified shell navigation, evidence/status semantics, privacy boundaries, and export/readiness controls
- **AND** it SHALL not mutate base runtime manifests or fabricate effect metrics in presentation code.

### Requirement: Knowledge map local panels are workspace controls
Knowledge graph chapter directories, relation filters, legends, view toggles, and node resource panels SHALL render as local workspace controls rather than platform navigation.

#### Scenario: Knowledge graph renders on desktop
- **WHEN** `/knowledge` renders at a desktop viewport
- **THEN** AppShell SHALL provide the platform route navigation and route trace
- **AND** graph-specific chapter directories and filters SHALL be visually subordinate local panels using platform tokens
- **AND** local graph panels SHALL NOT duplicate or visually compete with platform navigation.

#### Scenario: Knowledge graph renders on mobile
- **WHEN** `/knowledge` renders at 320px width
- **THEN** graph-specific directories, filters, and legends SHALL move into explicit drawer, sheet, tab, or command surfaces
- **AND** the graph canvas or primary graph task SHALL remain reachable without reading through a fixed desktop sidebar.

#### Scenario: Graph data marks need domain colors
- **WHEN** relation edges, node categories, or graph density states need color encoding
- **THEN** those colors SHALL be treated as chart or graph data marks
- **AND** shell, panel, filter, and navigation surfaces SHALL use platform semantic tokens rather than route-local raw palette values.

### Requirement: Simulation workspace panels have light and dark parity
Simulation workspace local panels, bottom toolbar, hints, and drawers SHALL define readable light and dark treatments.

#### Scenario: Local panel renders in both themes
- **WHEN** a simulation telemetry, control, evaluation, hint, or local-tool panel renders
- **THEN** it SHALL use the active simulation workspace template
- **AND** text, form controls, status markers, and focus rings SHALL remain readable in both themes.

### Requirement: Simulation workspace surfaces match handoff composition
Commercial simulation workspace surfaces SHALL demonstrate Product Design handoff composition, not only platform-token usage or `data-*` markers.

#### Scenario: Simulation local workspace is reviewed
- **WHEN** a simulation detail route changes local telemetry, controls, hints, bottom tools, or mission evidence surfaces
- **THEN** evidence SHALL show the accepted handoff relationship among scene, telemetry panel, control/evaluation panel, bottom toolbar, hint strip, and shared dock
- **AND** the review SHALL fail if the page merely wraps the existing scene in large opaque cards, repeated panels, or grid columns without the accepted immersive command-deck composition.

### Requirement: Simulation mobile command surfaces preserve task access
Simulation mobile layouts SHALL translate secondary controls into reachable command surfaces without squeezing desktop side rails into the viewport.

#### Scenario: 320px simulation evidence is reviewed
- **WHEN** a simulation detail route is captured at 320px width
- **THEN** the primary scene or instrument area SHALL remain visible before secondary-control overflow
- **AND** telemetry, control, bottom tool, hint, and Konling surfaces SHALL remain reachable through drawer, sheet, tab, collapse, or command-surface behavior
- **AND** the layout SHALL NOT rely on permanent desktop side panels.

### Requirement: Knowledge graph follows the shared dense-workspace surface model
The knowledge graph SHALL use the shared commercial workspace model while keeping graph-specific controls local to the graph surface.

#### Scenario: Knowledge graph workspace renders in the platform shell
- **WHEN** `/knowledge` renders as a dense workspace
- **THEN** AppShell SHALL own global navigation, route trace, theme switching, user center, and floating dock placement
- **AND** knowledge-specific directory, filters, legend, layout, focus, and inspector controls SHALL remain local workspace tools.

#### Scenario: Product Design concepts are used as references
- **WHEN** implementation uses the knowledge graph Product Design concept references
- **THEN** it SHALL adopt the approved workspace organization, dark-mode tone, and light-mode clarity
- **AND** it SHALL NOT introduce a second platform shell, duplicate role switcher, duplicate assistant entry, or pixel-copy generated mockup details.

### Requirement: Interactive module visual standards fit LessonRuntimeShell
Interactive module chrome SHALL fit the LessonRuntimeShell projection, desktop, mobile, light, and dark presentation modes.

#### Scenario: Module renders in projection mode
- **WHEN** a module appears on a teacher projection page
- **THEN** typography, spacing, action placement, and panel geometry SHALL remain readable for classroom projection
- **AND** controls SHALL not reduce the main teaching content below the intended visual priority.

#### Scenario: Module visual QA runs
- **WHEN** module visual standards are accepted
- **THEN** QA evidence SHALL cite `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`
- **AND** student and guest module-state evidence SHALL cite `concepts/revised/03-student-guest-runtime.png`
- **AND** teacher-control and projection module-state evidence SHALL cite `concepts/revised/06-teacher-projection-runtime-compact-navigation.png`
- **AND** Product Design `design-qa` SHALL report `final result: passed` for representative module states.

### Requirement: Interactive course entry uses CourseEntryShell
Concrete interactive course entry routes SHALL use a unified CourseEntryShell that fits the platform commercial workspace model.

#### Scenario: User opens a concrete interactive course entry
- **WHEN** `/interactive-learning/courses/unit-*` renders
- **THEN** the page SHALL show course identity, BOPPPS structure, entry actions, resources, and knowledge-path context through a unified CourseEntryShell
- **AND** it SHALL NOT rely on `premium-lesson-*` as the primary page shell.

#### Scenario: Course entry role actions render
- **WHEN** teacher start, student join, guest/demo, or self-study actions are available
- **THEN** those actions SHALL be clearly separated by role and intent
- **AND** student or guest entry contexts SHALL NOT show teacher-only class analytics, submission overview, or evidence status.

### Requirement: CourseEntryShell follows accepted Product Design references
Course entry implementations SHALL prove visual alignment with the accepted Product Design handoff and CourseEntryShell concept.

#### Scenario: Course entry visual QA runs
- **WHEN** course entry migration is accepted
- **THEN** QA evidence SHALL cite `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`
- **AND** it SHALL cite `concepts/02-course-entry-shell.png`
- **AND** Product Design `design-qa` SHALL report `final result: passed`.

### Requirement: Teacher classroom waiting state is standardized
Interactive course teacher start flow SHALL use a standardized classroom waiting state before projection runtime begins.

#### Scenario: Teacher creates a classroom session
- **WHEN** a teacher creates or opens a classroom waiting page
- **THEN** the page SHALL show the classroom QR code, classroom code, joined student count, and `开始上课` action
- **AND** it SHALL remain visually aligned with the shared AppShell and course entry shell.

#### Scenario: Teacher starts class
- **WHEN** the teacher activates `开始上课`
- **THEN** the flow SHALL enter the teacher projection runtime
- **AND** the waiting page SHALL NOT continue to display as if projection has already started.

### Requirement: Teacher waiting page follows accepted Product Design references
Teacher classroom waiting implementation SHALL prove visual alignment with the accepted Product Design handoff and waiting-page concept.

#### Scenario: Waiting page visual QA runs
- **WHEN** the waiting page is accepted
- **THEN** QA evidence SHALL cite `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`
- **AND** it SHALL cite `concepts/revised/02-teacher-classroom-qr-waiting.png`
- **AND** Product Design `design-qa` SHALL report `final result: passed`.

### Requirement: Interactive lessons use a unified LessonRuntimeShell
Interactive lesson runtime routes SHALL use a unified LessonRuntimeShell for student, guest/demo, teacher projection, and invalid-session states.

#### Scenario: Student or guest runtime renders
- **WHEN** a student or guest/demo lesson runtime opens
- **THEN** the shell SHALL prioritize the current lesson content, answer affordance where allowed, feedback, and progress
- **AND** it SHALL NOT show teacher-only submission overview, evidence status, class analytics, or teacher controls.

#### Scenario: Teacher projection runtime renders
- **WHEN** a teacher projection lesson runtime opens
- **THEN** teaching content, diagrams, question stems, and interaction modules SHALL dominate the visual hierarchy
- **AND** student answer input boxes SHALL NOT render
- **AND** right-side tools SHALL be collapsed by default rather than a permanent drawer.

#### Scenario: Teacher runtime navigation renders
- **WHEN** teacher projection runtime navigation is shown
- **THEN** the bottom course navigation SHALL be compact and visually secondary
- **AND** it SHALL include previous/next, BOPPPS stage indicator, page count, and page-jump dropdown
- **AND** the top bar SHALL NOT duplicate the next-page action.

### Requirement: LessonRuntimeShell follows accepted Product Design references
Lesson runtime implementations SHALL prove visual alignment with the accepted Product Design handoff and runtime concepts.

#### Scenario: Runtime visual QA runs
- **WHEN** runtime shell migration is accepted
- **THEN** QA evidence SHALL cite `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`
- **AND** it SHALL cite `concepts/revised/03-student-guest-runtime.png` and `concepts/revised/06-teacher-projection-runtime-compact-navigation.png`
- **AND** Product Design `design-qa` SHALL report `final result: passed` for student/guest and teacher projection states.

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

