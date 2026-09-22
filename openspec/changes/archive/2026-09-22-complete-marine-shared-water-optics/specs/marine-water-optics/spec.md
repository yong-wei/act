## ADDED Requirements

### Requirement: Comparable ocean routes meet declared optical parity
Routes admitted to feature-parity comparison SHALL implement the same predeclared optical and interaction features rather than their currently implemented intersection.

#### Scenario: A candidate lacks environment reflection
- **WHEN** The runner requests the complete profile
- **THEN** The missing feature makes that candidate incomplete and the better implementation is not downgraded to conceal it.

### Requirement: Shallow refraction changes actual underwater appearance
The shallow-water feature SHALL use declared water depth or thickness and actual background appearance with correct occlusion.

#### Scenario: A submerged test object is viewed
- **WHEN** The runner toggles shallow refraction at fixed inputs
- **THEN** The underwater appearance changes as specified without leaking foreground objects; shifting only foam coordinates is insufficient.
