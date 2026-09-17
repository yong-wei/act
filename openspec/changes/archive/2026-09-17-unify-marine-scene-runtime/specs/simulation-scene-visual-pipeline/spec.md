## MODIFIED Requirements

### Requirement: Ship rides the shared scene wave field
The ship's visual-water-owned heave, pitch, and roll SHALL sample the same shared world-space wave field as the visible water, including the declared base height and near-field approximation tolerance. Each motion degree of freedom SHALL have explicit telemetry, visual-water or fixed ownership. Telemetry-owned motion MUST NOT be overwritten or receive an additional visual response on the same axis. Wave sampling remains a visual concern: the numerical model, fixed-step clock, telemetry and Arena scoring SHALL NOT consume or be altered by visual wave sampling. Quality changes SHALL NOT change the base interaction wave field.

#### Scenario: Hull follows the visible swell
- **WHEN** a swell passes under a destroyer whose heave and pitch are declared visual-water-owned
- **THEN** its visual response SHALL use the shared field and its declared design-waterline reference
- **AND** the near-field rendered water SHALL meet the declared approximation tolerance rather than forcing every point of a rigid hull to coincide with the wave surface

#### Scenario: Drive chain is unaffected by wave unification
- **WHEN** visual ship sampling is switched to the shared field
- **THEN** the numerical state and control outputs for the same inputs SHALL remain equivalent
- **AND** no TypeScript physical stepper SHALL be introduced

#### Scenario: Numerical roll remains authoritative
- **WHEN** the cruise model supplies a telemetry-owned roll angle
- **THEN** rendering SHALL display that roll without overwriting it or adding an independent roll response

#### Scenario: Quality changes preserve interaction waves
- **WHEN** a quality tier changes at fixed world inputs and time
- **THEN** the base interaction field and motion ownership SHALL remain unchanged
