## ADDED Requirements

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
