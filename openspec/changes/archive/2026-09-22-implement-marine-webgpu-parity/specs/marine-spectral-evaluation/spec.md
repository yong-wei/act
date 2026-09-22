## ADDED Requirements

### Requirement: The WebGPU candidate executes a complete native route
The WebGPU candidate SHALL execute its FFT on a verified WebGPU device and implement the declared feature profile; a WebGL fallback SHALL be identified as such.

#### Scenario: Native GPU evaluation runs
- **WHEN** The host provides a usable WebGPU device
- **THEN** Both WebGPU FFT and the Gerstner control render the real scene and satisfy the parity profile.

### Requirement: Backend and algorithm effects have separate controls
Comparison SHALL include Gerstner and FFT on both declared rendering backends and SHALL separate algorithm changes from renderer changes.

#### Scenario: A WebGPU improvement is reported
- **WHEN** The runner compares full-route cost
- **THEN** Same-algorithm backend controls and same-backend algorithm controls are available with actual feature identities.
