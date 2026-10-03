## ADDED Requirements

### Requirement: Comparison routes share their visible behavior
The comparison SHALL use the same scene, visual time, vessel interaction, water optics and quality parameters for WebGL and WebGPU when the wave algorithm and inputs are unchanged. Differences SHALL be confined to GPU execution and resource adaptation, without reducing the existing WebGL feature profile.

#### Scenario: Graphics API is switched
- **WHEN** a user switches between WebGL and WebGPU at the same declared inputs
- **THEN** both routes render continuous waves, the same vessel and water datum, environment lighting, foam, reflection and shallow optics
- **AND** numerical differences remain within the declared GPU validation tolerance

### Requirement: Normal ocean animation keeps field data on the GPU
The normal animation SHALL update its wave field continuously using GPU-resident results without whole-field CPU readback, CPU mesh reconstruction or reference transforms in the frame loop.

#### Scenario: Animation runs without QA
- **WHEN** either supported graphics API renders the comparison
- **THEN** the wave field advances with the shared visual clock without a fixed half-second gate
- **AND** GPU resources and geometry are reused until their inputs change or the scene is disposed

### Requirement: Diagnostic evidence identifies the actual route
Numerical and visual diagnostics SHALL identify the actual graphics backend and measured feature consumers rather than copying desired feature flags.

#### Scenario: Native WebGPU cannot initialize
- **WHEN** the requested WebGPU device is unavailable or lost
- **THEN** the route reports the failure and does not report a WebGL fallback as a successful native route

#### Scenario: Pixel density changes
- **WHEN** the same numerical field runs at DPR 1 or 2
- **THEN** actual GPU readback agrees with an independent reference at the same time

### Requirement: FFT visual calibration has an explicit wave-height target
The comparison FFT route SHALL use a documented significant wave height rather than increasing wave amplitude to compensate for display or shading failures. Both graphics APIs SHALL consume the same spectrum and optical definition.

#### Scenario: The default moderate sea is rendered
- **WHEN** ss4 is selected with the comparison defaults
- **THEN** FFT significant wave height is 2m within 2% at the sampled validation times and supported resolutions
- **AND** the rendering uses sparse compression-driven whitecaps, while retaining the shared reflection and foam consumers
- **AND** the comparison does not claim equal significant wave height with the unchanged Gerstner control

### Requirement: Ship wakes displace the shared surface
The comparison SHALL generate ship waves from the moving vessel pressure source as a persistent GPU wave field, and SHALL apply its height and normals to the shared ocean instead of drawing Kelvin arm decals.

#### Scenario: Vessel follows a circle
- **WHEN** the default comparison runs
- **THEN** the vessel follows a prescribed circle and uses the existing tactical camera preset
- **AND** emitted waves and foam stay in world coordinates when the vessel changes heading
- **AND** low-frequency vessel contact samples include the combined visible surface

### Requirement: Breaking foam has a persistent lifecycle
Both graphics APIs SHALL share surface-breaking foam generation, accumulation, advection, diffusion and decay with a fixed-step history.

#### Scenario: Emission stops or playback changes
- **WHEN** foam sources stop
- **THEN** existing foam continues to drift and decay without following the ship
- **WHEN** playback pauses, resets or seeks
- **THEN** histories freeze, clear or deterministically rebuild with bounded per-frame work
- **AND** whole-field readback remains diagnostic-only

### Requirement: Production marine scenes share the spectral ocean
All seven vessel simulations and their active embedded consumers SHALL default to the shared FFT surface, moving-pressure ship waves and persistent foam, with vessel-specific inputs and unchanged authoritative dynamics.

#### Scenario: A vessel turns
- **WHEN** an active simulation changes vessel heading and position
- **THEN** its pressure source follows the actual vessel while previous waves and foam retain world-space history
- **AND** water contact queries consume the rendered surface rather than the replaced Gerstner field

### Requirement: Automatic graphics selection preserves feature parity
Automatic mode SHALL select WebGPU only when adapter capability and initialization satisfy the shared renderer requirements, and SHALL fall back to WebGL on unavailability or initialization failure.

#### Scenario: Native WebGPU is unavailable
- **WHEN** adapter acquisition or device initialization fails
- **THEN** the scene initializes the same FFT, wake, foam and optical implementation with WebGL and exposes its actual backend
- **AND** existing vessel controls, environment and camera remain available

### Requirement: Vessel wave detail resolves its declared local band
Vessel waves SHALL use a documented pressure distribution and speed-dependent inputs, with a visible mesh adequate for the generated wavelength band. Background FFT calibration SHALL remain unchanged, and water contact SHALL sample the combined visible surface.

#### Scenario: Steady vessel speed changes
- **WHEN** a controlled deep-water straight run changes between low, medium and high vessel speed
- **THEN** the wave pattern and source strength reflect the actual motion without a low-speed gate flattening all normal transit speeds
- **AND** local field boundaries do not wrap visible historical waves ahead of the vessel or create an overlapping plane that clips troughs

#### Scenario: Rendered contact is read asynchronously
- **WHEN** the shared sampler captures a small batch of points on the fine combined surface
- **THEN** returned heights and slopes are from that rendered triangle mesh and carry the captured surface time
- **AND** normal ocean updates continue after the GPU copy commands are submitted while the readback is pending

### Requirement: Propulsor wash consumes actual emitter identity
Active wash SHALL consume the declared or verified propulsor world position, direction and available read-only propulsion state. Visual estimates SHALL be distinguished from actual telemetry, and demonstration animation rates SHALL NOT be treated as measured propulsion state.

#### Scenario: A twin-propulsor vessel advances
- **WHEN** the vessel moves with available propulsion input
- **THEN** its local wash originates at the corresponding propulsors instead of a single generic stern center
- **AND** previous foam stays in world coordinates when the vessel turns

#### Scenario: A positioning platform uses thrust at zero translation
- **WHEN** existing thruster telemetry is active while hull translation is near zero
- **THEN** localized wash remains visible without inventing transit waves or modifying the authoritative thrust

### Requirement: Existing marine LOD loading preserves the visible scene
The shared marine loader SHALL present an authorized received ship proxy first, falling back to an available low LOD when the proxy is unavailable, and prepare requested replacements while retaining the displayed model. Asset preparation and address resolution SHALL avoid redundant consumption of the same immutable artifact. Upstream proxy wiring SHALL require explicit reception authorization.

#### Scenario: A replacement load is delayed or fails
- **WHEN** a visible vessel requests another LOD whose network, parsing or material preparation is delayed or fails
- **THEN** the current model remains visible with its transform, waterline and simulation state
- **AND** a later successful candidate replaces it only when ready to render

#### Scenario: A prepared LOD replaces an animated vessel
- **WHEN** a ready replacement is mounted within the same immutable model package
- **THEN** current animation progress, pingpong direction, clamped action state and live propulsor phase are preserved
- **AND** simulation state, camera and the declared waterline remain under their existing owners

### Requirement: Vessel foam uses shared logic and separate vessel calibration
The seven production vessel scenes and their active embedded consumers SHALL use one GPU foam implementation with explicit vessel-specific lifetime, diffusion, source, optical and waterline parameters. Parameters SHALL be identified as visual calibration rather than measured vessel physics.

#### Scenario: Vessel identity changes
- **WHEN** destroyer, cruise, LNG, container, icebreaker, dredger or drilling scenes initialize
- **THEN** each consumes its declared calibration through the shared surface host
- **AND** authoritative vessel dynamics and actual propulsor identities remain unchanged

### Requirement: Long vessel traces survive the fine wave region
Vessel traces SHALL retain world-space surface foam and lower-contrast bubble signatures beyond the fine wave region, with separate lifetimes and bounded optical contribution.

#### Scenario: The vessel leaves an emitted trace behind
- **WHEN** the vessel moves the fine field away from an old trace
- **THEN** the larger history retains that trace without a bright overlap or fine-field cutoff
- **AND** source cessation, translation, pause, reset and replay preserve the fixed-step lifecycle
- **AND** natural foam and the background wave-height calibration remain under their existing owners

### Requirement: Hull foam reflects localized waterline excitation
Hull foam SHALL follow the configured wet hull bands and available motion or wave excitation, including bow shoulders and vessel sides. It SHALL NOT create an unconditional bright hull border or change water exclusion geometry.

#### Scenario: Calm stationary hull has no excitation
- **WHEN** hull translation, ambient waves and propulsor activity are zero
- **THEN** no vessel-generated foam or bubble trace is produced

#### Scenario: A semi-submersible platform receives wave excitation
- **WHEN** the drilling platform has wave-excited hull foam
- **THEN** foam follows its separate column waterlines while openings retain water
- **AND** zero-translation thrust can still generate localized propulsor wash without transit waves
