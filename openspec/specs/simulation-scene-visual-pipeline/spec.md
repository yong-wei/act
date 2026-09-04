# simulation-scene-visual-pipeline Specification

## Purpose
TBD - created by archiving change upgrade-simulation-scene-visual-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Simulation scenes share one visual pipeline
Simulation detail scenes SHALL mount a shared scene visual pipeline (water, wake, environment, camera, audio, quality, annotations, post-processing) whose modules are parameterized by ship profile and contain no experiment-specific hardcoding.

#### Scenario: Pipeline module is consumed by an experiment
- **WHEN** a simulation detail route mounts its scene through the pipeline
- **THEN** the scene modules SHALL resolve their parameters from that experiment's ship profile
- **AND** no pipeline module SHALL reference an experiment id, route, or profile directly in its implementation

#### Scenario: Pipeline is reused by a seventh experiment without module changes
- **WHEN** the dredger detail route mounts its scene through the same pipeline modules after destroyer, lng, container, cruise, drilling, and icebreaker
- **THEN** the integration SHALL require only the experiment's ship profile, mounting glue, and model assets
- **AND** no scene pipeline module SHALL be edited to accommodate dredger

#### Scenario: Cruise scene geometry matches the other simulations
- **WHEN** the cruise detail route is rendered at the same viewport as another pipeline-mounted simulation route
- **THEN** its scene container bounding box SHALL match the other route's within a 2px tolerance
- **AND** structured page slots (context strip, evidence rail, support drawer, command bar) SHALL render after the scene frame without altering its layout

#### Scenario: New visual capability is added
- **WHEN** a scene visual capability is introduced or upgraded
- **THEN** it SHALL land in the shared pipeline modules rather than inside a single experiment component

### Requirement: Scene visual acceptance anchors on the reference game
Scene visual quality SHALL be accepted against the single reference anchor: the realistic ocean, ship, and wake rendering of World of Warships; pipeline feature checklists and performance numbers SHALL serve the anchor rather than act as parallel acceptance items.

#### Scenario: Visual QA evidence is reviewed
- **WHEN** visual acceptance evidence for a simulation scene is reviewed
- **THEN** the evidence SHALL include screenshot matrices compared against the reference anchor
- **AND** acceptance SHALL NOT be declared from feature checklists or performance metrics alone

### Requirement: Visual pipeline preserves the simulation drive chain
The visual pipeline SHALL NOT alter the simulation drive chain: fixed-step `SimulationClock` scheduling, engine facade and factory, Rust/WASM model stepping, controller algorithms, disturbance models, telemetry semantics, and Arena scoring SHALL remain unchanged; no new TypeScript physics stepper or integrator SHALL be introduced.

#### Scenario: Drive chain is inspected after visual integration
- **WHEN** a simulation experiment is integrated with the visual pipeline
- **THEN** the diff of drive-chain files SHALL be empty of semantic changes
- **AND** visual frame progression SHALL remain decoupled from the fixed-step simulation dt

### Requirement: Camera stays where the user leaves it
Scene cameras SHALL NOT pull back, reset, or re-lock without an explicit user action: after a drag ends the view SHALL stay put; per-view orbit offsets SHALL persist across camera mode switches, including free-to-preset transitions; the camera target SHALL NOT be force-locked to the ship, with follow translation preserving the user's relative framing.

#### Scenario: User drags and releases in a preset view
- **WHEN** the user orbits in a preset camera view and releases the pointer
- **THEN** the camera SHALL remain at the released framing except for ship-following translation

#### Scenario: User switches between free and preset views
- **WHEN** the user customizes a preset view, switches to free view, and switches back
- **THEN** the previously customized offset SHALL be restored instead of reset to the preset default

#### Scenario: View interaction model is uniform
- **WHEN** the user interacts with any pipeline-mounted simulation scene
- **THEN** left-drag SHALL adjust the viewing offset around the ship center with the released angle preserved and ship-following maintained
- **AND** right-drag SHALL enter free view which is not ship-centered
- **AND** clicking a view button SHALL lock that view mode

### Requirement: Preset cinematic shots with damped free look
Scene cameras SHALL offer a damped free-look mode and a set of preset cinematic shots — chase (directly astern at 45° elevation), tactical (right-rear 45° azimuth at 45° elevation), orbit (automatic circular motion at 45° elevation, 60s per revolution clockwise seen from above), and top-down — selected through a single view popover button that displays only the current view, with smooth transitions between shots.

#### Scenario: User activates a preset shot
- **WHEN** the user selects a preset cinematic shot from the view popover
- **THEN** the camera SHALL transition smoothly to the shot framing without snapping

#### Scenario: User re-selects the active view
- **WHEN** the user clicks the currently active view again after customizing the framing
- **THEN** the camera SHALL reset to that view's standard framing

#### Scenario: Orbit auto-rotation pauses on drag
- **WHEN** the user left-drags while the orbit shot is auto-rotating
- **THEN** the rotation SHALL pause and the released framing SHALL persist except for ship-following translation

### Requirement: Manual environment presets decoupled from platform theme
Simulation scenes SHALL provide a manual environment preset switcher (open sea, dawn haze, warm sunset, overcast, storm blue) sharing the same environment language as the course video system; the scene body SHALL NOT change with platform light/dark theme, while panels, HUD, grid, and labels SHALL remain theme-aware.

#### Scenario: Student switches environment preset
- **WHEN** a student selects a different environment preset in a simulation scene
- **THEN** sky, water, fog, and lighting SHALL update to that preset without altering simulation state

#### Scenario: Platform theme is switched
- **WHEN** the platform light/dark theme is switched on a simulation detail route
- **THEN** the scene body SHALL keep its selected environment preset
- **AND** panels and chrome elements SHALL update to the theme

### Requirement: Soundscape linked to environment presets
Simulation scenes SHALL provide a soundscape of ambience linked to the active environment preset plus alert sounds (scene channel) and interaction click sounds (UI channel); the two channels SHALL be independently switchable from a single sound popover button, SHALL default to off for new users, SHALL persist per-channel preference in localStorage, SHALL produce sound only after the first user gesture, and SHALL use a distinct sound for the start action versus regular clicks.

#### Scenario: First visit before any gesture
- **WHEN** a student opens a simulation scene without having interacted
- **THEN** no sound SHALL play until the first user gesture
- **AND** both channels SHALL default to off for a new user

#### Scenario: Student toggles one sound channel
- **WHEN** a student toggles the scene or UI channel in the sound popover
- **THEN** only that channel SHALL change state
- **AND** the per-channel preference SHALL persist across visits

#### Scenario: Start action sounds distinct
- **WHEN** the UI channel is enabled and the student clicks the start button
- **THEN** the start action SHALL play a sound distinct from regular button clicks

### Requirement: Quality tiers with automatic degradation
Simulation scenes SHALL support quality tiers (post-processing, particle budget, shadows, water tessellation) with a device-probed default, automatic degradation when frame time exceeds budget, and manual override; the baseline SHALL hold 1080p at 60fps on mainstream integrated GPUs.

#### Scenario: Frame time exceeds budget
- **WHEN** sustained frame time exceeds the budget on the current tier
- **THEN** the scene SHALL degrade to a lower tier automatically without losing simulation state

#### Scenario: Performance spec runs on baseline hardware profile
- **WHEN** the Playwright performance spec runs against the integrated scene
- **THEN** frame-time and particle-budget assertions SHALL pass on the probed tier

### Requirement: Progressive scene loading with compressed models
Ship model assets SHALL be re-encoded with Draco or meshopt compression in the build pipeline without changing their appearance; scene loading SHALL present water and environment first and mount the ship model with visible progress. When a registered versioned model package provides multiple ship LOD roles, the active quality tier SHALL select the corresponding LOD through the shared scene pipeline, and payload, demo, or collision roles SHALL load only for an explicit consumer.

#### Scenario: Student opens a simulation route on a slow network
- **WHEN** a simulation detail route loads
- **THEN** the environment SHALL render before the ship model is ready
- **AND** model loading SHALL show progress instead of a text-only placeholder

#### Scenario: Quality tier selects a versioned ship LOD
- **WHEN** a registered model package is active and the quality tier is high, medium, or low
- **THEN** the shared loader SHALL select ship LOD0, LOD1, or LOD2 respectively
- **AND** the selection SHALL NOT eagerly load payload, demo, or collision roles

#### Scenario: Automatic quality degradation changes LOD
- **WHEN** sustained frame time causes the scene to degrade to a lower quality tier
- **THEN** the loader SHALL replace only the ship LOD after the lower asset is ready
- **AND** simulation state, ship world transform, camera state, and progress SHALL remain unchanged

### Requirement: Minimal default teaching annotations
Scene teaching annotations SHALL default to minimal: the actual path trail is visible by default, while heading arc, target course line, direction arrows, and world labels live behind a teaching-annotation toggle that defaults to off; annotation styling SHALL remain coherent with the realistic scene.

#### Scenario: Fresh scene load
- **WHEN** a simulation scene loads with default settings
- **THEN** only the actual path trail SHALL be visible
- **AND** enabling the teaching-annotation toggle SHALL reveal the remaining annotations
- **AND** task content intrinsic to an experiment (task guide route, grid, HUD) SHALL NOT be treated as teaching annotations

### Requirement: Bottom chrome family shares one popover button form
Simulation scene bottom chrome (view, environment preset, quality tier, simulation rate, sound, annotations) SHALL be presented as one single row of icon-plus-two-character-label buttons that expand upward on click, display only the current state when collapsed, and collapse again on re-click or selection; the grid toggle and the teaching-annotations toggle SHALL be merged into one annotations popover control with two independent switch rows; every family button SHALL expose a tooltip (via the shared tooltip dependency) describing its function and current state; the inert local-tool placeholder command strip SHALL NOT be rendered; the hint strip SHALL offer a close button and SHALL reappear on every scene entry.

#### Scenario: Student opens a chrome popover button
- **WHEN** a student clicks any of the view/environment/quality/rate/sound buttons
- **THEN** the control SHALL expand upward with its options
- **AND** after selection or re-click it SHALL collapse showing only the current state

#### Scenario: Family button tooltip shows function and state
- **WHEN** a student hovers any bottom chrome family button
- **THEN** a tooltip SHALL describe the button's function and its current state

#### Scenario: Student dismisses the hint strip
- **WHEN** a student clicks the hint strip's close button
- **THEN** the strip SHALL close for the remainder of that page visit
- **AND** it SHALL reappear on the next scene entry

### Requirement: Scene overlays hug the water surface
Line-type scene overlays (trajectory, desired route, actual path trail) SHALL follow the animated water surface instead of a fixed horizontal plane: each vertex SHALL be lifted to the wave height at its world position plus a small epsilon using the same CPU wave sampling as the wake module, with reduced sampling on lower quality tiers; line overlays SHALL NOT be submerged by rising swells.

#### Scenario: Swell rises above the default plane
- **WHEN** the wave height at a trajectory vertex exceeds the line's fixed reference height
- **THEN** the line vertex SHALL be lifted to follow the water surface instead of being submerged

### Requirement: Simulation docks size to their content
Simulation dock panels (status and control rails) SHALL size their height to their content on desktop instead of stretching to a fixed bottom offset, with content overflow scrolling within a capped max height; dock cards SHALL fill the panel width uniformly across all pipeline-mounted simulations.

#### Scenario: Dock content is shorter than the viewport span
- **WHEN** a simulation dock's content height is less than the available vertical span on desktop
- **THEN** the dock SHALL shrink to its content height without leaving empty panel space
- **AND** its cards SHALL occupy the full inner width of the panel

### Requirement: Versioned model integration preserves the simulation drive chain
The shared scene pipeline SHALL treat model-package selection, coordinate adaptation, LOD changes, and animation bindings as visual concerns. They MUST NOT change `SimulationClock`, Rust/WASM stepping, controller behavior, disturbance semantics, telemetry, or Arena scoring.

#### Scenario: Type 055 candidate is enabled
- **WHEN** the versioned Type 055 model package is mounted in the destroyer simulation
- **THEN** the numerical state and control outputs for the same inputs SHALL remain equivalent to the existing model path
- **AND** only visual model loading, transforms, animation, and rendering behavior SHALL differ

### Requirement: Versioned model fallback is handled by the shared loader
The shared loader SHALL retain the current model until a selected LOD is ready and SHALL use the existing ordered destroyer candidates when the versioned candidate fails. Experiment-specific scene code MUST NOT implement a second independent retry state machine.

#### Scenario: Selected LOD fails after a working model is visible
- **WHEN** the requested replacement LOD fails integrity, parsing, or interface validation
- **THEN** the currently visible model SHALL remain mounted
- **AND** the shared loader SHALL report the failure and continue through the declared fallback policy

### Requirement: Camera re-anchors when the default camera object is replaced

The shared camera controller SHALL detect when the store's default camera object identity changes after the controller has initialized, and SHALL re-anchor once to the active preset view's framing (including any captured user offset for that view) on the replacement camera. A camera identity change MUST NOT leave the camera stranded at the replacement camera's construction position.

#### Scenario: Default camera is replaced during initial load
- **WHEN** a ship model load suspends long enough that the `makeDefault` camera replaces the store camera after the controller's first frame
- **THEN** the controller SHALL re-anchor the replacement camera to the active preset view's framing
- **AND** the ship SHALL be visibly framed once the model finishes loading

#### Scenario: Camera identity is stable during a session
- **WHEN** no camera identity change occurs after initialization
- **THEN** the controller SHALL preserve existing stay-put, user-offset, and follow-translation semantics without any extra re-anchoring

### Requirement: Model scene cloning preserves skinned bindings

Scene code that clones a loaded model scene containing skinned meshes SHALL use skeleton-aware cloning (three.js `SkeletonUtils.clone` or equivalent) so that bone bindings remain valid in the cloned tree. Plain `Object3D.clone(true)` MUST NOT be used for scenes containing skins.

#### Scenario: Ship model with rigged parts is cloned for mounting
- **WHEN** the destroyer scene or QA assembly clones the ship GLB scene containing hangar door and flag skins
- **THEN** every cloned skinned mesh SHALL reference bones inside the cloned tree
- **AND** the rigged parts SHALL render in their bind or animated pose instead of collapsing or disappearing

### Requirement: Model QA pages frame the complete model

Candidate QA and acceptance pages that mount a versioned model package SHALL configure a camera whose framing covers the model's full bounding box on first frame, either through explicit camera placement or fit-to-bounds logic.

#### Scenario: QA page first frame
- **WHEN** the candidate QA page finishes loading the ship LOD
- **THEN** the complete ship SHALL be visible in the first frame
- **AND** the page SHALL expose the evidence hooks required for automated visual verification

