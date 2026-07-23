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

#### Scenario: Pipeline is reused by a second experiment without module changes
- **WHEN** the lng detail route mounts its scene through the same pipeline modules after the destroyer sample
- **THEN** the integration SHALL require only the experiment's ship profile, mounting glue, and model assets
- **AND** no scene pipeline module SHALL be edited to accommodate lng

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

### Requirement: Preset cinematic shots with damped free look
Scene cameras SHALL offer a damped free-look mode and a set of preset cinematic shots (such as chase, orbit, retreat, and top-down) with smooth transitions between shots.

#### Scenario: User activates a preset shot
- **WHEN** the user selects a preset cinematic shot
- **THEN** the camera SHALL transition smoothly to the shot framing without snapping

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
Simulation scenes SHALL provide a soundscape of ambience linked to the active environment preset plus interaction and alert sounds; the soundscape SHALL default to enabled, SHALL produce sound only after the first user gesture, and SHALL offer an in-scene mute control with persisted preference.

#### Scenario: First visit before any gesture
- **WHEN** a student opens a simulation scene without having interacted
- **THEN** no sound SHALL play until the first user gesture

#### Scenario: Student mutes the soundscape
- **WHEN** a student mutes the soundscape
- **THEN** the mute preference SHALL persist across visits

### Requirement: Quality tiers with automatic degradation
Simulation scenes SHALL support quality tiers (post-processing, particle budget, shadows, water tessellation) with a device-probed default, automatic degradation when frame time exceeds budget, and manual override; the baseline SHALL hold 1080p at 60fps on mainstream integrated GPUs.

#### Scenario: Frame time exceeds budget
- **WHEN** sustained frame time exceeds the budget on the current tier
- **THEN** the scene SHALL degrade to a lower tier automatically without losing simulation state

#### Scenario: Performance spec runs on baseline hardware profile
- **WHEN** the Playwright performance spec runs against the integrated scene
- **THEN** frame-time and particle-budget assertions SHALL pass on the probed tier

### Requirement: Progressive scene loading with compressed models
Ship model assets SHALL be re-encoded with Draco or meshopt compression in the build pipeline without changing their appearance; scene loading SHALL present water and environment first and mount the ship model with visible progress.

#### Scenario: Student opens a simulation route on a slow network
- **WHEN** a simulation detail route loads
- **THEN** the environment SHALL render before the ship model is ready
- **AND** model loading SHALL show progress instead of a text-only placeholder

### Requirement: Minimal default teaching annotations
Scene teaching annotations SHALL default to minimal: the actual path trail is visible by default, while heading arc, target course line, direction arrows, and world labels live behind a teaching-annotation toggle that defaults to off; annotation styling SHALL remain coherent with the realistic scene.

#### Scenario: Fresh scene load
- **WHEN** a simulation scene loads with default settings
- **THEN** only the actual path trail SHALL be visible
- **AND** enabling the teaching-annotation toggle SHALL reveal the remaining annotations
- **AND** task content intrinsic to an experiment (task guide route, grid, HUD) SHALL NOT be treated as teaching annotations

