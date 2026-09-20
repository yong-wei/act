## ADDED Requirements

### Requirement: Graded reflections include a working high-quality consumer
The reflection feature SHALL include the default shared environment reflection and an explicitly enabled bounded planar-reflection consumer for a suitable high-quality scene.

#### Scenario: Planar reflection is enabled in a supported calm-water shot
- **WHEN** the enabled and disabled versions are compared with the same vessel and camera
- **THEN** vessel reflection changes visibly without recursive water, teaching overlays or UI appearing in the reflection
- **AND** the report records the additional rendering cost and the disabled path releases unused resources
