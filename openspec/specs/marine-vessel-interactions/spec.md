# marine-vessel-interactions Specification

## Purpose
TBD - created by archiving change unify-marine-vessel-interactions. Update Purpose after archive.
## Requirements
### Requirement: Water contact preserves degree-of-freedom ownership
The vessel rig SHALL align declared visual-water contact references with the shared surface while preserving telemetry-owned motion.

#### Scenario: Cruise stabilization is demonstrated
- **WHEN** the numerical model supplies roll throughout a run
- **THEN** the displayed roll follows that output without visual wave motion masking the controller effect

### Requirement: Propulsor effects consume existing semantic state
Wake and propulsor wash SHALL use declared world-space emitters and available read-only speed, thrust and orientation state.

#### Scenario: A positioning platform holds position
- **WHEN** hull translation is near zero and existing thrust telemetry is nonzero
- **THEN** localized thruster wash is visible without inventing a transit wake or modifying thrust

### Requirement: Vessel effects share a scene-wide budget
All propulsor emitters SHALL share the scene effect budget rather than each receiving a full independent particle allowance.

#### Scenario: A second propulsor is active
- **WHEN** a twin-propulsor vessel runs
- **THEN** two correctly anchored wakes are visible within the declared aggregate budget

### Requirement: Hull water exclusion respects real openings
Render-only hull exclusion SHALL follow declared hull volumes and SHALL NOT remove water from genuine openings between platform structures.

#### Scenario: A semi-submersible is viewed from above
- **WHEN** the camera looks between its columns and pontoons
- **THEN** water remains visible in open regions while solid hull interiors do not show an intersecting water sheet

