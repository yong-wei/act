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
