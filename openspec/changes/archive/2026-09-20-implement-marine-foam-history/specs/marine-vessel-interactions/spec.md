## ADDED Requirements

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
