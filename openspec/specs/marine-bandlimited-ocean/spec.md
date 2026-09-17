# marine-bandlimited-ocean Specification

## Purpose
TBD - created by archiving change implement-bandlimited-marine-ocean. Update Purpose after archive.
## Requirements
### Requirement: Ocean geometry is spatially band-limited
Ocean geometry SHALL suppress unresolved wave frequencies at each mesh LOD and SHALL provide continuous boundary transitions.

#### Scenario: The camera crosses a LOD boundary
- **WHEN** mesh LOD changes during camera motion
- **THEN** the surface has no cracks and unresolved short waves do not alias into large visible waves

### Requirement: The interaction wave field is quality invariant
The base interaction wave field SHALL remain identical across quality tiers; geometry SHALL meet the declared near-field approximation tolerance.

#### Scenario: Quality is reduced
- **WHEN** high quality changes to low at a fixed world point and time
- **THEN** base wave height and visual-water pose input are unchanged and the visible interaction mesh remains within the declared tolerance

### Requirement: CPU and GPU agree on displaced surface queries
CPU queries and GPU geometry SHALL account for horizontal Gerstner displacement and use the same world phase and time.

#### Scenario: A non-vertex location is sampled
- **WHEN** the test samples displaced non-vertex world positions across the supported sea-state range
- **THEN** CPU height and actual visible GPU surface satisfy the recorded near-field tolerance

