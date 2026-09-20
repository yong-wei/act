# marine-sky-lighting Specification

## Purpose
TBD - created by archiving change unify-marine-sky-lighting. Update Purpose after archive.
## Requirements
### Requirement: Sky water and ship use coherent illumination
Sky, ship materials and water SHALL share the same declared environment radiance, world-space sun and exposure policy.

#### Scenario: Only the camera rotates
- **WHEN** the camera rotates while the world sun and scene are unchanged
- **THEN** lighting remains spatially consistent and reflections vary only with the physical view direction

### Requirement: Environment filtering is cached and correctly sampled
PMREM SHALL be cached and sampled using its actual format and compatible Three.js implementation; it SHALL NOT be regenerated every frame by default.

#### Scenario: An unchanged preset renders repeatedly
- **WHEN** the environment preset is unchanged
- **THEN** rendering reuses the environment resources without repeated PMREM generation

### Requirement: Sun shadows follow a bounded stable region
Directional shadow coverage SHALL be explicitly fitted to the subject region and SHALL remain stable during translation and camera motion.

#### Scenario: The ship sails away from the origin
- **WHEN** the ship and camera translate through the supported operating area
- **THEN** the relevant hull and nearby objects retain stable correctly directed shadows

### Requirement: Water is an actual consumer of shared sky radiance
The custom water material SHALL sample the declared shared environment radiance rather than substituting a constant horizon color for environment reflection.

#### Scenario: The QA environment contains a directional diagnostic feature
- **WHEN** the environment feature changes direction with world sun and water geometry fixed
- **THEN** water and ship environment reflections follow the feature consistently while the direct sun highlight remains attributable to the sun

### Requirement: Sky translation and atmospheric depth are coherent
The distant sky SHALL avoid finite-world translation parallax, and active water materials SHALL participate in the declared atmospheric depth treatment.

#### Scenario: The camera translates through the operating area
- **WHEN** the camera moves while world objects remain fixed
- **THEN** the sky remains effectively distant, nearby objects retain correct parallax, and water and ship fog remain coherent

