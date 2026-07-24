## MODIFIED Requirements

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

## ADDED Requirements

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
