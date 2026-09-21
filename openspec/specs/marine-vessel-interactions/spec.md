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

### Requirement: Vessel foam is deposited from actual semantic sources
The active vessel rig SHALL deposit hull-contact and propulsor foam into the shared surface representation using existing read-only motion and actuator state.

#### Scenario: A vessel turns and then stops propulsion
- **WHEN** it turns after leaving a visible wake and its propulsion source then stops
- **THEN** the old wake remains on its world trajectory, new propulsion foam stops, and existing foam dissipates without rotating with the vessel

### Requirement: Effect allocations obey a hard aggregate budget
All vessel emitters SHALL share bounded allocated capacity as well as bounded live effects; reducing only each emitter's emission rate SHALL NOT establish an allocation budget.

#### Scenario: Additional propulsors are enabled
- **WHEN** the scene activates all declared propulsors at the selected quality tier
- **THEN** their aggregate allocations and active effects remain within the recorded scene budget

### Requirement: Active hull and wake consumers share surface time
Every active marine hull, wake and water-hugging overlay SHALL consume the shared visual time and explicit surface reference; a raw renderer-clock query SHALL NOT bypass an injected visual epoch.

#### Scenario: Visual time is changed independently of renderer time
- **WHEN** QA seeks or resets the visual clock while renderer elapsed time remains different
- **THEN** hull contact, water and overlay queries agree on the new surface time and stateful effects apply their declared history policy

### Requirement: Fleet mounting applies declared contact ownership
All active vessel mounts SHALL apply explicit contact references and motion ownership rather than relying on an implicit zero-height default.

#### Scenario: The cruise ship rolls on a moving surface
- **WHEN** the numerical model supplies roll and the scene supplies its declared water reference
- **THEN** the mount preserves the numerical roll and applies the appropriate waterline reference without an extra visual roll

