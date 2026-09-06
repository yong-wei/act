# simulation-scene-visual-pipeline Delta

## ADDED Requirements

### Requirement: Ship rides the shared scene wave field
The ship's visual heave, pitch, and roll SHALL sample the same CPU wave field as the visible water surface (shared Gerstner sampling including its base height), so the hull rides the waves the user sees. An independent or approximate wave field MUST NOT drive ship pose. Wave sampling remains a visual concern: the numerical model, fixed-step clock, and telemetry SHALL NOT consume or be altered by wave sampling.

#### Scenario: Hull follows the visible swell
- **WHEN** a Gerstner swell passes under the destroyer
- **THEN** the hull SHALL heave and pitch with the same sampled heights that shape the visible water surface at those positions
- **AND** the declared design waterline SHALL stay on the moving water surface rather than a fixed offset above or below it

#### Scenario: Drive chain is unaffected by wave unification
- **WHEN** the ship wave sampling is switched to the shared field
- **THEN** the numerical state and control outputs for the same inputs SHALL remain equivalent
- **AND** no TypeScript physics stepper SHALL be introduced

### Requirement: Wake trails anchor to semantic propulsor nodes
For ships whose active model package declares propulsor nodes, the wake rig SHALL mount one wake trail per propulsor and resolve each trail's emitter anchor from the propulsor node's world position every frame. Hand-placed profile wake anchors SHALL remain the behavior for models without propulsor declarations.

#### Scenario: Twin wakes track the propellers
- **WHEN** the destroyer simulation runs with a twin-propulsor declaration
- **THEN** two wake trails SHALL originate at the port and starboard propeller positions
- **AND** the emitters SHALL follow the propeller nodes through heading changes and wave motion

#### Scenario: Legacy single-stern wake is preserved
- **WHEN** the active model has no propulsor declaration
- **THEN** the single stern wake trail with profile anchors SHALL render unchanged

### Requirement: Model animation bindings are declarative and layered
Simulation-linked model animation SHALL be driven from the model package's declared semantic bindings in three layers: L0 always-on bindings (propeller spin, rudder angle, flag, radar, antenna lean) consume read-only telemetry; L1 attainment-triggered patrol loops play ship-internal weapon clips after the experiment's declared success criteria are met; L2 attainment-triggered demonstrations play one randomly selected weapon-demo clip per attainment, with the demo GLB loaded on demand as an explicit consumer. Animation wiring MUST NOT alter simulation state, scoring, telemetry, or the drive chain.

#### Scenario: L0 bindings are active from model mount
- **WHEN** the destroyer simulation mounts the versioned model
- **THEN** propeller, rudder, flag, radar, and antenna bindings SHALL be live without any user action
- **AND** their inputs SHALL be read-only telemetry views

#### Scenario: Attainment triggers the easter egg layers
- **WHEN** the running task's declared success criteria are met
- **THEN** the L1 weapon patrol loop SHALL start using only ship-internal clips
- **AND** one randomly selected weapon-demo clip SHALL play, with the demo GLB requested only at that moment

#### Scenario: First screen does not load the demo role
- **WHEN** a student opens the destroyer simulation without having attained the success criteria
- **THEN** the request ledger SHALL NOT contain the weapon-demo GLB
- **AND** no weapon patrol animation SHALL run
