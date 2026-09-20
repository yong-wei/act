## ADDED Requirements

### Requirement: Environment layouts contain recognizable scale-correct assets
The five active layout families SHALL contain recognizable silhouettes and materials appropriate to their viewing distance rather than only geometric placeholders.

#### Scenario: A harbor is viewed near its infrastructure
- **WHEN** the camera moves past cranes, piers and navigation markers
- **THEN** their forms, scale, parallax and water contact are credible beside the active high-detail vessel

### Requirement: Environment detail changes actual rendering work
Layout detail management SHALL implement distance or projected-size LOD and suitable batching or instancing for repeated objects.

#### Scenario: The camera retreats from repeated harbor or ice objects
- **WHEN** their projected size becomes small
- **THEN** detail and rendering work decrease measurably without changing task obstacles or numerical state
